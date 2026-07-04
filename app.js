/* =============================================
   GAPLE SCORE TRACKER — app.js
   Full application logic with LocalStorage
   ============================================= */

'use strict';

let socket = null;

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

  const n1 = parseInt(leftVal, 10);
  const n2 = parseInt(rightVal, 10);

  const getDotsHTML = (n, cx, cy) => {
    let pts = [];
    if (n === 1) {
      pts = [{ x: cx, y: cy }];
    } else if (n === 2) {
      pts = [{ x: cx - 10, y: cy - 10 }, { x: cx + 10, y: cy + 10 }];
    } else if (n === 3) {
      pts = [{ x: cx - 10, y: cy - 10 }, { x: cx, y: cy }, { x: cx + 10, y: cy + 10 }];
    } else if (n === 4) {
      pts = [
        { x: cx - 10, y: cy - 10 }, { x: cx + 10, y: cy - 10 },
        { x: cx - 10, y: cy + 10 }, { x: cx + 10, y: cy + 10 }
      ];
    } else if (n === 5) {
      pts = [
        { x: cx - 10, y: cy - 10 }, { x: cx + 10, y: cy - 10 },
        { x: cx, y: cy },
        { x: cx - 10, y: cy + 10 }, { x: cx + 10, y: cy + 10 }
      ];
    } else if (n === 6) {
      pts = [
        { x: cx - 10, y: cy - 10 }, { x: cx, y: cy - 10 }, { x: cx + 10, y: cy - 10 },
        { x: cx - 10, y: cy + 10 }, { x: cx, y: cy + 10 }, { x: cx + 10, y: cy + 10 }
      ];
    }
    return pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="6" fill="${color}" />`).join('');
  };

  const dotsHTML1 = getDotsHTML(n1, 20, 20);
  const dotsHTML2 = getDotsHTML(n2, 60, 20);

  return `
    <svg viewBox="0 0 80 40" width="${size * 2}" height="${size}" style="display: inline-block; vertical-align: middle; filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.45));">
      <rect x="1.5" y="1.5" width="77" height="37" rx="4" fill="#FFFFFF" stroke="#1A1C1E" stroke-width="2.5" />
      <line x1="40" y1="2.5" x2="40" y2="37.5" stroke="${color}" stroke-width="2.5" />
      ${dotsHTML1}
      ${dotsHTML2}
    </svg>
  `;
}

function getPixelDominoVerticalSVG(balakVal, color = '#FF5252', size = 16) {
  let topVal = '1';
  let bottomVal = '1';

  if (balakVal && balakVal.includes('/')) {
    const parts = balakVal.split('/');
    topVal = parts[0];
    bottomVal = parts[1];
  }

  const n1 = parseInt(topVal, 10);
  const n2 = parseInt(bottomVal, 10);

  const getDotsHTML = (n, cx, cy) => {
    let pts = [];
    if (n === 1) {
      pts = [{ x: cx, y: cy }];
    } else if (n === 2) {
      pts = [{ x: cx - 10, y: cy - 10 }, { x: cx + 10, y: cy + 10 }];
    } else if (n === 3) {
      pts = [{ x: cx - 10, y: cy - 10 }, { x: cx, y: cy }, { x: cx + 10, y: cy + 10 }];
    } else if (n === 4) {
      pts = [
        { x: cx - 10, y: cy - 10 }, { x: cx + 10, y: cy - 10 },
        { x: cx - 10, y: cy + 10 }, { x: cx + 10, y: cy + 10 }
      ];
    } else if (n === 5) {
      pts = [
        { x: cx - 10, y: cy - 10 }, { x: cx + 10, y: cy - 10 },
        { x: cx, y: cy },
        { x: cx - 10, y: cy + 10 }, { x: cx + 10, y: cy + 10 }
      ];
    } else if (n === 6) {
      pts = [
        { x: cx - 10, y: cy - 10 }, { x: cx - 10, y: cy }, { x: cx - 10, y: cy + 10 },
        { x: cx + 10, y: cy - 10 }, { x: cx + 10, y: cy }, { x: cx + 10, y: cy + 10 }
      ];
    }
    return pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="6" fill="${color}" />`).join('');
  };

  const dotsHTML1 = getDotsHTML(n1, 20, 20);
  const dotsHTML2 = getDotsHTML(n2, 20, 60);

  return `
    <svg viewBox="0 0 40 80" width="${size}" height="${size * 2}" style="display: inline-block; vertical-align: middle; filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.45));">
      <rect x="1.5" y="1.5" width="37" height="77" rx="4" fill="#FFFFFF" stroke="#1A1C1E" stroke-width="2.5" />
      <line x1="2.5" y1="40" x2="37.5" y2="40" stroke="${color}" stroke-width="2.5" />
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

function isPlayerOnFire(playerIdx) {
  const g = state.currentGame;
  if (!g || !g.rounds || g.rounds.length === 0) return false;

  let onFire = false;
  for (let r = 0; r < g.rounds.length; r++) {
    const roundScore = g.rounds[r].scores[playerIdx];
    if (roundScore === -30) {
      onFire = true;
    } else if (onFire && roundScore > 0) {
      onFire = false;
    }
  }
  return onFire;
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

  let badgeClass = 'player-badge-md';
  let svgSize = 32;

  if (size === 'sm') {
    badgeClass = 'player-badge-sm';
    svgSize = 24;
  } else if (size === 'lg') {
    badgeClass = 'player-badge-lg';
    svgSize = 42;
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
    <span class="player-badge ${badgeClass}" style="background-color: ${color}; color: ${textColor};">
      <span class="player-avatar">${avatarSVG}</span>
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

  const customNameInput = document.getElementById('custom-player-name');
  if (customNameInput) {
    customNameInput.addEventListener('input', updateCustomizerPreview);
  }

  // Real-time socket check
  if (typeof io !== 'undefined') {
    socket = io();
    setupSocketListeners();
  }

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
  updateMuteIcon();

  // Restore active page on refresh
  try {
    const savedPage = localStorage.getItem('gaple_activePage') || 'home';
    if (savedPage === 'dashboard' && state.currentGame && state.currentGame.status === 'active') {
      resumeGame();
    } else if (savedPage === 'gameover' && state.currentGame) {
      renderGameOver();
      showPage('gameover');
    } else if (savedPage === 'history') {
      showHistory();
    } else if (savedPage === 'stats') {
      showStatsPage();
    } else if (savedPage === 'setup') {
      showPage('setup');
    } else {
      showPage('home');
    }
  } catch (e) {
    showPage('home');
  }
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
  if (pageId === 'home') {
    renderHomePage();
  }
  
  // Track page to persist on refresh
  try {
    localStorage.setItem('gaple_activePage', pageId);
  } catch (e) {
    console.warn('LocalStorage write failed:', e);
  }
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
        aria-label="Nama Pemain ${i + 1}"
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

  // Check for duplicate names
  const uniqueNames = new Set();
  for (let i = 0; i < setupPlayerCount; i++) {
    const val = document.getElementById(`player-name-${i}`).value.trim();
    const name = val || `Pemain ${i + 1}`;
    if (uniqueNames.has(name.toLowerCase())) {
      showToast('Nama pemain tidak boleh sama!');
      document.getElementById(`player-name-${i}`).focus();
      return;
    }
    uniqueNames.add(name.toLowerCase());
  }

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
    startBalakEl.innerHTML = `${getPixelDominoSVG(g.startBalak || '0/0', '#FF5252', 22)} Mulai: ${g.startBalak || '0/0'}`;
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

function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    const onFire = isPlayerOnFire(p.idx);
    item.className = `lb-item${onFire ? ' fire-border' : ''}`;
    item.style.animationDelay = `${rank * 0.05}s`;

    // Dynamic background and border color based on player custom color
    const playerColor = p.color || '#FF5252';
    const bgVal = `linear-gradient(135deg, ${hexToRgba(playerColor, 0.22)} 0%, ${hexToRgba(playerColor, 0.08)} 100%)`;
    const borderVal = hexToRgba(playerColor, 0.45);
    const shadowVal = `0 8px 24px ${hexToRgba(playerColor, 0.2)}`;

    item.style.setProperty('background', bgVal, 'important');
    item.style.setProperty('border-color', borderVal, 'important');
    item.style.setProperty('box-shadow', shadowVal, 'important');

    // Logika Bar Darah: Mulai dari 100% saat skor 0, berkurang ke 0% saat skor 100
    const barPct = Math.max(0, Math.min(100, 100 - p.total));

    // Tentukan warna progress bar berdasarkan tingkat bahaya (skor mendekati 100 / darah menipis)
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
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6; display: inline-block; vertical-align: middle;">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
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
          aria-label="Skor Ronde ${p.name}"
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
    card.style.animationDelay = `${Math.min(revIdx, 5) * 0.05}s`;

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
          <span class="round-score-val ${cls}">${score >= 0 ? '+' : ''}${score}</span>
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
    finalizeSaveRound(scores);
  }
}

function finalizeSaveRound(scores) {
  const g = state.currentGame;
  if (!g) return;

  // Recalculate totals from scratch
  recalcTotals();
  saveState();
  renderDashboard();

  if (scores) {
    triggerAppreciationIfNeeded(scores);
  }

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
    finalizeEditRound(scores);
  }
}

function finalizeEditRound(scores) {
  recalcTotals();
  saveState();
  closeModal('modal-edit');
  renderDashboard();
  if (scores) {
    triggerAppreciationIfNeeded(scores);
  }
  showToast('Ronde diperbarui ✓');
}

// ─────────────────────────────────────────────
// NEW GAME
// ─────────────────────────────────────────────
function startNewGame() {
  if (state.mode === 'online') {
    if (socket) socket.emit('rematch');
    return;
  }
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
  state.historyMode = state.historyMode || 'local';
  
  const toggle = document.getElementById('history-mode-selector');
  const btnLocal = document.getElementById('btn-history-local');
  const btnOnline = document.getElementById('btn-history-online');
  
  if (socket) {
    if (toggle) toggle.classList.remove('hidden');
    if (btnLocal && btnOnline) {
      if (state.historyMode === 'local') {
        btnLocal.className = 'btn btn-sm btn-primary';
        btnOnline.className = 'btn btn-sm btn-outline';
      } else {
        btnLocal.className = 'btn btn-sm btn-outline';
        btnOnline.className = 'btn btn-sm btn-primary';
      }
    }
  } else {
    state.historyMode = 'local';
    if (toggle) toggle.classList.add('hidden');
  }

  if (state.historyMode === 'local') {
    state.viewingHistoryList = state.allGames;
    renderHistoryList(state.allGames);
  } else {
    const container = document.getElementById('history-list-container');
    if (container) {
      container.innerHTML = '<div class="no-history" style="text-align: center; padding: 2rem;">Memuat riwayat online...</div>';
    }
    if (socket) {
      socket.emit('getOnlineHistory', (history) => {
        state.viewingHistoryList = history;
        renderHistoryList(history);
      });
    }
  }
}

function switchHistoryMode(mode) {
  state.historyMode = mode;
  renderHistoryListPage();
}

function renderHistoryList(gamesArray) {
  const container = document.getElementById('history-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (!gamesArray || gamesArray.length === 0) {
    container.innerHTML = `
      <div class="no-history-games">
        <span class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
        </span>
        <p>Belum ada permainan selesai.</p>
      </div>
    `;
    return;
  }

  gamesArray.forEach(game => {
    const sorted = [...game.players].sort((a, b) => a.total - b.total);
    const winner = sorted[0];
    const date = new Date(game.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const card = document.createElement('div');
    card.className = 'history-game-card';
    card.style.cursor = 'pointer';
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
    card.onclick = () => showHistoryDetail(game.id);
    container.appendChild(card);
  });
}

function showHistoryDetail(gameId) {
  const gamesList = state.viewingHistoryList || state.allGames;
  const game = gamesList.find(g => g.id === gameId) || state.allGames.find(g => g.id === gameId);
  if (!game) return;

  state.viewingHistoryGame = game;

  document.getElementById('history-detail-title').textContent = game.name;
  
  const dateStr = new Date(game.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  document.getElementById('history-detail-date').textContent = dateStr;

  // Build Leaderboard
  const sorted = [...game.players].sort((a, b) => a.total - b.total);
  const maxScore = Math.max(...game.players.map(p => p.total), 1);
  const lbContainer = document.getElementById('history-detail-leaderboard');
  lbContainer.innerHTML = '';

  sorted.forEach((p, rank) => {
    const item = document.createElement('div');
    item.className = 'lb-item';
    
    // Rank pastel bg decoration
    if (rank === 0) item.style.background = 'var(--rank-1-bg)';
    else if (rank === 1) item.style.background = 'var(--rank-2-bg)';
    else if (rank === 2) item.style.background = 'var(--rank-3-bg)';

    // Logika Bar Darah: Mulai dari 100% saat skor 0, berkurang ke 0% saat skor 100
    const barPct = Math.max(0, Math.min(100, 100 - p.total));
    let barColorClass = 'bar-success';
    if (p.total >= 80) {
      barColorClass = 'bar-danger';
    } else if (p.total >= 50) {
      barColorClass = 'bar-warning';
    }

    item.innerHTML = `
      <div class="lb-rank lb-rank-${rank + 1}">${rank + 1}</div>
      <div class="lb-item-inner">
        <div class="lb-name">
          ${renderPlayerBadgeHTML(p)}
        </div>
        <div class="lb-bar-wrap">
          <div class="lb-bar ${barColorClass}" style="width: ${Math.min(barPct, 100)}%"></div>
        </div>
      </div>
      <div class="lb-score">${p.total}</div>
    `;
    lbContainer.appendChild(item);
  });

  // Build Rounds Score List
  const roundsContainer = document.getElementById('history-detail-rounds');
  roundsContainer.innerHTML = '';

  if (!game.rounds || game.rounds.length === 0) {
    roundsContainer.innerHTML = `<div class="no-history" style="padding: 1.5rem 1rem;">Belum ada ronde.</div>`;
  } else {
    const rounds = [...game.rounds].reverse();
    rounds.forEach((round, revIdx) => {
      const realIdx = game.rounds.length - 1 - revIdx;
      const rCard = document.createElement('div');
      rCard.className = 'round-card';
      
      const scoresHtml = game.players.map((p, i) => {
        const score = round.scores[i];
        const cls = score < 0 ? 'negative' : '';
        return `
          <div class="round-score-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;">
            <span class="round-score-name">${renderPlayerBadgeHTML(p, 'sm')}</span>
            <span class="round-score-val ${cls}">${score >= 0 ? '+' : ''}${score}</span>
          </div>
        `;
      }).join('');

      const gapleText = round.gapleCard ? ` <span class="gaple-history-badge" style="color: var(--primary); font-weight: bold; border: 1.5px solid var(--primary); padding: 1px 4px; font-size: 0.55rem; margin-left: 5px; text-transform: uppercase;">Gaple ${round.gapleCard}</span>` : '';
      rCard.innerHTML = `
        <div class="round-card-header" style="background: #F1F5F9; padding: 0.6rem 1rem; border-bottom: var(--border-width) solid var(--border-color);">
          <span class="round-card-title">Ronde ${realIdx + 1}${gapleText}</span>
        </div>
        <div class="round-card-body" style="padding: 0.6rem 1rem; display: flex; flex-direction: column; gap: 0.4rem;">${scoresHtml}</div>
      `;
      roundsContainer.appendChild(rCard);
    });
  }

  openModal('modal-history-detail');
}

function shareHistoryGame() {
  const g = state.viewingHistoryGame;
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

  if (navigator.share) {
    navigator.share({
      title: `Hasil Game Gaple: ${g.name}`,
      text: text
    })
    .then(() => showToast('Hasil dibagikan ✓'))
    .catch(() => {
      navigator.clipboard.writeText(text);
      showToast('Hasil disalin ke clipboard ✓');
    });
  } else {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('Hasil disalin ke clipboard ✓'))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }
}

function showPreviousGameStats(mode) {
  if (mode === 'online') {
    if (socket) {
      socket.emit('getOnlineHistory', (history) => {
        const completed = (history || []).filter(g => g.status === 'done');
        if (completed && completed.length > 0) {
          state.viewingHistoryList = history;
          showHistoryDetail(completed[0].id);
        } else {
          showToast('Belum ada permainan online sebelumnya 🎮');
        }
      });
    } else {
      showToast('Koneksi terputus.');
    }
  } else {
    // local mode
    const completed = (state.allGames || []).filter(g => g.status === 'done');
    if (completed && completed.length > 0) {
      state.viewingHistoryList = state.allGames;
      showHistoryDetail(completed[0].id);
    } else {
      showToast('Belum ada permainan lokal sebelumnya 🎮');
    }
  }
}

function executeResetAllData() {
  const keysToRemove = [
    'gaple_currentGame',
    'gaple_allGames',
    'gaple_setupPlayerData',
    'gaple_lastPlayerNames',
    'gaple_lastPlayerCount',
    'gaple_activePage',
    'gaple_muted'
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));

  state.currentGame = null;
  state.allGames = [];

  closeModal('modal-confirm-reset');
  showToast('Semua data berhasil direset! 🧹');

  showPage('home');
  setTimeout(() => {
    window.location.reload();
  }, 1000);
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
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast hidden';
    document.body.appendChild(el);
  }
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
    finalizeEditRound(scores);
  } else {
    finalizeSaveRound(scores);
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

function updateCustomizerPreview() {
  const nameInput = document.getElementById('custom-player-name');
  const avatarInput = document.getElementById('custom-player-avatar');
  const colorInput = document.getElementById('custom-player-color');

  const name = nameInput ? nameInput.value.trim() || 'Pemain' : 'Pemain';
  const avatar = avatarInput ? avatarInput.value : 'fox';
  const color = colorInput ? colorInput.value : '#FF5252';

  const mockPlayer = {
    name: name,
    avatar: avatar,
    color: color
  };

  const wrap = document.getElementById('custom-player-preview-badge-wrap');
  if (wrap) {
    wrap.innerHTML = renderPlayerBadgeHTML(mockPlayer, 'lg');
  }
}

function getUsedColorsByOthers(mode, currentIdx) {
  const usedColors = [];
  if (mode === 'setup') {
    const count = typeof setupPlayerCount !== 'undefined' ? setupPlayerCount : 4;
    for (let i = 0; i < count; i++) {
      if (i === currentIdx) continue;
      const data = setupPlayerData[i];
      if (data && data.color) {
        usedColors.push(data.color.toUpperCase());
      }
    }
  } else {
    const g = state.currentGame;
    if (g && g.players) {
      g.players.forEach((p, i) => {
        if (i === currentIdx) return;
        if (p.color) {
          usedColors.push(p.color.toUpperCase());
        }
      });
    }
  }
  return usedColors;
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

  // Update color options availability for other players
  const usedColors = getUsedColorsByOthers(mode, idx);
  document.querySelectorAll('.color-opt').forEach(btn => {
    const btnId = btn.id || '';
    const colorHex = '#' + btnId.replace('color-opt-', '');
    if (usedColors.includes(colorHex.toUpperCase())) {
      btn.style.opacity = '0.15';
      btn.style.cursor = 'not-allowed';
      btn.style.pointerEvents = 'none';
      btn.title = 'Sudah digunakan oleh pemain lain';
    } else {
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
      btn.title = '';
    }
  });

  selectCustomAvatar(avatar);
  selectCustomColor(color);
  updateCustomizerPreview();

  openModal('modal-customize-player');

  setTimeout(() => {
    const nameInput = document.getElementById('custom-player-name');
    if (nameInput) {
      nameInput.focus();
      try { nameInput.select(); } catch (e) { }
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
    btn.style.animation = 'none'; // reset animation
  });

  document.querySelectorAll('.avatar-opt').forEach(btn => {
    if (btn.getAttribute('data-avatar') === avatarKey) {
      btn.classList.add('active');
    }
  });

  updateCustomizerPreview();

  // Play jump animation on the preview avatar
  const previewAvatar = document.querySelector('#custom-player-preview-badge-wrap .player-avatar svg');
  if (previewAvatar) {
    previewAvatar.style.animation = 'none';
    previewAvatar.offsetHeight; // trigger reflow
    previewAvatar.style.animation = 'pixelAvatarJump 0.4s steps(4) 1';
  }
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

  updateCustomizerPreview();

  // Play flash animation on preview badge
  const previewBadge = document.querySelector('#custom-player-preview-badge-wrap .player-badge');
  if (previewBadge) {
    previewBadge.style.animation = 'none';
    previewBadge.offsetHeight; // trigger reflow
    previewBadge.style.animation = 'pixelFlash 0.3s steps(2) 1';
  }
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

  // Check for duplicate names
  let isDuplicate = false;
  if (mode === 'setup') {
    for (let i = 0; i < setupPlayerCount; i++) {
      if (i === idx) continue;
      const val = document.getElementById(`player-name-${i}`).value.trim() || `Pemain ${i + 1}`;
      if (val.toLowerCase() === newName.toLowerCase()) {
        isDuplicate = true;
        break;
      }
    }
  } else {
    const g = state.currentGame;
    if (g && g.players) {
      isDuplicate = g.players.some((p, i) => i !== idx && p.name.toLowerCase() === newName.toLowerCase());
    }
  }
  if (isDuplicate) {
    showToast('Nama pemain sudah digunakan!');
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
  if (typeof updateOnlineProfilePreview === 'function') {
    updateOnlineProfilePreview();
  }
}

// Keep for backward compatibility with leaderboard click
function openRenamePlayerModal(playerIdx) {
  openDashboardCustomizeModal(playerIdx);
}


function startLocalSetup() {
  // Restore setup inputs
  const countDisplay = document.getElementById('player-count-display');
  if (countDisplay) {
    setupPlayerCount = parseInt(localStorage.getItem('gaple_lastPlayerCount') || '4', 10);
    countDisplay.textContent = setupPlayerCount;
    document.getElementById('count-minus').disabled = setupPlayerCount <= 2;
    document.getElementById('count-plus').disabled = setupPlayerCount >= 6;
  }
  document.getElementById('game-name').value = '';
  document.getElementById('btn-mulai').textContent = "Mulai Permainan";

  renderSetupPlayerInputs();
  showPage('setup');
}

// ─────────────────────────────────────────────
// APPRECIATION CELEBRATION FUNCTIONS
// ─────────────────────────────────────────────
function triggerAppreciationIfNeeded(scores) {
  const g = state.currentGame;
  if (!g) return;

  const celebratedPlayers = [];
  scores.forEach((score, idx) => {
    if (score === -25 || score === -30) {
      celebratedPlayers.push({
        player: g.players[idx],
        score: score
      });
    }
  });

  if (celebratedPlayers.length === 0) return;

  celebratedPlayers.forEach((item, index) => {
    setTimeout(() => {
      showAppreciationOverlay(item.player, item.score);
    }, index * 4500);
  });
}

function showAppreciationOverlay(player, score) {
  const existing = document.getElementById('appreciation-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'appreciation-overlay';
  overlay.className = 'appreciation-overlay';

  const playerNameHtml = renderPlayerBadgeHTML(player, 'lg');

  let message = 'TANGGUH SEKALI! 🏆';
  if (score === -30) {
    message = 'DUNG TAK DUNG DUNG WAWWWW! 🥁🔥';
  } else if (score === -25) {
    message = 'GACORRRR KINGGGG GAPLE! 👑⚡';
  }

  overlay.innerHTML = `
    <div class="appreciation-sunburst"></div>
    <div class="appreciation-container">
      <h2 class="appreciation-title">HEBAT!</h2>
      <p class="appreciation-subtitle">${message}</p>
      
      <div class="appreciation-card">
        <div class="appreciation-player-showcase">
          ${playerNameHtml}
        </div>
        <div class="appreciation-score-badge">${score} POIN</div>
        <div class="appreciation-sparkles" id="appreciation-sparkles-container"></div>
      </div>
      
      <button class="btn btn-primary btn-lg" style="min-width: 160px;" onclick="dismissAppreciationOverlay()">
        LANJUT 🚀
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const sparklesContainer = overlay.querySelector('#appreciation-sparkles-container');
  if (sparklesContainer) {
    for (let i = 0; i < 35; i++) {
      createSparkle(sparklesContainer);
    }
  }

  const showcaseBadge = overlay.querySelector('.appreciation-player-showcase .player-badge');
  if (showcaseBadge) {
    showcaseBadge.style.animation = 'pixelAvatarJump 0.5s steps(4) infinite alternate';
  }

  const autoDismissTimer = setTimeout(() => {
    dismissAppreciationOverlay();
  }, 4000);

  window.dismissAppreciationOverlay = () => {
    clearTimeout(autoDismissTimer);
    overlay.style.transition = 'opacity 0.2s ease-out';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
    }, 200);
  };
}

