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
  
  // Dual-mode and Online Game state additions
  mode: 'tracker',       // 'tracker' | 'game'
  isOnline: false,
  isHost: false,
  roomCode: '',
  myPlayerIndex: -1,     // index of local player in the online game list (0-3)
  onlineDbRef: null,     // Firebase database reference
  selectedTileIndex: -1, // track selected tile in hand when choosing left/right placement
  onlineGame: null,      // active online game synced from Firebase
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
      pts = [{x: cx, y: cy}];
    } else if (n === 2) {
      pts = [{x: cx - 10, y: cy - 10}, {x: cx + 10, y: cy + 10}];
    } else if (n === 3) {
      pts = [{x: cx - 10, y: cy - 10}, {x: cx, y: cy}, {x: cx + 10, y: cy + 10}];
    } else if (n === 4) {
      pts = [
        {x: cx - 10, y: cy - 10}, {x: cx + 10, y: cy - 10},
        {x: cx - 10, y: cy + 10}, {x: cx + 10, y: cy + 10}
      ];
    } else if (n === 5) {
      pts = [
        {x: cx - 10, y: cy - 10}, {x: cx + 10, y: cy - 10},
        {x: cx, y: cy},
        {x: cx - 10, y: cy + 10}, {x: cx + 10, y: cy + 10}
      ];
    } else if (n === 6) {
      pts = [
        {x: cx - 10, y: cy - 10}, {x: cx, y: cy - 10}, {x: cx + 10, y: cy - 10},
        {x: cx - 10, y: cy + 10}, {x: cx, y: cy + 10}, {x: cx + 10, y: cy + 10}
      ];
    }
    return pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${color}" />`).join('');
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
      pts = [{x: cx, y: cy}];
    } else if (n === 2) {
      pts = [{x: cx - 10, y: cy - 10}, {x: cx + 10, y: cy + 10}];
    } else if (n === 3) {
      pts = [{x: cx - 10, y: cy - 10}, {x: cx, y: cy}, {x: cx + 10, y: cy + 10}];
    } else if (n === 4) {
      pts = [
        {x: cx - 10, y: cy - 10}, {x: cx + 10, y: cy - 10},
        {x: cx - 10, y: cy + 10}, {x: cx + 10, y: cy + 10}
      ];
    } else if (n === 5) {
      pts = [
        {x: cx - 10, y: cy - 10}, {x: cx + 10, y: cy - 10},
        {x: cx, y: cy},
        {x: cx - 10, y: cy + 10}, {x: cx + 10, y: cy + 10}
      ];
    } else if (n === 6) {
      pts = [
        {x: cx - 10, y: cy - 10}, {x: cx - 10, y: cy}, {x: cx - 10, y: cy + 10},
        {x: cx + 10, y: cy - 10}, {x: cx + 10, y: cy}, {x: cx + 10, y: cy + 10}
      ];
    }
    return pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${color}" />`).join('');
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
  initFirebase();
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
  if (pageId === 'home') {
    renderHomePage();
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
  if (state.isOnline && state.isHost) {
    createOnlineRoom();
    return;
  }
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
    startBalakEl.innerHTML = `${getPixelDominoSVG(g.startBalak || '0/0', '#FF5252', 12)} Mulai: ${g.startBalak || '0/0'}`;
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

// ─────────────────────────────────────────────
// ONLINE MULTIPLAYER GAME ENGINE (FIREBASE)
// ─────────────────────────────────────────────
let db;
let roomListener = null;
let mySessionId = localStorage.getItem('gaple_sessionId');
if (!mySessionId) {
  mySessionId = 'user_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('gaple_sessionId', mySessionId);
}

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK is not loaded. Online mode will run in simulated mode.');
    return;
  }
  
  // Public configurations that connect to default Firebase Realtime DB
  const firebaseConfig = {
    apiKey: "AIzaSyBySWc8w-BkMMahPE6DU5J5gAdbL0ih1mw",
    authDomain: "gamegaple-skor.firebaseapp.com",
    databaseURL: "https://gamegaple-skor-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "gamegaple-skor",
    storageBucket: "gamegaple-skor.firebasestorage.app",
    messagingSenderId: "766667897814",
    appId: "1:766667897814:web:904ac4b5cf8b34fdb4c277"
  };

  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    console.log("Firebase initialized successfully.");
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

