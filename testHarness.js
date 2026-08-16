'use strict';

const fs = require('fs');
const { CONFIG, createChildState, switchGame, step } = require('./childModel');
const sampleCases = require('./sampleCases');

// ============================================================================
// Fake student strategies
// action(trialResult, state) -> 'reinforce' | 'reinstruct' | 'withhold'
// ============================================================================
const strategies = {
  alwaysCorrect: (trialResult) => {
    if (trialResult.outcome === 'genuine_response') return 'reinforce';
    if (trialResult.outcome === 'false_positive') return 'reinstruct';
    return 'withhold'; // no_response: nothing to reinforce
  },
  alwaysReinforceEverything: (trialResult) => {
    return trialResult.outcome === 'no_response' ? 'withhold' : 'reinforce';
  },
  random: () => {
    const actions = ['reinforce', 'reinstruct', 'withhold'];
    return actions[Math.floor(Math.random() * actions.length)];
  },
};

// ============================================================================
// Trial/stimulus generation
// ============================================================================
const FREQS = [500, 1000, 2000, 4000];

function randomStimulus(trueThreshold) {
  const freq = FREQS[Math.floor(Math.random() * FREQS.length)];
  // dB roughly centered around threshold +/- 20, occasionally clearly inaudible.
  // Batch mode has no ear/masking physics (see childModel.js's runTrial compat
  // wrapper), so it always targets the right ear's threshold.
  const threshold = trueThreshold.right[freq];
  const dB = clampDb(threshold + (Math.random() * 40 - 15));
  return { freq, dB: Math.round(dB) };
}

function clampDb(v) {
  return Math.max(-10, Math.min(100, v));
}

// ============================================================================
// Runner
// ============================================================================
function runSimulation(caseConfig, strategyName, opts = {}) {
  const numTrials = opts.numTrials || 300;
  const logEvery = opts.logEvery || 25;
  const conditioningTrials = opts.conditioningTrials || 40;
  const gameSwitchEvery = opts.gameSwitchEvery || 35;
  const csvPath = opts.csvPath || null;

  const strategyFn = strategies[strategyName];
  let state = createChildState(caseConfig);
  let activeGame = CONFIG.games[0];
  let gameIdx = 0;
  const icons = CONFIG.icons;

  const rows = [];
  console.log(`\n=== Simulation: strategy=${strategyName} ===`);
  console.log(
    'trial'.padEnd(6) +
      'phase'.padEnd(13) +
      'game'.padEnd(9) +
      'outcome'.padEnd(17) +
      'action'.padEnd(11) +
      'cond'.padEnd(7) +
      'engag'.padEnd(7) +
      'fatig'.padEnd(7) +
      'fpRatio'.padEnd(9) +
      'unconditioned'
  );

  for (let i = 1; i <= numTrials; i++) {
    if (state.phase === 'conditioning' && i > conditioningTrials) {
      state.phase = 'testing';
    }

    if (i % gameSwitchEvery === 0) {
      gameIdx = (gameIdx + 1) % CONFIG.games.length;
      activeGame = CONFIG.games[gameIdx];
      state = switchGame(state, activeGame);
    }

    const stimulus = randomStimulus(state.trueThreshold);
    const icon = icons[Math.floor(Math.random() * icons.length)];

    // Pass the strategy as a callback so step() decides the action from the
    // trial's actual resolved outcome, rather than a separate re-rolled trial.
    const { state: newState, historyEntry } = step(state, stimulus, activeGame, strategyFn, icon);
    state = newState;
    rows.push(historyEntry);

    if (i % logEvery === 0 || i === numTrials) {
      console.log(
        String(historyEntry.trial).padEnd(6) +
          String(historyEntry.phase).padEnd(13) +
          String(historyEntry.activeGame).padEnd(9) +
          String(historyEntry.outcome).padEnd(17) +
          String(historyEntry.action || '-').padEnd(11) +
          historyEntry.conditioningLevel.toFixed(1).padEnd(7) +
          historyEntry.engagementLevel.toFixed(1).padEnd(7) +
          historyEntry.fatigueLevel.toFixed(1).padEnd(7) +
          historyEntry.falsePositiveRatio.toFixed(2).padEnd(9) +
          String(historyEntry.isUnconditioned)
      );
    }
  }

  if (csvPath) {
    writeCsv(csvPath, rows);
    console.log(`CSV written to ${csvPath}`);
  }

  return state;
}

function writeCsv(path, rows) {
  const headers = [
    'trial',
    'phase',
    'activeGame',
    'outcome',
    'action',
    'conditioningLevel',
    'engagementLevel',
    'fatigueLevel',
    'falsePositiveRatio',
    'isUnconditioned',
    'responseBudget',
    'timingOffsetMs',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => r[h]).join(','));
  }
  fs.writeFileSync(path, lines.join('\n'));
}

// ============================================================================
// Main: compare easy vs hard side by side for each strategy
// ============================================================================
function main() {
  const strategyNames = ['alwaysCorrect', 'alwaysReinforceEverything', 'random'];
  const cases = { easy: sampleCases.easyChild, hard: sampleCases.hardChild };

  for (const strategyName of strategyNames) {
    for (const [caseName, caseConfig] of Object.entries(cases)) {
      console.log(`\n########## case=${caseName} strategy=${strategyName} ##########`);
      runSimulation(caseConfig, strategyName, {
        numTrials: 250,
        logEvery: 25,
        conditioningTrials: 40,
        gameSwitchEvery: 60,
      });
    }
  }

  // Example CSV export for plotting one run
  runSimulation(sampleCases.hardChild, 'alwaysCorrect', {
    numTrials: 300,
    logEvery: 1000, // suppress console spam for this export run
    csvPath: 'trajectory_hardChild_alwaysCorrect.csv',
  });
}

if (require.main === module) {
  main();
}

module.exports = { strategies, runSimulation, writeCsv };
