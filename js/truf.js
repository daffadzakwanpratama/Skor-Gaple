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
let prevTrufScoreSnapshot = null;
let animateLatestTrufRound = false;

function shouldAnimateTrufUI() {
  if (typeof document === 'undefined' || !document.body) return false;
  if (document.body.classList.contains('lite-mode')) return false;
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }
  return true;
}

function animateTrufScoreNumber(el, from, to, duration = 420) {
  if (!el || from === to) return;
  if (typeof requestAnimationFrame !== 'function') {
    el.textContent = String(to);
    return;
  }
  const start = performance.now();
  el.textContent = String(from);
  el.classList.remove('score-pop');
  void el.offsetWidth;
  el.classList.add('score-pop');
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(from + (to - from) * eased);
    el.textContent = String(current);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = String(to);
    }
  }
  requestAnimationFrame(step);
}

function spawnTrufDeltaFloat(anchorEl, delta) {
  if (!anchorEl || !delta) return;
  const badge = document.createElement('span');
  const cls = delta > 0 ? 'good' : 'bad';
  badge.className = `score-delta-float ${cls}`;
  badge.textContent = delta > 0 ? `+${delta}` : String(delta);
  anchorEl.appendChild(badge);
  setTimeout(() => badge.remove(), 900);
}

function bumpTrufStepVal(el) {
  if (!el || !shouldAnimateTrufUI()) return;
  el.classList.remove('step-val-bump');
  void el.offsetWidth;
  el.classList.add('step-val-bump');
}

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
 * - gagal bid 0 (hasil > 0):
 *   - BAWAH: -10 - (hasil - 1) * 2 (1 -> -10, 2 -> -12, dst.)
 *   - ATAS: -5 - (hasil - 1) (1 -> -5, 2 -> -6, dst.)
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
  if (bidVal === 0) {
    if (mode === 'BAWAH') {
      const pts = -10 - (resultVal - 1) * 2;
      return { points: pts, label: `▲${resultVal} · ${pts}`, cls: 'neg' };
    }
    // mode === 'ATAS'
    const pts = -5 - (resultVal - 1);
    return { points: pts, label: `▲${resultVal} · ${pts}`, cls: 'neg' };
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

function getSavedTrufSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRUF_STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.players) && saved.players.length === 4) {
      return saved;
    }
  } catch (_) {}
  return null;
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

  const resumeWrap = document.getElementById('truf-resume-wrap');
  const saved = getSavedTrufSession();
  if (saved && resumeWrap) {
    resumeWrap.classList.remove('hidden');
    document.getElementById('truf-resume-info').textContent = `R${saved.round}`;
  } else if (resumeWrap) {
    resumeWrap.classList.add('hidden');
  }
}

function showSetupView() {
  document.getElementById('truf-game-view').classList.add('hidden');
  document.getElementById('truf-setup-view').classList.remove('hidden');
  document.getElementById('btn-truf-reset').classList.add('hidden');
  const setScoreBtn = document.getElementById('btn-truf-set-score');
  if (setScoreBtn) setScoreBtn.classList.add('hidden');
  const topSuitEl = document.getElementById('truf-topbar-suit');
  if (topSuitEl) topSuitEl.classList.add('hidden');
  initSetupScreen();
}

function handleStartTrufClick() {
  const saved = getSavedTrufSession();
  if (!saved) {
    startNewTrufGame();
    return;
  }
  const phaseLabel = saved.phase === 'result' ? 'Hasil' : 'Bid';
  const summary = saved.players.map(p => `${p.name} (${p.score})`).join(' · ');
  const infoEl = document.getElementById('truf-resume-choice-info');
  if (infoEl) {
    infoEl.textContent = `Ronde ${saved.round} (${phaseLabel}) — ${summary}`;
  }
  document.getElementById('modal-truf-resume-choice').classList.remove('hidden');
}

function closeTrufResumeChoiceModal() {
  const modal = document.getElementById('modal-truf-resume-choice');
  if (modal) modal.classList.add('hidden');
}

function confirmResumeSavedTrufGame() {
  closeTrufResumeChoiceModal();
  resumeSavedTrufGame();
}

function confirmStartFreshTrufGame() {
  closeTrufResumeChoiceModal();
  startNewTrufGame();
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
  const saved = getSavedTrufSession();
  if (saved) {
    trufState = saved;
    showGameView();
  } else {
    startNewTrufGame();
  }
}