function startLocalSetup() {
  state.isOnline = false;
  state.isHost = false;
  state.roomCode = '';
  state.myPlayerIndex = -1;
  
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

function showOnlineMenu() {
  showPage('online-menu');
}

function startOnlineSetup() {
  state.isOnline = true;
  state.isHost = true;
  setupPlayerCount = 4;
  
  const display = document.getElementById('player-count-display');
  if (display) display.textContent = 4;
  document.getElementById('count-minus').disabled = true;
  document.getElementById('count-plus').disabled = true;
  document.getElementById('game-name').value = "Gaple Online Room";
  
  renderSetupPlayerInputs();
  
  // Pre-fill waiting status for online players in setup form
  for (let i = 1; i < 4; i++) {
    const el = document.getElementById(`player-name-${i}`);
    if (el) {
      el.value = "Menunggu Pemain...";
      el.disabled = true;
    }
    const btn = document.getElementById(`setup-avatar-btn-${i}`);
    if (btn) btn.disabled = true;
  }
  
  document.getElementById('btn-mulai').textContent = "Buat Room & Masuk Lobby";
  showPage('setup');
}

function showJoinRoomPage() {
  document.getElementById('room-code-input').value = '';
  showPage('join');
  setTimeout(() => {
    document.getElementById('room-code-input').focus();
  }, 120);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function createOnlineRoom() {
  const hostName = document.getElementById('player-name-0').value.trim() || 'Host';
  const custom = setupPlayerData[0] || { avatar: getPlayerDefaultAvatar(0), color: getPlayerDefaultColor(0) };
  
  const hostPlayer = {
    id: mySessionId,
    name: hostName,
    avatar: custom.avatar,
    color: custom.color,
    totalScore: 0
  };
  
  const startBalak = document.getElementById('start-balak').value || '0/0';
  state.roomCode = generateRoomCode();
  state.myPlayerIndex = 0;
  
  const roomData = {
    id: Date.now().toString(),
    name: document.getElementById('game-name').value.trim() || 'Gaple Online',
    status: 'lobby',
    startBalak: startBalak,
    hostId: mySessionId,
    players: [hostPlayer],
    lastUpdated: Date.now()
  };
  
  if (db) {
    db.ref('rooms/' + state.roomCode).set(roomData)
      .then(() => {
        // Automatically clean up room from database if Host disconnects
        db.ref('rooms/' + state.roomCode).onDisconnect().remove();
        listenToRoom(state.roomCode);
        showPage('game-lobby');
      })
      .catch(err => {
        showToast('Gagal membuat room online di Firebase.');
        console.error(err);
      });
  } else {
    // Simulated offline/demo mode if Firebase not available
    console.warn("Using offline room simulation.");
    window.mockRoomData = roomData;
    listenToRoom(state.roomCode);
    showPage('game-lobby');
    showToast('Mode Simulasi Online Diaktifkan (Offline)');
  }
}

function joinRoom() {
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (code.length !== 4) {
    showToast('Masukkan 4 digit kode room!');
    return;
  }
  
  if (db) {
    db.ref('rooms/' + code).once('value')
      .then(snapshot => {
        const data = snapshot.val();
        if (!data) {
          showToast('Room tidak ditemukan!');
          return;
        }
        if (data.status !== 'lobby') {
          showToast('Game sudah dimulai atau sudah selesai.');
          return;
        }
        if (data.players.length >= 4) {
          showToast('Room ini sudah penuh!');
          return;
        }
        
        const customName = localStorage.getItem('gaple_lastPlayerNames') ? JSON.parse(localStorage.getItem('gaple_lastPlayerNames'))[0] : 'Pemain ' + (data.players.length + 1);
        const playerObj = {
          id: mySessionId,
          name: customName || 'Pemain ' + (data.players.length + 1),
          avatar: getPlayerDefaultAvatar(data.players.length),
          color: getPlayerDefaultColor(data.players.length),
          totalScore: 0
        };
        
        const existingIdx = data.players.findIndex(p => p.id === mySessionId);
        if (existingIdx !== -1) {
          state.myPlayerIndex = existingIdx;
          state.isOnline = true;
          state.isHost = false;
          listenToRoom(code);
          showPage('game-lobby');
          return;
        }
        
        const updatedPlayers = [...data.players, playerObj];
        db.ref('rooms/' + code + '/players').set(updatedPlayers)
          .then(() => {
            state.isOnline = true;
            state.isHost = false;
            state.myPlayerIndex = updatedPlayers.length - 1;
            listenToRoom(code);
            showPage('game-lobby');
            showToast('Berhasil bergabung ke room!');
          });
      })
      .catch(err => {
        showToast('Gagal tersambung ke Firebase.');
        console.error(err);
      });
  } else {
    // Mock simulation join
    if (window.mockRoomData && code === state.roomCode) {
      const playerObj = {
        id: mySessionId,
        name: 'Pemain ' + (window.mockRoomData.players.length + 1),
        avatar: getPlayerDefaultAvatar(window.mockRoomData.players.length),
        color: getPlayerDefaultColor(window.mockRoomData.players.length),
        totalScore: 0
      };
      window.mockRoomData.players.push(playerObj);
      state.isOnline = true;
      state.isHost = false;
      state.myPlayerIndex = window.mockRoomData.players.length - 1;
      localStorage.setItem('gaple_mock_room_' + code, JSON.stringify(window.mockRoomData));
      listenToRoom(code);
      showPage('game-lobby');
      showToast('Berhasil bergabung ke room (Simulasi)!');
    } else {
      showToast('Room tidak ditemukan (Simulasi).');
    }
  }
}

function listenToRoom(code) {
  state.roomCode = code;
  
  if (db) {
    if (roomListener) {
      db.ref('rooms/' + state.roomCode).off('value', roomListener);
    }
    roomListener = db.ref('rooms/' + state.roomCode).on('value', snapshot => {
      const data = snapshot.val();
      if (!data) {
        showToast('Room tidak ditemukan atau sudah ditutup.');
        leaveOnlineGame();
        return;
      }
      state.onlineGame = data;
      if (!state.isHost) {
        const myIndex = data.players.findIndex(p => p.id === mySessionId);
        if (myIndex !== -1) {
          state.myPlayerIndex = myIndex;
        }
      }
      
      if (data.status === 'lobby') {
        renderLobbyUI();
      } else if (data.status === 'playing') {
        renderGameBoardUI();
      } else if (data.status === 'round_over') {
        renderRoundOverUI();
      } else if (data.status === 'game_over') {
        renderGameOverUI();
      }
    });
  } else {
    state.onlineGame = window.mockRoomData;
    renderLobbyUI();
  }
}

// Window Storage Sync Event Listener for local multi-tab simulation
window.addEventListener('storage', (e) => {
  if (state.isOnline && e.key === 'gaple_mock_room_' + state.roomCode) {
    const data = JSON.parse(e.newValue);
    if (data) {
      state.onlineGame = data;
      window.mockRoomData = data;
      if (!state.isHost) {
        const myIndex = data.players.findIndex(p => p.id === mySessionId);
        if (myIndex !== -1) {
          state.myPlayerIndex = myIndex;
        }
      }
      if (data.status === 'lobby') {
        renderLobbyUI();
      } else if (data.status === 'playing') {
        renderGameBoardUI();
      } else if (data.status === 'round_over') {
        renderRoundOverUI();
      } else if (data.status === 'game_over') {
        renderGameOverUI();
      }
    }
  }
});

function renderLobbyUI() {
  const g = state.onlineGame;
  if (!g) return;
  
  document.getElementById('lobby-code-display').textContent = state.roomCode;
  
  const listEl = document.getElementById('lobby-players-list');
  listEl.innerHTML = '';
  
  for (let i = 0; i < 4; i++) {
    const p = g.players[i];
    const row = document.createElement('div');
    row.className = 'lb-item';
    row.style.padding = '0.75rem 1rem';
    
    if (p) {
      const isMe = p.id === mySessionId;
      const meText = isMe ? ' <span style="font-size: 0.55rem; color: var(--accent-gold); background: #1A1C1E; padding: 1px 4px; border-radius: 2px;">ANDA</span>' : '';
      row.innerHTML = `
        <div class="lb-rank">${i + 1}</div>
        <div class="lb-item-inner">
          <div class="lb-name" style="font-size: 1.5rem; display: inline-flex; align-items: center; gap: 0.5rem;">
            ${renderPlayerBadgeHTML(p, 'sm')}
            ${meText}
          </div>
        </div>
      `;
    } else {
      row.innerHTML = `
        <div class="lb-rank" style="opacity: 0.4;">${i + 1}</div>
        <div class="lb-item-inner">
          <div class="lb-name" style="font-size: 1.3rem; color: var(--text-muted); font-style: italic; opacity: 0.6;">
            Menunggu pemain lain...
          </div>
        </div>
      `;
    }
    listEl.appendChild(row);
  }
  
  if (state.isHost) {
    document.getElementById('lobby-actions-host').classList.remove('hidden');
    document.getElementById('lobby-actions-client').classList.add('hidden');
  } else {
    document.getElementById('lobby-actions-host').classList.add('hidden');
    document.getElementById('lobby-actions-client').classList.remove('hidden');
  }
}

function startOnlineGamePlay() {
  const g = state.onlineGame;
  if (!g) return;
  
  if (g.players.length < 4) {
    showToast('Menambahkan bot pemain agar lobby terisi 4 pemain 🤖');
    while (g.players.length < 4) {
      const idx = g.players.length;
      g.players.push({
        id: 'bot_' + idx,
        name: 'Bot ' + idx + ' 🤖',
        avatar: getPlayerDefaultAvatar(idx),
        color: getPlayerDefaultColor(idx),
        totalScore: 0,
        isBot: true
      });
    }
  }
  
  const deck = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push([i, j]);
    }
  }
  
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  for (let i = 0; i < 4; i++) {
    g.players[i].hand = deck.slice(i * 7, (i + 1) * 7);
  }
  
  const startBalak = g.startBalak || '0/0';
  let firstTurnIndex = 0;
  let firstTurnTile = startBalak.split('/').map(Number);
  
  for (let i = 0; i < 4; i++) {
    const hasBalak = g.players[i].hand.some(tile => 
      (tile[0] === firstTurnTile[0] && tile[1] === firstTurnTile[1]) || 
      (tile[0] === firstTurnTile[1] && tile[1] === firstTurnTile[0])
    );
    if (hasBalak) {
      firstTurnIndex = i;
      break;
    }
  }
  
  g.status = 'playing';
  g.currentPlayerIndex = firstTurnIndex;
  g.board = {
    tiles: [],
    leftVal: -1,
    rightVal: -1
  };
  g.lastMove = {
    playerIndex: -1,
    action: 'start'
  };
  g.roundNum = 1;
  g.lastUpdated = Date.now();
  
  updateOnlineGameData();
}