function createSparkle(container) {
  const sparkle = document.createElement('div');
  sparkle.className = 'sparkle';

  const x = Math.random() * 100;
  const y = Math.random() * 100;
  sparkle.style.left = `${x}%`;
  sparkle.style.top = `${y}%`;

  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * 150 + 50;
  const dx = (Math.cos(angle) * distance) + 'px';
  const dy = (Math.sin(angle) * distance) + 'px';
  sparkle.style.setProperty('--dx', dx);
  sparkle.style.setProperty('--dy', dy);

  const scale = Math.random() * 0.8 + 0.4;
  sparkle.style.transform = `scale(${scale})`;
  sparkle.style.animationDelay = `${Math.random() * 1.5}s`;

  const colors = ['#FFD740', '#00E5FF', '#69F0AE', '#FF5252', '#E040FB'];
  sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
  sparkle.style.boxShadow = `0 0 6px ${sparkle.style.background}`;

  container.appendChild(sparkle);
}

// ─────────────────────────────────────────────
// MULTIPLAYER ONLINE GAME ENGINE - CLIENT SIDE
// ─────────────────────────────────────────────

function setupSocketListeners() {
  if (!socket) return;

  socket.on('roomJoined', ({ room, myId }) => {
    state.mode = 'online';
    if (myId) {
      state.myId = myId;
    }
    state.onlineRoom = room;
    renderOnlineLobby();
    showPage('online-lobby');
  });

  socket.on('gameStateUpdate', (game) => {
    state.mode = 'online';
    
    // Check transitions for sound play before updating the state
    if (state.onlineRoom && state.onlineRoom.game) {
      const oldGame = state.onlineRoom.game;
      
      // 1. Board length increased => card play
      if (game.board.length > oldGame.board.length) {
        playRetroSound('click');
      } 
      // 2. Pass count increased => pass sound
      else if (game.passCount > oldGame.passCount) {
        playRetroSound('pass');
      }
      
      // 3. New round start detection
      if (game.roundsCount > oldGame.roundsCount) {
        playRetroSound('roundStart');
      }
      
      // 4. Turn alert for local player
      const activePlayer = game.players[game.currentTurnIdx];
      const oldActivePlayer = oldGame.players[oldGame.currentTurnIdx];
      if (activePlayer && activePlayer.id === state.myId && (!oldActivePlayer || oldActivePlayer.id !== state.myId)) {
        playRetroSound('turn');
      }
    } else {
      // First game state update on round start
      playRetroSound('roundStart');
    }

    state.onlineRoom.game = game;
    // Sync local lobby state if lobby was bypassed
    state.onlineRoom.players = game.players;
    renderOnlineDashboard();
  });

  socket.on('roundEnded', ({ roundLog, players, nextRoundNum }) => {
    state.mode = 'online';

    // Play sound based on round outcome
    const myPlayer = players.find(p => p.id === state.myId);
    const myName = myPlayer ? myPlayer.name : '';
    if (roundLog.type === 'gacor' || roundLog.type === 'dung_tak') {
      playRetroSound('special');
    } else if (roundLog.winnerName === myName) {
      playRetroSound('win');
    } else {
      playRetroSound('lose');
    }

    state.onlineRoom.players = players;
    state.onlineRoom.game.players = players;
    state.onlineRoom.game.status = 'roundEnded';
    showRoundEndModal(roundLog);
  });

  socket.on('gameOver', ({ players, rounds, leaderboard }) => {
    state.mode = 'online';
    state.onlineRoom.players = players;
    state.onlineRoom.game.status = 'ended';
    renderOnlineGameOver(players, rounds, leaderboard);
  });

  socket.on('playerDisconnected', ({ socketId }) => {
    if (state.onlineRoom && state.onlineRoom.players) {
      const p = state.onlineRoom.players.find(pl => pl.id === socketId);
      if (p) {
        showToast(`Pemain ${p.name} terputus dari permainan! 🛜`);
      }
    }
  });

  socket.on('errorMsg', (msg) => {
    showToast(msg);
  });
}