function showGameView() {
  if (window.history && window.history.pushState && (!window.history.state || window.history.state.trufView !== 'game')) {
    window.history.pushState({ trufView: 'game' }, '', '#play');
  }
  document.getElementById('truf-setup-view').classList.add('hidden');
  document.getElementById('truf-game-view').classList.remove('hidden');
  document.getElementById('btn-truf-reset').classList.remove('hidden');
  const setScoreBtn = document.getElementById('btn-truf-set-score');
  if (setScoreBtn) setScoreBtn.classList.remove('hidden');
  renderAll();
}

window.addEventListener('popstate', () => {
  const gameView = document.getElementById('truf-game-view');
  if (gameView && !gameView.classList.contains('hidden')) {
    showSetupView();
  }
});

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

  const topSuitEl = document.getElementById('truf-topbar-suit');
  if (topSuitEl) {
    topSuitEl.textContent = trufSuit.symbol;
    topSuitEl.style.color = trufSuit.isRed ? '#DC2626' : '#0F172A';
    topSuitEl.title = `Truf ${trufSuit.name}`;
    topSuitEl.setAttribute('aria-label', `Truf ${trufSuit.name}`);
    topSuitEl.classList.remove('hidden');
  }

  container.innerHTML = trufState.players.map((p, idx) => {
    const rank = rankMap[p.id];
    const scoreCls = p.score > 0 ? 'pos' : (p.score < 0 ? 'neg' : '');
    const isShuffler = kocok && kocok.shufflerName === p.name;
    const footText = isShuffler
      ? (kocok.isJenderal ? 'JENDERAL (5/5)' : `Kocok ${kocok.streak}/5`)
      : (p.lastDelta === null ? '—' : (p.lastDelta > 0 ? `▲ +${p.lastDelta}` : (p.lastDelta < 0 ? `▼ ${p.lastDelta}` : '• 0')));
    const rankIcon = (rank === 1 && hasRounds) ? `${ICONS.crown} ` : '';
    const pBid = trufState.bids[idx] || { value: 0, suit: 'sekop' };
    const pSuit = getSuitObj(pBid.suit);
    const bidPill = `<span class="truf-tile-bid-pill" title="Bid ronde ini">${pBid.value} <strong style="${pSuit.isRed ? 'color:#DC2626;' : 'color:#0F172A;'}">${pSuit.symbol}</strong></span>`;

    return `
      <div class="truf-score-tile ${rank === 1 ? 'rank-1' : ''} ${isShuffler ? 'is-shuffler' : ''}" data-player-idx="${idx}">
        <div class="truf-tile-main">
          <div class="truf-tile-top">
            <span class="truf-tile-rank">${rankIcon}#${rank}</span>
            <span class="truf-tile-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
          </div>
          <div class="truf-tile-sub">
            <span class="truf-tile-foot ${isShuffler ? 'shuffler' : ''}">${footText}</span>
            ${bidPill}
          </div>
        </div>
        <div class="truf-tile-score ${scoreCls}"><span class="truf-score-val">${p.score}</span></div>
      </div>
    `;
  }).join('');

  if (Array.isArray(prevTrufScoreSnapshot) && shouldAnimateTrufUI()) {
    trufState.players.forEach((p, idx) => {
      const prevScore = prevTrufScoreSnapshot[idx];
      if (typeof prevScore === 'number' && prevScore !== p.score) {
        const tileEl = container.querySelector(`.truf-score-tile[data-player-idx="${idx}"]`);
        if (tileEl) {
          const scoreEl = tileEl.querySelector('.truf-score-val');
          const scoreWrapEl = tileEl.querySelector('.truf-tile-score');
          animateTrufScoreNumber(scoreEl, prevScore, p.score, 420);
          spawnTrufDeltaFloat(scoreWrapEl, p.score - prevScore);
        }
      }
    });
  }
  prevTrufScoreSnapshot = null;
}