function updateOnlineGameData() {
  if (db) {
    db.ref('rooms/' + state.roomCode).set(state.onlineGame);
  } else {
    localStorage.setItem('gaple_mock_room_' + state.roomCode, JSON.stringify(state.onlineGame));
    listenToRoom(state.roomCode);
  }
}

function renderGameBoardUI() {
  const g = state.onlineGame;
  if (!g) return;
  
  showPage('game-board');
  
  document.getElementById('board-room-code').textContent = 'ROOM: ' + state.roomCode;
  document.getElementById('board-round-num').textContent = 'Ronde ' + (g.roundNum || 1);
  
  const leftContainer = document.getElementById('opponent-left-container');
  const topContainer = document.getElementById('opponent-top-container');
  const rightContainer = document.getElementById('opponent-right-container');
  
  if (leftContainer) leftContainer.innerHTML = '';
  if (topContainer) topContainer.innerHTML = '';
  if (rightContainer) rightContainer.innerHTML = '';
  
  for (let offset = 1; offset <= 3; offset++) {
    const idx = (state.myPlayerIndex + offset) % 4;
    const p = g.players[idx];
    if (!p) continue;
    
    const isCurrentTurn = g.currentPlayerIndex === idx;
    const turnIndicator = isCurrentTurn ? ' <span style="color: var(--accent-gold); animation: pulse 0.5s infinite alternate;">⬤</span>' : '';
    const activeBorder = isCurrentTurn ? '3px solid var(--accent-gold)' : '2px solid var(--border-color)';
    const cardCount = p.hand ? p.hand.length : 7;
    
    const oppCard = document.createElement('div');
    oppCard.className = 'player-badge';
    oppCard.style.padding = '0.3rem 0.5rem';
    oppCard.style.border = activeBorder;
    oppCard.style.backgroundColor = p.color || '#FF5252';
    oppCard.style.color = getTextColorForBg(p.color);
    oppCard.style.boxShadow = 'var(--pixel-shadow-sm)';
    oppCard.style.fontSize = '1rem';
    oppCard.style.display = 'flex';
    oppCard.style.flexDirection = 'column';
    oppCard.style.alignItems = 'center';
    oppCard.style.gap = '0.2rem';
    oppCard.style.width = '95px';
    oppCard.style.boxSizing = 'border-box';
    
    // Label relation based on offset
    let relLabel = 'LAWAN';
    if (offset === 1) relLabel = 'LAWAN 1';
    else if (offset === 2) relLabel = 'KAWAN';
    else if (offset === 3) relLabel = 'LAWAN 2';
    
    const avatarSVG = getPixelArtSVG(getSanitizedAvatar(p.avatar), 16);
    oppCard.innerHTML = `
      <div style="font-family: var(--font-title); font-size: 0.5rem; opacity: 0.85; margin-bottom: 2px; letter-spacing: 0.5px;">${relLabel}</div>
      <div style="display: flex; align-items: center; gap: 0.2rem; font-weight: bold; text-transform: uppercase; width: 100%; justify-content: center; font-size: 0.75rem;">
        ${avatarSVG} <span style="max-width: 50px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(p.name)}</span> ${turnIndicator}
      </div>
      <div style="font-size: 0.65rem; font-family: var(--font-title); color: #FFF; background: #1A1C1E; padding: 1px 4px; border-radius: 2px; width: 100%; text-align: center; margin-top: 3px; box-sizing: border-box;">
        🀱 ${cardCount} KARTU
      </div>
    `;
    
    if (offset === 1 && leftContainer) {
      leftContainer.appendChild(oppCard);
    } else if (offset === 2 && topContainer) {
      topContainer.appendChild(oppCard);
    } else if (offset === 3 && rightContainer) {
      rightContainer.appendChild(oppCard);
    }
  }
  
  const tableChain = document.getElementById('table-tiles-chain');
  tableChain.innerHTML = '';
  
  if (!g.board || !g.board.tiles || g.board.tiles.length === 0) {
    tableChain.innerHTML = `
      <div style="color: rgba(255,255,255,0.3); font-size: 1rem; font-family: var(--font-title); text-align: center; text-transform: uppercase; line-height: 1.4;">
        MEJA KOSONG<br/>
        <span style="font-size: 0.75rem; font-family: var(--font-pixel); color: var(--accent-gold);">Mulai dengan Balak ${g.startBalak}</span>
      </div>
    `;
  } else {
    g.board.tiles.forEach(tile => {
      const isBalak = tile[0] === tile[1];
      const valStr = tile[0] + '/' + tile[1];
      const item = document.createElement('div');
      item.style.display = 'inline-flex';
      item.style.alignItems = 'center';
      item.style.margin = '2px';
      
      // If balak/double, render vertically. Otherwise, render horizontally.
      if (isBalak) {
        item.innerHTML = getPixelDominoVerticalSVG(valStr, '#FF5252', 34);
      } else {
        item.innerHTML = getPixelDominoSVG(valStr, '#FF5252', 34);
      }
      tableChain.appendChild(item);
    });
  }
  
  const handContainer = document.getElementById('player-hand-container');
  handContainer.innerHTML = '';
  
  const myPlayer = g.players[state.myPlayerIndex];
  const myHand = myPlayer ? myPlayer.hand : [];
  const isMyTurn = g.currentPlayerIndex === state.myPlayerIndex;
  
  const turnIndicatorEl = document.getElementById('game-turn-indicator');
  if (isMyTurn) {
    turnIndicatorEl.textContent = 'GILIRAN ANDA!';
    turnIndicatorEl.style.color = 'var(--accent-gold)';
  } else {
    const currentName = g.players[g.currentPlayerIndex] ? g.players[g.currentPlayerIndex].name : 'Lawan';
    turnIndicatorEl.textContent = 'GILIRAN ' + currentName.toUpperCase();
    turnIndicatorEl.style.color = '#C8E6C9';
  }
  
  if (myHand && myHand.length > 0) {
    myHand.forEach((tile, tileIdx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.background = 'none';
      btn.style.border = 'none';
      btn.style.padding = '2px';
      btn.style.cursor = isMyTurn ? 'pointer' : 'default';
      btn.style.transition = 'transform 0.1s ease';
      
      // Hand tiles are always displayed vertically & in larger size (48px width, 96px height)
      const valStr = tile[0] + '/' + tile[1];
      btn.innerHTML = getPixelDominoVerticalSVG(valStr, '#FF5252', 48);
      
      let isPlayable = false;
      if (isMyTurn) {
        if (!g.board || !g.board.tiles || g.board.tiles.length === 0) {
          const startTile = g.startBalak.split('/').map(Number);
          isPlayable = (tile[0] === startTile[0] && tile[1] === startTile[1]) || (tile[0] === startTile[1] && tile[1] === startTile[0]);
        } else {
          const l = g.board.leftVal;
          const r = g.board.rightVal;
          isPlayable = tile[0] === l || tile[1] === l || tile[0] === r || tile[1] === r;
        }
      }
      
      if (isMyTurn && !isPlayable) {
        btn.style.opacity = '0.4';
      }
      
      if (isPlayable) {
        btn.style.transform = 'translateY(-6px)';
        btn.style.filter = 'drop-shadow(0px 0px 8px #69F0AE)';
        btn.onclick = () => selectHandTile(tileIdx);
      }
      
      handContainer.appendChild(btn);
    });
  } else {
    handContainer.innerHTML = '<div style="color: #FFF; font-style: italic; opacity: 0.6;">Tidak ada kartu tersisa.</div>';
  }
  
  const passBtn = document.getElementById('btn-game-pass');
  let hasPlayableCard = false;
  if (isMyTurn && myHand) {
    if (!g.board || !g.board.tiles || g.board.tiles.length === 0) {
      hasPlayableCard = true;
    } else {
      const l = g.board.leftVal;
      const r = g.board.rightVal;
      hasPlayableCard = myHand.some(tile => tile[0] === l || tile[1] === l || tile[0] === r || tile[1] === r);
    }
  }
  
  if (isMyTurn && !hasPlayableCard) {
    passBtn.disabled = false;
    passBtn.style.opacity = '1';
  } else {
    passBtn.disabled = true;
    passBtn.style.opacity = '0.3';
  }
  
  if (state.isHost && g.players[g.currentPlayerIndex] && g.players[g.currentPlayerIndex].isBot && g.status === 'playing') {
    setTimeout(executeBotTurn, 1500);
  }
}

