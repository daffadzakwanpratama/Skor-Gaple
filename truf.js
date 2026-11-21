/* =============================================
   TRUF REMI SCORE TRACKER — truf.js
   ============================================= */

const TRUF_STORAGE_KEY = 'truf_remi_session_v1';
const TRUF_NAMES_KEY = 'truf_remi_names_v1';

// Strongest -> Weakest: Sekop > Hati > Keriting > Diamond
const SUITS = [
  { id: 'sekop', name: 'Sekop', symbol: '♠', rank: 4, isRed: false },
  { id: 'hati', name: 'Hati', symbol: '♥', rank: 3, isRed: true },
  { id: 'keriting', name: 'Keriting', symbol: '♣', rank: 2, isRed: false },
  { id: 'diamond', name: 'Diamond', symbol: '♦', rank: 1, isRed: true }
];

const ICONS = {
  crown: `<svg class="truf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M3 18h18v2H3v-2zm0-2l-1-9 5.5 4L12 4l4.5 7L22 7l-1 9H3z"/></svg>`,
  up: `<svg class="truf-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>`,
  down: `<svg class="truf-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`,
  shuffle: `<svg class="truf-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`,
  check: `<svg class="truf-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  medal: `<svg class="truf-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>`,
  equal: `<svg class="truf-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/></svg>`
};

let trufState = null;

function getDefaultState(names) {
  return {
    players: names.map((name, idx) => ({
      id: idx,
      name: name.trim() || `Pemain ${idx + 1}`,
      score: 0,
      lastDelta: null
    })),
    round: 1,
    phase: 'bid', // 'bid' | 'result'
    bids: [
      { value: 3, suit: 'sekop' },
      { value: 3, suit: 'hati' },
      { value: 3, suit: 'keriting' },
      { value: 3, suit: 'diamond' }
    ],
    pas13Snapshot: null,
    results: [3, 3, 3, 3],
    history: []
  };
}

function getSuitObj(suitId) {
  return SUITS.find(s => s.id === suitId) || SUITS[0];
}

function renderMiniPlayingCard(value, suitObj, compact) {
  const redCls = suitObj.isRed ? 'red' : '';
  const compactCls = compact ? 'compact' : '';
  return `
    <div class="truf-mini-card ${redCls} ${compactCls}" aria-hidden="true">
      <span class="truf-mini-card-corner">${value}</span>
      <span class="truf-mini-card-center">${suitObj.symbol}</span>
    </div>
  `;
}

function getHighestBidderIndex(bids) {
  let bestIdx = 0;
  for (let i = 1; i < bids.length; i++) {
    const cur = bids[i];
    const best = bids[bestIdx];
    if (cur.value > best.value) {
      bestIdx = i;
    } else if (cur.value === best.value) {
      if (getSuitObj(cur.suit).rank > getSuitObj(best.suit).rank) {
        bestIdx = i;
      }
    }
  }
  return bestIdx;
}

function getRoundMode(totalBid) {
  if (totalBid > 13) return 'ATAS';
  if (totalBid < 13) return 'BAWAH';
  return 'PAS13';
}

function getRoundLowestPlayerName(historyItem) {
  if (!historyItem || !Array.isArray(historyItem.entries) || !historyItem.entries.length) {
    return null;
  }
  const sorted = [...historyItem.entries].sort((a, b) => {
    const ta = typeof a.totalAfter === 'number' ? a.totalAfter : a.points;
    const tb = typeof b.totalAfter === 'number' ? b.totalAfter : b.points;
    if (ta !== tb) return tb - ta;
    return (b.points || 0) - (a.points || 0);
  });
  return sorted[sorted.length - 1].name;
}

function getKocokStatus(history) {
  if (!Array.isArray(history) || !history.length) return null;
  const shufflerName = getRoundLowestPlayerName(history[0]);
  if (!shufflerName) return null;
  let streak = 0;
  for (let i = 0; i < history.length; i++) {
    if (getRoundLowestPlayerName(history[i]) === shufflerName) {
      streak++;
    } else {
      break;
    }
  }
  return {
    shufflerName,
    streak,
    isJenderal: streak >= 5
  };
}

/**
 * Calculate score for one player in a round.
 * - hasil === bid -> +bid (khusus bid 0: BAWAH -> +10, ATAS -> +5)
 * - ATAS (totalBid > 13): kurang -> -2 * (bid - hasil), lebih -> -1
 * - BAWAH (totalBid < 13): lebih -> -2 * (hasil - bid), kurang -> -1
 */
