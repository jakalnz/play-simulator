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

// ============================================================================
// Benji video-set helpers — a per-case-selectable set of real-child clips
// (manifest.videoSets[id]), paired idle/response by letter and split by
// transducer group ("insert" vs "BC"), plus dedicated conditioning and
// confidence-graded spontaneous clips. Pure — same no-DOM contract as the
// functions above.
// ============================================================================

// The optional `version` field on a video set is appended as a cache-busting
// query param — R2's public r2.dev buckets sit behind Cloudflare's CDN,
// which caches static file types like .mp4 at the edge independent of
// browser cache and isn't invalidated just because the object at that
// filename was overwritten. Bumping `version` after replacing a clip gives
// it a fresh URL so there's nothing stale to purge.
function benjiClipUrl(videoSet, file) {
  const url = videoSet.baseUrl + '/' + encodeURIComponent(file);
  return videoSet.version != null ? `${url}?v=${encodeURIComponent(videoSet.version)}` : url;
}

// Picks a random idle/response pair within the given transducer group,
// avoiding an immediate repeat of excludeLetter when another option exists.
function pickBenjiIdle(videoSet, transducerGroup, excludeLetter) {
  const all = videoSet.pairs.filter((p) => p.transducerGroup === transducerGroup);
  if (all.length === 0) {
    throw new Error(`No Benji pairs found for transducer group "${transducerGroup}"`);
  }
  const candidates = all.length > 1 ? all.filter((p) => p.letter !== excludeLetter) : all;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return { letter: pick.letter, url: benjiClipUrl(videoSet, pick.idleFile) };
}

// Looks up the response clip paired with the given idle letter. Real clip
// length isn't tracked here — trial-runner.html reads it directly off the
// <video> element once loaded, so swapping/re-cutting a file needs no
// manifest edit.
function benjiResponseFor(videoSet, letter) {
  const pair = videoSet.pairs.find((p) => p.letter === letter);
  if (!pair) {
    throw new Error(`No Benji pair found for letter "${letter}"`);
  }
  return { url: benjiClipUrl(videoSet, pair.responseFile) };
}

// confidence: 'low' | 'high'
function benjiSpontaneousFor(videoSet, confidence) {
  const clip = videoSet.spontaneous[confidence];
  if (!clip) {
    throw new Error(`No Benji spontaneous clip found for confidence "${confidence}"`);
  }
  return { url: benjiClipUrl(videoSet, clip.file) };
}

function benjiConditioningIdle(videoSet) {
  return { url: benjiClipUrl(videoSet, videoSet.conditioning.idleFile) };
}

function benjiConditioningAssist(videoSet) {
  return { url: benjiClipUrl(videoSet, videoSet.conditioning.assistFile) };
}

const Scheduler = {
  computeSchedulingPlan,
  pickIdleLoopUrl,
  pickBenjiIdle,
  benjiResponseFor,
  benjiSpontaneousFor,
  benjiConditioningIdle,
  benjiConditioningAssist,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scheduler;
}
if (typeof window !== 'undefined') {
  window.Scheduler = Scheduler;
}