function selectHandTile(idx) {
  const g = state.onlineGame;
  if (!g || g.currentPlayerIndex !== state.myPlayerIndex) return;
  
  const tile = g.players[state.myPlayerIndex].hand[idx];
  
  if (!g.board || !g.board.tiles || g.board.tiles.length === 0) {
    g.board.tiles = [tile];
    g.board.leftVal = tile[0];
    g.board.rightVal = tile[1];
    removeTileFromHand(state.myPlayerIndex, idx);
    advanceTurn();
    updateOnlineGameData();
    return;
  }
  
  const l = g.board.leftVal;
  const r = g.board.rightVal;
  
  const matchesLeft = tile[0] === l || tile[1] === l;
  const matchesRight = tile[0] === r || tile[1] === r;
  
  if (matchesLeft && matchesRight) {
    state.selectedTileIndex = idx;
    openModal('modal-placement-choice');
  } else if (matchesLeft) {
    playTileAt('left', idx);
  } else if (matchesRight) {
    playTileAt('right', idx);
  }
}

function confirmPlacement(direction) {
  if (state.selectedTileIndex === -1) return;
  playTileAt(direction, state.selectedTileIndex);
  closeModal('modal-placement-choice');
  state.selectedTileIndex = -1;
}

function playTileAt(direction, handIdx) {
  const g = state.onlineGame;
  if (!g) return;
  
  const tile = g.players[g.currentPlayerIndex].hand[handIdx];
  const l = g.board.leftVal;
  const r = g.board.rightVal;
  
  if (direction === 'left') {
    if (tile[1] === l) {
      g.board.tiles.unshift(tile);
      g.board.leftVal = tile[0];
    } else {
      g.board.tiles.unshift([tile[1], tile[0]]);
      g.board.leftVal = tile[1];
    }
  } else if (direction === 'right') {
    if (tile[0] === r) {
      g.board.tiles.push(tile);
      g.board.rightVal = tile[1];
    } else {
      g.board.tiles.push([tile[1], tile[0]]);
      g.board.rightVal = tile[0];
    }
  }
  
  removeTileFromHand(g.currentPlayerIndex, handIdx);
  
  if (g.players[g.currentPlayerIndex].hand.length === 0) {
    endOnlineRound(g.currentPlayerIndex);
  } else {
    advanceTurn();
  }
  
  updateOnlineGameData();
}

