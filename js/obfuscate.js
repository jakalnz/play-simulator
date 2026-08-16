'use strict';

// Copied unchanged from jakalnz/pta-simulator js/obfuscate.js, de-modularized.
//
// Casual-snooping deterrent only — NOT real security. XOR+base64 against a
// hardcoded key that lives in this file's own source, so anyone reading the
// app's JS can trivially reverse it. Used to keep answer-key data (e.g. a
// case's trueThreshold) from being readable at a glance in a shared URL or
// exported .json file, not to protect it from a determined reader.

(function () {
  const KEY = 'play-sim-case-obfuscation-v1';

  function xorString(str, key) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
      out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return out;
  }

  function obfuscate(obj) {
    const json = JSON.stringify(obj);
    const xored = xorString(json, KEY);
    return btoa(unescape(encodeURIComponent(xored)));
  }

  function deobfuscate(encoded) {
    const xored = decodeURIComponent(escape(atob(encoded)));
    const json = xorString(xored, KEY);
    return JSON.parse(json);
  }

  const Obfuscate = { obfuscate, deobfuscate };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Obfuscate;
  }
  if (typeof window !== 'undefined') {
    window.Obfuscate = Obfuscate;
  }
})();
