'use strict';

// Adapted from jakalnz/pta-simulator js/audiometer-engine.js, de-modularized.
//
// Ear/mode/transducer/masking dial state, plateau tracking, and stored-point
// bookkeeping are copied largely as-is. The one deliberate change from the
// source engine: evaluateResponse() no longer decides pass/fail itself.
// It still does the physics — presented level attenuated by the test ear's
// own ipsilateral conductive loss to reach the test cochlea, separately
// attenuated by the transducer's interaural attenuation (IAA) to reach the
// contralateral cochlea, and (when masking is on) the masking noise's own
// levels at each cochlea, including whether it crosses back into the test
// cochlea loud enough to overmask it — but stops short of comparing any of
// that to a patient threshold to decide whether the simulated patient
// responds. That decision belongs to childModel.js's resolveTrial(), which
// runs on the cochlea level(s) this engine computes. Overmasking is folded
// into a single `overmasked` flag on the result: an overmasked test ear is
// treated by the caller as inaudible for that presentation regardless of
// the tone's own level there.
//
// `patientModel` here is a minimal adapter (built in trial-runner.html)
// exposing only what the physics needs: getParam(ear, 'ipsiConductive', freq),
// getCrossIAA(transducer, freq), and getThreshold(ear, mode, freq) — the last
// one used only for the masking-required hint and the overmasking check
// (both physical/hint concerns), never to decide if the tone itself is heard.
(function () {
  const { FREQUENCIES, clampLevel, OTHER_EAR, BC_MAX_LEVEL, DB_MAX } = window.PtaUtils;
  const { isMaskingRequired, createPlateauTracker } = window.MaskingLogic;

  const BC_FALLBACK_MAX = Math.max(...Object.values(BC_MAX_LEVEL));

  function maxLevelFor(mode, freq) {
    return mode === 'BC' ? (BC_MAX_LEVEL[freq] ?? BC_FALLBACK_MAX) : DB_MAX;
  }

  function createAudiometerEngine(patientModel) {
    const state = {
      testEar: 'right',
      testMode: 'AC',
      transducer: 'headphone',
      freq: 1000,
      presentedLevel: 40,
      maskingOn: false,
      maskingLevel: 0,
      toggleDirection: 'up-louder',
      lastResponse: null,
      noResponse: false,
      cochleaResponse: { right: null, left: null },
    };

    const lastCochleaLevel = { right: -10, left: -10 };
    const plateau = createPlateauTracker();
    const listeners = new Set();
    const storedPoints = [];
    let lastPhysics = null;

    function emit() {
      listeners.forEach((fn) => fn(getState()));
    }

    function onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }

    function getState() {
      return { ...state };
    }

    function setTestEar(ear) {
      state.testEar = ear;
      plateau.reset();
      emit();
    }

    function setTestMode(mode) {
      state.testMode = mode;
      state.presentedLevel = clampLevel(state.presentedLevel, maxLevelFor(mode, state.freq));
      plateau.reset();
      emit();
    }

    function setTransducer(type) {
      state.transducer = type;
      plateau.reset();
      emit();
    }

    function setToggleDirection(dir) {
      state.toggleDirection = dir;
      emit();
    }

    function clampIndex(i, len) {
      return Math.min(len - 1, Math.max(0, i));
    }

    function stepFrequency(dir) {
      const idx = FREQUENCIES.indexOf(state.freq);
      const nextIdx = clampIndex(idx + dir, FREQUENCIES.length);
      state.freq = FREQUENCIES[nextIdx];
      state.presentedLevel = clampLevel(state.presentedLevel, maxLevelFor(state.testMode, state.freq));
      plateau.reset();
      emit();
    }

    function adjustPresentedLevel(dir) {
      // dir: +1 = "up" key. toggleDirection decides whether up = louder or quieter.
      const sign = state.toggleDirection === 'up-louder' ? dir : -dir;
      state.presentedLevel = clampLevel(state.presentedLevel + sign * 5, maxLevelFor(state.testMode, state.freq));
      emit();
    }

    function toggleMasking() {
      state.maskingOn = !state.maskingOn;
      plateau.reset();
      emit();
    }

    function adjustMaskingLevel(delta) {
      state.maskingLevel = clampLevel(state.maskingLevel + delta);
      emit();
    }

    /**
     * Pure physics — presented level to cochlea levels, plus masking's
     * effect on those levels. No pass/fail decision; see file header.
     */
    function evaluateResponse() {
      const { testEar, testMode, transducer, freq, presentedLevel, maskingOn, maskingLevel } = state;
      const otherEar = OTHER_EAR[testEar];

      const cross = testMode === 'AC' ? patientModel.getCrossIAA(transducer, freq) : 0;
      const ipsiConductiveTest = testMode === 'AC' ? patientModel.getParam(testEar, 'ipsiConductive', freq) : 0;
      const ipsiConductiveOther = testMode === 'AC' ? patientModel.getParam(otherEar, 'ipsiConductive', freq) : 0;

      const testCochleaLevel = presentedLevel - ipsiConductiveTest;
      const contraCochleaLevel = presentedLevel - cross;

      const testThresholdBase = patientModel.getThreshold(testEar, testMode, freq);

      let overmasked = false;
      let maskerAtContraCochlea = null;
      let maskerCrossToTestCochlea = null;

      if (maskingOn) {
        maskerAtContraCochlea = maskingLevel - ipsiConductiveOther;
        maskerCrossToTestCochlea = testMode === 'AC' ? maskingLevel - cross : maskingLevel;
        if (maskerCrossToTestCochlea > testThresholdBase) {
          overmasked = true;
        }
      }

      const maskingNeeded = isMaskingRequired({ testEar, testMode, freq, presentedLevel, transducer, patientModel });

      return {
        freq,
        testEar,
        otherEar,
        testCochleaLevel,
        contraCochleaLevel,
        overmasked,
        maskingNeeded,
        maskerAtContraCochlea,
        maskerCrossToTestCochlea,
      };
    }

    function presentTone() {
      lastPhysics = evaluateResponse();
      return lastPhysics;
    }

    /**
     * Caller resolves testResponded/contraResponded (via childModel's
     * resolveTrial, on the cochlea levels presentTone() just returned) and
     * reports the outcome back here so the engine can update its own
     * hysteresis anchor, response lights, and plateau tracker — mirroring
     * what the source engine did internally in presentTone().
     */
    function recordResponse({ testResponded, contraResponded }) {
      if (!lastPhysics) return null;
      const heard = Boolean(testResponded) || Boolean(contraResponded);
      state.lastResponse = heard;
      state.noResponse = !heard;
      if (testResponded) lastCochleaLevel[lastPhysics.testEar] = lastPhysics.testCochleaLevel;
      if (contraResponded) lastCochleaLevel[lastPhysics.otherEar] = lastPhysics.contraCochleaLevel;
      state.cochleaResponse = {
        ...state.cochleaResponse,
        [lastPhysics.testEar]: Boolean(testResponded),
        [lastPhysics.otherEar]: Boolean(contraResponded),
      };
      if (state.maskingOn) {
        plateau.record(state.maskingLevel, heard);
      }
      emit();
      return { heard };
    }

    /**
     * One stored point per (ear, mode, freq, masked) — overwrites on each
     * store. An unmasked and a masked point can legitimately coexist at the
     * same frequency (e.g. a shadow curve next to its true masked
     * threshold); selecting a new level for the same combination replaces
     * the old symbol rather than adding a second one.
     */
    function upsertPoint(point) {
      const idx = storedPoints.findIndex((p) => p.ear === point.ear
        && p.mode === point.mode
        && p.freq === point.freq
        && p.masked === point.masked);
      if (idx >= 0) storedPoints[idx] = point;
      else storedPoints.push(point);
      return point;
    }

    /**
     * No-response is a clinician decision, not something inferred from the
     * simulated patient's last response — the clinician stores NR only after
     * judging (e.g. at max output) that the patient genuinely can't hear it.
     */
    function storeThreshold(noResponse = false) {
      const point = upsertPoint({
        ear: state.testEar,
        mode: state.testMode,
        freq: state.freq,
        level: state.presentedLevel,
        masked: state.maskingOn,
        noResponse,
      });
      emit();
      return point;
    }

    function getStoredPoints() {
      return [...storedPoints];
    }

    function deleteStoredPoint() {
      const idx = storedPoints.findIndex((p) => p.ear === state.testEar
        && p.mode === state.testMode
        && p.freq === state.freq
        && p.masked === state.maskingOn);
      if (idx >= 0) storedPoints.splice(idx, 1);
      emit();
    }

    function clearStoredPoints() {
      storedPoints.length = 0;
      emit();
    }

    function restoreStoredPoints(points) {
      storedPoints.length = 0;
      points.forEach((p) => upsertPoint(p));
      emit();
    }

    function isPlateauStable() {
      return plateau.isStable();
    }

    /**
     * Mirrors the source simulator's "Visual" foldout: for each cochlea, the
     * tone level and masker level actually arriving there at the current
     * dial settings, the patient's threshold (answer-key info, only shown
     * when hints are enabled), the hysteresis anchor from the last response,
     * and whether that cochlea responded on the last presentation.
     */
    function getVisualState() {
      const r = evaluateResponse();
      const testEar = state.testEar;
      const otherEar = OTHER_EAR[testEar];

      const perEar = { right: {}, left: {} };
      perEar[testEar] = {
        toneLevel: r.testCochleaLevel,
        maskerLevel: r.maskerCrossToTestCochlea,
        threshold: patientModel.getThreshold(testEar, state.testMode, state.freq),
        lastLevel: lastCochleaLevel[testEar],
        responded: state.cochleaResponse[testEar],
      };
      perEar[otherEar] = {
        toneLevel: r.contraCochleaLevel,
        maskerLevel: r.maskerAtContraCochlea,
        threshold: patientModel.getThreshold(otherEar, state.testMode, state.freq),
        lastLevel: lastCochleaLevel[otherEar],
        responded: state.cochleaResponse[otherEar],
      };
      return perEar;
    }

    return {
      getState,
      onChange,
      setTestEar,
      setTestMode,
      setTransducer,
      setToggleDirection,
      stepFrequency,
      adjustPresentedLevel,
      toggleMasking,
      adjustMaskingLevel,
      evaluateResponse,
      presentTone,
      recordResponse,
      storeThreshold,
      getStoredPoints,
      deleteStoredPoint,
      clearStoredPoints,
      restoreStoredPoints,
      isPlateauStable,
      getVisualState,
    };
  }

  const AudiometerEngine = { createAudiometerEngine };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudiometerEngine;
  }
  if (typeof window !== 'undefined') {
    window.AudiometerEngine = AudiometerEngine;
  }
})();