function removeTileFromHand(playerIdx, handIdx) {
  const g = state.onlineGame;
  if (g && g.players[playerIdx] && g.players[playerIdx].hand) {
    g.players[playerIdx].hand.splice(handIdx, 1);
  }
}

function advanceTurn() {
  const g = state.onlineGame;
  if (!g) return;
  
  g.currentPlayerIndex = (g.currentPlayerIndex + 1) % 4;
  
  if (checkDeadlock()) {
    resolveDeadlock();
  }
}

function passOnlineTurn() {
  const g = state.onlineGame;
  if (!g || g.currentPlayerIndex !== state.myPlayerIndex) return;
  
  g.currentPlayerIndex = (g.currentPlayerIndex + 1) % 4;
  g.lastMove = {
    playerIndex: state.myPlayerIndex,
    action: 'pass'
  };
  
  if (checkDeadlock()) {
    resolveDeadlock();
  } else {
    updateOnlineGameData();
  }
}

function checkDeadlock() {
  const g = state.onlineGame;
  if (!g || !g.board || g.board.leftVal === -1) return false;
  
  const l = g.board.leftVal;
  const r = g.board.rightVal;
  
  for (let i = 0; i < 4; i++) {
    const hand = g.players[i].hand;
    if (hand && hand.length > 0) {
      const hasPlayable = hand.some(tile => tile[0] === l || tile[1] === l || tile[0] === r || tile[1] === r);
      if (hasPlayable) {
        return false;
      }
    }
  }
  return true;
}

