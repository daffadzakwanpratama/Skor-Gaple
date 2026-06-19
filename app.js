/* =============================================
   GAPLE SCORE TRACKER — app.js
   Full application logic with LocalStorage
   ============================================= */

'use strict';

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let state = {
  currentGame: null,   // active game object
  allGames: [],        // completed + active games list
  pendingDeleteIndex: null,
  deletedRoundCache: null,
  editingRoundIndex: null,
  pendingRound: null,  // temporary store for rounds requiring a gaple selection
  editingPlayerIndex: null, // Track which player is being renamed
  customizerMode: 'setup',
  customizerPlayerIndex: null,
};

// Game schema:
// {
//   id: string,
//   name: string,
//   players: [{ name, total, avatar, color }],
//   rounds: [{ scores: [number] }],   // scores[i] = player i's score for this round
//   status: 'active' | 'done',
//   createdAt: ISO string,
// }

// Color & Avatar Defaults, Pixel Art Sprites & Helpers
const DEFAULT_COLORS = ['#FF5252', '#448AFF', '#69F0AE', '#FFD740', '#E040FB', '#FF9100', '#00E5FF', '#FF4081'];
const DEFAULT_AVATARS = ['fox', 'frog', 'cat', 'panda', 'tiger', 'koala', 'pig', 'lion', 'chicken', 'monkey'];

const PIXEL_ART_DATA = {
  fox: {
    grid: [
      ".O....O.",
      "OOO..OOO",
      "OOOOOOOO",
      "OKOOOOOK",
      "OOOOOOOO",
      "WWOOOOWW",
      ".WWKKWW.",
      "...WW..."
    ],
    colors: { 'O': '#FF9100', 'W': '#FFFFFF', 'K': '#1A1C1E' }
  },
  frog: {
    grid: [
      ".K....K.",
      "KWK..KWK",
      "GGGGGGGG",
      "GKGGGGKG",
      "GGGGGGGG",
      "GRGGGGRG",
      ".GGGGGG.",
      "..GGGG.."
    ],
    colors: { 'G': '#69F0AE', 'W': '#FFFFFF', 'K': '#1A1C1E', 'R': '#FF5252' }
  },
  cat: {
    grid: [
      "Y......Y",
      "YY....YY",
      "YYYYYYYY",
      "YKYYYYKY",
      "YYYPPYYY",
      "YYWWWWYY",
      ".YYYYYY.",
      "..YYYY.."
    ],
    colors: { 'Y': '#FFD740', 'P': '#FF4081', 'K': '#1A1C1E', 'W': '#FFFFFF' }
  },
  panda: {
    grid: [
      "K......K",
      "KK....KK",
      "WWWWWWWW",
      "WKWWWWKW",
      "WWWPWWWW",
      ".KKKKKK.",
      "..WKKW..",
      "..WWWW.."
    ],
    colors: { 'W': '#FFFFFF', 'K': '#1A1C1E', 'P': '#FF4081' }
  },
  tiger: {
    grid: [
      "O......O",
      "OO.KK.OO",
      "OOKOOKOO",
      "OKOOOOOK",
      "OOKKKKOO",
      "WOOKKOOW",
      ".WWWWWW.",
      "..OOOO.."
    ],
    colors: { 'O': '#FF9100', 'K': '#1A1C1E', 'W': '#FFFFFF' }
  },
  koala: {
    grid: [
      ".GG..GG.",
      "GGGGGGGG",
      "GGGGGGGG",
      "GKGGGGKG",
      "GGGKKGGG",
      "GPGKKGPG",
      ".GGGGGG.",
      "..GGGG.."
    ],
    colors: { 'G': '#90A4AE', 'W': '#FFFFFF', 'K': '#1A1C1E', 'P': '#FF4081' }
  },
  pig: {
    grid: [
      "P......P",
      "PP....PP",
      "PPPPPPPP",
      "PKPPPPKP",
      "PPDDDDPP",
      "PPDDDKDP",
      ".PPPPPP.",
      "..PPPP.."
    ],
    colors: { 'P': '#FF80AB', 'D': '#FF4081', 'K': '#1A1C1E' }
  },
  lion: {
    grid: [
      ".BBBBBB.",
      "BBYYYYBB",
      "BYYYYYYB",
      "BYKYYKYB",
      "BYYYYYYB",
      "BYYKKYYB",
      ".BYYYYBB",
      "..BBBB.."
    ],
    colors: { 'B': '#FF9100', 'Y': '#FFD740', 'K': '#1A1C1E' }
  },
  chicken: {
    grid: [
      "...RR...",
      "..WWWW..",
      ".WWWWWW.",
      ".WKWWKW.",
      ".WWYYWW.",
      ".WWYYWW.",
      "..WWWW..",
      "...YY..."
    ],
    colors: { 'W': '#FFFFFF', 'R': '#FF5252', 'Y': '#FFD740', 'K': '#1A1C1E' }
  },
  monkey: {
    grid: [
      ".B....B.",
      "BBBBBBBB",
      "BTTTTTTB",
      "BTKTTKTB",
      "BTTTTTTB",
      "BTTRRTTB",
      ".BTTTTB.",
      "..BBBB.."
    ],
    colors: { 'B': '#8D6E63', 'T': '#D7CCC8', 'K': '#1A1C1E', 'R': '#FF5252' }
  }
};

const EMOJI_TO_KEY = {
  '🦊': 'fox', '🐸': 'frog', '🐱': 'cat', '🐼': 'panda', '🐯': 'tiger',
  '🐨': 'koala', '🐷': 'pig', '🦁': 'lion', '🐔': 'chicken', '🐵': 'monkey'
};

const KEY_TO_EMOJI = {
  'fox': '🦊', 'frog': '🐸', 'cat': '🐱', 'panda': '🐼', 'tiger': '🐯',
  'koala': '🐨', 'pig': '🐷', 'lion': '🦁', 'chicken': '🐔', 'monkey': '🐵'
};

function getSanitizedAvatar(avatar) {
  if (EMOJI_TO_KEY[avatar]) {
    return EMOJI_TO_KEY[avatar];
  }
  if (PIXEL_ART_DATA[avatar]) {
    return avatar;
  }
  return 'fox';
}

function getAvatarEmoji(key) {
  return KEY_TO_EMOJI[key] || '🦊';
}

function getPixelArtSVG(avatarKey, size = 32) {
  const data = PIXEL_ART_DATA[avatarKey];
  if (!data) return '';
  const rows = data.grid;
  const colors = data.colors;
  const width = rows[0].length;
  const height = rows.length;
  
  let svg = `<svg viewBox="0 0 ${width} ${height}" width="${size}" height="${size}" style="image-rendering: pixelated; display: inline-block; vertical-align: middle;">`;
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      const char = row[x];
      if (char !== '.' && colors[char]) {
        svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[char]}" />`;
      }
    }
  }
  svg += `</svg>`;
  return svg;
}

