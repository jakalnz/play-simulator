'use strict';

// Step 8 — admin case authoring: per-frequency/per-ear trueThreshold table.
// Adapted from pta-simulator's js/threshold-editor.js *rendering pattern*
// (a table of number inputs, one column per frequency) — not a literal
// port, since the source file edits a 10-row physiological patient model
// (cochlear reserve, conductive component, cross-IAA, hysteresis,
// psychometric width) via a patient-model.js dependency this project has
// no equivalent of. play-simulator's case data is a flat
// trueThreshold.{right,left}[freq] dB table, so this is a 2-row version
// bound directly to that shape, no patientModel indirection needed.

(function () {
  const { FREQUENCIES, clampLevel } = window.PtaUtils;
  const ROWS = [
    { ear: 'right', label: 'Right ear (cochlear / BC)', field: 'trueThreshold' },
    { ear: 'right', label: 'Right ear conductive component (air-bone gap)', field: 'conductiveLoss' },
    { ear: 'left', label: 'Left ear (cochlear / BC)', field: 'trueThreshold' },
    { ear: 'left', label: 'Left ear conductive component (air-bone gap)', field: 'conductiveLoss' },
  ];

  function buildThresholdEditor({ caseDraft, tbody, thead, onChange }) {
    function renderHead() {
      if (!thead) return;
      thead.innerHTML = '';
      const labelTh = document.createElement('th');
      labelTh.textContent = 'Ear';
      thead.appendChild(labelTh);
      FREQUENCIES.forEach((freq) => {
        const th = document.createElement('th');
        th.textContent = `${freq} Hz`;
        thead.appendChild(th);
      });
    }

    function render() {
      renderHead();
      tbody.innerHTML = '';
      ROWS.forEach((row) => {
        const tr = document.createElement('tr');
        const labelCell = document.createElement('td');
        labelCell.textContent = row.label;
        labelCell.className = 'row-label';
        tr.appendChild(labelCell);

        FREQUENCIES.forEach((freq) => {
          const td = document.createElement('td');
          const input = document.createElement('input');
          input.type = 'number';
          input.step = 5;
          input.min = -10;
          input.max = 120;
          input.value = caseDraft[row.field][row.ear][freq];
          input.addEventListener('change', () => {
            const clamped = clampLevel(Number(input.value));
            caseDraft[row.field][row.ear][freq] = clamped;
            input.value = clamped;
            onChange?.();
          });
          td.appendChild(input);
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }

    return { render };
  }

  const CaseThresholdEditor = { buildThresholdEditor };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CaseThresholdEditor;
  }
  if (typeof window !== 'undefined') {
    window.CaseThresholdEditor = CaseThresholdEditor;
  }
})();
