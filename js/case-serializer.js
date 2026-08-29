'use strict';

// Step 9 — schema-versioned case sharing, for admin.html (step 8) to export
// and index.html (step 8) to import/read from a share link. Depends on
// js/obfuscate.js for the locked/answer-key wrapping.
//
// Field list matches the actual case-config shape used throughout this
// repo (js/case-utils.js's blankCaseConfig(), cases/*.json) — not a
// restated/abbreviated version of it.

(function () {
  const SCHEMA_VERSION = 1;

  // trueThreshold and conductiveLoss are treated as answer-key data worth
  // obfuscating when locked — matching pta-simulator's own precedent (only
  // the threshold/patient data is ever wrapped, never budget/rate
  // constants). conductiveLoss is the air-bone gap component of the same
  // answer key, so it's wrapped the same way.
  function serializeCase(caseConfig, { locked } = {}) {
    const isLocked = !!locked;
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      locked: isLocked,
      name: caseConfig.name,
      vignette: caseConfig.vignette,
      trueThreshold: isLocked
        ? { __obfuscated: true, data: window.Obfuscate.obfuscate(caseConfig.trueThreshold) }
        : caseConfig.trueThreshold,
      conductiveLoss: isLocked
        ? { __obfuscated: true, data: window.Obfuscate.obfuscate(caseConfig.conductiveLoss) }
        : caseConfig.conductiveLoss,
      startingFatigue: caseConfig.startingFatigue,
      startingPhase: caseConfig.startingPhase,
      responseBudget: caseConfig.responseBudget,
      engagementDecayRate: caseConfig.engagementDecayRate,
      falsePositiveSusceptibility: caseConfig.falsePositiveSusceptibility,
      games: caseConfig.games,
      clipEligibility: caseConfig.clipEligibility,
    };
  }

  // Accepts either a schema-versioned record (this file's own output) or a
  // legacy/raw case config (a plain cases/*.json file, or blankCaseConfig()'s
  // shape, which has no schemaVersion field at all) — the latter is wrapped
  // as an unlocked v1 record rather than rejected, so "Import case from
  // .json" on index.html doesn't need the user to know which kind of file
  // they have.
  function deserializeCase(data) {
    if (!data) throw new Error('No data to import.');
    if (data.schemaVersion == null) {
      return { schemaVersion: SCHEMA_VERSION, createdAt: null, locked: false, ...data };
    }
    if (data.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`Unsupported case schemaVersion (expected ${SCHEMA_VERSION}, got ${data.schemaVersion})`);
    }
    return data;
  }

  // Deobfuscates trueThreshold if wrapped, returns a plain caseConfig ready
  // for the shapes every existing call site expects (sessionStorage
  // handoff, cases/*.json fetch). Pass childModelFactory (e.g.
  // ChildModel.createChildState) to get a live model state back instead.
  function applyCase(data, { childModelFactory } = {}) {
    const trueThreshold =
      data.trueThreshold && data.trueThreshold.__obfuscated
        ? window.Obfuscate.deobfuscate(data.trueThreshold.data)
        : data.trueThreshold;

    const conductiveLoss =
      data.conductiveLoss && data.conductiveLoss.__obfuscated
        ? window.Obfuscate.deobfuscate(data.conductiveLoss.data)
        : data.conductiveLoss;

    const caseConfig = {
      name: data.name,
      vignette: data.vignette,
      trueThreshold,
      conductiveLoss,
      startingFatigue: data.startingFatigue,
      startingPhase: data.startingPhase,
      responseBudget: data.responseBudget,
      engagementDecayRate: data.engagementDecayRate,
      falsePositiveSusceptibility: data.falsePositiveSusceptibility,
      games: data.games,
      clipEligibility: data.clipEligibility,
    };

    return childModelFactory ? childModelFactory(caseConfig) : caseConfig;
  }

  const CaseSerializer = { SCHEMA_VERSION, serializeCase, deserializeCase, applyCase };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CaseSerializer;
  }
  if (typeof window !== 'undefined') {
    window.CaseSerializer = CaseSerializer;
  }
})();
