'use strict';

// Step 9 — schema-versioned session-results sharing, for trial-runner.html's
// summary screen (step 7) to export/share and to render a read-only review
// of a shared/imported result. No obfuscation — this is performance data,
// not an answer key.
//
// Deliberately stores the raw responseHistory rather than pre-baked
// accuracy/action-table/trajectory numbers: js/session-summary.js already
// recomputes everything fresh from a { responseHistory, trueThreshold }
// shape on every render, so a reconstructed object of that shape is enough
// to reuse it unmodified — pre-baking would duplicate that aggregation
// logic and risk drifting from it.

(function () {
  const SCHEMA_VERSION = 1;

  function serializeResults(sessionLog, caseConfig) {
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      caseName: (caseConfig && caseConfig.name) || null,
      trueThreshold: caseConfig ? caseConfig.trueThreshold : null,
      responseHistory: sessionLog || [],
    };
  }

  function deserializeResults(data) {
    if (!data) throw new Error('No data to import.');
    if (data.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`Unsupported results schemaVersion (expected ${SCHEMA_VERSION}, got ${data.schemaVersion})`);
    }
    return data;
  }

  const ResultsSerializer = { SCHEMA_VERSION, serializeResults, deserializeResults };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResultsSerializer;
  }
  if (typeof window !== 'undefined') {
    window.ResultsSerializer = ResultsSerializer;
  }
})();