function calculatePlayerRoundScore(bidVal, resultVal, mode) {
  if (resultVal === bidVal) {
    if (bidVal === 0) {
      const bonus = mode === 'BAWAH' ? 10 : 5;
      return { points: bonus, label: `✓ +${bonus}`, cls: 'pos' };
    }
    return { points: bidVal, label: `✓ +${bidVal}`, cls: 'pos' };
  }
  if (mode === 'ATAS') {
    if (resultVal < bidVal) {
      const diff = bidVal - resultVal;
      const pts = diff * -2;
      return { points: pts, label: `▼${diff} · ${pts}`, cls: 'neg' };
    }
    const diff = resultVal - bidVal;
    return { points: -1, label: `▲${diff} · -1`, cls: 'neg' };
  }
  // mode === 'BAWAH'
  if (resultVal > bidVal) {
    const diff = resultVal - bidVal;
    const pts = diff * -2;
    return { points: pts, label: `▲${diff} · ${pts}`, cls: 'neg' };
  }
  const diff = bidVal - resultVal;
  return { points: -1, label: `▼${diff} · -1`, cls: 'neg' };
}

function saveState() {
  if (trufState) {
    localStorage.setItem(TRUF_STORAGE_KEY, JSON.stringify(trufState));
  }
}

function initSetupScreen() {
  try {
    const savedNames = JSON.parse(localStorage.getItem(TRUF_NAMES_KEY) || 'null');
    if (Array.isArray(savedNames) && savedNames.length === 4) {
      savedNames.forEach((n, i) => {
        const el = document.getElementById(`p-name-${i}`);
        if (el) el.value = n;
      });
    }
  } catch (_) {}

  try {
    const saved = JSON.parse(localStorage.getItem(TRUF_STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.players) && saved.players.length === 4) {
      document.getElementById('truf-resume-wrap').classList.remove('hidden');
      document.getElementById('truf-resume-info').textContent = `R${saved.round}`;
    }
  } catch (_) {}
}

function startNewTrufGame() {
  const names = [0, 1, 2, 3].map(i => {
    const val = document.getElementById(`p-name-${i}`).value.trim();
    return val || `Pemain ${i + 1}`;
  });
  localStorage.setItem(TRUF_NAMES_KEY, JSON.stringify(names));
  trufState = getDefaultState(names);
  saveState();
  showGameView();
}

function resumeSavedTrufGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRUF_STORAGE_KEY) || 'null');
    if (saved) {
      trufState = saved;
      showGameView();
    }
  } catch (_) {
    startNewTrufGame();
  }
}

function showGameView() {
  document.getElementById('truf-setup-view').classList.add('hidden');
  document.getElementById('truf-game-view').classList.remove('hidden');
  document.getElementById('btn-truf-reset').classList.remove('hidden');
  renderAll();
}

function renderAll() {
  renderScoreboard();
  if (trufState.phase === 'bid') {
    document.getElementById('truf-phase-bid').classList.remove('hidden');
    document.getElementById('truf-phase-result').classList.add('hidden');
    renderBidPhase();
  } else {
    document.getElementById('truf-phase-bid').classList.add('hidden');
    document.getElementById('truf-phase-result').classList.remove('hidden');
    renderResultPhase();
  }
  renderHistory();
  renderTotalLeaderboard();
}