function resolveDeadlock() {
  const g = state.onlineGame;
  if (!g) return;
  
  const sums = g.players.map(p => {
    if (!p.hand) return 0;
    return p.hand.reduce((sum, tile) => sum + tile[0] + tile[1], 0);
  });
  
  let minSum = Infinity;
  let winnerIdx = 0;
  
  sums.forEach((sum, idx) => {
    if (sum < minSum) {
      minSum = sum;
      winnerIdx = idx;
    }
  });
  
  showToast('GAPLE! Jalan Terkunci. Menghitung jumlah sisa kartu...', 4000);
  setTimeout(() => {
    endOnlineRound(winnerIdx, true);
  }, 2500);
}

function endOnlineRound(winnerIdx, isGaple = false) {
  const g = state.onlineGame;
  if (!g) return;
  
  g.players.forEach((p, idx) => {
    if (idx !== winnerIdx) {
      const penalty = p.hand ? p.hand.reduce((sum, tile) => sum + tile[0] + tile[1], 0) : 0;
      p.totalScore += penalty;
    }
  });
  
  const gameOver = g.players.some(p => p.totalScore >= 100);
  
  if (gameOver) {
    g.status = 'game_over';
  } else {
    g.status = 'round_over';
    g.roundWinnerIndex = winnerIdx;
    g.isGapleWin = isGaple;
  }
  
  updateOnlineGameData();
}