function showOnlineSetup() {
  state.mode = 'online';
  updateOnlineProfilePreview();
  const joinInput = document.getElementById('online-join-code');
  if (joinInput) joinInput.value = '';
  showPage('online-setup');
}

function updateOnlineProfilePreview() {
  const custom = setupPlayerData[0] || { avatar: getPlayerDefaultAvatar(0), color: getPlayerDefaultColor(0) };
  const savedNames = JSON.parse(localStorage.getItem('gaple_lastPlayerNames') || '[]');
  const name = savedNames[0] || 'Pemain 1';
  const mockPlayer = { name, avatar: custom.avatar, color: custom.color };
  const wrap = document.getElementById('online-profile-preview');
  if (wrap) {
    wrap.innerHTML = renderPlayerBadgeHTML(mockPlayer, 'lg');
  }
}

function createRoomOnline() {
  const custom = setupPlayerData[0] || { avatar: getPlayerDefaultAvatar(0), color: getPlayerDefaultColor(0) };
  const savedNames = JSON.parse(localStorage.getItem('gaple_lastPlayerNames') || '[]');
  const name = savedNames[0] || 'Pemain 1';

  if (socket) {
    socket.emit('createRoom', { name, avatar: custom.avatar, color: custom.color });
  } else {
    showToast('Koneksi server terputus.');
  }
}