function renderScoreboard() {
  const container = document.getElementById('truf-scoreboard');
  const sorted = [...trufState.players].sort((a, b) => b.score - a.score);
  const rankMap = {};
  sorted.forEach((p, idx) => {
    rankMap[p.id] = idx + 1;
  });

  const trufIdx = getHighestBidderIndex(trufState.bids);
  const trufSuit = getSuitObj(trufState.bids[trufIdx].suit);
  const kocok = getKocokStatus(trufState.history);
  const hasRounds = trufState.history.length > 0;

  container.innerHTML = trufState.players.map((p, idx) => {
    const rank = rankMap[p.id];
    const scoreCls = p.score > 0 ? 'pos' : (p.score < 0 ? 'neg' : '');
    const isShuffler = kocok && kocok.shufflerName === p.name;
    const footText = isShuffler
      ? (kocok.isJenderal ? 'JENDERAL (5/5)' : `Kocok ${kocok.streak}/5`)
      : (p.lastDelta === null ? '—' : (p.lastDelta > 0 ? `▲ +${p.lastDelta}` : (p.lastDelta < 0 ? `▼ ${p.lastDelta}` : '• 0')));
    const suitDotColor = trufSuit.isRed ? 'color:#DC2626;' : 'color:#0F172A;';
    const trufDot = idx === trufIdx
      ? `<span class="truf-tile-truf-dot" style="${suitDotColor}" title="Truf ${trufSuit.name}" aria-label="Truf ${trufSuit.name}">${trufSuit.symbol}</span>`
      : '';
    const rankIcon = (rank === 1 && hasRounds) ? `${ICONS.crown} ` : '';

    return `
      <div class="truf-score-tile ${rank === 1 ? 'rank-1' : ''} ${isShuffler ? 'is-shuffler' : ''}">
        <div class="truf-tile-top">
          <span class="truf-tile-rank">${rankIcon}#${rank}</span>
          ${trufDot}
        </div>
        <div class="truf-tile-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
        <div class="truf-tile-score ${scoreCls}">${p.score}</div>
        <div class="truf-tile-foot ${isShuffler ? 'shuffler' : ''}">${footText}</div>
      </div>
    `;
  }).join('');
}

function renderBidPhase() {
  document.getElementById('bid-round-num').textContent = trufState.round;
  const totalBid = trufState.bids.reduce((sum, b) => sum + b.value, 0);
  const mode = getRoundMode(totalBid);
  const highestIdx = getHighestBidderIndex(trufState.bids);
  const highestSuit = getSuitObj(trufState.bids[highestIdx].suit);

  const totalPill = document.getElementById('bid-total-pill');
  const pillLabel = mode === 'ATAS' ? 'Atas' : (mode === 'BAWAH' ? 'Bawah' : 'Pas 13');
  totalPill.textContent = `${pillLabel} · ${totalBid}/13`;
  totalPill.className = 'truf-badge ' + (
    mode === 'ATAS' ? 'truf-badge-atas' :
    mode === 'BAWAH' ? 'truf-badge-bawah' : 'truf-badge-pas13'
  );

  const rowsEl = document.getElementById('truf-bid-rows');
  rowsEl.innerHTML = trufState.players.map((p, idx) => {
    const b = trufState.bids[idx];
    const suitObj = getSuitObj(b.suit);
    const isHighest = idx === highestIdx;
    const suitBtns = SUITS.map(s => `
      <button
        class="truf-suit-btn ${s.isRed ? 'red' : ''} ${b.suit === s.id ? 'active' : ''}"
        title="${s.name}"
        onclick="setPlayerSuit(${idx}, '${s.id}')"
      >${s.symbol}</button>
    `).join('');

    return `
      <div class="truf-player-row ${isHighest ? 'winner-bid' : ''}">
        <div class="truf-row-left">
          ${renderMiniPlayingCard(b.value, suitObj, false)}
          <div class="truf-row-name">
            ${escapeHtml(p.name)}
            ${isHighest ? `<span class="truf-suit-emblem sm" style="${suitObj.isRed ? 'color:#DC2626;' : 'color:#0F172A;'}" title="Truf ${suitObj.name}" aria-label="Truf ${suitObj.name}">${suitObj.symbol}</span>` : ''}
          </div>
        </div>
        <div class="truf-controls">
          <div class="truf-stepper">
            <button class="truf-step-btn" onclick="changeBidValue(${idx}, -1)">−</button>
            <span class="truf-step-val">${b.value}</span>
            <button class="truf-step-btn" onclick="changeBidValue(${idx}, 1)">+</button>
          </div>
          <div class="truf-suit-group">${suitBtns}</div>
        </div>
      </div>
    `;
  }).join('');

  // Compact visual summary strip
  const modeBadge = mode === 'ATAS'
    ? `<span class="truf-badge truf-badge-atas">${ICONS.up} Atas</span>`
    : mode === 'BAWAH'
    ? `<span class="truf-badge truf-badge-bawah">${ICONS.down} Bawah</span>`
    : `<span class="truf-badge truf-badge-pas13">${ICONS.equal} Pas 13</span>`;

  const editPas13Btn = (mode !== 'PAS13' && Array.isArray(trufState.pas13Snapshot))
    ? `<button class="btn btn-sm btn-outline truf-pas13-revert-btn" type="button" onclick="revertPas13Adjustment()" title="Ubah kembali pilihan Pas 13">Edit</button>`
    : '';

  document.getElementById('truf-bid-summary').innerHTML = `
    <div style="display:flex;align-items:center;gap:0.55rem;">
      <span class="truf-suit-emblem" style="${highestSuit.isRed ? 'color:#DC2626;' : 'color:#0F172A;'}" title="Truf ${highestSuit.name}" aria-label="Truf ${highestSuit.name}">${highestSuit.symbol}</span>
      <strong style="color:#0F172A;">${escapeHtml(trufState.players[highestIdx].name)}</strong>
    </div>
    <div class="truf-summary-right">${modeBadge}${editPas13Btn}</div>
  `;

  // Pas 13 Box
  const pasBox = document.getElementById('truf-pas13-box');
  const lockBtn = document.getElementById('btn-lock-bid');
  if (mode === 'PAS13') {
    pasBox.classList.remove('hidden');
    document.getElementById('truf-pas13-desc').innerHTML =
      `<strong>${escapeHtml(trufState.players[highestIdx].name)}</strong> (${trufState.bids[highestIdx].value} ${highestSuit.symbol})`;
    lockBtn.disabled = true;
  } else {
    pasBox.classList.add('hidden');
    lockBtn.disabled = false;
  }
}

