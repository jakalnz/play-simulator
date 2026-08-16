'use strict';

// Step 7 — session summary / scoring screen. Pure aggregation over
// state.responseHistory (built by childModel.js's applyResolvedTrial(),
// extended in trial-runner.html's chooseAction() with `judgement`,
// `isCorrect`, `mode`, `masked`, `presentedLevel`) — no new state-tracking,
// see js/audiogram-chart.js and js/utils.js for the modules this reuses.
// Same de-modularized plain-global pattern as the rest of js/.

(function () {
  const ACTIONS = ['reinforce', 'reinstruct', 'withhold'];
  const OUTCOME_LABELS = { genuine_response: 'Genuine', false_positive: 'False positive' };
  const ACTION_LABELS = { reinforce: 'Reinforce', reinstruct: 'Re-instruct', withhold: 'Withhold' };
  const BAD_CELLS = new Set([
    'false_positive|reinforce',
    'genuine_response|withhold',
    'false_positive|withhold',
  ]);
  const MIN_GROUP_N = 3;

  function pct(n, d) {
    return d === 0 ? null : Math.round((n / d) * 1000) / 10;
  }

  function fmtPct(n, d) {
    const p = pct(n, d);
    return p === null ? '—' : `${p}%`;
  }

  // ==========================================================================
  // 1. Judgement accuracy
  // ==========================================================================
  function computeAccuracy(history) {
    const judged = history.filter((e) => e.phase === 'testing' && e.judgement != null);
    const correct = judged.filter((e) => e.isCorrect).length;

    const byEar = {};
    const byFreq = {};
    judged.forEach((e) => {
      const ear = e.stimulus.ear;
      const freq = e.stimulus.freq;
      (byEar[ear] = byEar[ear] || []).push(e);
      (byFreq[freq] = byFreq[freq] || []).push(e);
    });

    function summarize(groups) {
      const out = {};
      Object.keys(groups).forEach((k) => {
        const g = groups[k];
        if (g.length >= MIN_GROUP_N) {
          out[k] = { n: g.length, correct: g.filter((e) => e.isCorrect).length };
        }
      });
      return out;
    }

    const missedGenuine = judged.filter(
      (e) => e.outcome === 'genuine_response' && e.judgement === 'not_accept'
    ).length;
    const acceptedFalsePositive = judged.filter(
      (e) => e.outcome === 'false_positive' && e.judgement === 'accept'
    ).length;
    const acceptedNoResponse = judged.filter(
      (e) => e.outcome === 'no_response' && e.judgement === 'accept'
    ).length;

    return {
      total: judged.length,
      correct,
      byEar: summarize(byEar),
      byFreq: summarize(byFreq),
      missedGenuine,
      acceptedFalsePositive,
      acceptedNoResponse,
    };
  }

  function renderAccuracy(el, acc) {
    if (acc.total === 0) {
      el.innerHTML = '<p class="summary-empty">No testing-phase trials judged yet.</p>';
      return;
    }

    const rows = [];
    rows.push(`
      <div class="summary-stat-row">
        <div class="summary-stat">
          <span class="summary-stat__label">Overall accuracy</span>
          <span class="summary-stat__value">${fmtPct(acc.correct, acc.total)} (${acc.correct}/${acc.total})</span>
        </div>
        <div class="summary-stat">
          <span class="summary-stat__label">Missed genuine responses</span>
          <span class="summary-stat__value">${acc.missedGenuine}</span>
        </div>
        <div class="summary-stat">
          <span class="summary-stat__label">Accepted false positives</span>
          <span class="summary-stat__value">${acc.acceptedFalsePositive}</span>
        </div>
        <div class="summary-stat">
          <span class="summary-stat__label">Accepted no-response</span>
          <span class="summary-stat__value">${acc.acceptedNoResponse}</span>
        </div>
      </div>
    `);

    function groupTable(title, groups, fmtKey) {
      const keys = Object.keys(groups);
      if (keys.length === 0) return '';
      const cells = keys
        .map((k) => `<th>${fmtKey(k)}</th>`)
        .join('');
      const vals = keys
        .map((k) => `<td>${fmtPct(groups[k].correct, groups[k].n)} (${groups[k].correct}/${groups[k].n})</td>`)
        .join('');
      return `
        <div style="margin-top:0.5rem;">
          <div class="sparkline-block__label">${title}</div>
          <table class="summary-table"><thead><tr>${cells}</tr></thead><tbody><tr>${vals}</tr></tbody></table>
        </div>
      `;
    }

    rows.push(groupTable('By ear', acc.byEar, (k) => k[0].toUpperCase() + k.slice(1)));
    rows.push(groupTable('By frequency', acc.byFreq, (k) => `${k} Hz`));

    el.innerHTML = rows.join('');
  }

  // ==========================================================================
  // 2. Action appropriateness
  // ==========================================================================
  function computeActionTable(history) {
    const testing = history.filter((e) => e.phase === 'testing');
    const cells = {};
    ['genuine_response', 'false_positive'].forEach((outcome) => {
      ACTIONS.forEach((action) => {
        cells[`${outcome}|${action}`] = 0;
      });
    });
    let noResponseCount = 0;

    testing.forEach((e) => {
      if (e.outcome === 'no_response') {
        noResponseCount += 1;
        return;
      }
      const key = `${e.outcome}|${e.action}`;
      if (key in cells) cells[key] += 1;
    });

    return { cells, noResponseCount, total: testing.length };
  }

  function renderActionTable(el, table) {
    if (table.total === 0) {
      el.innerHTML = '<p class="summary-empty">No testing-phase trials yet.</p>';
      return;
    }

    const outcomes = ['genuine_response', 'false_positive'];
    const header = `<tr><th></th>${ACTIONS.map((a) => `<th>${ACTION_LABELS[a]}</th>`).join('')}</tr>`;
    const rows = outcomes
      .map((outcome) => {
        const cells = ACTIONS.map((action) => {
          const key = `${outcome}|${action}`;
          const isBad = BAD_CELLS.has(key);
          return `<td class="${isBad ? 'bad-cell' : ''}">${table.cells[key]}</td>`;
        }).join('');
        return `<tr><th>${OUTCOME_LABELS[outcome]}</th>${cells}</tr>`;
      })
      .join('');

    el.innerHTML = `
      <table class="summary-table">
        <thead>${header}</thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:0.8rem; color:#666; margin-top:0.4rem;">
        No response (any action): ${table.noResponseCount}
      </p>
    `;
  }

  // ==========================================================================
  // 3. Conditioning trajectory
  // ==========================================================================
  function buildSparklinePath(points, { min, max }) {
    // points: [{trial, value}], sorted by trial. Breaks the polyline
    // wherever trial numbers aren't consecutive (per-game history only has
    // an entry on trials that game was active for).
    if (points.length === 0) return '';
    const width = 300;
    const height = 60;
    const pad = 4;
    const trials = points.map((p) => p.trial);
    const minTrial = Math.min(...trials);
    const maxTrial = Math.max(...trials);
    const trialSpan = Math.max(1, maxTrial - minTrial);
    const valueSpan = Math.max(1e-6, max - min);

    function xFor(trial) {
      return pad + ((trial - minTrial) / trialSpan) * (width - 2 * pad);
    }
    function yFor(value) {
      return height - pad - ((value - min) / valueSpan) * (height - 2 * pad);
    }

    let d = '';
    points.forEach((p, i) => {
      const prev = points[i - 1];
      const broken = !prev || p.trial - prev.trial > 1;
      d += `${broken ? 'M' : 'L'} ${xFor(p.trial).toFixed(1)} ${yFor(p.value).toFixed(1)} `;
    });

    return { d, width, height };
  }

  function sparklineSvg(points, range, markers) {
    const built = buildSparklinePath(points, range);
    if (!built) return '<p class="summary-empty">No data.</p>';
    const { d, width, height } = built;
    const trials = points.map((p) => p.trial);
    const minTrial = Math.min(...trials);
    const maxTrial = Math.max(...trials);
    const trialSpan = Math.max(1, maxTrial - minTrial);
    const markerEls = (markers || [])
      .map((m) => {
        const x = 4 + ((m.trial - minTrial) / trialSpan) * (width - 8);
        return `<circle cx="${x.toFixed(1)}" cy="${height / 2}" r="4" fill="#b30000" />`;
      })
      .join('');
    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="60" preserveAspectRatio="none" style="display:block;">
        <path d="${d}" fill="none" stroke="#1f5fd2" stroke-width="2" />
        ${markerEls}
      </svg>
    `;
  }

  function computeTrajectory(history) {
    const games = [...new Set(history.map((e) => e.activeGame))];
    const perGame = games.map((game) => {
      const points = history
        .filter((e) => e.activeGame === game)
        .map((e) => ({ trial: e.trial, value: e.conditioningLevel }));
      const testingPoints = history.filter((e) => e.activeGame === game && e.phase === 'testing');
      const markers = [];
      let wasUnconditioned = false;
      testingPoints.forEach((e) => {
        if (e.isUnconditioned && !wasUnconditioned) {
          markers.push({ trial: e.trial });
        }
        wasUnconditioned = e.isUnconditioned;
      });
      return { game, points, markers };
    });

    const engagementPoints = history.map((e) => ({ trial: e.trial, value: e.engagementLevel }));

    return { perGame, engagementPoints };
  }

  function renderTrajectory(el, traj) {
    if (traj.engagementPoints.length === 0) {
      el.innerHTML = '<p class="summary-empty">No trials yet.</p>';
      return;
    }

    const blocks = [];
    traj.perGame.forEach(({ game, points, markers }) => {
      blocks.push(`
        <div class="sparkline-block">
          <div class="sparkline-block__label">Conditioning level — ${game}</div>
          ${sparklineSvg(points, { min: 0, max: 100 }, markers)}
          ${markers.length ? markers.map((m) => `<div class="sparkline-block__caption">Child lost conditioning around trial ${m.trial} (${game}).</div>`).join('') : ''}
        </div>
      `);
    });

    blocks.push(`
      <div class="sparkline-block">
        <div class="sparkline-block__label">Engagement level</div>
        ${sparklineSvg(traj.engagementPoints, { min: 0, max: 100 })}
      </div>
    `);

    el.innerHTML = blocks.join('');
  }

  // ==========================================================================
  // 4. Audiogram: recorded (accept+reinforce+genuine) vs trueThreshold
  // ==========================================================================
  function buildAudiogramPoints(state) {
    const history = state.responseHistory;

    const qualifying = history.filter(
      (e) =>
        e.phase === 'testing' &&
        e.judgement === 'accept' &&
        e.action === 'reinforce' &&
        e.outcome === 'genuine_response' &&
        e.presentedLevel != null
    );

    // One point per (ear, freq, mode, masked), keeping the lowest
    // presentedLevel — a threshold search presents several levels at the
    // same frequency; without this reduction the connecting-line drawer's
    // last-write-wins keying would pick an arbitrary stacked symbol.
    const byKey = new Map();
    qualifying.forEach((e) => {
      const key = `${e.stimulus.ear}|${e.stimulus.freq}|${e.mode}|${e.masked}`;
      const existing = byKey.get(key);
      if (!existing || e.presentedLevel < existing.level) {
        byKey.set(key, {
          ear: e.stimulus.ear,
          freq: e.stimulus.freq,
          mode: e.mode,
          masked: e.masked,
          level: e.presentedLevel,
          noResponse: false,
        });
      }
    });
    const recorded = [...byKey.values()];

    // Reference: trueThreshold for every (ear, freq) actually tested
    // (present in responseHistory at all, regardless of outcome) — never
    // fabricate a point for an untested combination.
    const testedPairs = new Set();
    history.forEach((e) => {
      testedPairs.add(`${e.stimulus.ear}|${e.stimulus.freq}`);
    });
    const reference = [];
    testedPairs.forEach((key) => {
      const [ear, freqStr] = key.split('|');
      const freq = Number(freqStr);
      const level = state.trueThreshold[ear] && state.trueThreshold[ear][freq];
      if (level == null) return;
      reference.push({ ear, freq, mode: 'AC', masked: false, level, noResponse: false, reference: true });
    });

    return [...recorded, ...reference];
  }

  function renderAudiogram(canvasEl, state) {
    if (!canvasEl || !window.AudiogramChart) return;
    const points = buildAudiogramPoints(state);
    window.AudiogramChart.renderAudiogram(canvasEl, points);
  }

  // ==========================================================================
  // Entry point
  // ==========================================================================
  function render({ accuracyEl, actionTableEl, trajectoryEl, audiogramCanvas }, state) {
    const history = state.responseHistory || [];
    if (accuracyEl) renderAccuracy(accuracyEl, computeAccuracy(history));
    if (actionTableEl) renderActionTable(actionTableEl, computeActionTable(history));
    if (trajectoryEl) renderTrajectory(trajectoryEl, computeTrajectory(history));
    if (audiogramCanvas) renderAudiogram(audiogramCanvas, state);
  }

  const SessionSummary = {
    computeAccuracy,
    computeActionTable,
    computeTrajectory,
    buildAudiogramPoints,
    render,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionSummary;
  }
  if (typeof window !== 'undefined') {
    window.SessionSummary = SessionSummary;
  }
})();