function joinRoomOnline() {
  const codeEl = document.getElementById('online-join-code');
  const code = codeEl ? codeEl.value.trim().toUpperCase() : '';
  if (!code) {
    showToast('Masukkan kode ruangan!');
    return;
  }

  const custom = setupPlayerData[0] || { avatar: getPlayerDefaultAvatar(0), color: getPlayerDefaultColor(0) };
  const savedNames = JSON.parse(localStorage.getItem('gaple_lastPlayerNames') || '[]');
  const name = savedNames[0] || 'Pemain 1';

  if (socket) {
    socket.emit('joinRoom', { roomId: code, name, avatar: custom.avatar, color: custom.color });
  } else {
    showToast('Koneksi server terputus.');
  }
}

function exitRoomOnline() {
  if (socket) {
    socket.disconnect();
  }
  window.location.reload();
}

function copyLobbyCode() {
  const code = document.getElementById('lobby-code-display').textContent;
  if (!code || code === '------') return;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code)
      .then(() => showToast('Kode disalin ✓'))
      .catch(() => showToast('Gagal menyalin otomatis'));
  }
}

function setLobbyStartingBalak(val) {
  const input = document.getElementById('lobby-start-balak');
  if (input) input.value = val;

  document.querySelectorAll('.lobby-balak-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const activeBtn = document.getElementById(`lobby-balak-btn-${val.replace('/', '-')}`);
  if (activeBtn) activeBtn.classList.add('active');
}

function startOnlineMatch() {
  const startBalak = document.getElementById('lobby-start-balak').value || '0/0';
  if (socket) {
    socket.emit('startGame', { startBalak });
  }
}

function renderOnlineLobby() {
  const room = state.onlineRoom;
  if (!room) return;

  document.getElementById('lobby-code-display').textContent = room.id;

  const list = document.getElementById('lobby-players-list');
  list.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    const p = room.players[i];
    const row = document.createElement('div');
    if (p) {
      row.className = 'lobby-player-row';
      const isHost = p.id === room.hostId;
      const hostTag = isHost ? `<span class="dealer-badge" style="background: var(--accent-gold); color: #1A1C1E; font-size: 0.65rem; border: 1.5px solid #1A1C1E; box-shadow: 1px 1px 0px #000; padding: 2px 4px; font-weight: bold; text-transform: uppercase;">👑 HOST</span>` : '';
      row.innerHTML = `
        <span>${renderPlayerBadgeHTML(p, 'sm')}</span>
        ${hostTag}
      `;
    } else {
      row.className = 'lobby-player-row empty-slot';
      row.textContent = 'Menunggu Pemain...';
    }
    list.appendChild(row);
  }

  // Toggle host vs guest dashboard components
  const isMyHost = state.myId === room.hostId;
  if (isMyHost) {
    document.getElementById('lobby-host-controls').classList.remove('hidden');
    document.getElementById('lobby-guest-message').classList.add('hidden');
  } else {
    document.getElementById('lobby-host-controls').classList.add('hidden');
    document.getElementById('lobby-guest-message').classList.remove('hidden');
  }
}

