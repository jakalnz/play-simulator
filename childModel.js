'use strict';

// ============================================================================
// CONFIG — all tunable constants live here so trial behaviour can be tuned
// without touching logic below.
// ============================================================================
const CONFIG = {
  // --- conditioning ---
  conditioningGainConditioningPhase: 3, // per-trial conditioning gain while in "conditioning" phase
  conditioningGainGenuineReinforce: 4, // conditioning gain on genuine+reinforce in testing
  conditioningLossReinstructGenuine: 2, // conditioning loss on genuine+reinstruct (extinction risk)
  conditioningLossWithholdGenuine: 5, // conditioning loss on genuine+withhold (bigger extinction risk)
  conditioningProtectFalsePositiveReinstruct: 1, // small protective boost for correct FP call
  conditioningWithholdPenalty: 1, // extra fixed penalty applied on ANY withhold action, stacks
  fastDecayMultiplier: 3, // multiplier applied to conditioning decay once falsePositiveRatio is high
  unconditionedFloor: 15, // conditioningLevel below this (for active game) => isUnconditioned flag

  // --- false positives / rolling ratio ---
  fpRollingWindow: 6, // number of recent testing-phase trials used for falsePositiveRatio
  fpRatioThreshold: 0.4, // ratio above which fast conditioning decay kicks in

  // --- engagement ---
  engagementDecayPerTrial: 1.5, // baseline engagement decay per trial
  engagementDecayPerTrialSinceReinforcement: 0.8, // extra decay per trial since last reinforcement
  engagementReinforceBoost: 35, // engagement restored on genuine+reinforce (diminishing returns applied)
  engagementReinstructGenuinePenalty: 4, // extra engagement drop on genuine+reinstruct
  engagementFalsePositiveWithholdDrift: 2, // small engagement drop on false_positive+withhold
  engagementDiminishingReturnsFactor: 0.85, // each successive boost within a phase is scaled by this^n

  // --- fatigue ---
  fatigueRisePerTrial: 0.4, // fatigue rises slowly across the whole session
  fatigueRiseTimeSinceReinforcementFactor: 0.05, // extra fatigue rise per trial since last reinforcement

  // --- response budget ---
  responseBudgetStart: 120, // starting response budget
  responseBudgetGameSwitchTopUpBase: 15, // base top-up for switching games
  responseBudgetGameSwitchTopUpDecay: 0.7, // top-up shrinks by this factor each time it's used
  responseBudgetGameSwitchCost: 3, // flat cost of switching games (spends some of the budget)

  // --- reinforcer novelty (per icon type, 3 icons) ---
  noveltyStart: 100,
  noveltyDecayPerUse: 20, // novelty for a used icon decays this much
  noveltyRecoveryOnVary: 10, // when a *different* icon is used, other icons partially recover
  noveltyRecoveryOnGameChange: 25, // game change recovers novelty for all icons

  // --- probability model coefficients ---
  pGenuine: {
    audibleBase: 0.05, // small baseline chance of "genuine" response when not actually audible (noise floor)
    audibleTrueBase: 0.55, // base chance of genuine response when audible
    conditioningWeight: 0.4, // scales with conditioningLevel/100
    engagementWeight: 0.3, // scales with engagementLevel/100
    fatiguePenaltyWeight: 0.25, // scales down with fatigueLevel/100
  },
  pFalsePositive: {
    base: 0.03,
    lowConditioningWeight: 0.35, // scales with (100-conditioningLevel)/100
    lowEngagementWeight: 0.15, // secondary driver, only matters once engagement is quite low
    lowEngagementThreshold: 35, // engagement below this starts contributing to false positives
    lowConditioningAndEngagementBoost: 0.1, // extra push when BOTH conditioning and engagement are weak
    lowConditioningThresholdForCombo: 40,
  },

  // --- reaction time / timing offsets (ms), for outcome logging only ---
  timing: {
    genuineMeanMs: 600,
    genuineJitterMs: 150,
    anticipatoryMinMs: -800, // negative offset = before stimulus onset
    anticipatoryMaxMs: -100,
    creepingMinMs: 900, // delayed/creeping false positive, after onset
    creepingMaxMs: 2500,
    withholdConfidenceLossOffsetMs: 100, // added per stacked withhold penalty to next-trial offset
  },

  games: ['cars', 'horses', 'marbles'],
  icons: ['iconA', 'iconB', 'iconC'],
};

