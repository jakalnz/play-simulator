'use strict';

// Sample case configs for the child behaviour model.
// conditioningGainRate is a small multiplier (~0.3-1.2) applied to the base
// per-trial conditioning gains in childModel.js — higher = learns faster.

// trueThreshold is per ear: { right: {freq: dB}, left: {freq: dB} }. These
// sample cases mirror the same values into both ears (symmetric loss) —
// asymmetric cases can be authored later (step 8's case-authoring screen).
const easyChild = {
  trueThreshold: {
    right: { 500: 15, 1000: 15, 2000: 20, 4000: 20 },
    left: { 500: 15, 1000: 15, 2000: 20, 4000: 20 },
  },
  startingFatigue: 0,
  startingPhase: 'conditioning',
  games: {
    cars: { baseResponseLevel: 70, conditioningGainRate: 1.1, startingConditioning: 10 },
    horses: { baseResponseLevel: 60, conditioningGainRate: 0.9, startingConditioning: 5 },
    marbles: { baseResponseLevel: 55, conditioningGainRate: 0.8, startingConditioning: 0 },
  },
};

const hardChild = {
  trueThreshold: {
    right: { 500: 35, 1000: 40, 2000: 45, 4000: 50 },
    left: { 500: 35, 1000: 40, 2000: 45, 4000: 50 },
  },
  startingFatigue: 15,
  startingPhase: 'conditioning',
  games: {
    cars: { baseResponseLevel: 35, conditioningGainRate: 0.5, startingConditioning: 0 },
    horses: { baseResponseLevel: 30, conditioningGainRate: 0.4, startingConditioning: 0 },
    marbles: { baseResponseLevel: 25, conditioningGainRate: 0.35, startingConditioning: 0 },
  },
};

const mixedChild = {
  trueThreshold: {
    right: { 500: 20, 1000: 25, 2000: 20, 4000: 30 },
    left: { 500: 20, 1000: 25, 2000: 20, 4000: 30 },
  },
  startingFatigue: 5,
  startingPhase: 'conditioning',
  games: {
    cars: { baseResponseLevel: 75, conditioningGainRate: 1.2, startingConditioning: 15 }, // strong game
    horses: { baseResponseLevel: 40, conditioningGainRate: 0.5, startingConditioning: 0 }, // weak game
    marbles: { baseResponseLevel: 20, conditioningGainRate: 0.3, startingConditioning: 0 }, // starting from scratch
  },
};

const SampleCases = { easyChild, hardChild, mixedChild };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SampleCases;
}
if (typeof window !== 'undefined') {
  window.SampleCases = SampleCases;
}
