'use strict';

// Adapted from jakalnz/pta-simulator js/ui-controls.js, de-modularized.
// Reuses wireUi's DOM wiring, display-bar refresh, and sound/hints toggles
// as-is. Two changes from the source:
//   1. No audiogram chart in this step (per brief) — refreshChart() and the
//      chart-view/canvas wiring are dropped; a plain stored-points list
//      stands in so Store/No-Response/Delete still have visible feedback.
//   2. presentTone()'s pass/fail no longer comes from the engine itself.
//      startPresenting() now calls engine.presentTone() to get the physics
//      (cochlea levels + overmasked flag), hands that to the caller-supplied
//      `resolveResponse(physics)` — which runs childModel.js's
//      resolveTrial() per ear — and reports the result back to
//      engine.recordResponse() so hysteresis/plateau bookkeeping still
//      happens in the same place it always did.
(function () {
  const { formatDb, formatFreq, OTHER_EAR } = window.PtaUtils;
  const { isMaskingRequired } = window.MaskingLogic;
  const { createTonePlayer } = window.TonePlayer;
  const { createNoisePlayer } = window.NoisePlayer;

  const RESPONSE_LIGHT_MS = 900;

  function wireUi({ engine, patientModel, dom, resolveResponse }) {
    let soundOn = true;
    let hintsOn = true;
    let examLocked = false;
    let isPresenting = false;
    const tonePlayer = createTonePlayer();
    const noisePlayer = createNoisePlayer();

    // Masking noise is continuous while Masking is on (independent of tone
    // presentation) and follows frequency changes, matching real audiometric
    // practice. Idempotent so it can be called from any state-change handler.
    function syncMaskingNoise(s) {
      if (soundOn && s.maskingOn) {
        if (noisePlayer.isPlaying()) {
          noisePlayer.retune(s.freq);
        } else {
          noisePlayer.start(s.freq);
        }
      } else if (noisePlayer.isPlaying()) {
        noisePlayer.stop();
      }
    }

    function cap(s) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function refreshSoundStatus() {
      const upLouder = engine.getState().toggleDirection === 'up-louder';
      dom.soundStatusFlag.textContent = `Sound: ${soundOn ? 'ON' : 'OFF'} · Up=${upLouder ? 'Louder' : 'Quieter'}`;
    }

    function refreshDisplayBar() {
      const s = engine.getState();
      dom.stimulusLevel.textContent = formatDb(s.presentedLevel);
      dom.freqReadout.textContent = formatFreq(s.freq);
      dom.freqHintReadout.textContent = formatFreq(s.freq);
      dom.maskingLevel.textContent = `[ ${formatDb(s.maskingLevel)} ]`;
      const transducerLabel = s.transducer === 'insertphone' ? 'Insert' : 'Headphone';
      const maskingStateLabel = s.maskingOn ? 'ON' : 'OFF';
      const stimulusRouteLabel = s.testMode === 'BC' ? 'Bone' : transducerLabel;
      dom.stimulusLabel.textContent = `Stimulus Tone - ${stimulusRouteLabel} - ${cap(s.testEar)}`;
      dom.maskingLabel.textContent = `NBN - ${transducerLabel} - ${cap(OTHER_EAR[s.testEar])} - ${maskingStateLabel}`;

      const testIsRight = s.testEar === 'right';
      dom.stimulusPanel.classList.toggle('channel-red', testIsRight);
      dom.stimulusPanel.classList.toggle('channel-blue', !testIsRight);
      dom.maskingPanel.classList.toggle('channel-red', !testIsRight);
      dom.maskingPanel.classList.toggle('channel-blue', testIsRight);
      dom.maskingPanel.classList.toggle('channel-dim', !s.maskingOn);

      dom.earButtons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.ear === s.testEar)));
      dom.modeButtons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.mode === s.testMode)));
      dom.transducerButtons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.transducer === s.transducer)));
      dom.transducerSwitch.textContent = transducerLabel;
      dom.transducerSwitch.setAttribute('aria-pressed', String(s.transducer === 'insertphone'));
      dom.maskOnBtn.setAttribute('aria-pressed', String(s.maskingOn));
      dom.maskOffBtn.setAttribute('aria-pressed', String(!s.maskingOn));

      const upIsLouder = s.toggleDirection === 'up-louder';
      dom.directionSwitch.textContent = upIsLouder ? 'Up = Louder' : 'Up = Quieter';
      dom.directionSwitch.setAttribute('aria-pressed', String(upIsLouder));

      const required = isMaskingRequired({
        testEar: s.testEar,
        testMode: s.testMode,
        freq: s.freq,
        presentedLevel: s.presentedLevel,
        transducer: s.transducer,
        patientModel,
      });
      dom.maskingRequiredFlag.classList.toggle('active', hintsOn && required);

      refreshVisualPanel();
      refreshSoundStatus();
      syncMaskingNoise(s);
    }

    function formatVisualLevel(v) {
      return v === null || v === undefined ? '—' : formatDb(v);
    }

    function refreshVisualPanel() {
      if (!hintsOn) {
        ['right', 'left'].forEach((ear) => {
          dom.visual[ear].tone.textContent = '—';
          dom.visual[ear].masker.textContent = '—';
          dom.visual[ear].threshold.textContent = '—';
          dom.visual[ear].response.textContent = '—';
          dom.visual[ear].last.textContent = '—';
        });
        return;
      }
      const v = engine.getVisualState();
      ['right', 'left'].forEach((ear) => {
        dom.visual[ear].tone.textContent = formatVisualLevel(v[ear].toneLevel);
        dom.visual[ear].masker.textContent = formatVisualLevel(v[ear].maskerLevel);
        dom.visual[ear].threshold.textContent = formatVisualLevel(v[ear].threshold);
        dom.visual[ear].response.textContent = v[ear].responded === null || v[ear].responded === undefined
          ? '—'
          : (v[ear].responded ? 'Heard' : 'No response');
        dom.visual[ear].last.textContent = formatVisualLevel(v[ear].lastLevel);
      });
    }

    function refreshStoredPointsList() {
      if (!dom.storedPointsList) return;
      const points = engine.getStoredPoints();
      dom.storedPointsList.textContent = points
        .map((p) => `${cap(p.ear)} ${p.mode}${p.masked ? ' (masked)' : ''} ${formatFreq(p.freq)}: ${p.noResponse ? 'NR' : formatDb(p.level)}`)
        .join('\n');
    }

    let responseLightTimer = null;

    function clearResponseLight() {
      if (responseLightTimer) {
        clearTimeout(responseLightTimer);
        responseLightTimer = null;
      }
      dom.freqPanel.classList.remove('responded');
    }

    function flashResponseLight() {
      clearResponseLight();
      dom.freqPanel.classList.add('responded');
      responseLightTimer = setTimeout(() => {
        dom.freqPanel.classList.remove('responded');
        responseLightTimer = null;
      }, RESPONSE_LIGHT_MS);
    }

    // Press-and-hold, mirroring the source simulator's Present Tone button —
    // the tone plays for exactly as long as the button/spacebar is held.
    function startPresenting() {
      if (isPresenting) return null;
      isPresenting = true;
      const s = engine.getState();
      dom.presentBtn.classList.add('presenting');
      if (soundOn) {
        tonePlayer.start(s.freq);
      }

      const physics = engine.presentTone();
      const { testResponded, contraResponded } = resolveResponse(physics, s);
      const { heard } = engine.recordResponse({ testResponded, contraResponded });
      if (heard) {
        flashResponseLight();
      } else {
        clearResponseLight();
      }
      return { physics, testResponded, contraResponded, heard };
    }

    function stopPresenting() {
      if (!isPresenting) return;
      isPresenting = false;
      dom.presentBtn.classList.remove('presenting');
      tonePlayer.stop();
    }

    dom.earButtons.forEach((btn) => btn.addEventListener('click', () => { clearResponseLight(); engine.setTestEar(btn.dataset.ear); }));
    dom.modeButtons.forEach((btn) => btn.addEventListener('click', () => { clearResponseLight(); engine.setTestMode(btn.dataset.mode); }));
    dom.transducerButtons.forEach((btn) => btn.addEventListener('click', () => { clearResponseLight(); engine.setTransducer(btn.dataset.transducer); }));
    dom.transducerSwitch.addEventListener('click', () => {
      clearResponseLight();
      const next = engine.getState().transducer === 'insertphone' ? 'headphone' : 'insertphone';
      engine.setTransducer(next);
    });
    dom.directionSwitch.addEventListener('click', () => {
      const next = engine.getState().toggleDirection === 'up-louder' ? 'up-quieter' : 'up-louder';
      engine.setToggleDirection(next);
    });
    dom.maskOnBtn.addEventListener('click', () => {
      clearResponseLight();
      if (!engine.getState().maskingOn) engine.toggleMasking();
    });
    dom.maskOffBtn.addEventListener('click', () => {
      clearResponseLight();
      if (engine.getState().maskingOn) engine.toggleMasking();
    });
    dom.levelUpBtn.addEventListener('click', () => { clearResponseLight(); engine.adjustPresentedLevel(1); });
    dom.levelDownBtn.addEventListener('click', () => { clearResponseLight(); engine.adjustPresentedLevel(-1); });
    dom.freqPrevBtn.addEventListener('click', () => { clearResponseLight(); engine.stepFrequency(-1); });
    dom.freqNextBtn.addEventListener('click', () => { clearResponseLight(); engine.stepFrequency(1); });
    dom.maskUpBtn.addEventListener('click', () => { clearResponseLight(); engine.adjustMaskingLevel(5); });
    dom.maskDownBtn.addEventListener('click', () => { clearResponseLight(); engine.adjustMaskingLevel(-5); });

    // No-response and Store are both clinician decisions made after one or
    // more presentations, not automatic consequences of the simulated
    // patient's last response.
    function markNoResponse() {
      engine.storeThreshold(true);
      clearResponseLight();
      refreshStoredPointsList();
    }
    function storeThreshold() {
      engine.storeThreshold(false);
      refreshStoredPointsList();
    }
    function deletePoint() {
      engine.deleteStoredPoint();
      clearResponseLight();
      refreshStoredPointsList();
    }
    dom.noResponseBtn.addEventListener('click', markNoResponse);
    dom.storeBtn.addEventListener('click', storeThreshold);
    dom.deletePointBtn?.addEventListener('click', deletePoint);

    function onActivate(el, handler) {
      el.addEventListener('click', handler);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    }
    onActivate(dom.stimulusPanel, storeThreshold);
    onActivate(dom.maskingPanel, markNoResponse);

    dom.presentBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); startPresenting(); });
    dom.presentBtn.addEventListener('pointerup', stopPresenting);
    dom.presentBtn.addEventListener('pointerleave', stopPresenting);
    dom.presentBtn.addEventListener('pointercancel', stopPresenting);
    dom.presentBtn.addEventListener('contextmenu', (e) => e.preventDefault());

    dom.soundSwitch.addEventListener('click', () => {
      soundOn = !soundOn;
      dom.soundSwitch.textContent = soundOn ? 'Tone: On' : 'Tone: Off';
      dom.soundSwitch.setAttribute('aria-pressed', String(soundOn));
      refreshSoundStatus();
      syncMaskingNoise(engine.getState());
    });

    function refreshHintsStatus() {
      dom.hintsStatusFlag.textContent = examLocked
        ? 'Hints: DISABLED'
        : `Hints: ${hintsOn ? 'ON' : 'OFF'}`;
    }

    function setHints(on) {
      hintsOn = on;
      dom.hintsSwitch.textContent = hintsOn ? 'Hints: On' : 'Hints: Off';
      dom.hintsSwitch.setAttribute('aria-pressed', String(hintsOn));
      refreshHintsStatus();
      refreshDisplayBar();
    }

    dom.hintsSwitch.addEventListener('click', () => {
      if (examLocked) return;
      setHints(!hintsOn);
    });

    function setExamMode(locked) {
      examLocked = locked;
      dom.hintsSwitch.disabled = locked;
      if (dom.visualDetails) dom.visualDetails.hidden = locked;
      if (locked) setHints(false);
      refreshHintsStatus();
    }

    setHints(hintsOn);
    engine.onChange(refreshDisplayBar);
    refreshDisplayBar();
    refreshStoredPointsList();

    return { refreshDisplayBar, refreshStoredPointsList, startPresenting, stopPresenting, setExamMode };
  }

  const UiControls = { wireUi };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UiControls;
  }
  if (typeof window !== 'undefined') {
    window.UiControls = UiControls;
  }
})();