// ============================================================================
// Helpers
// ============================================================================
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// ============================================================================
// State construction
// ============================================================================
function createChildState(caseConfig) {
  const games = {};
  for (const g of CONFIG.games) {
    const gc = caseConfig.games[g];
    games[g] = {
      baseResponseLevel: gc.baseResponseLevel,
      conditioningGainRate: gc.conditioningGainRate,
      conditioningLevel: gc.startingConditioning != null ? gc.startingConditioning : 0,
      isUnconditioned: false,
      gameSwitchTopUpAmount: CONFIG.responseBudgetGameSwitchTopUpBase,
    };
  }

  const reinforcerNovelty = {};
  for (const icon of CONFIG.icons) {
    reinforcerNovelty[icon] = CONFIG.noveltyStart;
  }

  return {
    trueThreshold: deepClone(caseConfig.trueThreshold),
    engagementLevel: 100,
    fatigueLevel: caseConfig.startingFatigue != null ? caseConfig.startingFatigue : 0,
    responseBudget: CONFIG.responseBudgetStart,
    falsePositiveRatio: 0,
    games,
    reinforcerNovelty,
    lastUsedIcon: null,
    phase: caseConfig.startingPhase || 'conditioning',
    trialCount: 0,
    trialsSinceReinforcement: 0,
    consecutiveWithholds: 0,
    engagementBoostStreak: 0, // for diminishing returns on reinforcement boosts
    responseHistory: [],
    fpWindow: [], // rolling window of booleans: true = reinforced-but-non-genuine
  };
}

// ============================================================================
// Trial resolution — cochlea level based
// ============================================================================
// audible for a given ear is decided against that ear's own trueThreshold
// (trueThreshold is now { right: {freq: dB}, left: {freq: dB} } — see
// createChildState). cochleaLevel is whatever level actually reaches that
// ear's cochlea once masking/IAA/conductive-loss physics (computed by the
// audiometer engine, for the browser control surface) have been applied.
// ============================================================================

// ============================================================================
// Probability model
// ============================================================================
function computeProbabilities(state, audible, activeGame) {
  const g = state.games[activeGame];
  const fatigueCap = 1 - (state.fatigueLevel / 100) * CONFIG.pGenuine.fatiguePenaltyWeight;

  let pGenuine = 0;
  if (audible) {
    pGenuine =
      CONFIG.pGenuine.audibleTrueBase +
      (g.conditioningLevel / 100) * CONFIG.pGenuine.conditioningWeight +
      (state.engagementLevel / 100) * CONFIG.pGenuine.engagementWeight;
    pGenuine *= fatigueCap;
  } else {
    pGenuine = CONFIG.pGenuine.audibleBase * (g.conditioningLevel / 100);
  }
  pGenuine = clamp(pGenuine, 0, 0.98);

  const lowConditioningTerm =
    ((100 - g.conditioningLevel) / 100) * CONFIG.pFalsePositive.lowConditioningWeight;

  let lowEngagementTerm = 0;
  if (state.engagementLevel < CONFIG.pFalsePositive.lowEngagementThreshold) {
    lowEngagementTerm =
      ((CONFIG.pFalsePositive.lowEngagementThreshold - state.engagementLevel) / 100) *
      CONFIG.pFalsePositive.lowEngagementWeight;
  }

  let comboBoost = 0;
  if (
    g.conditioningLevel < CONFIG.pFalsePositive.lowConditioningThresholdForCombo &&
    state.engagementLevel < CONFIG.pFalsePositive.lowEngagementThreshold
  ) {
    comboBoost = CONFIG.pFalsePositive.lowConditioningAndEngagementBoost;
  }

  let pFalsePositive =
    CONFIG.pFalsePositive.base + lowConditioningTerm + lowEngagementTerm + comboBoost;
  pFalsePositive = clamp(pFalsePositive, 0, 0.9);

  // Ensure pGenuine + pFalsePositive doesn't exceed 1
  if (pGenuine + pFalsePositive > 0.98) {
    const scale = 0.98 / (pGenuine + pFalsePositive);
    pGenuine *= scale;
    pFalsePositive *= scale;
  }

  return { pGenuine, pFalsePositive };
}

function rollOutcome(pGenuine, pFalsePositive) {
  const r = Math.random();
  if (r < pGenuine) return 'genuine_response';
  if (r < pGenuine + pFalsePositive) return 'false_positive';
  return 'no_response';
}