function renderBidPhase() {
  document.getElementById('bid-round-num').textContent = trufState.round;
  const totalBid = trufState.bids.reduce((sum, b) => sum + b.value, 0);
  const mode = getRoundMode(totalBid);
  const highestIdx = getHighestBidderIndex(trufState.bids);
  const highestSuit = getSuitObj(trufState.bids[highestIdx].suit);
  const maxBid = Math.max(...trufState.bids.map(b => b.value));

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
    const isTopBid = b.value === maxBid;
    const suitBtns = isTopBid
      ? SUITS.map(s => `
          <button
            class="truf-suit-btn ${s.isRed ? 'red' : ''} ${b.suit === s.id ? 'active' : ''}"
            title="${s.name}"
            onclick="setPlayerSuit(${idx}, '${s.id}')"
          >${s.symbol}</button>
        `).join('')
      : '';

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
          <button type="button" class="truf-step-val truf-step-val-btn" onclick="openTrufNumpad('bid', ${idx})" title="Pilih angka cepat (0–13)">${b.value}</button>
          ${isTopBid ? `<div class="truf-suit-group">${suitBtns}</div>` : ''}
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
  bumpTrufStepVal(document.querySelector(`#truf-bid-rows .truf-player-row:nth-child(${playerIdx + 1}) .truf-step-val`));
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
  if (valEl) {
    valEl.textContent = pas13CustomDelta;
    bumpTrufStepVal(valEl);
  }
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
  lastBookedPlayerIdx = null;
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
    const isBooked = res === bid.value;

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
          <button type="button" class="truf-step-val truf-step-val-btn" onclick="openTrufNumpad('result', ${idx})" title="Pilih angka cepat (0–13)">${res}</button>
          <button
            type="button"
            class="truf-book-btn ${isBooked ? 'is-booked' : ''}"
            onclick="bookResultValue(${idx})"
            title="Isi hasil pas sesuai bid (${bid.value})"
          >Book</button>
          <span class="truf-preview-pill ${preview.cls}">${preview.label}</span>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('btn-save-round').disabled = totalResult !== 13;
}

let lastBookedPlayerIdx = null;

function changeResultValue(playerIdx, delta) {
  const next = Math.max(0, Math.min(13, trufState.results[playerIdx] + delta));
  trufState.results[playerIdx] = next;
  lastBookedPlayerIdx = null;
  saveState();
  renderResultPhase();
  bumpTrufStepVal(document.querySelector(`#truf-result-rows .truf-player-row:nth-child(${playerIdx + 1}) .truf-step-val`));
}

function bookResultValue(playerIdx) {
  const bidVal = trufState.bids[playerIdx].value;
  trufState.results[playerIdx] = bidVal;
  lastBookedPlayerIdx = playerIdx;
  saveState();
  renderResultPhase();
  bumpTrufStepVal(document.querySelector(`#truf-result-rows .truf-player-row:nth-child(${playerIdx + 1}) .truf-step-val`));
}

let activeTrufNumpad = null;

function openTrufNumpad(target, playerIdx) {
  if (!trufState || !trufState.players[playerIdx]) return;
  activeTrufNumpad = { target, playerIdx };

  const player = trufState.players[playerIdx];
  const bidVal = trufState.bids[playerIdx].value;
  const currentVal = target === 'bid' ? bidVal : trufState.results[playerIdx];

  const titleEl = document.getElementById('truf-numpad-title');
  const subEl = document.getElementById('truf-numpad-sub');
  const gridEl = document.getElementById('truf-numpad-grid');
  const modalEl = document.getElementById('modal-truf-numpad');
  if (!titleEl || !subEl || !gridEl || !modalEl) return;

  titleEl.textContent = `${target === 'bid' ? 'Bid' : 'Hasil'} · ${player.name}`;
  subEl.textContent = target === 'bid'
    ? 'Ketuk angka 0 – 13'
    : `Bid: ${bidVal} · Ketuk hasil 0 – 13`;

  const numberBtns = [];
  for (let n = 0; n <= 13; n++) {
    const classes = ['truf-numpad-btn'];
    if (n === currentVal) classes.push('is-current');
    if (target === 'result' && n === bidVal) classes.push('is-target-bid');
    numberBtns.push(
      `<button type="button" class="${classes.join(' ')}" onclick="selectTrufNumpadValue(${n})">${n}</button>`
    );
  }

  const otherSum = target === 'result'
    ? trufState.results.reduce((sum, val, i) => (i === playerIdx ? sum : sum + val), 0)
    : 0;
  const remaining = 13 - otherSum;

  const actionBtn = target === 'result'
    ? (remaining >= 0 && remaining <= 13
        ? `<button type="button" class="truf-numpad-btn truf-numpad-span2 is-book" onclick="selectTrufNumpadValue(${remaining})">Sisa (${remaining})</button>`
        : `<button type="button" class="truf-numpad-btn truf-numpad-span2 is-book" onclick="selectTrufNumpadValue(${bidVal})">Pas Bid (${bidVal})</button>`)
    : `<button type="button" class="truf-numpad-btn truf-numpad-span2 is-close" onclick="closeTrufNumpad()">Tutup</button>`;

  gridEl.innerHTML = numberBtns.join('') + actionBtn;
  modalEl.classList.remove('hidden');
}

