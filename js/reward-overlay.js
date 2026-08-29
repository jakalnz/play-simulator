'use strict';

// Floats a burst of emoji over the video overlay container when a resolved
// interaction is 'reinforce' or 'reinstruct'. Purely visual — no state
// mutation. Only these two actions render anything; implicit withholds stay
// silent so the overlay is reserved for deliberate feedback.

const REINFORCE_EMOJI = ['👏', '👍', '🎉', '😁'];
const REINSTRUCT_EMOJI = ['🤚', '🙅', '⏳'];

function spawnEmoji(container, emoji, className, delayMs) {
  const el = document.createElement('span');
  el.className = `reward-overlay__emoji ${className}`;
  el.textContent = emoji;
  el.style.top = `${8 + Math.random() * 74}%`;
  el.style.animationDelay = `${delayMs}ms`;
  el.addEventListener('animationend', () => el.remove());
  container.appendChild(el);
}

function play(container, action) {
  if (!container) return;
  if (action !== 'reinforce' && action !== 'reinstruct') return;

  const pool = action === 'reinforce' ? REINFORCE_EMOJI : REINSTRUCT_EMOJI;
  const count = action === 'reinforce' ? 5 : 3;

  for (let i = 0; i < count; i++) {
    const emoji = pool[Math.floor(Math.random() * pool.length)];
    spawnEmoji(container, emoji, action, i * 180);
  }
}

const RewardOverlay = { play };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RewardOverlay;
}
if (typeof window !== 'undefined') {
  window.RewardOverlay = RewardOverlay;
}