function rollFalsePositiveTiming(confidenceLossOffsetMs) {
  const anticipatory = Math.random() < 0.5;
  let offsetMs;
  if (anticipatory) {
    offsetMs = randRange(CONFIG.timing.anticipatoryMinMs, CONFIG.timing.anticipatoryMaxMs);
  } else {
    offsetMs = randRange(CONFIG.timing.creepingMinMs, CONFIG.timing.creepingMaxMs);
  }
  return offsetMs + confidenceLossOffsetMs;
}

// ============================================================================
// Trial resolution
// ============================================================================
function resolveTrial(state, { freq, ear, cochleaLevel }, activeGame) {
  const s = deepClone(state);
  const audible = cochleaLevel > s.trueThreshold[ear][freq];

  const { pGenuine, pFalsePositive } = computeProbabilities(s, audible, activeGame);
  const outcome = rollOutcome(pGenuine, pFalsePositive);

  const confidenceLossOffset =
    s.consecutiveWithholds * CONFIG.timing.withholdConfidenceLossOffsetMs;

  let timingOffsetMs = 0;
  if (outcome === 'genuine_response') {
    timingOffsetMs =
      randRange(-CONFIG.timing.genuineJitterMs, CONFIG.timing.genuineJitterMs) +
      CONFIG.timing.genuineMeanMs +
      confidenceLossOffset;
  } else if (outcome === 'false_positive') {
    timingOffsetMs = rollFalsePositiveTiming(confidenceLossOffset);
  }

  const trialResult = {
    stimulus: { freq, ear, cochleaLevel },
    activeGame,
    audible,
    outcome,
    pGenuine,
    pFalsePositive,
    timingOffsetMs,
  };

  return { state: s, trialResult };
}

/**
 * Compat wrapper for callers that only have a single presented dB, not a
 * per-ear cochlea level (testHarness.js's headless batch harness, which has
 * no audiometer engine or masking/IAA physics). Treats the presented dB as
 * landing directly on the right-ear cochlea at face value.
 */
function runTrial(state, stimulus, activeGame) {
  const { freq, dB } = stimulus;
  return resolveTrial(state, { freq, ear: 'right', cochleaLevel: dB }, activeGame);
}

// ============================================================================
// Conditioning phase resolution (always reinforced, no scoring)
// ============================================================================
function applyConditioningPhase(state, trialResult, activeGame) {
  const s = deepClone(state);
  const g = s.games[activeGame];
  const fatigueCap = 100 - s.fatigueLevel * 0.5;
  g.conditioningLevel = clamp(
    g.conditioningLevel + CONFIG.conditioningGainConditioningPhase * g.conditioningGainRate,
    0,
    fatigueCap
  );
  s.trialsSinceReinforcement = 0;
  s.consecutiveWithholds = 0;
  return { state: s, action: 'reinforce' };
}

