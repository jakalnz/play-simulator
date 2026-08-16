'use strict';

// Step 9 — generic .json export/import. Ported from the *pattern* of
// jakalnz/pta-simulator's js/json-io.js, generalized the same way as
// js/share-link.js: not tied to one serializer, callers pass already-
// serialized data and handle deserialization themselves.
//
// Unlike the source file (confirmed to have no error handling and an
// unwrapped call site in main.js), importJson's callers in this app are
// expected to wrap the awaited call in try/catch — this file itself still
// throws on bad JSON, that's intentional, just don't let it go uncaught.

(function () {
  function exportJson(dataObj, filename) {
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importJson(file) {
    const text = await file.text();
    return JSON.parse(text);
  }

  const JsonIo = { exportJson, importJson };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = JsonIo;
  }
  if (typeof window !== 'undefined') {
    window.JsonIo = JsonIo;
  }
})();