function renderOnlineDashboard() {
  const room = state.onlineRoom;
  const game = room.game;
  if (!room || !game) return;

  // Header meta synchronization
  document.getElementById('dashboard-header-local').classList.add('hidden');
  const onlineHeader = document.getElementById('dashboard-header-online');
  onlineHeader.classList.remove('hidden');
  onlineHeader.style.display = 'flex';

  document.getElementById('dash-room-id').textContent = room.id;
  document.getElementById('dash-round-num').textContent = game.roundsCount + 1;
  document.getElementById('dash-balak-val').textContent = game.startingBalak || '0/0';

  // Swap scorecard input to multiplayer visual game board
  document.getElementById('score-input-section').classList.add('hidden');
  document.getElementById('game-board-section').classList.remove('hidden');

  const activePlayer = game.players[game.currentTurnIdx];
  const activePlayerId = activePlayer ? activePlayer.id : null;

  // Populate scoreboard overlay (Top-Left)
  const scoresEl = document.getElementById('online-board-scores');
  if (scoresEl) {
    scoresEl.innerHTML = room.players.map(p => {
      const isActive = p.id === activePlayerId;
      const badgeColor = p.color || '#FF5252';
      return `
        <div class="scoreboard-score-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: bold; ${isActive ? 'color: var(--accent-gold);' : ''}">
          <span style="display: inline-flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; background: ${badgeColor}; display: inline-block; border: 1.5px solid #FFF;"></span>
            ${p.name.substring(0, 10)}
          </span>
          <span>${p.total}</span>
        </div>
      `;
    }).join('');
  }

  // Seating rotation to always keep the local player at the bottom
  const myIdx = room.players.findIndex(p => p.id === state.myId) !== -1 
    ? room.players.findIndex(p => p.id === state.myId) 
    : 0;

  const bottomPlayer = room.players[myIdx];
  const leftPlayer = room.players[(myIdx + 1) % 4];
  const topPlayer = room.players[(myIdx + 2) % 4];
  const rightPlayer = room.players[(myIdx + 3) % 4];

  // Render Bottom Player Slot (arya / Local)
  const isBottomActive = bottomPlayer.id === activePlayerId;
  const bottomEl = document.getElementById('online-player-bottom');
  if (bottomEl) {
    bottomEl.innerHTML = `
      ${isBottomActive ? '<div style="font-family: var(--font-title); font-size: 0.5rem; color: var(--accent-gold); margin-bottom: 2px; text-shadow: 1px 1px 0px #000; animation: retroFloat 1.2s ease-in-out infinite;">👉 GILIRAN KAMU</div>' : ''}
      <div class="player-slot-badge-wrap" style="display: flex; align-items: center; gap: 6px;">
        <div class="${isBottomActive ? 'active-player-outline' : ''}" style="display: inline-block;">
          ${renderPlayerBadgeHTML(bottomPlayer, 'sm')}
        </div>
        <div class="card-counter-indicator" title="Jumlah Kartu">
          <span style="width: 6px; height: 10px; background: #8D6E63; display: inline-block; border: 1px solid #FFF; box-shadow: 0.5px 0.5px 0px #000; transform: rotate(-5deg);"></span>
          <span>${game.hands[bottomPlayer.id] ? game.hands[bottomPlayer.id].count : 0}</span>
        </div>
      </div>
    `;
  }

  // Render Left Player Slot
  const isLeftActive = leftPlayer.id === activePlayerId;
  const leftEl = document.getElementById('online-player-left');
  if (leftEl) {
    leftEl.innerHTML = `
      <div class="player-slot-badge-wrap" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <div class="${isLeftActive ? 'active-player-outline' : ''}" style="display: inline-block;">
          ${renderPlayerBadgeHTML(leftPlayer, 'sm')}
        </div>
        <div class="card-counter-indicator" title="Jumlah Kartu">
          <span style="width: 6px; height: 10px; background: #8D6E63; display: inline-block; border: 1px solid #FFF; box-shadow: 0.5px 0.5px 0px #000; transform: rotate(-5deg);"></span>
          <span>${game.hands[leftPlayer.id] ? game.hands[leftPlayer.id].count : 0}</span>
        </div>
        ${isLeftActive ? '<div style="font-family: var(--font-title); font-size: 0.45rem; color: var(--accent-gold); text-shadow: 1px 1px 0px #000;">GILIRAN</div>' : ''}
      </div>
    `;
  }

  // Render Top Player Slot
  const isTopActive = topPlayer.id === activePlayerId;
  const topEl = document.getElementById('online-player-top');
  if (topEl) {
    topEl.innerHTML = `
      <div class="player-slot-badge-wrap" style="display: flex; align-items: center; gap: 6px;">
        <div class="${isTopActive ? 'active-player-outline' : ''}" style="display: inline-block;">
          ${renderPlayerBadgeHTML(topPlayer, 'sm')}
        </div>
        <div class="card-counter-indicator" title="Jumlah Kartu">
          <span style="width: 6px; height: 10px; background: #8D6E63; display: inline-block; border: 1px solid #FFF; box-shadow: 0.5px 0.5px 0px #000; transform: rotate(-5deg);"></span>
          <span>${game.hands[topPlayer.id] ? game.hands[topPlayer.id].count : 0}</span>
        </div>
      </div>
      ${isTopActive ? '<div style="font-family: var(--font-title); font-size: 0.45rem; color: var(--accent-gold); text-shadow: 1px 1px 0px #000; margin-top: 2px;">GILIRAN</div>' : ''}
    `;
  }

  // Render Right Player Slot
  const isRightActive = rightPlayer.id === activePlayerId;
  const rightEl = document.getElementById('online-player-right');
  if (rightEl) {
    rightEl.innerHTML = `
      <div class="player-slot-badge-wrap" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <div class="${isRightActive ? 'active-player-outline' : ''}" style="display: inline-block;">
          ${renderPlayerBadgeHTML(rightPlayer, 'sm')}
        </div>
        <div class="card-counter-indicator" title="Jumlah Kartu">
          <span style="width: 6px; height: 10px; background: #8D6E63; display: inline-block; border: 1px solid #FFF; box-shadow: 0.5px 0.5px 0px #000; transform: rotate(-5deg);"></span>
          <span>${game.hands[rightPlayer.id] ? game.hands[rightPlayer.id].count : 0}</span>
        </div>
        ${isRightActive ? '<div style="font-family: var(--font-title); font-size: 0.45rem; color: var(--accent-gold); text-shadow: 1px 1px 0px #000;">GILIRAN</div>' : ''}
      </div>
    `;
  }

  // Render Domino visual chain on board
  const dominoChain = document.getElementById('domino-chain');
  const emptyMsg = document.getElementById('board-empty-message');

  if (game.board.length > 0) {
    emptyMsg.classList.add('hidden');
    dominoChain.innerHTML = game.board.map(tile => {
      const [a, b] = tile.split('/').map(Number);
      if (a === b) {
        return `<div class="chain-tile balak-tile" style="margin: 0 4px; padding: 2px 0;">${getPixelDominoVerticalSVG(tile, '#FF5252', 15)}</div>`;
      } else {
        return `<div class="chain-tile normal-tile" style="margin: 0 2px;">${getPixelDominoSVG(tile, '#FF5252', 15)}</div>`;
      }
    }).join('');

    // Smooth horizontal scroll to endpoints follow-up
    setTimeout(() => {
      const wrapper = document.getElementById('domino-chain-scroll-wrapper');
      if (wrapper) {
        wrapper.scrollLeft = wrapper.scrollWidth;
      }
    }, 50);
  } else {
    emptyMsg.classList.remove('hidden');
    dominoChain.innerHTML = '';
  }

  // Render Hand tiles for local player
  const isMyTurn = activePlayerId === state.myId;
  const myHandObj = game.hands[state.myId];
  const myTiles = myHandObj ? myHandObj.tiles : [];
  renderPlayerHand(myTiles, game.leftValue, game.rightValue, isMyTurn);

  // Sync round history inside the popup overlay list
  const historyList = document.getElementById('online-round-history-list');
  if (historyList) {
    if (!game.rounds || game.rounds.length === 0) {
      historyList.innerHTML = '<div class="no-history" style="text-align: center; padding: 1.5rem 0;">Belum ada ronde.</div>';
    } else {
      historyList.innerHTML = [...game.rounds].reverse().map(round => {
        const gapleText = round.gapleCard ? ` <span class="gaple-history-badge" style="color: var(--primary); font-weight: bold; border: 1.5px solid var(--primary); padding: 1px 4px; font-size: 0.55rem; margin-left: 5px; text-transform: uppercase;">Gaple ${round.gapleCard}</span>` : '';
        const scoresHtml = round.scores.map(item => {
          const cls = item.score < 0 ? 'color: var(--primary); font-weight: bold;' : '';
          return `
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 2px;">
              <span>${item.name}</span>
              <span style="${cls}">${item.score >= 0 ? '+' : ''}${item.score}</span>
            </div>
          `;
        }).join('');
        return `
          <div style="border: 2px solid var(--border-color); background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 0.6rem 0.8rem; border-radius: 8px; margin-bottom: 0.5rem; color: var(--text-primary);">
            <div style="font-family: var(--font-title); font-size: 0.55rem; border-bottom: 1.5px solid var(--border-color); padding-bottom: 2px; margin-bottom: 4px; display: flex; justify-content: space-between;">
              <span>RONDE ${round.roundNum}</span>
              ${gapleText}
            </div>
            ${scoresHtml}
          </div>
        `;
      }).join('');
    }
  }

  // Switch page
  showPage('dashboard');
}