// ============================================================================
// Testing phase: outcome x action effect matrix
// ============================================================================
function applyTestingAction(state, trialResult, action, activeGame) {
  const s = deepClone(state);
  const g = s.games[activeGame];
  const outcome = trialResult.outcome;
  const fatigueCapConditioning = 100 - s.fatigueLevel * 0.5;
  const fatigueCapEngagement = 100 - s.fatigueLevel * 0.3;

  if (outcome === 'genuine_response') {
    if (action === 'reinforce') {
      g.conditioningLevel = clamp(
        g.conditioningLevel + CONFIG.conditioningGainGenuineReinforce * g.conditioningGainRate,
        0,
        fatigueCapConditioning
      );
      s.engagementBoostStreak += 1;
      const boost =
        CONFIG.engagementReinforceBoost *
        Math.pow(CONFIG.engagementDiminishingReturnsFactor, s.engagementBoostStreak - 1);
      s.engagementLevel = clamp(s.engagementLevel + boost, 0, fatigueCapEngagement);
      s.trialsSinceReinforcement = 0;
      s.consecutiveWithholds = 0;
      // reinforcer novelty ticks down slightly for the icon used, handled by caller via useReinforcerIcon
    } else if (action === 'reinstruct') {
      g.conditioningLevel = clamp(g.conditioningLevel - CONFIG.conditioningLossReinstructGenuine, 0, fatigueCapConditioning);
      s.engagementLevel = clamp(s.engagementLevel - CONFIG.engagementReinstructGenuinePenalty, 0, 100);
      s.trialsSinceReinforcement += 1;
    } else if (action === 'withhold') {
      g.conditioningLevel = clamp(g.conditioningLevel - CONFIG.conditioningLossWithholdGenuine, 0, fatigueCapConditioning);
      s.trialsSinceReinforcement += 1;
    }
  } else if (outcome === 'false_positive') {
    if (action === 'reinforce') {
      s.fpWindow.push(true);
      s.trialsSinceReinforcement = 0;
    } else if (action === 'reinstruct') {
      g.conditioningLevel = clamp(
        g.conditioningLevel + CONFIG.conditioningProtectFalsePositiveReinstruct,
        0,
        fatigueCapConditioning
      );
      s.fpWindow.push(false);
      s.trialsSinceReinforcement += 1;
    } else if (action === 'withhold') {
      s.engagementLevel = clamp(s.engagementLevel - CONFIG.engagementFalsePositiveWithholdDrift, 0, 100);
      s.fpWindow.push(false);
      s.trialsSinceReinforcement += 1;
    }
  } else {
    // no_response: any action still tracked for withhold-streak purposes below
    s.trialsSinceReinforcement += 1;
  }

  // trim rolling fp window
  if (s.fpWindow.length > CONFIG.fpRollingWindow) {
    s.fpWindow = s.fpWindow.slice(-CONFIG.fpRollingWindow);
  }
  if (s.fpWindow.length > 0) {
    const fpCount = s.fpWindow.filter(Boolean).length;
    s.falsePositiveRatio = fpCount / s.fpWindow.length;
  }

  // ANY withhold: extra fixed conditioning penalty + reaction-time confidence-loss stacking
  if (action === 'withhold') {
    g.conditioningLevel = clamp(g.conditioningLevel - CONFIG.conditioningWithholdPenalty, 0, fatigueCapConditioning);
    s.consecutiveWithholds += 1;
  } else {
    s.consecutiveWithholds = 0;
  }

  // fast decay once falsePositiveRatio crosses threshold
  if (s.falsePositiveRatio > CONFIG.fpRatioThreshold) {
    const decay =
      (CONFIG.conditioningGainGenuineReinforce / 2) * CONFIG.fastDecayMultiplier * 0.1;
    g.conditioningLevel = clamp(g.conditioningLevel - decay, 0, fatigueCapConditioning);
  }

  g.isUnconditioned = g.conditioningLevel < CONFIG.unconditionedFloor;

  return { state: s, action };
}

// ============================================================================
// Per-trial engagement/fatigue update (runs every trial regardless of action)
// ============================================================================
function updateEngagementAndFatigue(state, activeGame) {
  const s = deepClone(state);
  s.trialCount += 1;

  const g = s.games[activeGame];
  const noveltyFactor = 1 - (s.reinforcerNovelty[s.lastUsedIcon || CONFIG.icons[0]] || 100) / 200;

  const engagementDecay =
    CONFIG.engagementDecayPerTrial +
    s.trialsSinceReinforcement * CONFIG.engagementDecayPerTrialSinceReinforcement * (1 + noveltyFactor);
  s.engagementLevel = clamp(s.engagementLevel - engagementDecay, 0, 100);

  const fatigueRise =
    CONFIG.fatigueRisePerTrial +
    s.trialsSinceReinforcement * CONFIG.fatigueRiseTimeSinceReinforcementFactor;
  s.fatigueLevel = clamp(s.fatigueLevel + fatigueRise, 0, 100);

  const fatigueCapConditioning = 100 - s.fatigueLevel * 0.5;
  const fatigueCapEngagement = 100 - s.fatigueLevel * 0.3;
  s.engagementLevel = clamp(s.engagementLevel, 0, fatigueCapEngagement);
  for (const gameName of CONFIG.games) {
    s.games[gameName].conditioningLevel = clamp(
      s.games[gameName].conditioningLevel,
      0,
      fatigueCapConditioning
    );
  }

  return s;
}

// ============================================================================
// Game switching
// ============================================================================
function switchGame(state, newGame) {
  const s = deepClone(state);
  const g = s.games[newGame];

  s.responseBudget = Math.max(0, s.responseBudget - CONFIG.responseBudgetGameSwitchCost);
  s.responseBudget += g.gameSwitchTopUpAmount;
  g.gameSwitchTopUpAmount *= CONFIG.responseBudgetGameSwitchTopUpDecay;

  for (const icon of CONFIG.icons) {
    s.reinforcerNovelty[icon] = clamp(
      s.reinforcerNovelty[icon] + CONFIG.noveltyRecoveryOnGameChange,
      0,
      100
    );
  }

  s.engagementBoostStreak = 0;

  return s;
}

