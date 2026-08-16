'use strict';

// Copied from jakalnz/pta-simulator js/tone-player.js, de-modularized.
// Optional audible preview of the stimulus tone for the instructor's benefit
// — separate from, and has no effect on, the simulated patient's response
// logic. Plays for as long as start()..stop() is held open, mirroring a
// press-and-hold Present Stimulus button.
(function () {
  function createTonePlayer() {
    let ctx = null;
    let oscillator = null;
    let gainNode = null;

    function ensureContext() {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return ctx;
    }

    function start(freq) {
      stop();
      const audioCtx = ensureContext();
      oscillator = audioCtx.createOscillator();
      gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
    }

    function stop() {
      if (oscillator && gainNode) {
        const audioCtx = ctx;
        const stopAt = audioCtx.currentTime + 0.1;
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, stopAt);
        try {
          oscillator.stop(stopAt + 0.02);
        } catch {
          // already stopped
        }
      }
      oscillator = null;
      gainNode = null;
    }

    return { start, stop };
  }

  const TonePlayer = { createTonePlayer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TonePlayer;
  }
  if (typeof window !== 'undefined') {
    window.TonePlayer = TonePlayer;
  }
})();
