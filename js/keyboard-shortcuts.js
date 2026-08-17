'use strict';

// Copied from jakalnz/pta-simulator js/keyboard-shortcuts.js, de-modularized.
// Space = press-and-hold Present (mirrors the Present button's own
// pointerdown/pointerup pattern), arrows = level/frequency, Shift+arrows =
// masking level, M = toggle masking, S = Store, Delete = delete stored
// point, 1-4 = fire the numbered Interact option directly (no open/close
// step — the options are always on screen).
(function () {
  function wireKeyboardShortcuts({ engine, onStore, onDelete, onLevelChange, onPresentStart, onPresentEnd, onInteractOption }) {
    function isTextInput(el) {
      return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }

    document.addEventListener('keyup', (e) => {
      if (isTextInput(document.activeElement)) return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        onPresentEnd?.();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (isTextInput(document.activeElement)) return;

      switch (e.key) {
        case 'm':
        case 'M':
          engine.toggleMasking();
          break;
        case 'ArrowUp':
          if (e.shiftKey) {
            engine.adjustMaskingLevel(5);
          } else {
            engine.adjustPresentedLevel(1);
            onLevelChange?.();
          }
          e.preventDefault();
          break;
        case 'ArrowDown':
          if (e.shiftKey) {
            engine.adjustMaskingLevel(-5);
          } else {
            engine.adjustPresentedLevel(-1);
            onLevelChange?.();
          }
          e.preventDefault();
          break;
        case 'ArrowLeft':
          engine.stepFrequency(-1);
          break;
        case 'ArrowRight':
          engine.stepFrequency(1);
          break;
        case 's':
        case 'S':
          onStore?.();
          break;
        case 'Delete':
          e.preventDefault();
          onDelete?.();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          e.preventDefault();
          onInteractOption?.(Number(e.key) - 1);
          break;
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          if (!e.repeat) onPresentStart?.();
          break;
        default:
          break;
      }
    });
  }

  const KeyboardShortcuts = { wireKeyboardShortcuts };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyboardShortcuts;
  }
  if (typeof window !== 'undefined') {
    window.KeyboardShortcuts = KeyboardShortcuts;
  }
})();