function startNextOnlineRound() {
  const g = state.onlineGame;
  if (!g) return;
  
  const deck = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push([i, j]);
    }
  }
  
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  for (let i = 0; i < 4; i++) {
    g.players[i].hand = deck.slice(i * 7, (i + 1) * 7);
  }
  
  g.status = 'playing';
  g.currentPlayerIndex = g.roundWinnerIndex !== undefined ? g.roundWinnerIndex : 0;
  g.board = {
    tiles: [],
    leftVal: -1,
    rightVal: -1
  };
  g.lastMove = {
    playerIndex: -1,
    action: 'start'
  };
  g.roundNum = (g.roundNum || 1) + 1;
  g.lastUpdated = Date.now();
  
  closeModal('modal-round-over');
  updateOnlineGameData();
}

function renderRoundOverUI() {
  const g = state.onlineGame;
  if (!g) return;
  
  closeModal('modal-placement-choice');
  openModal('modal-round-over');
  
  const winner = g.players[g.roundWinnerIndex];
  const titleEl = document.getElementById('round-over-title');
  if (titleEl) titleEl.textContent = `Ronde ${g.roundNum} Selesai`;
  
  const resultsEl = document.getElementById('round-over-results');
  if (resultsEl) {
    resultsEl.innerHTML = '';
    
    const isMeWinner = g.roundWinnerIndex === state.myPlayerIndex;
    let winMsg = isMeWinner ? '🎉 ANDA MENANG RONDE INI!' : `🏆 ${winner.name.toUpperCase()} MENANG RONDE INI!`;
    if (g.isGapleWin) winMsg += ' (GAPLE!)';
    
    const h4 = document.createElement('h4');
    h4.style.fontFamily = 'var(--font-title)';
    h4.style.fontSize = '0.65rem';
    h4.style.color = 'var(--accent-gold)';
    h4.style.marginBottom = '1.25rem';
    h4.style.textAlign = 'center';
    h4.textContent = winMsg;
    resultsEl.appendChild(h4);
    
    g.players.forEach((p, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.marginBottom = '0.6rem';
      row.style.fontSize = '1.4rem';
      row.style.borderBottom = '2px dashed rgba(0,0,0,0.1)';
      row.style.paddingBottom = '0.3rem';
      
      const isMe = p.id === mySessionId;
      const nameStr = isMe ? `${p.name} (Anda)` : p.name;
      const isWinner = idx === g.roundWinnerIndex;
      const additionText = isWinner ? 'Menang' : `+${p.hand ? p.hand.reduce((sum, tile) => sum + tile[0] + tile[1], 0) : 0} Poin`;
      
      row.innerHTML = `
        <span style="font-weight: ${isMe ? 'bold' : 'normal'}; display: inline-flex; align-items: center; gap: 0.3rem;">
          ${renderPlayerBadgeHTML(p, 'sm')}
        </span>
        <span style="font-family: var(--font-title); font-size: 0.6rem; color: ${isWinner ? 'var(--accent-green)' : 'var(--primary)'}; font-weight: bold;">
          ${additionText} (Total: ${p.totalScore})
        </span>
      `;
      resultsEl.appendChild(row);
    });
  }
  
  const nextBtn = document.getElementById('btn-next-round');
  const waitLbl = document.getElementById('lbl-next-round-wait');
  
  if (state.isHost) {
    nextBtn.classList.remove('hidden');
    waitLbl.classList.add('hidden');
  } else {
    nextBtn.classList.add('hidden');
    waitLbl.classList.remove('hidden');
  }
}

