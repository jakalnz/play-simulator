'use strict';

// Icon/phrase options shown in the free-form Interact palette, plus a tiny
// no-immediate-repeat picker. Withhold deliberately has no palette entry —
// it only ever happens implicitly when a resolution window expires — see
// PHRASES.withhold below.

const INTERACT_OPTIONS = [
  {
    id: 'encourage_well_done',
    action: 'reinforce',
    icon: '👍',
    phrase: 'Well done! Listen for the next one.',
  },
  {
    id: 'encourage_great_listening',
    action: 'reinforce',
    icon: '😁',
    phrase: 'Great listening!',
  },
  {
    id: 'reinstruct_wait',
    action: 'reinstruct',
    icon: '🗨️',
    phrase: "That was quick — let's wait for the sound.",
  },
  {
    id: 'reinstruct_together',
    action: 'reinstruct',
    icon: '🗨️',
    phrase: "Let's try again together.",
  },
];

const WITHHOLD_LABEL = 'Missed the feedback window';

/**
 * Picks a random entry from `pool`, avoiding `lastValue` when the pool has
 * more than one option (so the same line/icon never shows twice in a row).
 */
function pickNoRepeat(pool, lastValue) {
  if (pool.length <= 1) return pool[0];
  let choice;
  do {
    choice = pool[Math.floor(Math.random() * pool.length)];
  } while (choice === lastValue);
  return choice;
}

const Phrases = {
  interactOptions: INTERACT_OPTIONS,
  withhold: {
    label: WITHHOLD_LABEL,
  },
  pickNoRepeat,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Phrases;
}
if (typeof window !== 'undefined') {
  window.Phrases = Phrases;
}