// ============================================================================
// Reinforcer icon usage (novelty tracking)
// ============================================================================
function useReinforcerIcon(state, iconType) {
  const s = deepClone(state);
  s.reinforcerNovelty[iconType] = clamp(
    s.reinforcerNovelty[iconType] - CONFIG.noveltyDecayPerUse,
    0,
    100
  );

  if (s.lastUsedIcon && s.lastUsedIcon !== iconType) {
    for (const icon of CONFIG.icons) {
      if (icon !== iconType) {
        s.reinforcerNovelty[icon] = clamp(
          s.reinforcerNovelty[icon] + CONFIG.noveltyRecoveryOnVary,
          0,
          100
        );
      }
    }
  }

  s.lastUsedIcon = iconType;
  return s;
}

// ============================================================================
// Top-level orchestration: resolve one full trial including phase logic,
// logging to responseHistory. `actionOrFn` is either a fixed action string
// (ignored during conditioning phase) or a function
// `(trialResult, state) => action`, called after the trial is rolled so the
// caller's strategy can react to the actual resolved outcome without a
// separate (and inconsistent) dry-run roll.
// ============================================================================
function step(state, stimulus, activeGame, actionOrFn, iconType) {
  const { state: afterTrialState, trialResult } = runTrial(state, stimulus, activeGame);
  return applyResolvedTrial(afterTrialState, trialResult, activeGame, actionOrFn, iconType);
}

/**
 * Same as step(), but for callers with a per-ear cochlea level rather than a
 * single presented dB — the browser control surface (trial-runner.html),
 * which routes through the audiometer engine's masking/IAA/conductive-loss
 * physics before knowing what level actually reaches a given cochlea.
 */
function stepFromCochleaLevel(state, { freq, ear, cochleaLevel }, activeGame, actionOrFn, iconType) {
  const { state: afterTrialState, trialResult } = resolveTrial(state, { freq, ear, cochleaLevel }, activeGame);
  return applyResolvedTrial(afterTrialState, trialResult, activeGame, actionOrFn, iconType);
}

function applyResolvedTrial(state, trialResult, activeGame, actionOrFn, iconType) {
  let s = state;
  let appliedAction = null;
  if (s.phase === 'conditioning') {
    const res = applyConditioningPhase(s, trialResult, activeGame);
    s = res.state;
    appliedAction = res.action;
    if (iconType) s = useReinforcerIcon(s, iconType);
  } else {
    const action =
      typeof actionOrFn === 'function' ? actionOrFn(trialResult, s) : actionOrFn;
    const res = applyTestingAction(s, trialResult, action, activeGame);
    s = res.state;
    appliedAction = res.action;
    if (action === 'reinforce' && iconType) {
      s = useReinforcerIcon(s, iconType);
    }
  }

  s = updateEngagementAndFatigue(s, activeGame);

  const historyEntry = {
    trial: s.trialCount,
    phase: s.phase,
    activeGame,
    ...trialResult,
    action: appliedAction,
    conditioningLevel: s.games[activeGame].conditioningLevel,
    engagementLevel: s.engagementLevel,
    fatigueLevel: s.fatigueLevel,
    falsePositiveRatio: s.falsePositiveRatio,
    isUnconditioned: s.games[activeGame].isUnconditioned,
    responseBudget: s.responseBudget,
  };
  s.responseHistory.push(historyEntry);

  return { state: s, historyEntry };
}

const ChildModel = {
  CONFIG,
  createChildState,
  runTrial,
  resolveTrial,
  applyConditioningPhase,
  applyTestingAction,
  updateEngagementAndFatigue,
  switchGame,
  useReinforcerIcon,
  step,
  stepFromCochleaLevel,
  // Same phase-dispatch/engagement-fatigue/history-logging that step() and
  // stepFromCochleaLevel() run internally, exposed directly so a caller can
  // resolveTrial() first (to know the outcome — e.g. to play a video clip),
  // wait for a human judgement, and only then apply the chosen action,
  // without re-implementing any of applyTestingAction/updateEngagementAndFatigue.
  applyStudentAction: applyResolvedTrial,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChildModel;
}
if (typeof window !== 'undefined') {
  window.ChildModel = ChildModel;
}