function closeTrufNumpad() {
  const modalEl = document.getElementById('modal-truf-numpad');
  if (modalEl) modalEl.classList.add('hidden');
  activeTrufNumpad = null;
}

function selectTrufNumpadValue(val) {
  if (!activeTrufNumpad || !trufState) return;
  const { target, playerIdx } = activeTrufNumpad;
  const clamped = Math.max(0, Math.min(13, Number(val) || 0));

  if (target === 'bid') {
    trufState.bids[playerIdx].value = clamped;
    trufState.pas13Snapshot = null;
    saveState();
    renderScoreboard();
    renderBidPhase();
    closeTrufNumpad();
    bumpTrufStepVal(document.querySelector(`#truf-bid-rows .truf-player-row:nth-child(${playerIdx + 1}) .truf-step-val`));
  } else {
    trufState.results[playerIdx] = clamped;
    lastBookedPlayerIdx = null;
    saveState();
    renderResultPhase();
    closeTrufNumpad();
    bumpTrufStepVal(document.querySelector(`#truf-result-rows .truf-player-row:nth-child(${playerIdx + 1}) .truf-step-val`));
  }
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (activeTrufNumpad) closeTrufNumpad();
    const setScoreModal = document.getElementById('modal-set-score');
    if (setScoreModal && !setScoreModal.classList.contains('hidden')) {
      closeSetScoreModal();
    }
    const resumeChoiceModal = document.getElementById('modal-truf-resume-choice');
    if (resumeChoiceModal && !resumeChoiceModal.classList.contains('hidden')) {
      closeTrufResumeChoiceModal();
    }
  }
});

function openSetScoreModal() {
  if (!trufState || !Array.isArray(trufState.players)) return;
  const rowsEl = document.getElementById('truf-set-score-rows');
  const modalEl = document.getElementById('modal-set-score');
  if (!rowsEl || !modalEl) return;

  rowsEl.innerHTML = trufState.players.map((p, idx) => `
    <div class="truf-set-score-row">
      <label class="truf-set-score-name" for="set-score-input-${idx}">${escapeHtml(p.name)}</label>
      <div class="truf-set-score-control">
        <button type="button" class="truf-sign-btn" onclick="toggleSetScoreSign(${idx})" title="Ubah positif / minus">±</button>
        <input
          id="set-score-input-${idx}"
          type="number"
          inputmode="numeric"
          class="truf-input truf-set-score-input"
          value="${p.score}"
        />
      </div>
    </div>
  `).join('');

  modalEl.classList.remove('hidden');
}

function closeSetScoreModal() {
  const modalEl = document.getElementById('modal-set-score');
  if (modalEl) modalEl.classList.add('hidden');
}

function toggleSetScoreSign(playerIdx) {
  const input = document.getElementById(`set-score-input-${playerIdx}`);
  if (!input) return;
  const raw = input.value.trim();
  if (!raw || raw === '0') {
    input.value = '-';
    input.focus();
    return;
  }
  const num = parseInt(raw, 10);
  if (!Number.isNaN(num)) {
    input.value = String(-num);
  }
  input.focus();
}

function applyManualScores() {
  if (!trufState || !Array.isArray(trufState.players)) return;
  prevTrufScoreSnapshot = trufState.players.map(p => p.score);
  trufState.players.forEach((p, idx) => {
    const input = document.getElementById(`set-score-input-${idx}`);
    const parsed = input ? parseInt(input.value, 10) : p.score;
    const nextScore = Number.isNaN(parsed) ? 0 : parsed;
    p.lastDelta = nextScore - p.score;
    p.score = nextScore;
  });
  saveState();
  closeSetScoreModal();
  renderAll();
}

function saveRoundResult() {
  const totalResult = trufState.results.reduce((sum, v) => sum + v, 0);
  if (totalResult !== 13) return;

  prevTrufScoreSnapshot = trufState.players.map(p => p.score);

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
  lastBookedPlayerIdx = null;
  saveState();
  animateLatestTrufRound = true;
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const hasBidZeroCelebration = triggerTrufZeroCelebrationIfNeeded(roundEntries, mode);

  const kocok = getKocokStatus(trufState.history);
  if (kocok && kocok.isJenderal) {
    if (hasBidZeroCelebration) {
      setTimeout(() => showWinnerModal(kocok.shufflerName), 2400);
    } else {
      showWinnerModal(kocok.shufflerName);
    }
  }
}