function renderPlayerHand(tiles, leftValue, rightValue, isMyTurn) {
  const container = document.getElementById('player-hand-tiles');
  container.innerHTML = '';

  if (!tiles || tiles.length === 0) {
    container.innerHTML = '<div style="font-family: var(--font-title); font-size: 0.55rem; color: var(--text-muted); padding: 0.5rem 0;">KARTU DI TANGAN HABIS</div>';
    return;
  }

  // Card matching check helper
  const isPlayable = (tile) => {
    if (!isMyTurn) return false;
    if (leftValue === null && rightValue === null) return true;
    const [a, b] = tile.split('/').map(Number);
    return a === leftValue || b === leftValue || a === rightValue || b === rightValue;
  };

  tiles.forEach(tile => {
    const playable = isPlayable(tile);
    const tileEl = document.createElement('div');
    tileEl.className = `hand-tile${playable ? '' : ' unplayable'}`;
    tileEl.innerHTML = getPixelDominoVerticalSVG(tile, '#FF5252', 20);

    if (playable) {
      tileEl.onclick = () => {
        // Close side selector overlay if already open
        document.getElementById('play-side-selector').classList.add('hidden');

        // Check placement options
        const [a, b] = tile.split('/').map(Number);
        const canPlayLeft = leftValue === null || a === leftValue || b === leftValue;
        const canPlayRight = rightValue === null || a === rightValue || b === rightValue;

        if (canPlayLeft && canPlayRight && leftValue !== rightValue && leftValue !== null) {
          // Player can drop this card on either left or right endpoint - show side selection helper
          state.selectedTileForPlay = tile;
          document.getElementById('side-sel-card-val').textContent = tile;
          document.getElementById('play-side-selector').classList.remove('hidden');
        } else if (canPlayLeft) {
          playCardOnline(tile, 'left');
        } else {
          playCardOnline(tile, 'right');
        }
      };
    }
    container.appendChild(tileEl);
  });

  // Handle Turn Skip (Pass) button
  const passBtn = document.getElementById('btn-pass-online');
  const hasPlayableCard = tiles.some(tile => isPlayable(tile));
  if (isMyTurn && !hasPlayableCard && leftValue !== null) {
    passBtn.classList.remove('hidden');
  } else {
    passBtn.classList.add('hidden');
  }
}

function playCardOnline(tile, side) {
  if (socket) {
    socket.emit('playCard', { tile, side });
    document.getElementById('play-side-selector').classList.add('hidden');
  }
}

function selectPlaySideOnline(side) {
  if (state.selectedTileForPlay) {
    playCardOnline(state.selectedTileForPlay, side);
    state.selectedTileForPlay = null;
  }
}

function cancelPlaySideOnline() {
  document.getElementById('play-side-selector').classList.add('hidden');
  state.selectedTileForPlay = null;
}

function passTurnOnline() {
  if (socket) {
    socket.emit('passTurn');
  }
}

function renderOnlineRoundHistory(rounds) {
  const container = document.getElementById('round-history');
  container.innerHTML = '';

  if (!rounds || rounds.length === 0) {
    container.innerHTML = `<div class="no-history">Belum ada ronde. Menunggu kartu dibuang!</div>`;
    return;
  }

  const reversed = [...rounds].reverse();
  reversed.forEach(round => {
    const card = document.createElement('div');
    card.className = 'round-card';

    const scoresHtml = round.scores.map(item => {
      const cls = item.score < 0 ? 'negative' : '';
      const mockPlayer = { name: item.name, avatar: item.avatar, color: item.color };
      return `
        <div class="round-score-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;">
          <span class="round-score-name">${renderPlayerBadgeHTML(mockPlayer, 'sm')}</span>
          <span class="round-score-val ${cls}">${item.score >= 0 ? '+' : ''}${item.score}</span>
        </div>
      `;
    }).join('');

    const gapleText = round.gapleCard ? ` <span class="gaple-history-badge" style="color: var(--primary); font-weight: bold; border: 1.5px solid var(--primary); padding: 1px 4px; font-size: 0.55rem; margin-left: 5px; text-transform: uppercase;">Gaple ${round.gapleCard}</span>` : '';

    card.innerHTML = `
      <div class="round-card-header">
        <span class="round-card-title">Ronde ${round.roundNum}${gapleText}</span>
      </div>
      <div class="round-card-body">${scoresHtml}</div>
    `;
    container.appendChild(card);
  });
}

