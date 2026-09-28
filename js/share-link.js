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

  // page: the page the link should open (default: the current page). Case
  // links must open index.html, which is the page that reads #case=.
  function buildShareUrl(hashKey, dataObj, page) {
    const encoded = toBase64Url(JSON.stringify(dataObj));
    const url = new URL(page || window.location.href, window.location.href);
    url.hash = `${hashKey}=${encoded}`;
    return url.toString();
  }

  // Case link for index.html: the short js/case-codec.js format when the
  // case fits it exactly, otherwise the full serializeCase() JSON.
  function buildCaseShareUrl(caseConfig, { locked } = {}) {
    if (window.CaseCodec && window.CaseCodec.canEncode(caseConfig)) {
      const url = new URL('index.html', window.location.href);
      url.hash = `case=${window.CaseCodec.encode(caseConfig, { locked })}`;
      return url.toString();
    }
    return buildShareUrl('case', window.CaseSerializer.serializeCase(caseConfig, { locked }), 'index.html');
  }

  // Returns the parsed-but-unvalidated payload, or null if the hash doesn't
  // match hashKey, or if base64/JSON decoding fails.
  function readShareUrl(hashKey) {
    const re = new RegExp(`#?${hashKey}=(.+)`);
    const match = window.location.hash.match(re);
    if (!match) return null;
    try {
      if (window.CaseCodec && match[1][0] === window.CaseCodec.PREFIX) return window.CaseCodec.decode(match[1]);
      return JSON.parse(fromBase64Url(match[1]));
    } catch (err) {
      return null;
    }
  }

  const ShareLink = { toBase64Url, fromBase64Url, buildShareUrl, buildCaseShareUrl, readShareUrl };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShareLink;
  }
  if (typeof window !== 'undefined') {
    window.ShareLink = ShareLink;
  }
})();