function undoLastRound() {
  if (!trufState.history.length) return;
  prevTrufScoreSnapshot = trufState.players.map(p => p.score);
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
    animateLatestTrufRound = false;
    listEl.innerHTML = `<p style="font-size: 0.8rem; color: #64748B; text-align: center; padding: 1rem 0;">Belum ada ronde</p>`;
    return;
  }
  undoBtn.classList.remove('hidden');

  const shouldAnimNewCard = animateLatestTrufRound && shouldAnimateTrufUI();
  animateLatestTrufRound = false;

  listEl.innerHTML = trufState.history.map((item, idx) => {
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
      <div class="truf-history-item ${(idx === 0 && shouldAnimNewCard) ? 'history-card-enter' : ''}">
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

  const animate = shouldAnimateTrufUI();
  const firstRects = {};
  if (animate) {
    lbEl.querySelectorAll('.truf-lb-row[data-player-id]').forEach(el => {
      firstRects[el.dataset.playerId] = el.getBoundingClientRect().top;
    });
  }

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
      <div class="truf-lb-row ${rank === 1 ? 'rank-1' : ''} ${isShuffler ? 'is-shuffler' : ''}" data-player-id="${p.id}">
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

  if (animate && typeof requestAnimationFrame === 'function') {
    lbEl.querySelectorAll('.truf-lb-row[data-player-id]').forEach(row => {
      const oldTop = firstRects[row.dataset.playerId];
      if (typeof oldTop === 'number') {
        const newTop = row.getBoundingClientRect().top;
        const dy = oldTop - newTop;
        if (Math.abs(dy) >= 2) {
          row.style.transition = 'none';
          row.style.transform = `translateY(${dy}px)`;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              row.style.transition = 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)';
              row.style.transform = '';
            });
          });
        }
      }
    });
  }
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
  const setScoreBtn = document.getElementById('btn-truf-set-score');
  if (setScoreBtn) setScoreBtn.classList.add('hidden');
  document.getElementById('truf-resume-wrap').classList.add('hidden');
  const topSuitEl = document.getElementById('truf-topbar-suit');
  if (topSuitEl) topSuitEl.classList.add('hidden');
}

const TRUF_PLAYER_PALETTES = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];

