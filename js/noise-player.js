'use strict';

// Copied from jakalnz/pta-simulator js/noise-player.js, de-modularized.
// Audible narrowband masking noise, synthesised (band-pass-filtered white
// noise centred on the current frequency). Loops continuously while masking
// is switched on, independent of tone presentation (real audiometric
// masking is continuous, not tied to individual tone bursts).
(function () {
  function createNoisePlayer() {
    let ctx = null;
    let noiseBuffer = null;
    let source = null;
    let filter = null;
    let gainNode = null;

    function ensureContext() {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return ctx;
    }

    function ensureBuffer(audioCtx) {
      if (!noiseBuffer) {
        const length = audioCtx.sampleRate * 2;
        noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      }
      return noiseBuffer;
    }

    function isPlaying() {
      return Boolean(source);
    }

    function start(freq) {
      stop();
      const audioCtx = ensureContext();
      source = audioCtx.createBufferSource();
      source.buffer = ensureBuffer(audioCtx);
      source.loop = true;
      filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 1.5;
      gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.15);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      source.start();
    }

    function retune(freq) {
      if (filter) {
        filter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
      }
    }

    function stop() {
      if (source && gainNode) {
        const audioCtx = ctx;
        const stopAt = audioCtx.currentTime + 0.15;
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, stopAt);
        try {
          source.stop(stopAt + 0.02);
        } catch {
          // already stopped
        }
      }
      source = null;
      filter = null;
      gainNode = null;
    }

    return { start, stop, retune, isPlaying };
  }

  const NoisePlayer = { createNoisePlayer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NoisePlayer;
  }
  if (typeof window !== 'undefined') {
    window.NoisePlayer = NoisePlayer;
  }
})();
