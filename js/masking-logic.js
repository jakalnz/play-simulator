'use strict';

// Copied from jakalnz/pta-simulator js/masking-logic.js, de-modularized.
// Depends on PtaUtils.OTHER_EAR (js/utils.js must load first).
(function () {
  const OTHER_EAR = window.PtaUtils.OTHER_EAR;

  /**
   * Cross-hearing attenuation is a per-patient, per-frequency parameter
   * (patientModel.getCrossIAA) rather than a fixed constant. BC crosses the
   * skull at ~0dB IAA regardless of transducer.
   */
  function getEffectiveLevelAtContraCochlea(freq, presentedLevel, transducer, testMode, patientModel) {
    const attenuation = testMode === 'AC' ? patientModel.getCrossIAA(transducer, freq) : 0;
    return presentedLevel - attenuation;
  }

  const OCCLUSION_EFFECT = { 250: 15, 500: 15, 1000: 10 };

  function isMaskingRequired({ testEar, testMode, freq, presentedLevel, transducer, patientModel }) {
    const nonTestEar = OTHER_EAR[testEar];
    if (testMode === 'AC') {
      const contraLevel = getEffectiveLevelAtContraCochlea(freq, presentedLevel, transducer, 'AC', patientModel);
      return contraLevel > patientModel.getThreshold(nonTestEar, 'BC', freq);
    }
    // BC test: masking essentially always a consideration once presented level
    // could reach the non-test ear at ~0dB IAA.
    const contraLevel = getEffectiveLevelAtContraCochlea(freq, presentedLevel, transducer, 'BC', patientModel);
    return contraLevel > patientModel.getThreshold(nonTestEar, 'AC', freq);
  }

  function getOcclusionCorrection(freq, transducer) {
    if (transducer !== 'insertphone' && OCCLUSION_EFFECT[freq]) {
      return OCCLUSION_EFFECT[freq];
    }
    return 0;
  }

  function createPlateauTracker() {
    let history = [];

    function reset() {
      history = [];
    }

    function record(maskingLevel, heard) {
      history.push({ maskingLevel, heard });
      if (history.length > 6) history.shift();
    }

    function isStable() {
      if (history.length < 3) return false;
      const last3 = history.slice(-3);
      return last3.every((h) => h.heard === last3[0].heard);
    }

    function getHistory() {
      return history;
    }

    return { reset, record, isStable, getHistory };
  }

  const MaskingLogic = {
    getEffectiveLevelAtContraCochlea,
    isMaskingRequired,
    getOcclusionCorrection,
    createPlateauTracker,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MaskingLogic;
  }
  if (typeof window !== 'undefined') {
    window.MaskingLogic = MaskingLogic;
  }
})();