function renderGameOverUI() {
  const g = state.onlineGame;
  if (!g) return;
  
  closeModal('modal-round-over');
  
  state.currentGame = {
    id: g.id,
    name: g.name,
    players: g.players.map(p => ({
      name: p.name,
      total: p.totalScore,
      avatar: p.avatar,
      color: p.color
    })),
    rounds: [],
    status: 'done',
    createdAt: new Date().toISOString()
  };
  
  renderGameOver();
  showPage('gameover');
  startConfetti();
  
  if (db && state.roomCode) {
    db.ref('rooms/' + state.roomCode).off('value', roomListener);
  }
}

function executeBotTurn() {
  const g = state.onlineGame;
  if (!g || g.status !== 'playing') return;
  
  const bot = g.players[g.currentPlayerIndex];
  if (!bot || !bot.isBot) return;
  
  const hand = bot.hand || [];
  if (hand.length === 0) return;
  
  if (!g.board || !g.board.tiles || g.board.tiles.length === 0) {
    const startTile = g.startBalak.split('/').map(Number);
    const tileIdx = hand.findIndex(tile => 
      (tile[0] === startTile[0] && tile[1] === startTile[1]) || 
      (tile[0] === startTile[1] && tile[1] === startTile[0])
    );
    const actualIdx = tileIdx !== -1 ? tileIdx : 0;
    const tile = hand[actualIdx];
    
    g.board.tiles = [tile];
    g.board.leftVal = tile[0];
    g.board.rightVal = tile[1];
    removeTileFromHand(g.currentPlayerIndex, actualIdx);
    advanceTurn();
    updateOnlineGameData();
    return;
  }
  
  const l = g.board.leftVal;
  const r = g.board.rightVal;
  
  const playableIdxs = [];
  hand.forEach((tile, idx) => {
    if (tile[0] === l || tile[1] === l || tile[0] === r || tile[1] === r) {
      playableIdxs.push(idx);
    }
  });
  
  if (playableIdxs.length === 0) {
    g.currentPlayerIndex = (g.currentPlayerIndex + 1) % 4;
    g.lastMove = {
      playerIndex: g.currentPlayerIndex,
      action: 'pass'
    };
    
    if (checkDeadlock()) {
      resolveDeadlock();
    } else {
      updateOnlineGameData();
    }
    return;
  }
  
  const chosenIdx = playableIdxs[0];
  const tile = hand[chosenIdx];
  
  const matchesLeft = tile[0] === l || tile[1] === l;
  const matchesRight = tile[0] === r || tile[1] === r;
  
  let direction = 'right';
  if (matchesLeft && matchesRight) {
    direction = Math.random() > 0.5 ? 'left' : 'right';
  } else if (matchesLeft) {
    direction = 'left';
  } else if (matchesRight) {
    direction = 'right';
  }
  
  if (direction === 'left') {
    if (tile[1] === l) {
      g.board.tiles.unshift(tile);
      g.board.leftVal = tile[0];
    } else {
      g.board.tiles.unshift([tile[1], tile[0]]);
      g.board.leftVal = tile[1];
    }
  } else {
    if (tile[0] === r) {
      g.board.tiles.push(tile);
      g.board.rightVal = tile[1];
    } else {
      g.board.tiles.push([tile[1], tile[0]]);
      g.board.rightVal = tile[0];
    }
  }
  
  removeTileFromHand(g.currentPlayerIndex, chosenIdx);
  
  if (bot.hand.length === 0) {
    endOnlineRound(g.currentPlayerIndex);
  } else {
    advanceTurn();
  }
  
  updateOnlineGameData();
}

function openLeaveGameModal() {
  openModal('modal-leave-game');
}

function confirmLeaveOnlineGame() {
  closeModal('modal-leave-game');
  leaveOnlineGame();
}

function leaveOnlineGame() {
  if (db && state.roomCode) {
    if (state.isHost) {
      db.ref('rooms/' + state.roomCode).remove();
    } else {
      const g = state.onlineGame;
      if (g && g.players) {
        const filtered = g.players.filter(p => p.id !== mySessionId);
        db.ref('rooms/' + state.roomCode + '/players').set(filtered);
      }
    }
    db.ref('rooms/' + state.roomCode).off('value', roomListener);
  }
  
  state.isOnline = false;
  state.isHost = false;
  state.roomCode = '';
  state.myPlayerIndex = -1;
  state.onlineGame = null;
  
  showPage('home');
}


