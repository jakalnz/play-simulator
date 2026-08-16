'use strict';

// Step 9 — generic base64url-in-hash share links. Ported from the *pattern*
// of jakalnz/pta-simulator's js/share-link.js, but not hardwired to one
// serializer: pta-simulator has exactly one shareable thing (a session) and
// uses a bare `#d=...` hash; this app has two (cases, from step 8, and
// results, from step 7) that must never be confusable with each other, so
// buildShareUrl/readShareUrl take an explicit hashKey ('case' | 'results')
// instead. Schema-version validation is deliberately NOT done here — that's
// each serializer's job (js/case-serializer.js, js/results-serializer.js),
// same separation of concerns as the source repo's
// deserializeSession/applySession split.

(function () {
  function toBase64Url(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function fromBase64Url(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    return decodeURIComponent(escape(atob(base64)));
  }

  function buildShareUrl(hashKey, dataObj) {
    const encoded = toBase64Url(JSON.stringify(dataObj));
    const url = new URL(window.location.href);
    url.hash = `${hashKey}=${encoded}`;
    return url.toString();
  }

  // Returns the parsed-but-unvalidated payload, or null if the hash doesn't
  // match hashKey, or if base64/JSON decoding fails.
  function readShareUrl(hashKey) {
    const re = new RegExp(`#?${hashKey}=(.+)`);
    const match = window.location.hash.match(re);
    if (!match) return null;
    try {
      return JSON.parse(fromBase64Url(match[1]));
    } catch (err) {
      return null;
    }
  }

  const ShareLink = { toBase64Url, fromBase64Url, buildShareUrl, readShareUrl };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShareLink;
  }
  if (typeof window !== 'undefined') {
    window.ShareLink = ShareLink;
  }
})();