function getDominoFaceDotsHTML(val, offsetX, color) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 0 || n > 6) return '';
  
  const center = { x: 3, y: 4 };
  const topLeft = { x: 2, y: 2 };
  const topRight = { x: 5, y: 2 };
  const bottomLeft = { x: 2, y: 6 };
  const bottomRight = { x: 5, y: 6 };
  const midLeft = { x: 2, y: 4 };
  const midRight = { x: 5, y: 4 };
  
  let dots = [];
  if (n === 1) {
    dots = [center];
  } else if (n === 2) {
    dots = [topLeft, bottomRight];
  } else if (n === 3) {
    dots = [topLeft, center, bottomRight];
  } else if (n === 4) {
    dots = [topLeft, topRight, bottomLeft, bottomRight];
  } else if (n === 5) {
    dots = [topLeft, topRight, center, bottomLeft, bottomRight];
  } else if (n === 6) {
    dots = [topLeft, topRight, midLeft, midRight, bottomLeft, bottomRight];
  }
  
  return dots.map(d => `<rect x="${offsetX + d.x}" y="${1 + d.y}" width="1" height="1" fill="${color}" />`).join('');
}

function getPixelDominoSVG(balakVal, color = '#FF5252', size = 16) {
  let leftVal = '1';
  let rightVal = '1';
  
  if (balakVal && balakVal.includes('/')) {
    const parts = balakVal.split('/');
    leftVal = parts[0];
    rightVal = parts[1];
  }
  
  const dotsHTML1 = getDominoFaceDotsHTML(leftVal, 1, color);
  const dotsHTML2 = getDominoFaceDotsHTML(rightVal, 9, color);
  
  return `
    <svg viewBox="0 0 16 10" width="${size * 1.6}" height="${size}" style="image-rendering: pixelated; display: inline-block; vertical-align: middle;">
      <rect x="0" y="0" width="16" height="10" rx="1" fill="#1A1C1E" />
      <rect x="1" y="1" width="6" height="8" rx="0.5" fill="#FFFFFF" />
      <rect x="9" y="1" width="6" height="8" rx="0.5" fill="#FFFFFF" />
      <rect x="7" y="1" width="2" height="8" fill="${color}" />
      ${dotsHTML1}
      ${dotsHTML2}
    </svg>
  `;
}

function getPlayerDefaultColor(idx) {
  return DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
}

function getPlayerDefaultAvatar(idx) {
  return DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];
}

function getTextColorForBg(hexcolor) {
  if (!hexcolor) return '#1A1C1E';
  let color = hexcolor.replace('#', '');
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#1A1C1E' : '#FFFFFF';
}

function getRoundWinnerIndex(round) {
  if (!round || !round.scores || round.scores.length === 0) return -1;
  const minusTwenty = round.scores.indexOf(-20);
  if (minusTwenty !== -1) return minusTwenty;
  const minusTen = round.scores.indexOf(-10);
  if (minusTen !== -1) return minusTen;
  
  let minScore = Infinity;
  let winnerIdx = -1;
  round.scores.forEach((score, idx) => {
    if (score < minScore) {
      minScore = score;
      winnerIdx = idx;
    }
  });
  return minScore <= 0 ? winnerIdx : -1;
}

