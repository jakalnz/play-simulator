'use strict';

// ============================================================================
// Pure scheduling logic: given a manifest, an outcome token, and a timing
// offset (ms, relative to stimulus onset at t=0, may be negative), decide
// which clip variant to play and when. No DOM, no timers — safe to reuse
// from a browser test page or, later, the real audiometer UI.
// ============================================================================

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clipUrl(manifest, file) {
  return manifest.baseUrl + '/' + file;
}

function computeSchedulingPlan(manifest, outcome, offsetMs) {
  const candidates = manifest.clips.filter((c) => c.token === outcome);
  if (candidates.length === 0) {
    throw new Error(`No clip variants found for outcome "${outcome}"`);
  }

  const clip = candidates[Math.floor(Math.random() * candidates.length)];

  let playAtMs;
  if (clip.offsetRange) {
    playAtMs = clamp(offsetMs, clip.offsetRange.minMs, clip.offsetRange.maxMs);
  } else {
    // Not stimulus-timed (no_response, off_task, reinforcer_response): play immediately.
    playAtMs = 0;
  }

  return {
    variantUrl: clipUrl(manifest, clip.file),
    playAtMs,
    durationMs: clip.durationMs,
    variantId: clip.variantId,
    token: clip.token,
  };
}

// Picks one of the manifest's idle-loop variants at random, so the
// between-trials footage varies instead of always looping the same clip.
function pickIdleLoopUrl(manifest) {
  const loops = manifest.idleLoops;
  const loop = loops[Math.floor(Math.random() * loops.length)];
  return clipUrl(manifest, loop.file);
}

const Scheduler = { computeSchedulingPlan, pickIdleLoopUrl };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scheduler;
}
if (typeof window !== 'undefined') {
  window.Scheduler = Scheduler;
}