function showRoundEndModal(roundLog) {
  const outcome = document.getElementById('round-end-outcome');
  const typeLabel = roundLog.type === 'gaple' ? 'GAPLE!' : (roundLog.type === 'gacor' ? 'GACOR! ⚡' : (roundLog.type === 'dung_tak' ? 'DUNG TAK! 🔥' : 'MENANG!'));
  
  outcome.innerHTML = `🏆 ${roundLog.winnerName} ${typeLabel}`;

  // Scoreboard populating
  const board = document.getElementById('round-end-scoreboard');
  board.innerHTML = '';

  roundLog.scores.forEach(item => {
    const mockPlayer = { name: item.name, avatar: item.avatar, color: item.color };
    const row = document.createElement('div');
    row.className = 'score-input-row';
    row.style.justifyContent = 'space-between';

    const change = item.score;
    const scoreClass = change < 0 ? 'negative' : '';
    const changeText = change >= 0 ? `+${change}` : `${change}`;

    row.innerHTML = `
      <span>${renderPlayerBadgeHTML(mockPlayer, 'sm')}</span>
      <span class="${scoreClass}" style="font-family: var(--font-title); font-size: 0.95rem; font-weight: bold;">${changeText}</span>
    `;
    board.appendChild(row);
  });

  // Enable controls based on host permissions
  const isMyHost = state.myId === state.onlineRoom.hostId;
  if (isMyHost) {
    document.getElementById('btn-next-round-online').classList.remove('hidden');
    document.getElementById('guest-wait-next-round').classList.add('hidden');
  } else {
    document.getElementById('btn-next-round-online').classList.add('hidden');
    document.getElementById('guest-wait-next-round').classList.remove('hidden');
  }

  // Trigger celebration visual effects on custom milestones
  if (roundLog.type === 'gacor') {
    showToast('GACORRRR KINGGGG! 👑⚡');
  } else if (roundLog.type === 'dung_tak') {
    showToast('DUNG TAK DUNG DUNG WAWWWW! 🥁🔥');
  }

  openModal('modal-round-end');
}

function nextRoundOnline() {
  if (socket) {
    socket.emit('nextRound');
    closeModal('modal-round-end');
  }
}

function renderOnlineGameOver(players, rounds, leaderboard) {
  closeModal('modal-round-end');
  stopConfetti();

  const winner = leaderboard[0];
  document.getElementById('gameover-subtitle').textContent = `🏆 ${winner.name} menang dengan ${winner.total} poin terkecil!`;

  const container = document.getElementById('gameover-leaderboard');
  container.innerHTML = '';

  leaderboard.forEach((p, rank) => {
    const item = document.createElement('div');
    item.className = `go-lb-item ${rank === 0 ? 'rank-1' : ''}`;
    item.innerHTML = `
      <div class="go-lb-rank">${rank + 1}</div>
      <div class="go-lb-name">${renderPlayerBadgeHTML(p)}</div>
      <div class="go-lb-score">${p.total}</div>
    `;
    container.appendChild(item);
  });

  // Render Gaple statistical list
  const gapleStatsEl = document.getElementById('gameover-gaple-stats');
  const gapleListEl = document.getElementById('gameover-gaple-list');
  gapleListEl.innerHTML = '';

  const gapleRounds = rounds.filter(r => r.gapleCard);

  if (gapleRounds.length > 0) {
    gapleStatsEl.classList.remove('hidden');
    gapleRounds.forEach(gr => {
      const row = document.createElement('div');
      row.className = 'go-lb-item';
      row.style.borderColor = 'var(--primary)';
      row.innerHTML = `
        <div class="go-lb-name" style="font-size: 1.6rem; display: inline-flex; align-items: center; gap: 0.5rem;">
          Ronde ${gr.roundNum}: ${gr.winnerName}
        </div>
        <div class="go-lb-score" style="color: var(--primary); font-size: 1.2rem; font-weight: bold;">BALAK ${gr.gapleCard}</div>
      `;
      gapleListEl.appendChild(row);
    });
  } else {
    gapleStatsEl.classList.add('hidden');
  }

  // Rematch action logic handled in startNewGame online mode check
  showPage('gameover');
  startConfetti();
}

// ─────────────────────────────────────────────
// RETRO SOUND SYNTHESIS & CONTROL
// ─────────────────────────────────────────────
let isMuted = false;
try {
  isMuted = localStorage.getItem('gaple_muted') === 'true';
} catch (e) {}

function playRetroSound(type) {
  if (isMuted) return;
  
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  const now = ctx.currentTime;
  
  if (type === 'click') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'pass') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.15);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'turn') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.setValueAtTime(0, now + 0.05);
    gain.gain.setValueAtTime(0.05, now + 0.08);
    gain.gain.setValueAtTime(0, now + 0.13);
    osc.frequency.setValueAtTime(1046.5, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'roundStart') {
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, i) => {
      const playTime = now + (i * 0.08);
      const tempOsc = ctx.createOscillator();
      const tempGain = ctx.createGain();
      tempOsc.type = 'square';
      tempOsc.frequency.setValueAtTime(freq, playTime);
      tempGain.gain.setValueAtTime(0.04, playTime);
      tempGain.gain.exponentialRampToValueAtTime(0.001, playTime + 0.07);
      tempOsc.connect(tempGain);
      tempGain.connect(ctx.destination);
      tempOsc.start(playTime);
      tempOsc.stop(playTime + 0.08);
    });
  } else if (type === 'win') {
    const melody = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
    const rhythm = [0.1, 0.1, 0.1, 0.15, 0.1, 0.3];
    let accumTime = now;
    melody.forEach((freq, i) => {
      const dur = rhythm[i];
      const tempOsc = ctx.createOscillator();
      const tempGain = ctx.createGain();
      tempOsc.type = 'square';
      tempOsc.frequency.setValueAtTime(freq, accumTime);
      tempGain.gain.setValueAtTime(0.05, accumTime);
      tempGain.gain.exponentialRampToValueAtTime(0.001, accumTime + dur - 0.01);
      tempOsc.connect(tempGain);
      tempGain.connect(ctx.destination);
      tempOsc.start(accumTime);
      tempOsc.stop(accumTime + dur);
      accumTime += dur;
    });
  } else if (type === 'lose') {
    const melody = [392.00, 349.23, 311.13, 261.63];
    let accumTime = now;
    melody.forEach((freq, i) => {
      const dur = 0.15;
      const tempOsc = ctx.createOscillator();
      const tempGain = ctx.createGain();
      tempOsc.type = 'sawtooth';
      tempOsc.frequency.setValueAtTime(freq, accumTime);
      tempGain.gain.setValueAtTime(0.05, accumTime);
      tempGain.gain.exponentialRampToValueAtTime(0.001, accumTime + dur - 0.01);
      tempOsc.connect(tempGain);
      tempGain.connect(ctx.destination);
      tempOsc.start(accumTime);
      tempOsc.stop(accumTime + dur);
      accumTime += dur;
    });
  } else if (type === 'special') {
    const melody = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50];
    let accumTime = now;
    melody.forEach((freq, i) => {
      const dur = 0.06;
      const tempOsc = ctx.createOscillator();
      const tempGain = ctx.createGain();
      tempOsc.type = 'triangle';
      tempOsc.frequency.setValueAtTime(freq, accumTime);
      tempGain.gain.setValueAtTime(0.06, accumTime);
      tempGain.gain.exponentialRampToValueAtTime(0.001, accumTime + dur - 0.005);
      tempOsc.connect(tempGain);
      tempGain.connect(ctx.destination);
      tempOsc.start(accumTime);
      tempOsc.stop(accumTime + dur);
      accumTime += dur;
    });
  }
}

function toggleMuteSound() {
  isMuted = !isMuted;
  try {
    localStorage.setItem('gaple_muted', isMuted);
  } catch (e) {}
  updateMuteIcon();
  showToast(isMuted ? 'Suara dimatikan 🔈' : 'Suara diaktifkan 🔊');
}

