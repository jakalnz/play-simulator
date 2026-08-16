'use strict';

// Icon/phrase pools shown to the student after they pick an action, plus a
// tiny no-immediate-repeat picker. Withhold deliberately has no phrase pool
// — see PHRASES.withhold below.

const REINFORCE_ICONS = ['👍', '✋', '😁'];

const REINFORCE_PHRASES = [
  'Well done! Listen for the next one.',
  'Great listening!',
  'Nice one — here we go again.',
  'You got it! Ready for another?',
  'Good job listening!',
  'Lovely response!',
  "That's it — nice and quick!",
];

const REINSTRUCT_ICON = '🗨️';

const REINSTRUCT_PHRASES = [
  "That was a little too quick — let's wait for the sound.",
  'Almost! Let’s listen carefully.',
  "Not quite — let's try again together.",
  "Let's wait for the noise this time.",
  'Good try — let’s listen for the beep first.',
  "Nearly! Ears on, and wait for it.",
];

const WITHHOLD_ICON = '😐';
const WITHHOLD_LABEL = 'No reward, no guidance';

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
  reinforce: {
    icons: REINFORCE_ICONS,
    phrases: REINFORCE_PHRASES,
  },
  reinstruct: {
    icon: REINSTRUCT_ICON,
    phrases: REINSTRUCT_PHRASES,
  },
  withhold: {
    icon: WITHHOLD_ICON,
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