function getPlayerCurrentStreak(playerIdx) {
  const g = state.currentGame;
  if (!g || g.rounds.length === 0) return 0;
  
  let streak = 0;
  for (let i = g.rounds.length - 1; i >= 0; i--) {
    const winnerIdx = getRoundWinnerIndex(g.rounds[i]);
    if (winnerIdx === playerIdx) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function getPixelFlameSVG(size = 18) {
  const matrix = [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 2, 2, 1, 0, 0],
    [0, 1, 2, 3, 3, 2, 1, 0],
    [0, 1, 2, 3, 3, 2, 1, 0],
    [1, 2, 2, 3, 3, 2, 2, 1],
    [1, 2, 3, 3, 3, 3, 2, 1],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0]
  ];
  
  const colors = {
    1: '#FF1744', // Red
    2: '#FF9100', // Orange
    3: '#FFD740'  // Yellow
  };
  
  let rects = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const val = matrix[r][c];
      if (val > 0) {
        rects.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="${colors[val]}" />`);
      }
    }
  }
  
  return `
    <svg class="pixel-flame" viewBox="0 0 8 8" width="${size}" height="${size}" style="image-rendering: pixelated; display: inline-block; vertical-align: middle; filter: drop-shadow(1px 1px 0px rgba(0, 0, 0, 0.4));">
      ${rects.join('')}
    </svg>
  `;
}

function renderPlayerBadgeHTML(player, size = 'md') {
  const name = player.name;
  const avatar = getSanitizedAvatar(player.avatar);
  const color = player.color || '#FF5252';
  const textColor = getTextColorForBg(color);
  
  let padding = '0.2rem 0.5rem';
  let fontSize = '1.5rem';
  let shadow = '2px 2px 0px #1A1C1E';
  let border = '3px solid #1A1C1E';
  let svgSize = 20;
  
  if (size === 'sm') {
    padding = '0.1rem 0.4rem';
    fontSize = '1.3rem';
    border = '2px solid #1A1C1E';
    shadow = '1.5px 1.5px 0px #1A1C1E';
    svgSize = 16;
  } else if (size === 'lg') {
    padding = '0.3rem 0.75rem';
    fontSize = '1.8rem';
    border = '3px solid #1A1C1E';
    shadow = '3px 3px 0px #1A1C1E';
    svgSize = 24;
  }
  
  const avatarSVG = getPixelArtSVG(avatar, svgSize);
  
  const g = state.currentGame;
  let playerIdx = -1;
  if (g && g.players) {
    playerIdx = g.players.findIndex(p => p.name === name);
  }
  const streak = (playerIdx !== -1) ? getPlayerCurrentStreak(playerIdx) : 0;
  const flameHTML = (streak >= 3)
    ? `<span class="streak-flame-wrapper" style="display: inline-flex; align-items: center; gap: 2px; margin-left: 0.2rem;" title="Menang beruntun ${streak}x! 🔥">
        ${getPixelFlameSVG(svgSize)}
        <span style="font-family: var(--font-title); font-size: ${size === 'sm' ? '0.55rem' : '0.65rem'}; color: #FFD740; text-shadow: 1px 1px 0px #000; font-weight: bold; line-height: 1;">${streak}</span>
       </span>`
    : '';
  
  return `
    <span class="player-badge" style="background-color: ${color}; color: ${textColor}; display: inline-flex; align-items: center; gap: 0.4rem; padding: ${padding}; border: ${border}; box-shadow: ${shadow}; font-weight: bold; text-transform: uppercase; font-size: ${fontSize}; line-height: 1.2; vertical-align: middle;">
      <span class="player-avatar" style="line-height: 1; flex-shrink: 0; display: flex; align-items: center;">${avatarSVG}</span>
      <span class="player-name-text">${escapeHtml(name)}</span>
      ${flameHTML}
    </span>
  `;
}

// Initialize setup player customized data
let setupPlayerData = [];
for (let i = 0; i < 6; i++) {
  setupPlayerData.push({
    avatar: getPlayerDefaultAvatar(i),
    color: getPlayerDefaultColor(i)
  });
}

function saveSetupPlayerData() {
  try {
    localStorage.setItem('gaple_setupPlayerData', JSON.stringify(setupPlayerData));
  } catch (e) {
    console.warn('Failed to save setup player data:', e);
  }
}

function loadSetupPlayerData() {
  try {
    const stored = localStorage.getItem('gaple_setupPlayerData');
    if (stored) {
      setupPlayerData = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load setup player data:', e);
  }
}

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────
const LS_CURRENT = 'gaple_currentGame';
const LS_ALL = 'gaple_allGames';

function saveState() {
  try {
    if (state.currentGame) {
      localStorage.setItem(LS_CURRENT, JSON.stringify(state.currentGame));
    } else {
      localStorage.removeItem(LS_CURRENT);
    }
    localStorage.setItem(LS_ALL, JSON.stringify(state.allGames));
  } catch (e) {
    console.warn('LocalStorage write failed:', e);
  }
}

function loadState() {
  try {
    const cg = localStorage.getItem(LS_CURRENT);
    const ag = localStorage.getItem(LS_ALL);
    state.currentGame = cg ? JSON.parse(cg) : null;
    state.allGames = ag ? JSON.parse(ag) : [];
    
    // Sanitize players of current game
    if (state.currentGame && state.currentGame.players) {
      state.currentGame.players.forEach((p, idx) => {
        p.avatar = getSanitizedAvatar(p.avatar || getPlayerDefaultAvatar(idx));
        if (!p.color) p.color = getPlayerDefaultColor(idx);
      });
    }
    
    // Sanitize players of archived games
    state.allGames.forEach(game => {
      if (game.players) {
        game.players.forEach((p, idx) => {
          p.avatar = getSanitizedAvatar(p.avatar || getPlayerDefaultAvatar(idx));
          if (!p.color) p.color = getPlayerDefaultColor(idx);
        });
      }
    });
  } catch (e) {
    console.warn('LocalStorage read failed:', e);
    state.currentGame = null;
    state.allGames = [];
  }
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  loadSetupPlayerData();
  renderAvatarSelectionGrid();

  // Load last player count if saved
  try {
    const savedCount = localStorage.getItem('gaple_lastPlayerCount');
    if (savedCount) {
      setupPlayerCount = parseInt(savedCount, 10);
      const display = document.getElementById('player-count-display');
      const minusBtn = document.getElementById('count-minus');
      const plusBtn = document.getElementById('count-plus');
      if (display) display.textContent = setupPlayerCount;
      if (minusBtn) minusBtn.disabled = setupPlayerCount <= 2;
      if (plusBtn) plusBtn.disabled = setupPlayerCount >= 6;
    }
  } catch (e) { }

  renderHomePage();
  renderSetupPlayerInputs();
  showPage('home');
});

// Close minus options popovers when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.score-input-control')) {
    document.querySelectorAll('.minus-options-popover').forEach(p => p.classList.add('hidden'));
  }
});

// Delegated keydown listener for score inputs to handle Enter key navigation
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList.contains('score-input-field')) {
    e.preventDefault();

    const currentId = e.target.id; // e.g., "score-score-inputs-2" or "score-edit-inputs-1"
    const parts = currentId.split('-');
    const index = parseInt(parts[parts.length - 1], 10);
    const containerId = parts.slice(1, -1).join('-'); // e.g., "score-inputs" or "edit-inputs"

    const nextInput = document.getElementById(`score-${containerId}-${index + 1}`);
    if (nextInput) {
      nextInput.focus();
      try {
        nextInput.select();
      } catch (err) { }
    } else {
      // It's the last input, trigger save
      if (containerId === 'score-inputs') {
        saveRound();
      } else if (containerId === 'edit-inputs') {
        saveEditRound();
      }
    }
  }
});

// ─────────────────────────────────────────────
// PAGE NAVIGATION
// ─────────────────────────────────────────────
function showPage(pageId) {
  if (pageId !== 'gameover') {
    stopConfetti();
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');
}

// ─────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────
function renderHomePage() {
  const banner = document.getElementById('saved-game-banner');
  const nameEl = document.getElementById('saved-game-name');
  if (state.currentGame && state.currentGame.status === 'active') {
    banner.classList.remove('hidden');
    nameEl.textContent = state.currentGame.name || 'Permainan tersimpan';
  } else {
    banner.classList.add('hidden');
  }
}

function resumeGame() {
  renderDashboard();
  showPage('dashboard');
}

function showHistory() {
  renderHistoryListPage();
  showPage('history');
}

// ─────────────────────────────────────────────
// SETUP PAGE
// ─────────────────────────────────────────────
let setupPlayerCount = 4;

function changePlayerCount(delta) {
  // Simpan nama yang sudah diketik agar tidak hilang saat mengubah jumlah pemain
  const typedNames = [];
  for (let i = 0; i < setupPlayerCount; i++) {
    const el = document.getElementById(`player-name-${i}`);
    if (el) typedNames.push(el.value.trim());
  }

  setupPlayerCount = Math.max(2, Math.min(6, setupPlayerCount + delta));
  document.getElementById('player-count-display').textContent = setupPlayerCount;
  document.getElementById('count-minus').disabled = setupPlayerCount <= 2;
  document.getElementById('count-plus').disabled = setupPlayerCount >= 6;
  renderSetupPlayerInputs(typedNames);
}

function renderSetupPlayerInputs(tempNames = null) {
  const container = document.getElementById('player-inputs');
  container.innerHTML = '';

  let defaultNames = [];
  if (tempNames) {
    defaultNames = tempNames;
  } else {
    try {
      const stored = localStorage.getItem('gaple_lastPlayerNames');
      if (stored) defaultNames = JSON.parse(stored);
    } catch (e) {
      console.warn('Gagal membaca gaple_lastPlayerNames:', e);
    }
  }

  for (let i = 0; i < setupPlayerCount; i++) {
    const val = defaultNames[i] || '';
    const row = document.createElement('div');
    row.className = 'player-input-row';
    
    const custom = setupPlayerData[i] || { avatar: getPlayerDefaultAvatar(i), color: getPlayerDefaultColor(i) };
    setupPlayerData[i] = custom;

    const textColor = getTextColorForBg(custom.color);

    row.innerHTML = `
      <span class="player-input-number">${i + 1}</span>
      <button 
        type="button"
        id="setup-avatar-btn-${i}" 
        class="btn btn-sm" 
        style="background-color: ${custom.color}; color: ${textColor}; padding: 0.5rem; width: 44px; height: 44px; flex-shrink: 0; box-shadow: var(--pixel-shadow-sm); border: var(--border-width) solid var(--border-color); display: flex; align-items: center; justify-content: center;"
        onclick="openSetupCustomizeModal(${i})"
        title="Kustomisasi Pemain"
      >${getPixelArtSVG(custom.avatar, 24)}</button>
      <input
        id="player-name-${i}"
        class="form-input"
        type="text"
        placeholder="Nama Pemain ${i + 1}"
        value="${escapeHtml(val)}"
        maxlength="20"
        autocomplete="off"
        style="flex: 1;"
      />
    `;
    container.appendChild(row);
  }
}

function startGame() {
  const gameName = document.getElementById('game-name').value.trim() || 'Gaple Game';
  const players = [];
  const namesToSave = [];

  for (let i = 0; i < setupPlayerCount; i++) {
    const val = document.getElementById(`player-name-${i}`).value.trim();
    const name = val || `Pemain ${i + 1}`;
    const custom = setupPlayerData[i] || { avatar: getPlayerDefaultAvatar(i), color: getPlayerDefaultColor(i) };
    players.push({ 
      name: name, 
      total: 0,
      avatar: custom.avatar,
      color: custom.color
    });
    namesToSave.push(val);
  }

  // Simpan ke LocalStorage agar tidak perlu mengetik ulang nanti
  try {
    localStorage.setItem('gaple_lastPlayerNames', JSON.stringify(namesToSave));
  } catch (e) {
    console.warn('Gagal menyimpan gaple_lastPlayerNames:', e);
  }

  // Jika jumlah pemain game sebelumnya berbeda, kita update default count ke depan
  try {
    localStorage.setItem('gaple_lastPlayerCount', setupPlayerCount);
  } catch (e) { }

  const startBalak = document.getElementById('start-balak').value || '0/0';

  const game = {
    id: Date.now().toString(),
    name: gameName,
    players: players,
    rounds: [],
    status: 'active',
    startBalak: startBalak,
    createdAt: new Date().toISOString(),
  };

  state.currentGame = game;
  saveState();

  renderDashboard();
  showPage('dashboard');
  showToast('Permainan dimulai! 🎮');
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
function renderDashboard() {
  const g = state.currentGame;
  if (!g) return;

  // Header
  document.getElementById('dash-game-name').textContent = g.name;
  const badge = document.getElementById('dash-status-badge');
  if (g.status === 'done') {
    badge.textContent = 'Selesai';
    badge.className = 'status-badge status-done';
  } else {
    badge.textContent = 'Berlangsung';
    badge.className = 'status-badge status-active';
  }

  document.getElementById('dash-round-info').textContent = `Ronde ${g.rounds.length}`;

  const startBalakEl = document.getElementById('dash-start-balak');
  if (startBalakEl) {
    startBalakEl.innerHTML = `${getPixelDominoSVG('#FF5252', 12)} Mulai: ${g.startBalak || '0/0'}`;
  }

  const gapleBadgeEl = document.getElementById('dash-gaple-info');
  if (gapleBadgeEl) {
    if (g.rounds.length > 0) {
      const lastRound = g.rounds[g.rounds.length - 1];
      if (lastRound.gapleCard) {
        gapleBadgeEl.textContent = `Gaple ${lastRound.gapleCard}`;
        gapleBadgeEl.classList.remove('hidden');
      } else {
        gapleBadgeEl.classList.add('hidden');
      }
    } else {
      gapleBadgeEl.classList.add('hidden');
    }
  }

  // Leaderboard
  renderLeaderboard();

  // Score input section
  const inputSection = document.getElementById('score-input-section');
  const titleEl = document.getElementById('score-input-title');
  if (g.status === 'done') {
    inputSection.classList.add('hidden');
  } else {
    inputSection.classList.remove('hidden');
    titleEl.textContent = `Tambah Skor Ronde ${g.rounds.length + 1}`;
    renderScoreInputs('score-inputs');
  }

  // History
  renderRoundHistory();

  // Undo button hidden by default
  document.getElementById('btn-undo').classList.add('hidden');
}

function getDealerPlayerIndex(targetRoundNum = null) {
  const g = state.currentGame;
  if (!g || g.players.length === 0) return -1;

  const totals = Array(g.players.length).fill(0);
  const maxRounds = targetRoundNum !== null ? targetRoundNum : g.rounds.length;

  for (let r = 0; r < maxRounds; r++) {
    const round = g.rounds[r];
    for (let p = 0; p < g.players.length; p++) {
      totals[p] += (round.scores[p] || 0);
    }
  }

  const maxScore = Math.max(...totals);
  if (maxScore === 0) {
    return -1; // No dealer/shuffler when scores are still zero
  }

  let dealerIdx = -1;
  let highestScore = -Infinity;
  for (let p = 0; p < g.players.length; p++) {
    if (totals[p] > highestScore) {
      highestScore = totals[p];
      dealerIdx = p;
    }
  }
  return dealerIdx;
}

function getFirstPlayerIndex() {
  const g = state.currentGame;
  if (!g || g.rounds.length === 0) return -1;
  const latestRound = g.rounds[g.rounds.length - 1];
  return latestRound.scores.indexOf(-10);
}

function renderLeaderboard() {
  const g = state.currentGame;
  if (!g) return;

  const sorted = [...g.players]
    .map((p, i) => ({ ...p, idx: i }))
    .sort((a, b) => a.total - b.total);

  const maxScore = Math.max(...g.players.map(p => p.total), 1);
  const container = document.getElementById('leaderboard-list');
  container.innerHTML = '';

  // Dealer: Pemain dengan skor tertinggi saat ini
  const dealerIdx = getDealerPlayerIndex();
  // Jalan Duluan: Pemain yang dapat skor -10 di ronde terakhir
  const firstPlayerIdx = getFirstPlayerIndex();
  
  // Gaple Terakhir: Pemain yang dapat skor -20 di ronde terakhir
  let gaplePlayerIdx = -1;
  let gapleCardVal = null;
  if (g.rounds.length > 0) {
    const latestRound = g.rounds[g.rounds.length - 1];
    gaplePlayerIdx = latestRound.scores.indexOf(-20);
    gapleCardVal = latestRound.gapleCard;
  }

  sorted.forEach((p, rank) => {
    const isDealer = p.idx === dealerIdx;
    const isFirst = p.idx === firstPlayerIdx;

    const dealerBadge = isDealer ? `<span class="dealer-badge-sm" title="Pengocok Kartu (Ngocok)">🎴 NGOCOK</span>` : '';
    const firstBadge = isFirst ? `<span class="first-badge-sm" title="Jalan Duluan">🚀 Jalan Duluan</span>` : '';

    const item = document.createElement('div');
    item.className = 'lb-item';
    const barPct = maxScore > 0 ? Math.round((p.total / 100) * 100) : 0;
    
    // Tentukan warna progress bar berdasarkan tingkat bahaya (skor mendekati 100)
    let barColorClass = 'bar-success';
    if (p.total >= 80) {
      barColorClass = 'bar-danger';
    } else if (p.total >= 50) {
      barColorClass = 'bar-warning';
    }

    item.innerHTML = `
      <div class="lb-rank lb-rank-${rank + 1}">${rank + 1}</div>
      <div class="lb-item-inner">
        <div class="lb-name" style="cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;" onclick="openRenamePlayerModal(${p.idx})" title="Klik untuk kustomisasi pemain">
          ${renderPlayerBadgeHTML(p)}
          <span style="font-size: 0.75rem; opacity: 0.6; display: inline-block; vertical-align: middle;">✏️</span>
          ${dealerBadge}
          ${firstBadge}
        </div>
        <div class="lb-bar-wrap">
          <div class="lb-bar ${barColorClass}" style="width: ${Math.min(barPct, 100)}%"></div>
        </div>
      </div>
      <div class="lb-score ${p.total >= 100 ? 'lb-score-danger' : ''}">${p.total}</div>
    `;
    container.appendChild(item);
  });
}

function renderScoreInputs(containerId) {
  const g = state.currentGame;
  if (!g) return;
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // Hitung dealer berdasarkan ronde yang sedang dikerjakan
  let targetRoundNum = g.rounds.length;
  if (containerId === 'edit-inputs' && state.editingRoundIndex !== null) {
    targetRoundNum = state.editingRoundIndex;
  }
  const dealerIdx = getDealerPlayerIndex(targetRoundNum);

  // Hitung siapa yang jalan duluan (siapa yang dapat -10 di ronde sebelumnya)
  let firstPlayerIdx = -1;
  let gaplePlayerIdx = -1;
  let gapleCardVal = null;

  if (containerId === 'score-inputs') {
    firstPlayerIdx = getFirstPlayerIndex();
    if (g.rounds.length > 0) {
      const prevRound = g.rounds[g.rounds.length - 1];
      gaplePlayerIdx = prevRound.scores.indexOf(-20);
      gapleCardVal = prevRound.gapleCard;
    }
  } else if (containerId === 'edit-inputs' && state.editingRoundIndex !== null && state.editingRoundIndex > 0) {
    const prevRound = g.rounds[state.editingRoundIndex - 1];
    if (prevRound) {
      firstPlayerIdx = prevRound.scores.indexOf(-10);
      gaplePlayerIdx = prevRound.scores.indexOf(-20);
      gapleCardVal = prevRound.gapleCard;
    }
  }

  g.players.forEach((p, i) => {
    const isDealer = i === dealerIdx;
    const isFirst = i === firstPlayerIdx;

    const dealerBadge = isDealer ? `<span class="dealer-badge" title="Pengocok Kartu (Ngocok)">🎴 NGOCOK</span>` : '';
    const firstBadge = isFirst ? `<span class="first-badge" title="Jalan Duluan">🚀 Jalan Duluan</span>` : '';

    const row = document.createElement('div');
    row.className = 'score-input-row';
    row.innerHTML = `
      <span class="score-player-name" style="display: inline-flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        ${renderPlayerBadgeHTML(p, 'sm')}
        ${dealerBadge}
        ${firstBadge}
      </span>
      <div class="score-input-control">
        <button
          type="button"
          class="btn-minus-toggle"
          onclick="toggleMinusOptions(event, '${containerId}', ${i})"
          title="Pilih Skor Negatif"
        >
          ±
        </button>
        <input
          id="score-${containerId}-${i}"
          class="score-input-field"
          type="number"
          placeholder="0"
          inputmode="numeric"
          autocomplete="off"
        />
        <div id="minus-options-${containerId}-${i}" class="minus-options-popover hidden">
          <button type="button" class="minus-opt-btn" onclick="selectMinusVal('${containerId}', ${i}, -10)">-10</button>
          <button type="button" class="minus-opt-btn" onclick="selectMinusVal('${containerId}', ${i}, -15)">-15</button>
          <button type="button" class="minus-opt-btn" onclick="selectMinusVal('${containerId}', ${i}, -20)">-20</button>
          <button type="button" class="minus-opt-btn" onclick="selectMinusVal('${containerId}', ${i}, -25)">-25</button>
          <button type="button" class="minus-opt-btn" onclick="selectMinusVal('${containerId}', ${i}, -30)">-30</button>
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}

function toggleMinusOptions(event, containerId, playerIdx) {
  event.stopPropagation();
  const popoverId = `minus-options-${containerId}-${playerIdx}`;
  const popover = document.getElementById(popoverId);
  if (!popover) return;

  const isHidden = popover.classList.contains('hidden');

  // Close all other popovers
  document.querySelectorAll('.minus-options-popover').forEach(p => {
    p.classList.add('hidden');
  });

  if (isHidden) {
    popover.classList.remove('hidden');
  } else {
    popover.classList.add('hidden');
  }
}

function selectMinusVal(containerId, playerIdx, val) {
  const inputId = `score-${containerId}-${playerIdx}`;
  const el = document.getElementById(inputId);
  if (el) {
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  const popoverId = `minus-options-${containerId}-${playerIdx}`;
  const popover = document.getElementById(popoverId);
  if (popover) {
    popover.classList.add('hidden');
  }
}

function renderRoundHistory() {
  const g = state.currentGame;
  const container = document.getElementById('round-history');
  container.innerHTML = '';

  if (!g || g.rounds.length === 0) {
    container.innerHTML = `<div class="no-history">Belum ada ronde. Tambahkan skor pertama!</div>`;
    return;
  }

  // Render reversed (latest first)
  const rounds = [...g.rounds].reverse();
  rounds.forEach((round, revIdx) => {
    const realIdx = g.rounds.length - 1 - revIdx;
    const card = document.createElement('div');
    card.className = 'round-card';

    const isDone = g.status === 'done';
    const actionsHtml = isDone ? '' : `
      <button class="btn-round-action" onclick="openEditRound(${realIdx})">Edit</button>
      <button class="btn-round-action danger" onclick="openDeleteRound(${realIdx})">Hapus</button>
    `;

    const scoresHtml = g.players.map((p, i) => {
      const score = round.scores[i];
      const cls = score < 0 ? 'negative' : '';
      return `
        <div class="round-score-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;">
          <span class="round-score-name">${renderPlayerBadgeHTML(p, 'sm')}</span>
          <span class="round-score-val ${cls}" style="font-family: var(--font-title); font-size: 0.75rem;">${score >= 0 ? '+' : ''}${score}</span>
        </div>
      `;
    }).join('');

    const gapleText = round.gapleCard ? ` <span class="gaple-history-badge" style="color: var(--primary); font-weight: bold; border: 1.5px solid var(--primary); padding: 1px 4px; font-size: 0.55rem; margin-left: 5px; text-transform: uppercase;">Gaple ${round.gapleCard}</span>` : '';
    card.innerHTML = `
      <div class="round-card-header">
        <span class="round-card-title">Ronde ${realIdx + 1}${gapleText}</span>
        <div class="round-card-actions">${actionsHtml}</div>
      </div>
      <div class="round-card-body">${scoresHtml}</div>
    `;
    container.appendChild(card);
  });
}

// ─────────────────────────────────────────────
// SAVE ROUND
// ─────────────────────────────────────────────
function saveRound() {
  const g = state.currentGame;
  if (!g || g.status === 'done') return;

  const scores = [];
  let hasAnyInput = false;

  for (let i = 0; i < g.players.length; i++) {
    const val = document.getElementById(`score-score-inputs-${i}`).value;
    const num = val === '' ? 0 : parseInt(val, 10);
    if (isNaN(num)) {
      showToast('Skor harus berupa angka!');
      document.getElementById(`score-score-inputs-${i}`).focus();
      return;
    }
    if (val !== '') hasAnyInput = true;
    scores.push(num);
  }

  if (!hasAnyInput) {
    showToast('Masukkan setidaknya satu skor!');
    return;
  }

  // Check if anyone scored -20 (Gaple)
  const hasGaple = scores.includes(-20);
  if (hasGaple) {
    state.pendingRound = {
      scores,
      isEditing: false,
      editIndex: null
    };
    // Reset modal custom inputs
    document.getElementById('gaple-custom-card').value = '';
    document.getElementById('gaple-custom-input-wrap').classList.add('hidden');
    document.getElementById('btn-confirm-gaple').classList.add('hidden');
    openModal('modal-gaple-card');
  } else {
    // Add round normally
    g.rounds.push({ scores });
    finalizeSaveRound();
  }
}

function finalizeSaveRound() {
  const g = state.currentGame;
  if (!g) return;

  // Recalculate totals from scratch
  recalcTotals();
  saveState();
  renderDashboard();

  // Check win condition
  checkGameOver();

  // Beritahu jika ada yang dapat -10 (jalan duluan)
  const lastRound = g.rounds[g.rounds.length - 1];
  const minusTenIdx = lastRound ? lastRound.scores.indexOf(-10) : -1;
  if (minusTenIdx !== -1) {
    const winnerName = g.players[minusTenIdx].name;
    showToast(`🎉 ${winnerName} dapat -10! Ronde berikutnya jalan duluan 🚀`, 4000);
  } else {
    showToast(`Ronde ${g.rounds.length} disimpan ✓`);
  }

  // Auto-focus first input field for the next round
  setTimeout(() => {
    const firstInput = document.getElementById('score-score-inputs-0');
    if (firstInput) {
      firstInput.focus();
      try { firstInput.select(); } catch (err) { }
    }
  }, 50);
}

function recalcTotals() {
  const g = state.currentGame;
  if (!g) return;
  g.players.forEach((p, i) => {
    p.total = g.rounds.reduce((sum, r) => sum + (r.scores[i] || 0), 0);
  });
}

// ─────────────────────────────────────────────
// CHECK GAME OVER
// ─────────────────────────────────────────────
function checkGameOver() {
  const g = state.currentGame;
  if (!g || g.status === 'done') return;

  const over = g.players.filter(p => p.total >= 100);
  if (over.length > 0) {
    const names = over.map(p => p.name).join(', ');
    document.getElementById('modal-gameover-body').textContent =
      `${names} telah mencapai atau melampaui 100 poin. Permainan akan diakhiri.`;
    openModal('modal-gameover');
  }
}

function endGame() {
  const g = state.currentGame;
  if (!g) return;
  g.status = 'done';

  // Archive current game
  const existing = state.allGames.findIndex(ag => ag.id === g.id);
  if (existing >= 0) {
    state.allGames[existing] = { ...g };
  } else {
    state.allGames.unshift({ ...g });
  }

  closeModal('modal-gameover');
  saveState();
  renderGameOver();
  showPage('gameover');
  startConfetti();
}

// ─────────────────────────────────────────────
// GAME OVER PAGE
// ─────────────────────────────────────────────
function renderGameOver() {
  const g = state.currentGame;
  if (!g) return;

  const winner = [...g.players].sort((a, b) => a.total - b.total)[0];
  document.getElementById('gameover-subtitle').textContent =
    `🏆 ${winner.name} menang dengan ${winner.total} poin terkecil!`;

  const sorted = [...g.players]
    .map((p, i) => ({ ...p, idx: i }))
    .sort((a, b) => a.total - b.total);

  const container = document.getElementById('gameover-leaderboard');
  container.innerHTML = '';

  sorted.forEach((p, rank) => {
    const item = document.createElement('div');
    item.className = `go-lb-item ${rank === 0 ? 'rank-1' : ''}`;
    item.innerHTML = `
      <div class="go-lb-rank">${rank + 1}</div>
      <div class="go-lb-name">${renderPlayerBadgeHTML(p)}</div>
      <div class="go-lb-score">${p.total}</div>
    `;
    container.appendChild(item);
  });

  // Render Gaple Momen Stats
  const gapleStatsEl = document.getElementById('gameover-gaple-stats');
  const gapleListEl = document.getElementById('gameover-gaple-list');
  gapleListEl.innerHTML = '';
  
  const gapleRounds = [];
  g.rounds.forEach((r, roundIdx) => {
    if (r.gapleCard) {
      const playerIdx = r.scores.indexOf(-20);
      if (playerIdx !== -1) {
        gapleRounds.push({
          roundNum: roundIdx + 1,
          player: g.players[playerIdx],
          card: r.gapleCard
        });
      }
    }
  });

  if (gapleRounds.length > 0) {
    gapleStatsEl.classList.remove('hidden');
    gapleRounds.forEach(gr => {
      const row = document.createElement('div');
      row.className = 'go-lb-item';
      row.style.borderColor = 'var(--primary)';
      row.innerHTML = `
        <div class="go-lb-name" style="font-size: 1.6rem; display: inline-flex; align-items: center; gap: 0.5rem;">
          Ronde ${gr.roundNum}: ${renderPlayerBadgeHTML(gr.player, 'sm')}
        </div>
        <div class="go-lb-score" style="color: var(--primary); font-size: 1.2rem; font-weight: bold;">BALAK ${gr.card}</div>
      `;
      gapleListEl.appendChild(row);
    });
  } else {
    gapleStatsEl.classList.add('hidden');
  }
}

// ─────────────────────────────────────────────
// DELETE ROUND
// ─────────────────────────────────────────────
function openDeleteRound(idx) {
  state.pendingDeleteIndex = idx;
  openModal('modal-delete');
}

function confirmDeleteRound() {
  const g = state.currentGame;
  if (!g || state.pendingDeleteIndex === null) return;

  // Cache for undo
  state.deletedRoundCache = {
    round: { ...g.rounds[state.pendingDeleteIndex], scores: [...g.rounds[state.pendingDeleteIndex].scores] },
    index: state.pendingDeleteIndex,
  };

  g.rounds.splice(state.pendingDeleteIndex, 1);
  state.pendingDeleteIndex = null;
  recalcTotals();
  saveState();
  closeModal('modal-delete');
  renderDashboard();

  // Show undo button
  document.getElementById('btn-undo').classList.remove('hidden');
  showToast('Ronde dihapus');
}

function undoLastDelete() {
  const g = state.currentGame;
  if (!g || !state.deletedRoundCache) return;

  const { round, index } = state.deletedRoundCache;
  g.rounds.splice(index, 0, round);
  state.deletedRoundCache = null;
  recalcTotals();
  saveState();
  renderDashboard();
  showToast('Penghapusan dibatalkan ↩');
}

// ─────────────────────────────────────────────
// EDIT ROUND
// ─────────────────────────────────────────────
function openEditRound(idx) {
  const g = state.currentGame;
  if (!g) return;
  state.editingRoundIndex = idx;
  document.getElementById('edit-round-num').textContent = idx + 1;

  // Pre-fill
  renderScoreInputs('edit-inputs');
  const round = g.rounds[idx];
  g.players.forEach((p, i) => {
    const el = document.getElementById(`score-edit-inputs-${i}`);
    if (el) el.value = round.scores[i] !== undefined ? round.scores[i] : 0;
  });

  openModal('modal-edit');

  // Auto-focus the first edit input
  setTimeout(() => {
    const firstInput = document.getElementById('score-edit-inputs-0');
    if (firstInput) {
      firstInput.focus();
      try { firstInput.select(); } catch (e) { }
    }
  }, 120);
}

function saveEditRound() {
  const g = state.currentGame;
  if (!g || state.editingRoundIndex === null) return;

  const scores = [];
  for (let i = 0; i < g.players.length; i++) {
    const val = document.getElementById(`score-edit-inputs-${i}`).value;
    const num = val === '' ? 0 : parseInt(val, 10);
    if (isNaN(num)) {
      showToast('Skor harus berupa angka!');
      return;
    }
    scores.push(num);
  }

  // Check if anyone scored -20 (Gaple)
  const hasGaple = scores.includes(-20);
  if (hasGaple) {
    state.pendingRound = {
      scores,
      isEditing: true,
      editIndex: state.editingRoundIndex
    };
    // Reset modal custom inputs
    document.getElementById('gaple-custom-card').value = '';
    document.getElementById('gaple-custom-input-wrap').classList.add('hidden');
    document.getElementById('btn-confirm-gaple').classList.add('hidden');
    closeModal('modal-edit');
    openModal('modal-gaple-card');
  } else {
    g.rounds[state.editingRoundIndex].scores = scores;
    delete g.rounds[state.editingRoundIndex].gapleCard; // Remove gaple label if it's no longer -20
    state.editingRoundIndex = null;
    finalizeEditRound();
  }
}

function finalizeEditRound() {
  recalcTotals();
  saveState();
  closeModal('modal-edit');
  renderDashboard();
  showToast('Ronde diperbarui ✓');
}

// ─────────────────────────────────────────────
// NEW GAME
// ─────────────────────────────────────────────
function startNewGame() {
  stopConfetti();
  // Archive current game if exists
  const g = state.currentGame;
  let nextBalak = '0/0';
  if (g) {
    // Auto-copy game results to clipboard
    try {
      copyResult();
    } catch (e) {
      console.warn('Auto-copy failed:', e);
    }

    if (g.status === 'active') g.status = 'done';
    const existing = state.allGames.findIndex(ag => ag.id === g.id);
    if (existing >= 0) {
      state.allGames[existing] = { ...g };
    } else {
      state.allGames.unshift({ ...g });
    }
    // Calculate the next balak card in the double sequence
    if (g.startBalak) {
      const sequence = ['0/0', '1/1', '2/2', '3/3', '4/4', '5/5', '6/6'];
      const idx = sequence.indexOf(g.startBalak);
      if (idx !== -1) {
        nextBalak = sequence[(idx + 1) % sequence.length];
      }
    }
  }
  state.currentGame = null;
  state.deletedRoundCache = null;
  state.pendingDeleteIndex = null;
  state.editingRoundIndex = null;
  saveState();

  // Reset setup form
  document.getElementById('game-name').value = '';
  setupPlayerCount = 4;
  document.getElementById('player-count-display').textContent = 4;
  document.getElementById('count-minus').disabled = false;
  document.getElementById('count-plus').disabled = false;
  setStartingBalak(nextBalak);
  renderSetupPlayerInputs();

  renderHomePage();
  showPage('setup');
}

// ─────────────────────────────────────────────
// HISTORY LIST PAGE
// ─────────────────────────────────────────────
function renderHistoryListPage() {
  const container = document.getElementById('history-list-container');
  container.innerHTML = '';

  if (state.allGames.length === 0) {
    container.innerHTML = `
      <div class="no-history-games">
        <span class="empty-icon">📋</span>
        <p>Belum ada permainan selesai.</p>
      </div>
    `;
    return;
  }

  state.allGames.forEach(game => {
    const sorted = [...game.players].sort((a, b) => a.total - b.total);
    const winner = sorted[0];
    const date = new Date(game.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const card = document.createElement('div');
    card.className = 'history-game-card';
    card.innerHTML = `
      <div class="history-game-card-header">
        <span class="history-game-name">${escapeHtml(game.name)}</span>
        <span class="history-game-date">${date}</span>
      </div>
      <p class="history-game-meta" style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
        <span>${game.players.length} pemain · ${game.rounds.length} ronde · Pemenang: </span>
        ${renderPlayerBadgeHTML(winner, 'sm')}
        <span>(${winner.total})</span>
      </p>
    `;
    container.appendChild(card);
  });
}

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────
function exportData() {
  const g = state.currentGame;
  if (!g) { showToast('Tidak ada game aktif.'); return; }

  const sorted = [...g.players].sort((a, b) => a.total - b.total);
  const date = new Date(g.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  let csv = `GAPLE SCORE TRACKER\n`;
  csv += `Game: ${g.name}\n`;
  csv += `Tanggal: ${date}\n`;
  csv += `Total Ronde: ${g.rounds.length}\n\n`;

  // Leaderboard
  csv += `LEADERBOARD\n`;
  sorted.forEach((p, i) => {
    csv += `${i + 1}. ${p.name},${p.total}\n`;
  });

  csv += `\nRIWAYAT RONDE\n`;
  csv += `Ronde,` + g.players.map(p => p.name).join(',') + `\n`;
  g.rounds.forEach((round, i) => {
    csv += `${i + 1},` + round.scores.join(',') + `\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gaple-${g.name.replace(/\s+/g, '_')}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('File CSV diunduh ✓');
}

// ─────────────────────────────────────────────
// COPY RESULT
// ─────────────────────────────────────────────
function copyResult() {
  const g = state.currentGame;
  if (!g) return;

  const sorted = [...g.players].sort((a, b) => a.total - b.total);
  const date = new Date(g.createdAt).toLocaleDateString('id-ID');
  let text = `GAPLE SCORE — ${g.name} (${date})\n`;
  text += `━━━━━━━━━━━━━━━━━━\n`;
  const medals = ['🥇', '🥈', '🥉'];
  sorted.forEach((p, i) => {
    text += `${medals[i] || (i + 1 + '.')} ${getAvatarEmoji(p.avatar)} ${p.name}: ${p.total} poin\n`;
  });
  text += `━━━━━━━━━━━━━━━━━━\n`;
  
  // List Gaple events if any
  const gapleEvents = [];
  g.rounds.forEach((r, idx) => {
    if (r.gapleCard) {
      const pIdx = r.scores.indexOf(-20);
      if (pIdx !== -1) {
        const p = g.players[pIdx];
        gapleEvents.push(`• Ronde ${idx + 1}: ${getAvatarEmoji(p.avatar)} ${p.name} (Balak ${r.gapleCard})`);
      }
    }
  });
  
  if (gapleEvents.length > 0) {
    text += `MOMEN GAPLE 🀱:\n`;
    text += gapleEvents.join('\n') + `\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
  }
  
  text += `Total ${g.rounds.length} ronde`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Hasil disalin ke clipboard ✓'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand('copy');
    showToast('Hasil disalin ke clipboard ✓');
  } catch {
    showToast('Gagal menyalin. Salin manual.');
  }
  document.body.removeChild(el);
}

// ─────────────────────────────────────────────
// MODAL HELPERS
// ─────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// Close modals on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
let toastTimer = null;

function showToast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}

// ─────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────
// CONFETTI CELEBRATION EFFECT (VANILLA JS)
// ─────────────────────────────────────────────
let confettiActive = false;
let confettiAnimationId = null;
let confettiCanvas = null;
let confettiCtx = null;
let confettiParticles = [];

function initConfetti() {
  confettiCanvas = document.getElementById('confetti-canvas');
  confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
}

function resizeConfettiCanvas() {
  if (!confettiCanvas) initConfetti();
  if (confettiCanvas) {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
}
window.addEventListener('resize', resizeConfettiCanvas);

class ConfettiParticle {
  constructor() {
    this.x = Math.random() * window.innerWidth;
    this.y = Math.random() * -window.innerHeight - 20;
    this.size = Math.random() * 8 + 6;
    this.color = this.getRandomColor();
    this.speedY = Math.random() * 3.5 + 2;
    this.speedX = Math.random() * 3 - 1.5;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 6 - 3;
  }

  getRandomColor() {
    // Warna-warni konfeti retro arcade yang sangat meriah
    const colors = [
      '#FF5252', // Coral Red
      '#00E5FF', // Neon Cyan
      '#FFD740', // Golden Yellow
      '#69F0AE', // Lime Green
      '#FF9100', // Neon Orange
      '#E040FB', // Bright Purple
      '#651FFF', // Indigo
      '#FF3D00', // Deep Orange
      '#00E676', // Green
      '#FFEB3B'  // Yellow
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    this.rotation += this.rotationSpeed;

    // Reset particles that fall below screen
    if (this.y > window.innerHeight) {
      this.y = -20;
      this.x = Math.random() * window.innerWidth;
    }
  }

  draw() {
    if (!confettiCtx) return;
    confettiCtx.save();
    confettiCtx.translate(this.x + this.size / 2, this.y + this.size / 2);
    confettiCtx.rotate((this.rotation * Math.PI) / 180);
    confettiCtx.fillStyle = this.color;
    confettiCtx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    confettiCtx.restore();
  }
}

function startConfetti() {
  if (!confettiCanvas) initConfetti();
  resizeConfettiCanvas();
  confettiParticles = [];
  for (let i = 0; i < 150; i++) {
    confettiParticles.push(new ConfettiParticle());
  }
  confettiActive = true;
  animateConfetti();
}

function stopConfetti() {
  confettiActive = false;
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
  }
  if (confettiCtx && confettiCanvas) {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

function animateConfetti() {
  if (!confettiActive || !confettiCtx || !confettiCanvas) return;
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  confettiParticles.forEach(p => {
    p.update();
    p.draw();
  });

  confettiAnimationId = requestAnimationFrame(animateConfetti);
}

// ─────────────────────────────────────────────
// GAPLE CARD SELECTOR FUNCTIONS
// ─────────────────────────────────────────────
function selectGapleCard(val) {
  if (val === 'Lainnya') {
    document.getElementById('gaple-custom-input-wrap').classList.remove('hidden');
    document.getElementById('btn-confirm-gaple').classList.remove('hidden');
    document.getElementById('gaple-custom-card').focus();
  } else {
    commitPendingRound(val);
  }
}

function confirmGapleCustom() {
  const val = document.getElementById('gaple-custom-card').value.trim();
  if (!val) {
    showToast('Masukkan nomor/kartu balak!');
    return;
  }
  commitPendingRound(val);
}

function cancelGapleModal() {
  closeModal('modal-gaple-card');
  if (state.pendingRound && state.pendingRound.isEditing) {
    state.editingRoundIndex = state.pendingRound.editIndex;
    openModal('modal-edit');
  }
  state.pendingRound = null;
}

function commitPendingRound(gapleCardVal) {
  const g = state.currentGame;
  if (!g || !state.pendingRound) return;

  const { scores, isEditing, editIndex } = state.pendingRound;

  if (isEditing) {
    g.rounds[editIndex].scores = scores;
    g.rounds[editIndex].gapleCard = gapleCardVal;
    state.editingRoundIndex = null;
  } else {
    g.rounds.push({ scores, gapleCard: gapleCardVal });
  }

  state.pendingRound = null;
  closeModal('modal-gaple-card');

  if (isEditing) {
    finalizeEditRound();
  } else {
    finalizeSaveRound();
  }
}

// ─────────────────────────────────────────────
// STARTING BALAK SELECTION FUNCTIONS
// ─────────────────────────────────────────────
function setStartingBalak(val) {
  const input = document.getElementById('start-balak');
  if (input) input.value = val;

  document.querySelectorAll('.balak-select-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const activeBtn = document.getElementById(`balak-btn-${val.replace('/', '-')}`);
  if (activeBtn) activeBtn.classList.add('active');
}

// ─────────────────────────────────────────────
// PLAYER RENAME FUNCTIONS
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// PLAYER RENAME & CUSTOMIZATION FUNCTIONS
// ─────────────────────────────────────────────
let customizerContext = {
  mode: 'setup', // 'setup' | 'dashboard'
  playerIndex: 0
};

function renderAvatarSelectionGrid() {
  const grid = document.querySelector('.avatar-selector-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const avatars = ['fox', 'frog', 'cat', 'panda', 'tiger', 'koala', 'pig', 'lion', 'chicken', 'monkey'];
  avatars.forEach(avatarKey => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline avatar-opt';
    btn.setAttribute('data-avatar', avatarKey);
    btn.innerHTML = getPixelArtSVG(avatarKey, 24);
    btn.onclick = () => selectCustomAvatar(avatarKey);
    grid.appendChild(btn);
  });
}

function openCustomizePlayerModal(mode, idx) {
  customizerContext.mode = mode;
  customizerContext.playerIndex = idx;

  let name = '';
  let avatar = '';
  let color = '';

  if (mode === 'setup') {
    const custom = setupPlayerData[idx] || { avatar: getPlayerDefaultAvatar(idx), color: getPlayerDefaultColor(idx) };
    const inputEl = document.getElementById(`player-name-${idx}`);
    name = inputEl ? inputEl.value.trim() : `Pemain ${idx + 1}`;
    avatar = custom.avatar;
    color = custom.color;
  } else {
    const g = state.currentGame;
    if (!g) return;
    const player = g.players[idx];
    name = player.name;
    avatar = player.avatar || getPlayerDefaultAvatar(idx);
    color = player.color || getPlayerDefaultColor(idx);
  }

  document.getElementById('custom-player-name').value = name;
  document.getElementById('custom-player-avatar').value = avatar;
  document.getElementById('custom-player-color').value = color;

  selectCustomAvatar(avatar);
  selectCustomColor(color);

  openModal('modal-customize-player');

  setTimeout(() => {
    const nameInput = document.getElementById('custom-player-name');
    if (nameInput) {
      nameInput.focus();
      try { nameInput.select(); } catch (e) {}
    }
  }, 120);
}

function openSetupCustomizeModal(idx) {
  openCustomizePlayerModal('setup', idx);
}

function openDashboardCustomizeModal(idx) {
  openCustomizePlayerModal('dashboard', idx);
}

function selectCustomAvatar(avatarKey) {
  const input = document.getElementById('custom-player-avatar');
  if (input) input.value = avatarKey;

  document.querySelectorAll('.avatar-opt').forEach(btn => {
    btn.classList.remove('active');
  });

  document.querySelectorAll('.avatar-opt').forEach(btn => {
    if (btn.getAttribute('data-avatar') === avatarKey) {
      btn.classList.add('active');
    }
  });
}

function selectCustomColor(hexcolor) {
  const input = document.getElementById('custom-player-color');
  if (input) input.value = hexcolor;

  document.querySelectorAll('.color-opt').forEach(btn => {
    btn.classList.remove('active');
  });

  const colorClean = hexcolor.replace('#', '');
  const activeBtn = document.getElementById(`color-opt-${colorClean}`);
  if (activeBtn) activeBtn.classList.add('active');
}

function confirmCustomizePlayer() {
  const mode = customizerContext.mode;
  const idx = customizerContext.playerIndex;

  const nameInput = document.getElementById('custom-player-name');
  const avatarInput = document.getElementById('custom-player-avatar');
  const colorInput = document.getElementById('custom-player-color');

  const newName = nameInput ? nameInput.value.trim() : '';
  const newAvatar = avatarInput ? avatarInput.value : 'fox';
  const newColor = colorInput ? colorInput.value : '#FF5252';

  if (!newName) {
    showToast('Nama tidak boleh kosong!');
    return;
  }

  if (mode === 'setup') {
    setupPlayerData[idx] = {
      avatar: newAvatar,
      color: newColor
    };
    saveSetupPlayerData();

    const nameField = document.getElementById(`player-name-${idx}`);
    if (nameField) nameField.value = newName;

    const avatarBtn = document.getElementById(`setup-avatar-btn-${idx}`);
    if (avatarBtn) {
      avatarBtn.innerHTML = getPixelArtSVG(newAvatar, 24);
      avatarBtn.style.backgroundColor = newColor;
      avatarBtn.style.color = getTextColorForBg(newColor);
    }
  } else {
    const g = state.currentGame;
    if (g && g.players[idx]) {
      g.players[idx].name = newName;
      g.players[idx].avatar = newAvatar;
      g.players[idx].color = newColor;

      saveState();
      renderDashboard();
    }
  }

  closeModal('modal-customize-player');
  showToast('Kustomisasi pemain diperbarui ✓');
}

// Keep for backward compatibility with leaderboard click
function openRenamePlayerModal(playerIdx) {
  openDashboardCustomizeModal(playerIdx);
}