function changeBidValue(playerIdx, delta) {
  const next = Math.max(0, Math.min(13, trufState.bids[playerIdx].value + delta));
  trufState.bids[playerIdx].value = next;
  trufState.pas13Snapshot = null;
  saveState();
  renderScoreboard();
  renderBidPhase();
}

function setPlayerSuit(playerIdx, suitId) {
  trufState.bids[playerIdx].suit = suitId;
  if (Array.isArray(trufState.pas13Snapshot) && trufState.pas13Snapshot[playerIdx]) {
    trufState.pas13Snapshot[playerIdx].suit = suitId;
  }
  saveState();
  renderScoreboard();
  renderBidPhase();
}

let pas13CustomDelta = 1;

function changePas13Delta(step) {
  pas13CustomDelta = Math.max(1, Math.min(13, pas13CustomDelta + step));
  const valEl = document.getElementById('pas13-delta-val');
  if (valEl) valEl.textContent = pas13CustomDelta;
  document.querySelectorAll('.pas13-delta-label').forEach(el => {
    el.textContent = pas13CustomDelta;
  });
}

function applyCustomPas13(sign) {
  adjustBidsFromPas13(sign * pas13CustomDelta);
}

function adjustBidsFromPas13(delta) {
  trufState.pas13Snapshot = trufState.bids.map(b => ({ value: b.value, suit: b.suit }));
  trufState.bids.forEach(b => {
    b.value = Math.max(0, Math.min(13, b.value + delta));
  });
  saveState();
  renderScoreboard();
  renderBidPhase();
}

function revertPas13Adjustment() {
  if (!Array.isArray(trufState.pas13Snapshot) || trufState.pas13Snapshot.length !== 4) return;
  trufState.bids = trufState.pas13Snapshot.map(b => ({ value: b.value, suit: b.suit }));
  trufState.pas13Snapshot = null;
  saveState();
  renderScoreboard();
  renderBidPhase();
}

function lockBidsAndPlay() {
  const totalBid = trufState.bids.reduce((sum, b) => sum + b.value, 0);
  if (totalBid === 13) return;
  trufState.phase = 'result';
  trufState.results = [0, 0, 0, 0];
  saveState();
  renderAll();
}

function backToBidPhase() {
  trufState.phase = 'bid';
  saveState();
  renderAll();
}

