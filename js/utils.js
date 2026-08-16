'use strict';

// Copied from jakalnz/pta-simulator js/utils.js, de-modularized to a plain
// global (this repo loads scripts via <script src> rather than ES modules,
// matching childModel.js/scheduler.js).
//
// FREQUENCIES is trimmed to the four octave frequencies childModel.js's
// case configs actually define thresholds for (500/1000/2000/4000 Hz) —
// the source repo's full ten-frequency set would let the dial step to a
// frequency with no trueThreshold entry.
const FREQUENCIES = [500, 1000, 2000, 4000];

const DB_MIN = -10;
const DB_MAX = 120;
const DB_STEP = 5;

// Bone conductor output ceiling per frequency — real audiometers can't
// drive BC anywhere near AC's 120dB max, and the ceiling itself varies by
// frequency. 6000/8000Hz have no entry: BC isn't offered at those
// frequencies, same as most clinical audiometers.
const BC_MAX_LEVEL = {
  250: 45,
  500: 60,
  750: 70,
  1000: 70,
  1500: 70,
  2000: 70,
  3000: 70,
  4000: 70,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampLevel(db, max = DB_MAX) {
  return clamp(roundToStep(db, DB_STEP), DB_MIN, max);
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function formatFreq(freq) {
  if (freq < 1000) return `${freq} Hz`;
  const kHz = freq / 1000;
  const label = Number.isInteger(kHz) ? kHz : kHz.toFixed(1);
  return `${label} kHz`;
}

function formatDb(db) {
  return `${db} dB`;
}

const OTHER_EAR = { left: 'right', right: 'left' };

const PtaUtils = {
  FREQUENCIES,
  DB_MIN,
  DB_MAX,
  DB_STEP,
  BC_MAX_LEVEL,
  clamp,
  clampLevel,
  roundToStep,
  formatFreq,
  formatDb,
  OTHER_EAR,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PtaUtils;
}
if (typeof window !== 'undefined') {
  window.PtaUtils = PtaUtils;
}