function buildTrufSlamColorVars(hexColor) {
  const baseHex = /^#[0-9a-f]{6}$/i.test(hexColor) ? hexColor : '#3B82F6';
  const r = parseInt(baseHex.slice(1, 3), 16);
  const g = parseInt(baseHex.slice(3, 5), 16);
  const b = parseInt(baseHex.slice(5, 7), 16);

  const mix = (c1, c2, weight) => {
    const mr = Math.round(c1[0] * (1 - weight) + c2[0] * weight);
    const mg = Math.round(c1[1] * (1 - weight) + c2[1] * weight);
    const mb = Math.round(c1[2] * (1 - weight) + c2[2] * weight);
    return `#${[mr, mg, mb].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
  };

  const darkHex = mix([r, g, b], [15, 23, 42], 0.28);
  const deepHex = mix([r, g, b], [15, 23, 42], 0.52);
  const lightHex = mix([r, g, b], [255, 255, 255], 0.72);

  return `--slam-accent: ${baseHex}; --slam-accent-dark: ${darkHex}; --slam-accent-deep: ${deepHex}; --slam-accent-light: ${lightHex}; --slam-accent-rgb: ${r}, ${g}, ${b};`;
}

function buildSlamPlayingCardSVG(rank, suitSymbol, isRed) {
  const color = isRed ? '#DC2626' : '#172554';
  return `
    <svg class="slam-playing-card-svg" viewBox="0 0 78 118" width="78" height="118" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="6" width="70" height="108" rx="12" fill="#172554" />
      <rect x="2" y="2" width="70" height="108" rx="11" fill="#FFFFFF" stroke="#172554" stroke-width="3.2" />
      <rect x="6" y="6" width="62" height="100" rx="8" fill="none" stroke="#F1F5F9" stroke-width="1.6" />
      <text x="12" y="24" fill="${color}" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="900">${rank}</text>
      <text x="12.5" y="38" fill="${color}" font-size="13">${suitSymbol}</text>
      <text x="37" y="68" text-anchor="middle" fill="${color}" font-size="38">${suitSymbol}</text>
      <g transform="rotate(180 37 56)">
        <text x="12" y="24" fill="${color}" font-family="Plus Jakarta Sans, sans-serif" font-size="16" font-weight="900">${rank}</text>
        <text x="12.5" y="38" fill="${color}" font-size="13">${suitSymbol}</text>
      </g>
    </svg>
  `;
}

function buildTrufMegaphoneSVG() {
  return `
    <svg class="slam-megaphone-svg" viewBox="0 0 92 84" width="84" height="76" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M53 6 L68 18 L60 22 L73 36 L54 27 L60 22 L47 11 Z" fill="#FACC15" stroke="#172554" stroke-width="2" stroke-linejoin="round" />
      <path d="M27 49 L35 72 C36 75 41 75 43 72 L38 46 Z" fill="#B91C1C" stroke="#172554" stroke-width="2.6" stroke-linejoin="round" />
      <ellipse cx="17" cy="48" rx="6.5" ry="9.5" transform="rotate(-18 17 48)" fill="#F59E0B" stroke="#172554" stroke-width="2.5" />
      <path d="M17 39 L56 17 L68 55 L22 57 Z" fill="#EF4444" stroke="#172554" stroke-width="2.8" stroke-linejoin="round" />
      <path d="M29 32.5 L39 27 L46 56 L34 56.5 Z" fill="#FFFFFF" stroke="#172554" stroke-width="2.2" stroke-linejoin="round" />
      <ellipse cx="62" cy="36" rx="13" ry="22" transform="rotate(-18 62 36)" fill="#FFFFFF" stroke="#172554" stroke-width="2.8" />
      <ellipse cx="63" cy="36" rx="8.5" ry="16" transform="rotate(-18 63 36)" fill="#991B1B" stroke="#172554" stroke-width="2" />
      <ellipse cx="60" cy="37" rx="4.5" ry="9" transform="rotate(-18 60 37)" fill="#DC2626" />
    </svg>
  `;
}

function buildTrufCrownSVG() {
  return `
    <svg class="slam-crown-svg" viewBox="0 0 60 40" width="50" height="34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 33 L4 11 L19 21 L30 5 L41 21 L56 11 L53 33 Z" fill="#FACC15" stroke="#172554" stroke-width="2.8" stroke-linejoin="round" />
      <rect x="8" y="31" width="44" height="6" rx="2.5" fill="#F59E0B" stroke="#172554" stroke-width="2.4" />
      <circle cx="30" cy="21" r="3" fill="#DC2626" stroke="#172554" stroke-width="1.5" />
    </svg>
  `;
}

function playTrufCardSlamSound(isBawah10) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    function playCardSnap(delaySec, pitch = 1) {
      const start = now + delaySec;
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(170 * pitch, start);
      osc.frequency.exponentialRampToValueAtTime(48, start + 0.085);
      oscGain.gain.setValueAtTime(0.28, start);
      oscGain.gain.exponentialRampToValueAtTime(0.001, start + 0.095);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.1);

      const bufferSize = Math.floor(ctx.sampleRate * 0.04);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1250 * pitch, start);
      filter.Q.setValueAtTime(1.5, start);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.24, start);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, start + 0.04);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(start);
      noise.stop(start + 0.045);
    }

    if (isBawah10) {
      [0.08, 0.13, 0.18, 0.23].forEach((d, idx) => {
        playCardSnap(d, 0.94 + idx * 0.06);
      });
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const start = now + 0.24 + i * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.32);
      });
    } else {
      playCardSnap(0.12, 1.0);
      [587.33, 880].forEach((freq, i) => {
        const start = now + 0.15 + i * 0.065;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.065, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.24);
      });
    }

    setTimeout(() => {
      if (ctx.state !== 'closed') ctx.close().catch(() => {});
    }, 1100);
  } catch (_) {}
}

function triggerTrufZeroCelebrationIfNeeded(roundEntries, mode) {
  if (!Array.isArray(roundEntries)) return false;
  const winners = [];
  roundEntries.forEach((entry, idx) => {
    if (entry.bid === 0 && entry.result === 0) {
      winners.push({
        playerIdx: idx,
        name: entry.name,
        suit: entry.suit,
        points: entry.points,
        mode
      });
    }
  });

  if (winners.length === 0) return false;

  winners.forEach((item, index) => {
    setTimeout(() => {
      showTrufZeroCelebrationOverlay(item);
    }, index * 2600);
  });
  return true;
}

function showTrufZeroCelebrationOverlay(item) {
  const existing = document.getElementById('truf-appreciation-overlay');
  if (existing) existing.remove();

  const isBawah = (item.mode === 'BAWAH' || item.points === 10);
  const playerColor = TRUF_PLAYER_PALETTES[item.playerIdx % TRUF_PLAYER_PALETTES.length];
  const colorVars = buildTrufSlamColorVars(playerColor);
  const pSuit = getSuitObj(item.suit);

  const shellEl = document.querySelector('.truf-shell');
  if (shellEl) {
    shellEl.classList.remove('domino-table-shake-25', 'domino-table-shake-30');
    setTimeout(() => {
      shellEl.classList.add(isBawah ? 'domino-table-shake-30' : 'domino-table-shake-25');
      setTimeout(() => {
        shellEl.classList.remove('domino-table-shake-25', 'domino-table-shake-30');
      }, 420);
    }, 110);
  }

  const targetTiles = document.querySelectorAll(
    `.truf-score-tile[data-player-idx="${item.playerIdx}"], .truf-lb-row[data-player-idx="${item.playerIdx}"]`
  );
  targetTiles.forEach(el => {
    el.classList.remove('lb-item-slam-25', 'lb-item-slam-30');
    void el.offsetWidth;
    el.classList.add(isBawah ? 'lb-item-slam-30' : 'lb-item-slam-25');
    setTimeout(() => {
      el.classList.remove('lb-item-slam-25', 'lb-item-slam-30');
    }, 2800);
  });

  const chipCount = isBawah ? 16 : 10;
  const suitSymbols = ['♠', '♥', '♣', '♦'];
  let chipsHTML = '';
  for (let i = 0; i < chipCount; i++) {
    const angle = (Math.PI * 2 * i) / chipCount + (i % 2 === 0 ? 0.14 : -0.14);
    const dist = (isBawah ? 112 : 82) + (i % 3) * 24;
    const tx = Math.round(Math.cos(angle) * dist);
    const ty = Math.round(Math.sin(angle) * dist);
    const rot = ((i * 53) % 240) - 120;
    const delayMs = isBawah ? (110 + (i % 4) * 45) : 120;

    if (isBawah && i % 2 === 0) {
      const sym = suitSymbols[(i / 2) % 4];
      const symColor = (sym === '♥' || sym === '♦') ? '#EF4444' : '#FACC15';
      chipsHTML += `<span class="slam-suit-confetti" style="--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;color:${symColor};animation-delay:${delayMs}ms;">${sym}</span>`;
    } else {
      const chipColor = isBawah
        ? (i % 3 === 0 ? '#FACC15' : i % 3 === 1 ? '#DC2626' : playerColor)
        : (i % 2 === 0 ? '#10B981' : '#FACC15');
      chipsHTML += `<span class="slam-chip ${i % 2 === 0 ? 'circle' : ''}" style="--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;background:${chipColor};animation-delay:${delayMs}ms;"></span>`;
    }
  }

  const cardsHTML = isBawah
    ? `
      <div class="slam-domino-wrap" style="--start-rot:-35deg;--end-rot:-21deg;animation-delay:0ms;z-index:1;">
        <div class="slam-domino-card">${buildSlamPlayingCardSVG('A', '♠', false)}</div>
      </div>
      <div class="slam-domino-wrap" style="--start-rot:-15deg;--end-rot:-7deg;animation-delay:50ms;z-index:2;margin-top:-10px;">
        <div class="slam-domino-card">${buildSlamPlayingCardSVG('A', '♥', true)}</div>
      </div>
      <div class="slam-domino-wrap" style="--start-rot:15deg;--end-rot:7deg;animation-delay:100ms;z-index:3;margin-top:-10px;">
        <div class="slam-domino-card">${buildSlamPlayingCardSVG('A', '♣', false)}</div>
      </div>
      <div class="slam-domino-wrap" style="--start-rot:35deg;--end-rot:21deg;animation-delay:150ms;z-index:4;">
        <div class="slam-domino-card">${buildSlamPlayingCardSVG('A', '♦', true)}</div>
      </div>
    `
    : `
      <div class="slam-domino-wrap slam-domino-left" style="--start-rot:-24deg;--end-rot:-11deg;animation-delay:0ms;">
        <div class="slam-domino-card">${buildSlamPlayingCardSVG('A', '♠', false)}</div>
      </div>
      <div class="slam-domino-wrap slam-domino-right" style="--start-rot:20deg;--end-rot:8deg;animation-delay:90ms;">
        <div class="slam-domino-card">${buildSlamPlayingCardSVG('A', '♥', true)}</div>
      </div>
    `;

  const shockwavesHTML = isBawah
    ? `
      <span class="slam-shockwave ring-gold" style="animation-delay:110ms;"></span>
      <span class="slam-shockwave ring-crimson" style="animation-delay:220ms;"></span>
    `
    : `
      <span class="slam-shockwave ring-emerald" style="animation-delay:120ms;"></span>
    `;

  const headlineHTML = isBawah
    ? `
      <span class="slam-hl-line slam-hl-white">RAJA NOL!</span>
      <span class="slam-hl-line slam-hl-gold">GILA BOS!</span>
    `
    : `
      <span class="slam-hl-line slam-hl-white">LOLOS</span>
      <span class="slam-hl-line slam-hl-gold">BERSIH!</span>
    `;

  const heroClusterHTML = isBawah
    ? `
      <div class="slam-megaphone-wrap left">${buildTrufMegaphoneSVG()}</div>
      <div class="slam-domino-cluster is-fan-4">${cardsHTML}</div>
      <div class="slam-megaphone-wrap right">${buildTrufMegaphoneSVG()}</div>
    `
    : `
      <div class="slam-domino-cluster is-double">${cardsHTML}</div>
    `;

  const overlay = document.createElement('div');
  overlay.id = 'truf-appreciation-overlay';
  overlay.className = `domino-slam-overlay ${isBawah ? 'tier-30' : 'tier-25'}`;
  overlay.onclick = () => window.dismissTrufZeroOverlay && window.dismissTrufZeroOverlay();

  overlay.innerHTML = `
    <div class="domino-slam-stage ${isBawah ? 'tier-30' : 'tier-25'}" style="${colorVars}">
      <div class="slam-burst-backdrop">
        <div class="slam-golden-glow"></div>
        <span class="slam-sparkle-star s1">&#10022;</span>
        <span class="slam-sparkle-star s2">&#10022;</span>
        <span class="slam-sparkle-star s3">&#10022;</span>
        <span class="slam-sparkle-star s4">&#10022;</span>
        <span class="slam-confetti-ribbon r1"></span>
        <span class="slam-confetti-ribbon r2"></span>
        <span class="slam-confetti-ribbon r3"></span>
        <span class="slam-comic-ray ray-l1"></span>
        <span class="slam-comic-ray ray-l2"></span>
        <span class="slam-comic-ray ray-r1"></span>
        <span class="slam-comic-ray ray-r2"></span>
      </div>

      <div class="slam-impact-fx">
        ${shockwavesHTML}
        ${chipsHTML}
      </div>

      <div class="slam-comic-headline">${headlineHTML}</div>

      <div class="slam-hero-cluster">${heroClusterHTML}</div>

      <div class="slam-ribbon-wrap">
        ${isBawah ? `<div class="slam-crown-badge">${buildTrufCrownSVG()}</div>` : ''}
        <div class="slam-red-ribbon">
          <span class="slam-ribbon-text">${isBawah ? 'JAGO BENER!' : 'AMAN BOS!'}</span>
        </div>
      </div>

      <div class="slam-score-panel-outer ${isBawah ? 'tier-30' : 'tier-25'}">
        <div class="slam-score-panel-inner">
          <div class="slam-player-pill-wrap">
            <span class="slam-accent-ticks bottom-left" aria-hidden="true"></span>
            <span class="truf-slam-player-badge">
              <span>${pSuit.symbol}</span>
              <span>${escapeHtml(item.name)}</span>
            </span>
          </div>
          <div class="slam-score-pill-wrap">
            <span class="slam-accent-ticks top-right" aria-hidden="true"></span>
            <div class="slam-score-pill ${isBawah ? '' : 'is-plus-5'}">
              <span class="slam-score-big ${isBawah ? 'tier-30' : ''}">+${item.points}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="slam-floor-halo" aria-hidden="true"></div>
    </div>
  `;

  document.body.appendChild(overlay);
  playTrufCardSlamSound(isBawah);

  let dismissed = false;
  window.dismissTrufZeroOverlay = () => {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(autoDismissTimer);
    overlay.classList.add('slam-exit');
    setTimeout(() => {
      overlay.remove();
    }, 340);
  };

  const autoDismissTimer = setTimeout(() => {
    window.dismissTrufZeroOverlay();
  }, isBawah ? 2800 : 2250);
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