function renderResultPhase() {
  document.getElementById('res-round-num').textContent = trufState.round;
  const totalBid = trufState.bids.reduce((sum, b) => sum + b.value, 0);
  const mode = getRoundMode(totalBid);
  const highestIdx = getHighestBidderIndex(trufState.bids);
  const highestSuit = getSuitObj(trufState.bids[highestIdx].suit);

  const totalResult = trufState.results.reduce((sum, v) => sum + v, 0);
  const resPill = document.getElementById('res-total-pill');
  resPill.innerHTML = totalResult === 13 ? `${ICONS.check} 13/13` : `${totalResult}/13`;
  resPill.className = 'truf-badge ' + (
    totalResult === 13 ? 'truf-badge-bawah' :
    totalResult > 13 ? 'truf-badge-atas' : 'truf-badge-pas13'
  );

  const fillEl = document.getElementById('res-progress-fill');
  if (fillEl) {
    const pct = Math.min(100, Math.round((totalResult / 13) * 100));
    fillEl.style.width = `${pct}%`;
    fillEl.className = 'truf-progress-fill' + (
      totalResult === 13 ? ' exact' :
      totalResult > 13 ? ' over' : ''
    );
  }

  const modeChip = mode === 'ATAS'
    ? `<span class="truf-badge truf-badge-atas" style="padding:0.18rem 0.55rem;font-size:0.78rem;">${ICONS.up} Atas · ${totalBid}</span>`
    : `<span class="truf-badge truf-badge-bawah" style="padding:0.18rem 0.55rem;font-size:0.78rem;">${ICONS.down} Bawah · ${totalBid}</span>`;

  document.getElementById('truf-active-banner').innerHTML = `
    <span class="truf-active-suit-chip" title="Truf ${highestSuit.name}">
      <span class="truf-active-suit-sym" style="${highestSuit.isRed ? 'color:#DC2626;' : 'color:#0F172A;'}">${highestSuit.symbol}</span>
      <span>${escapeHtml(trufState.players[highestIdx].name)}</span>
    </span>
    ${modeChip}
  `;

  const rowsEl = document.getElementById('truf-result-rows');
  rowsEl.innerHTML = trufState.players.map((p, idx) => {
    const bid = trufState.bids[idx];
    const suitObj = getSuitObj(bid.suit);
    const res = trufState.results[idx];
    const preview = calculatePlayerRoundScore(bid.value, res, mode);
    const isHighest = idx === highestIdx;

    return `
      <div class="truf-player-row ${isHighest ? 'winner-bid' : ''}">
        <div class="truf-row-left">
          ${renderMiniPlayingCard(bid.value, suitObj, true)}
          <div class="truf-row-name">
            ${escapeHtml(p.name)}
            ${isHighest ? `<span class="truf-suit-emblem sm" style="${suitObj.isRed ? 'color:#DC2626;' : 'color:#0F172A;'}" title="Truf ${suitObj.name}" aria-label="Truf ${suitObj.name}">${suitObj.symbol}</span>` : ''}
          </div>
        </div>
        <div class="truf-controls">
          <div class="truf-stepper">
            <button class="truf-step-btn" onclick="changeResultValue(${idx}, -1)">−</button>
            <span class="truf-step-val">${res}</span>
            <button class="truf-step-btn" onclick="changeResultValue(${idx}, 1)">+</button>
          </div>
          <span class="truf-preview-pill ${preview.cls}">${preview.label}</span>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('btn-save-round').disabled = totalResult !== 13;
}

function changeResultValue(playerIdx, delta) {
  const next = Math.max(0, Math.min(13, trufState.results[playerIdx] + delta));
  trufState.results[playerIdx] = next;
  saveState();
  renderResultPhase();
}

function saveRoundResult() {
  const totalResult = trufState.results.reduce((sum, v) => sum + v, 0);
  if (totalResult !== 13) return;

  const totalBid = trufState.bids.reduce((sum, b) => sum + b.value, 0);
  const mode = getRoundMode(totalBid);
  const highestIdx = getHighestBidderIndex(trufState.bids);
  const highestSuit = getSuitObj(trufState.bids[highestIdx].suit);

  const roundEntries = trufState.players.map((p, idx) => {
    const bidVal = trufState.bids[idx].value;
    const resVal = trufState.results[idx];
    const calc = calculatePlayerRoundScore(bidVal, resVal, mode);
    p.score += calc.points;
    p.lastDelta = calc.points;
    return {
      name: p.name,
      bid: bidVal,
      suit: trufState.bids[idx].suit,
      result: resVal,
      points: calc.points,
      totalAfter: p.score,
      isTrufMaker: idx === highestIdx
    };
  });

  trufState.history.unshift({
    round: trufState.round,
    mode,
    totalBid,
    trufMaker: trufState.players[highestIdx].name,
    trufSuit: highestSuit.id,
    entries: roundEntries
  });

  trufState.round += 1;
  trufState.phase = 'bid';
  trufState.pas13Snapshot = null;
  trufState.results = [0, 0, 0, 0];
  saveState();
  renderAll();

  const kocok = getKocokStatus(trufState.history);
  if (kocok && kocok.isJenderal) {
    showWinnerModal(kocok.shufflerName);
  }
}

function undoLastRound() {
  if (!trufState.history.length) return;
  const last = trufState.history.shift();
  last.entries.forEach((entry, idx) => {
    trufState.players[idx].score -= entry.points;
    trufState.players[idx].lastDelta = null;
  });
  trufState.round = last.round;
  trufState.phase = 'bid';
  trufState.pas13Snapshot = null;
  saveState();
  renderAll();
}

function renderHistory() {
  const listEl = document.getElementById('truf-history-list');
  const undoBtn = document.getElementById('btn-undo-round');
  if (!trufState.history.length) {
    undoBtn.classList.add('hidden');
    listEl.innerHTML = `<p style="font-size: 0.8rem; color: #64748B; text-align: center; padding: 1rem 0;">Belum ada ronde</p>`;
    return;
  }
  undoBtn.classList.remove('hidden');

  listEl.innerHTML = trufState.history.map(item => {
    const suit = getSuitObj(item.trufSuit);
    const modeLabel = item.mode === 'ATAS' ? 'Atas' : 'Bawah';
    const modeCls = item.mode === 'ATAS' ? 'truf-badge-atas' : 'truf-badge-bawah';

    const rankedEntries = [...item.entries].sort((a, b) => {
      const ta = typeof a.totalAfter === 'number' ? a.totalAfter : a.points;
      const tb = typeof b.totalAfter === 'number' ? b.totalAfter : b.points;
      return tb - ta;
    });

    const rows = rankedEntries.map((e, rankIdx) => {
      const eSuit = getSuitObj(e.suit);
      const ptsStr = e.points > 0 ? `+${e.points}` : `${e.points}`;
      const ptsColor = e.points > 0 ? '#059669' : (e.points < 0 ? '#DC2626' : '#64748B');
      const totalVal = typeof e.totalAfter === 'number' ? e.totalAfter : e.points;
      const totalColor = totalVal > 0 ? '#059669' : (totalVal < 0 ? '#DC2626' : '#0F172A');
      const trufTag = (e.isTrufMaker || e.name === item.trufMaker)
        ? `<span class="truf-suit-emblem xs" style="${suit.isRed ? 'color:#DC2626;' : 'color:#0F172A;'}" title="Truf ${suit.name}" aria-label="Truf ${suit.name}">${suit.symbol}</span>`
        : '';

      return `
        <div class="truf-lb-row ${rankIdx === 0 ? 'rank-1' : ''}">
          <div class="truf-lb-left">
            <span class="truf-lb-rank">#${rankIdx + 1}</span>
            <div>
              <div class="truf-lb-name">${escapeHtml(e.name)} ${trufTag}</div>
              <div class="truf-lb-meta"><span style="${eSuit.isRed ? 'color:#DC2626;' : ''}">${e.bid}${eSuit.symbol}</span> → ${e.result}</div>
            </div>
          </div>
          <div class="truf-lb-right">
            <span class="truf-lb-score" style="color:${totalColor};">${totalVal}</span>
            <span class="truf-lb-delta" style="color:${ptsColor};">${ptsStr}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="truf-history-item">
        <div class="truf-history-head">
          <span>R${item.round} · <strong style="font-size:1.15rem;line-height:1;${suit.isRed ? 'color:#DC2626;' : 'color:#0F172A;'}">${suit.symbol}</strong></span>
          <span class="truf-badge ${modeCls}" style="font-size:0.74rem;padding:0.16rem 0.55rem;">${modeLabel} · ${item.totalBid}</span>
        </div>
        <div class="truf-lb-list">${rows}</div>
      </div>
    `;
  }).join('');
}

function renderTotalLeaderboard() {
  const lbEl = document.getElementById('truf-total-leaderboard');
  const badgeEl = document.getElementById('truf-total-rounds-badge');
  if (!lbEl) return;

  const totalRounds = trufState.history.length;
  if (badgeEl) badgeEl.textContent = `${totalRounds}R`;
  const kocok = getKocokStatus(trufState.history);

  const sorted = [...trufState.players].sort((a, b) => b.score - a.score);
  lbEl.innerHTML = sorted.map((p, idx) => {
    const rank = idx + 1;
    const scoreColor = p.score > 0 ? '#059669' : (p.score < 0 ? '#DC2626' : '#0F172A');
    const deltaChip = p.lastDelta === null
      ? '—'
      : (p.lastDelta > 0 ? `▲+${p.lastDelta}` : (p.lastDelta < 0 ? `▼${p.lastDelta}` : '•0'));

    let pasCount = 0;
    trufState.history.forEach(item => {
      const entry = item.entries.find(e => e.name === p.name);
      if (entry && entry.bid === entry.result) pasCount++;
    });

    const isShuffler = kocok && kocok.shufflerName === p.name;
    const shufflerTag = isShuffler
      ? `<span class="truf-kocok-tag ${kocok.isJenderal ? 'jenderal' : ''}">${kocok.isJenderal ? 'JENDERAL' : `Kocok ${kocok.streak}/5`}</span>`
      : '';
    const pasMeta = pasCount > 0 ? ` · ${ICONS.check} ${pasCount}` : '';

    return `
      <div class="truf-lb-row ${rank === 1 ? 'rank-1' : ''} ${isShuffler ? 'is-shuffler' : ''}">
        <div class="truf-lb-left">
          <span class="truf-lb-rank">#${rank}</span>
          <div>
            <div class="truf-lb-name">${escapeHtml(p.name)} ${shufflerTag}</div>
            <div class="truf-lb-meta">${deltaChip}${pasMeta}</div>
          </div>
        </div>
        <div class="truf-lb-right">
          <span class="truf-lb-score" style="color:${scoreColor};">${p.score}</span>
        </div>
      </div>
    `;
  }).join('');
}

function showWinnerModal(jenderalName) {
  const sorted = [...trufState.players].sort((a, b) => b.score - a.score);
  const titleEl = document.querySelector('#modal-winner h3');
  if (jenderalName) {
    if (titleEl) titleEl.textContent = `🎖️ JENDERAL!`;
    document.getElementById('winner-subtitle').innerHTML =
      `<strong style="color:#DC2626;">${escapeHtml(jenderalName)}</strong> kocok 5× beruntun · Juara: <strong>${escapeHtml(sorted[0].name)}</strong> (${sorted[0].score})`;
  } else {
    if (titleEl) titleEl.textContent = `Hasil Akhir`;
    document.getElementById('winner-subtitle').textContent =
      `${trufState.history.length} Ronde · Juara: ${sorted[0].name} (${sorted[0].score})`;
  }
  document.getElementById('winner-standings').innerHTML = sorted.map((p, idx) => {
    const isJen = jenderalName && p.name === jenderalName;
    return `
      <div style="display:flex;justify-content:space-between;padding:0.6rem 0.8rem;border-radius:10px;background:${isJen ? '#FEF2F2' : '#F8FAFC'};border:1px solid ${isJen ? '#FECACA' : '#E2E8F0'};">
        <span><strong>#${idx + 1}</strong> ${escapeHtml(p.name)} ${isJen ? '<span style="color:#DC2626;font-weight:800;">(🎖️ JENDERAL)</span>' : ''}</span>
        <strong style="color:${p.score >= 0 ? '#059669' : '#DC2626'};">${p.score}</strong>
      </div>
    `;
  }).join('');
  document.getElementById('modal-winner').classList.remove('hidden');
}

function closeWinnerModal() {
  document.getElementById('modal-winner').classList.add('hidden');
}

function openRulesModal() {
  document.getElementById('modal-rules').classList.remove('hidden');
}

function closeRulesModal() {
  document.getElementById('modal-rules').classList.add('hidden');
}

function confirmResetSession() {
  if (confirm('Reset sesi Truf saat ini dan kembali ke pengaturan pemain?')) {
    resetSessionNow();
  }
}

function resetSessionNow() {
  localStorage.removeItem(TRUF_STORAGE_KEY);
  trufState = null;
  closeWinnerModal();
  document.getElementById('truf-game-view').classList.add('hidden');
  document.getElementById('truf-setup-view').classList.remove('hidden');
  document.getElementById('btn-truf-reset').classList.add('hidden');
  document.getElementById('truf-resume-wrap').classList.add('hidden');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', initSetupScreen);