function updateMuteIcon() {
  const btn = document.querySelector('button[onclick="toggleMuteSound()"]');
  if (btn) {
    btn.innerHTML = isMuted ? `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    ` : `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    `;
  }
}

// ─────────────────────────────────────────────
// LIFETIME STATISTICS DASHBOARD FUNCTIONS
// ─────────────────────────────────────────────

let statsCache = [];

function showStatsPage() {
  state.statsMode = state.statsMode || 'local';
  state.statsSortKey = state.statsSortKey || 'wins';

  const toggle = document.getElementById('stats-mode-selector');
  const btnLocal = document.getElementById('btn-stats-local');
  const btnOnline = document.getElementById('btn-stats-online');

  if (socket) {
    if (toggle) toggle.classList.remove('hidden');
    if (btnLocal && btnOnline) {
      if (state.statsMode === 'local') {
        btnLocal.className = 'btn btn-sm btn-primary';
        btnOnline.className = 'btn btn-sm btn-outline';
      } else {
        btnLocal.className = 'btn btn-sm btn-outline';
        btnOnline.className = 'btn btn-sm btn-primary';
      }
    }
  } else {
    state.statsMode = 'local';
    if (toggle) toggle.classList.add('hidden');
  }

  loadAndRenderStats();
  showPage('stats');
}

function switchStatsMode(mode) {
  state.statsMode = mode;
  showStatsPage();
}

function calculateLocalLifetimeStats() {
  const localStats = {};

  // Filter completed local games
  const completedGames = state.allGames.filter(g => g.status === 'done');

  completedGames.forEach(game => {
    if (!game.players || game.players.length === 0) return;

    // Find final winner score
    const sorted = [...game.players].sort((a, b) => a.total - b.total);
    const minTotal = sorted[0].total;

    game.players.forEach((p, playerIdx) => {
      if (!localStats[p.name]) {
        localStats[p.name] = {
          name: p.name,
          avatar: p.avatar,
          color: p.color,
          matchesPlayed: 0,
          matchesWon: 0,
          roundsWon: 0,
          gapleCount: 0,
          gacorCount: 0,
          dungTakCount: 0,
          longestStreak: 0
        };
      }

      const stat = localStats[p.name];
      stat.matchesPlayed++;
      // Keep avatar and color updated to the latest one
      stat.avatar = p.avatar;
      stat.color = p.color;

      if (p.total === minTotal) {
        stat.matchesWon++;
      }

      // Streaks and rounds calculation
      let currentStreak = 0;
      game.rounds.forEach(round => {
        const winnerIdx = getRoundWinnerIndex(round);
        const isRoundWinner = winnerIdx === playerIdx;

        if (isRoundWinner) {
          stat.roundsWon++;
          currentStreak++;
          if (currentStreak > stat.longestStreak) {
            stat.longestStreak = currentStreak;
          }
        } else {
          currentStreak = 0;
        }

        // Special scores
        if (round.scores && round.scores[playerIdx] !== undefined) {
          const roundScore = round.scores[playerIdx];
          if (roundScore === -20) {
            stat.gapleCount++;
          } else if (roundScore === -25) {
            stat.gacorCount++;
          } else if (roundScore === -30) {
            stat.dungTakCount++;
          }
        }
      });
    });
  });

  return Object.values(localStats);
}

function loadAndRenderStats() {
  if (state.statsMode === 'local') {
    const localData = calculateLocalLifetimeStats();
    statsCache = localData;
    renderStatsList(localData);
  } else {
    const list = document.getElementById('stats-list');
    if (list) {
      list.innerHTML = '<div class="no-history" style="text-align: center; padding: 2rem;">Memuat statistik online...</div>';
    }
    if (socket) {
      socket.emit('getAllLifetimeStats', (allStats) => {
        // allStats is map of name -> stats
        const statsArray = Object.values(allStats).map(p => ({
          name: p.name,
          avatar: p.avatar || 'fox',
          color: p.color || '#FF5252',
          matchesPlayed: p.totalMatchesPlayed || 0,
          matchesWon: p.totalMatchesWon || 0,
          roundsWon: p.totalRoundsWon || 0,
          gapleCount: p.totalGaple || 0,
          gacorCount: p.totalGacor || 0,
          dungTakCount: p.totalDungTak || 0,
          longestStreak: p.longestWinStreak || 0
        }));
        statsCache = statsArray;
        renderStatsList(statsArray);
      });
    } else {
      showToast('Koneksi terputus, beralih ke Lokal.');
      state.statsMode = 'local';
      loadAndRenderStats();
    }
  }
}

function sortStats(key) {
  state.statsSortKey = key;

  const btnMatches = document.getElementById('sort-btn-matches');
  const btnWins = document.getElementById('sort-btn-wins');
  if (btnMatches && btnWins) {
    if (key === 'matches') {
      btnMatches.className = 'btn btn-sm btn-primary';
      btnWins.className = 'btn btn-sm btn-outline';
    } else {
      btnMatches.className = 'btn btn-sm btn-outline';
      btnWins.className = 'btn btn-sm btn-primary';
    }
  }

  renderStatsList(statsCache);
}

function renderStatsList(statsArray) {
  const list = document.getElementById('stats-list');
  if (!list) return;
  list.innerHTML = '';

  if (!statsArray || statsArray.length === 0) {
    list.innerHTML = '<div class="no-history" style="text-align: center; padding: 2rem;">Belum ada data statistik.</div>';
    return;
  }

  // Sort
  const sorted = [...statsArray].sort((a, b) => {
    if (state.statsSortKey === 'matches') {
      if (b.matchesPlayed !== a.matchesPlayed) {
        return b.matchesPlayed - a.matchesPlayed;
      }
      return b.matchesWon - a.matchesWon;
    } else {
      if (b.matchesWon !== a.matchesWon) {
        return b.matchesWon - a.matchesWon;
      }
      return b.matchesPlayed - a.matchesPlayed;
    }
  });

  sorted.forEach(p => {
    const row = document.createElement('div');
    row.className = 'stats-row';
    row.onclick = () => openPlayerStatsDetail(p.name);
    
    row.innerHTML = `
      <div class="stats-row-left">
        ${renderPlayerBadgeHTML(p, 'sm')}
      </div>
      <div class="stats-row-right">
        <span class="stats-row-val" title="Total Main">${p.matchesPlayed}</span>
        <span class="stats-row-val" title="Total Menang" style="color: var(--accent-orange);">${p.matchesWon}</span>
      </div>
    `;
    list.appendChild(row);
  });
}

function openPlayerStatsDetail(playerName) {
  const p = statsCache.find(item => item.name === playerName);
  if (!p) return;

  const badgeWrap = document.getElementById('player-stats-detail-badge');
  if (badgeWrap) {
    badgeWrap.innerHTML = renderPlayerBadgeHTML(p, 'lg');
  }

  document.getElementById('stat-detail-matches').textContent = p.matchesPlayed;
  document.getElementById('stat-detail-wins').textContent = p.matchesWon;

  const winRate = p.matchesPlayed > 0 ? Math.round((p.matchesWon / p.matchesPlayed) * 100) : 0;
  document.getElementById('stat-detail-winrate').textContent = winRate + '%';
  document.getElementById('stat-detail-streak').textContent = p.longestStreak;

  document.getElementById('stat-detail-gaple').textContent = p.gapleCount;
  document.getElementById('stat-detail-gacor').textContent = p.gacorCount;
  document.getElementById('stat-detail-dungtak').textContent = p.dungTakCount;

  openModal('modal-player-stats-detail');

  // Trigger preview avatar micro-animation
  setTimeout(() => {
    const detailBadgeAvatar = document.querySelector('#player-stats-detail-badge .player-avatar svg');
    if (detailBadgeAvatar) {
      detailBadgeAvatar.style.animation = 'pixelAvatarJump 0.5s steps(4) infinite alternate';
    }
  }, 100);
}


