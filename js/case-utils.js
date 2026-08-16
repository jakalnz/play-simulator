'use strict';

// Step 8 — shared helpers for the case-selection screen (index.html) and
// the admin authoring screen (admin.html). Same de-modularized plain-global
// pattern as the rest of js/.

(function () {
  const GAMES = ['cars', 'horses', 'marbles'];

  // Buckets average trueThreshold severity and average per-game
  // conditioningGainRate into a short label — no raw numbers surfaced on
  // the selection screen, per the step 8 brief.
  function computeDifficultySummary(caseConfig) {
    const levels = [];
    ['right', 'left'].forEach((ear) => {
      const t = caseConfig.trueThreshold && caseConfig.trueThreshold[ear];
      if (!t) return;
      Object.values(t).forEach((v) => levels.push(Number(v)));
    });
    const avgLoss = levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 0;

    const gains = GAMES.map((g) => {
      const gc = caseConfig.games && caseConfig.games[g];
      return gc ? Number(gc.conditioningGainRate) : 0;
    });
    const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;

    let lossLabel;
    if (avgLoss < 25) lossLabel = 'Mild loss';
    else if (avgLoss < 40) lossLabel = 'Moderate loss';
    else lossLabel = 'Severe loss';

    let conditionLabel;
    if (avgGain >= 0.75) conditionLabel = 'quick to condition';
    else if (avgGain >= 0.45) conditionLabel = 'typical to condition';
    else conditionLabel = 'harder to condition';

    return `${lossLabel} · ${conditionLabel}`;
  }

  // Fresh default-valued config for "new case" in the admin form. Built
  // from PtaUtils.FREQUENCIES rather than a hardcoded list so it can't
  // drift from what resolveTrial() actually looks up.
  function blankCaseConfig() {
    const freqs = window.PtaUtils.FREQUENCIES;
    const thresholdRow = () => {
      const row = {};
      freqs.forEach((f) => { row[f] = 30; });
      return row;
    };

    return {
      name: '',
      vignette: '',
      trueThreshold: { right: thresholdRow(), left: thresholdRow() },
      startingFatigue: 0,
      startingPhase: 'conditioning',
      responseBudget: 120,
      engagementDecayRate: 1,
      falsePositiveSusceptibility: 1,
      games: {
        cars: { baseResponseLevel: 50, conditioningGainRate: 0.7, startingConditioning: 0 },
        horses: { baseResponseLevel: 50, conditioningGainRate: 0.7, startingConditioning: 0 },
        marbles: { baseResponseLevel: 50, conditioningGainRate: 0.7, startingConditioning: 0 },
      },
      clipEligibility: {},
    };
  }

  // Reachable-from-outcome tokens, per scheduler.js/childModel.js's
  // outcome->token mapping (mapOutcomeToToken in trial-runner.html) plus
  // the conditioning-phase reinforcer clip. Used to warn (not block) when
  // an admin-authored clipEligibility restriction would empty one of
  // these out.
  const REACHABLE_TOKENS = ['clear_response', 'spontaneous_response', 'no_response', 'reinforcer_response'];

  // Verifies every FREQUENCIES x {right,left} pair has a trueThreshold
  // entry. Returns an array of missing "{ear} {freq}Hz" strings (empty if
  // complete) — a hand-edited case missing an entry makes resolveTrial's
  // `cochleaLevel > undefined` silently always false at that frequency,
  // so this is meant to be logged as a console warning, not thrown.
  function findMissingThresholds(caseConfig) {
    const freqs = window.PtaUtils.FREQUENCIES;
    const missing = [];
    ['right', 'left'].forEach((ear) => {
      const t = (caseConfig.trueThreshold && caseConfig.trueThreshold[ear]) || {};
      freqs.forEach((f) => {
        if (t[f] == null) missing.push(`${ear} ${f}Hz`);
      });
    });
    return missing;
  }

  const CaseUtils = {
    GAMES,
    REACHABLE_TOKENS,
    computeDifficultySummary,
    blankCaseConfig,
    findMissingThresholds,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CaseUtils;
  }
  if (typeof window !== 'undefined') {
    window.CaseUtils = CaseUtils;
  }
})();
