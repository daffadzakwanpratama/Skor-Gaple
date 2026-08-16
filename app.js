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
  'fox': 'fox', 'frog': 'frog', 'cat': 'cat', 'panda': 'panda', 'tiger': 'tiger',
  'koala': 'koala', 'pig': 'pig', 'lion': 'lion', 'chicken': 'chicken', 'monkey': 'monkey'
};

const KEY_TO_EMOJI = {
  'fox': 'fox', 'frog': 'frog', 'cat': 'cat', 'panda': 'panda', 'tiger': 'tiger',
  'koala': 'koala', 'pig': 'pig', 'lion': 'lion', 'chicken': 'chicken', 'monkey': 'monkey'
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
  return KEY_TO_EMOJI[key] || 'fox';
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
  const minusFifteen = round.scores.indexOf(-15);
  if (minusFifteen !== -1) return minusFifteen;
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

// ─────────────────────────────────────────────
// REAL-TIME PLAYER TITLES / JULUKAN
// ─────────────────────────────────────────────
function calculatePlayerTitles(game) {
  // Semua badge julukan (Tukang Buntu, Raja Balak, Dewa Hoki, Korban Bedak) dihilangkan
  return {};
}

function getPlayerTitle(playerIdx, gameOverride = null) {
  const g = gameOverride || state.currentGame;
  if (!g || !g.players || !g.rounds || g.rounds.length === 0) {
    return null;
  }
  const titles = calculatePlayerTitles(g);
  return titles[playerIdx] || null;
}

function renderPlayerBadgeHTML(player, size = 'md', options = {}) {
  const showTitle = options.showTitle !== false;
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

  const g = options.game || state.currentGame;
  let playerIdx = -1;
  if (g && g.players) {
    playerIdx = g.players.findIndex(p => p.name === name);
  }
  const streak = (playerIdx !== -1) ? getPlayerCurrentStreak(playerIdx) : 0;
  const flameHTML = (streak >= 3)
    ? `<span class="streak-flame-wrapper" style="display: inline-flex; align-items: center; gap: 2px; margin-left: 0.2rem;" title="Menang beruntun ${streak}x! ">
        ${getPixelFlameSVG(svgSize)}
        <span style="font-family: var(--font-title); font-size: ${size === 'sm' ? '0.55rem' : '0.65rem'}; color: #FFD740; text-shadow: 1px 1px 0px #000; font-weight: bold; line-height: 1;">${streak}</span>
       </span>`
    : '';

  let titleHTML = '';
  if (showTitle && playerIdx !== -1) {
    const titleObj = getPlayerTitle(playerIdx, g);
    if (titleObj) {
      const titleSmClass = size === 'sm' ? 'title-sm' : '';
      titleHTML = `<span class="player-title-tag ${titleObj.class} ${titleSmClass}" title="${titleObj.desc}">${titleObj.label}</span>`;
    }
  }

  return `
    <span class="player-badge ${badgeClass}" style="background-color: ${color}; color: ${textColor};">
      <span class="player-avatar">${avatarSVG}</span>
      <span class="player-name-text">${escapeHtml(name)}</span>
      ${flameHTML}
      ${titleHTML}
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

// Toggle Lite Mode (Performance Mode for low-end devices)
function toggleLiteMode(init = false) {
  const isLite = document.body.classList.contains('lite-mode');
  const newLite = init ? (localStorage.getItem('lite-mode') === 'true') : !isLite;
  
  if (newLite) {
    document.body.classList.add('lite-mode');
    localStorage.setItem('lite-mode', 'true');
  } else {
    document.body.classList.remove('lite-mode');
    localStorage.setItem('lite-mode', 'false');
  }
  
  // Update Switch UI if elements exist
  const chk = document.getElementById('chk-lite-mode');
  const knob = document.getElementById('lite-mode-knob');
  const switchBg = document.getElementById('lite-mode-switch');
  const icon = document.getElementById('perf-toggle-icon');
  
  if (chk) chk.checked = newLite;
  if (knob && switchBg) {
    if (newLite) {
      knob.style.transform = 'translateX(14px)';
      switchBg.style.background = 'var(--accent-green)';
      switchBg.style.borderColor = 'var(--accent-green)';
      if (icon) icon.textContent = '';
    } else {
      knob.style.transform = 'translateX(0)';
      switchBg.style.background = 'rgba(255,255,255,0.15)';
      switchBg.style.borderColor = 'rgba(255,255,255,0.2)';
      if (icon) icon.textContent = '';
    }
  }
}

// Toggle 17 Agustus Special Theme (Independence Day Theme)
function toggleKemerdekaanTheme(init = false) {
  const isKemerdekaan = document.body.classList.contains('kemerdekaan-mode');
  
  let newKemerdekaan;
  if (init) {
    const savedKemerdekaan = localStorage.getItem('kemerdekaan-mode');
    newKemerdekaan = (savedKemerdekaan === 'true');
  } else {
    newKemerdekaan = !isKemerdekaan;
  }
  
  if (newKemerdekaan) {
    document.body.classList.add('kemerdekaan-mode');
    if (!init) {
      localStorage.setItem('kemerdekaan-mode', 'true');
    }
    initKemerdekaanConfetti();
  } else {
    document.body.classList.remove('kemerdekaan-mode');
    if (!init) {
      localStorage.setItem('kemerdekaan-mode', 'false');
    }
  }
  
  // Update Switch UI
  const chk = document.getElementById('chk-kemerdekaan-mode');
  const knob = document.getElementById('kemerdekaan-mode-knob');
  const switchBg = document.getElementById('kemerdekaan-mode-switch');
  
  if (chk) chk.checked = newKemerdekaan;
  if (knob && switchBg) {
    if (newKemerdekaan) {
      knob.style.transform = 'translateX(14px)';
      switchBg.style.background = '#FF1744';
      switchBg.style.borderColor = '#FF5252';
    } else {
      knob.style.transform = 'translateX(0)';
      switchBg.style.background = 'rgba(255,255,255,0.15)';
      switchBg.style.borderColor = 'rgba(255,255,255,0.2)';
    }
  }
}

// Generate Red & White Confetti Particles
function initKemerdekaanConfetti() {
  const container = document.getElementById('kemerdekaan-confetti-container');
  if (!container || container.children.length > 0) return;

  const colors = ['#FF1744', '#D32F2F', '#FFFFFF', '#FFD740'];
  const particleCount = 28;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'kemerdekaan-particle';
    particle.style.left = Math.random() * 100 + 'vw';
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
    particle.style.animationDelay = (Math.random() * 4) + 's';
    particle.style.width = (Math.random() * 6 + 6) + 'px';
    particle.style.height = (Math.random() * 10 + 6) + 'px';
    container.appendChild(particle);
  }
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  toggleLiteMode(true);
  toggleKemerdekaanTheme(true);
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

  // Restore active tournament & page on refresh
  try {
    const savedPage = localStorage.getItem('gaple_activePage') || 'home';
    const activeTourneyId = localStorage.getItem('gaple_activeTournamentId');

    // Muat turnamen jika ada
    try {
      const savedTourney = localStorage.getItem('gaple_tournamentState');
      if (savedTourney) {
        const parsed = JSON.parse(savedTourney);
        if (parsed && parsed.id && Array.isArray(parsed.players) && parsed.players.length > 0) {
          tournamentState = parsed;
          tourneySelectedSize = parsed.players.length;
        }
      }
    } catch (e) {
      console.warn('Gagal membaca gaple_tournamentState:', e);
    }

    // Fetch turnamen terbaru dari server secara persisten
    const tourneyIdToFetch = (tournamentState && tournamentState.id) || activeTourneyId;
    if (tourneyIdToFetch) {
      fetch(`/api/tournaments/${tourneyIdToFetch}`)
        .then(r => r.ok ? r.json() : null)
        .then(t => {
          if (t && t.id && Array.isArray(t.players) && t.players.length > 0) {
            tournamentState = t;
            tourneySelectedSize = t.players.length;
            saveTournamentStateLocalOnly();
            if (document.getElementById('page-tournament') && document.getElementById('page-tournament').classList.contains('active')) {
              renderTournamentView();
            }
          } else if (tournamentState && tournamentState.id) {
            saveTournamentState();
          }
        })
        .catch(() => {
          if (tournamentState && tournamentState.id) {
            saveTournamentState();
          }
        });
    }

    if (savedPage === 'tournament') {
      if (!tournamentState) initTournamentData();
      renderTournamentView();
      showPage('tournament');
    } else if (savedPage === 'dashboard' && state.currentGame && state.currentGame.status === 'active') {
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

    startTournamentAutoSync();
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
  showToast('Permainan dimulai! ');
}

// ─────────────────────────────────────────────
// DASHBOARD & NAVIGATION SAFETY
// ─────────────────────────────────────────────
let pendingBackAction = null;

function syncTournamentOngoingGame(g) {
  if (!g || !g.isTournamentMatch || !g.tournamentContext || !tournamentState) return;
  const { mode, roundIdx, tableIdx } = g.tournamentContext;
  
  if (mode === 'roundrobin' && tournamentState.rrMatches) {
    const match = tournamentState.rrMatches.find(m => m.roundIdx === roundIdx && m.tableIdx === tableIdx);
    if (match) match.ongoingGame = JSON.parse(JSON.stringify(g));
  } else if (tournamentState.rounds && tournamentState.rounds[roundIdx]) {
    const tbl = tournamentState.rounds[roundIdx].tables[tableIdx];
    if (tbl) tbl.ongoingGame = JSON.parse(JSON.stringify(g));
  }
  saveTournamentStateLocalOnly();

  // Hitung skor sementara per pemain dari game yang sedang berjalan
  const currentScoresObj = {};
  g.players.forEach((p, pIdx) => {
    let pId = null;
    if (mode === 'roundrobin' && tournamentState.rrMatches) {
      const match = tournamentState.rrMatches.find(m => m.roundIdx === roundIdx && m.tableIdx === tableIdx);
      pId = match && match.playerIds ? match.playerIds[pIdx] : null;
    } else if (tournamentState.rounds && tournamentState.rounds[roundIdx]) {
      const tbl = tournamentState.rounds[roundIdx].tables[tableIdx];
      pId = tbl && tbl.playerIds ? tbl.playerIds[pIdx] : null;
    }
    if (pId !== null && pId !== undefined) {
      currentScoresObj[pId] = p.total;
    }
  });

  // Kirim update skor berjalan ke server secara real-time
  syncTournamentTableScore(roundIdx, tableIdx, {
    scores: currentScoresObj,
    isDone: false,
    ongoingGame: g
  });
}

function handleDashboardBack() {
  const g = state.currentGame;
  if (!g) {
    showPage('home');
    return;
  }

  // Jika game masih berlangsung (status active)
  if (g.status === 'active') {
    pendingBackAction = () => {
      saveState();
      if (g.isTournamentMatch) {
        syncTournamentOngoingGame(g);
        showPage('tournament');
        renderTournamentView();
        showToast('Progres pertandingan meja tersimpan aman ✓');
      } else {
        showPage('home');
        showToast('Permainan tersimpan. Anda dapat melanjutkannya kapan saja ✓');
      }
    };

    const titleEl = document.getElementById('confirm-back-title');
    const msgEl = document.getElementById('confirm-back-message');
    if (titleEl) titleEl.textContent = 'Pertandingan Sedang Berlangsung';
    if (msgEl) msgEl.textContent = 'Pertandingan sedang berlangsung. Apakah Anda yakin ingin kembali? Data skor dan progres ronde akan tetap tersimpan aman.';
    openModal('modal-confirm-back');
  } else {
    // Jika game sudah selesai
    if (g.isTournamentMatch) {
      showPage('tournament');
      renderTournamentView();
    } else {
      showPage('home');
    }
  }
}

function handleTournamentBack() {
  if (tournamentState) {
    const hasProgress = (tournamentState.mode === 'roundrobin')
      ? (tournamentState.rrMatches && tournamentState.rrMatches.some(m => m.status === 'completed' || m.ongoingGame))
      : (tournamentState.rounds && tournamentState.rounds.some(r => r.tables.some(t => t.isDone || t.ongoingGame)));

    if (hasProgress) {
      pendingBackAction = () => {
        saveTournamentState();
        showPage('home');
        showToast('Turnamen tersimpan aman.');
      };

      const titleEl = document.getElementById('confirm-back-title');
      const msgEl = document.getElementById('confirm-back-message');
      if (titleEl) titleEl.textContent = 'Turnamen Sedang Berlangsung';
      if (msgEl) msgEl.textContent = 'Turnamen sedang berlangsung. Apakah Anda yakin ingin kembali ke menu utama? Seluruh bagan dan skor turnamen akan tetap tersimpan.';
      openModal('modal-confirm-back');
      return;
    }
  }

  showPage('home');
}

function executeConfirmedBack() {
  closeModal('modal-confirm-back');
  if (typeof pendingBackAction === 'function') {
    const action = pendingBackAction;
    pendingBackAction = null;
    action();
  }
}

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
  const tourneyFinishBtn = document.getElementById('btn-finish-tourney-match');

  if (g.status === 'done') {
    inputSection.classList.add('hidden');
  } else {
    inputSection.classList.remove('hidden');
    titleEl.textContent = `Tambah Skor Ronde ${g.rounds.length + 1}`;
    renderScoreInputs('score-inputs');

    // Toggle finish tournament button if playing tournament match
    if (tourneyFinishBtn) {
      if (g.isTournamentMatch) {
        tourneyFinishBtn.classList.remove('hidden');
      } else {
        tourneyFinishBtn.classList.add('hidden');
      }
    }
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
  const idx15 = latestRound.scores.indexOf(-15);
  return idx15 !== -1 ? idx15 : latestRound.scores.indexOf(-10);
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

    const dealerBadge = isDealer ? `<span class="dealer-badge-sm" title="Pengocok Kartu (Ngocok)"> NGOCOK</span>` : '';
    const firstBadge = isFirst ? `<span class="first-badge-sm" title="Jalan Duluan"> Jalan Duluan</span>` : '';

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
      const idx15 = prevRound.scores.indexOf(-15);
      firstPlayerIdx = idx15 !== -1 ? idx15 : prevRound.scores.indexOf(-10);
      gaplePlayerIdx = prevRound.scores.indexOf(-20);
      gapleCardVal = prevRound.gapleCard;
    }
  }

  g.players.forEach((p, i) => {
    const isDealer = i === dealerIdx;
    const isFirst = i === firstPlayerIdx;

    const dealerBadge = isDealer ? `<span class="dealer-badge" title="Pengocok Kartu (Ngocok)"> NGOCOK</span>` : '';
    const firstBadge = isFirst ? `<span class="first-badge" title="Jalan Duluan"> Jalan Duluan</span>` : '';

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

  const allZero = scores.every(s => s === 0);
  if (!hasAnyInput && !allZero) {
    showToast('Masukkan setidaknya satu skor!');
    return;
  }

  // Check if anyone scored -20 (Gaple) or all scores are 0
  const hasGaple = scores.includes(-20) || allZero;
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
  if (g.isTournamentMatch) {
    syncTournamentOngoingGame(g);
  }
  renderDashboard();

  if (scores) {
    triggerAppreciationIfNeeded(scores);
  }

  // Check win condition
  checkGameOver();

  // Beritahu jika ada yang dapat -15 atau -10 (jalan duluan)
  const lastRound = g.rounds[g.rounds.length - 1];
  let firstPlayerIdx = -1;
  if (lastRound) {
    const idx15 = lastRound.scores.indexOf(-15);
    firstPlayerIdx = idx15 !== -1 ? idx15 : lastRound.scores.indexOf(-10);
  }

  if (firstPlayerIdx !== -1) {
    const winnerName = g.players[firstPlayerIdx].name;
    const scoreVal = lastRound.scores[firstPlayerIdx];
    showToast(` ${winnerName} dapat ${scoreVal}! Ronde berikutnya jalan duluan `, 4000);
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

  const btnBackTourney = document.getElementById('btn-back-tournament');
  if (btnBackTourney) {
    if (g.isTournamentMatch) {
      btnBackTourney.classList.remove('hidden');
      const isRR = g.tournamentContext && g.tournamentContext.mode === 'roundrobin';
      btnBackTourney.textContent = isRR ? ' Simpan & Kembali ke Klasemen' : ' Simpan & Kembali ke Bagan Turnamen';
    } else {
      btnBackTourney.classList.add('hidden');
    }
  }

  const winner = [...g.players].sort((a, b) => a.total - b.total)[0];
  document.getElementById('gameover-subtitle').textContent =
    ` ${winner.name} menang dengan ${winner.total} poin terkecil!`;

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

  // Render Gelar & Julukan Pertandingan
  const titlesStatsEl = document.getElementById('gameover-titles-stats');
  const titlesListEl = document.getElementById('gameover-titles-list');
  if (titlesStatsEl && titlesListEl) {
    titlesListEl.innerHTML = '';
    const titlesMap = calculatePlayerTitles(g);
    const awardedPlayerIdxs = Object.keys(titlesMap);

    if (awardedPlayerIdxs.length > 0) {
      titlesStatsEl.classList.remove('hidden');
      awardedPlayerIdxs.forEach(playerIdxStr => {
        const pIdx = parseInt(playerIdxStr, 10);
        const player = g.players[pIdx];
        const titleObj = titlesMap[pIdx];
        if (player && titleObj) {
          const row = document.createElement('div');
          row.className = 'go-lb-item';
          row.innerHTML = `
            <div class="go-lb-name" style="display: inline-flex; align-items: center; gap: 0.5rem;">
              ${renderPlayerBadgeHTML(player, 'sm', { showTitle: false })}
            </div>
            <div class="go-lb-score">
              <span class="player-title-tag ${titleObj.class}" style="font-size: 0.8rem; padding: 0.2rem 0.55rem;">${titleObj.label}</span>
            </div>
          `;
          titlesListEl.appendChild(row);
        }
      });
    } else {
      titlesStatsEl.classList.add('hidden');
    }
  }

  // Render Gaple Momen Stats
  const gapleStatsEl = document.getElementById('gameover-gaple-stats');
  const gapleListEl = document.getElementById('gameover-gaple-list');
  gapleListEl.innerHTML = '';

  const gapleRounds = [];
  g.rounds.forEach((r, roundIdx) => {
    if (r.gapleCard) {
      const playerIdx = r.scores.indexOf(-20);
      gapleRounds.push({
        roundNum: roundIdx + 1,
        player: playerIdx !== -1 ? g.players[playerIdx] : null,
        card: r.gapleCard
      });
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
          Ronde ${gr.roundNum}: ${gr.player ? renderPlayerBadgeHTML(gr.player, 'sm') : 'Semua Skor 0'}
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
  if (g.isTournamentMatch) {
    syncTournamentOngoingGame(g);
  }
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
  if (g.isTournamentMatch) {
    syncTournamentOngoingGame(g);
  }
  renderDashboard();
  showToast('Penghapusan dibatalkan ✓');
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

let pendingEditRoundScores = null;

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

  pendingEditRoundScores = scores;
  openModal('modal-confirm-edit-round');
}

function executeConfirmedEditRound() {
  closeModal('modal-confirm-edit-round');
  const g = state.currentGame;
  if (!g || state.editingRoundIndex === null || !pendingEditRoundScores) return;

  const scores = pendingEditRoundScores;
  pendingEditRoundScores = null;

  // Check if anyone scored -20 (Gaple) or all scores are 0
  const allZero = scores.every(s => s === 0);
  const hasGaple = scores.includes(-20) || allZero;
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
  if (state.currentGame && state.currentGame.isTournamentMatch) {
    syncTournamentOngoingGame(state.currentGame);
  }
  closeModal('modal-edit');
  renderDashboard();
  if (scores) {
    triggerAppreciationIfNeeded(scores);
  }
  showToast('Perubahan skor ronde berhasil diperbarui dan disinkronkan! ✓');
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

  const btnResume = document.getElementById('btn-resume-history');
  if (btnResume) {
    const maxScore = Math.max(...game.players.map(p => p.total), 0);
    const isLocal = state.allGames.some(ag => ag.id === game.id);
    if (isLocal && maxScore < 100) {
      btnResume.style.display = 'inline-flex';
    } else {
      btnResume.style.display = 'none';
    }
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
  const medals = ['1', '2', '3'];
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
      } else {
        gapleEvents.push(`• Ronde ${idx + 1}: Semua Skor 0 (Balak ${r.gapleCard})`);
      }
    }
  });

  if (gapleEvents.length > 0) {
    text += `MOMEN GAPLE :\n`;
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
          showToast('Belum ada permainan online sebelumnya ');
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
      showToast('Belum ada permainan lokal sebelumnya ');
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
  showToast('Semua data berhasil direset! ');

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
  const medals = ['1', '2', '3'];
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
      } else {
        gapleEvents.push(`• Ronde ${idx + 1}: Semua Skor 0 (Balak ${r.gapleCard})`);
      }
    }
  });

  if (gapleEvents.length > 0) {
    text += `MOMEN GAPLE :\n`;
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
  if (document.body.classList.contains('lite-mode')) return;
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

  let message = 'TANGGUH SEKALI! ';
  if (score === -30) {
    message = 'DUNG TAK DUNG DUNG WAWWWW! ';
  } else if (score === -25) {
    message = 'GACORRRR KINGGGG GAPLE! ';
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
        LANJUT 
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const sparklesContainer = overlay.querySelector('#appreciation-sparkles-container');
  if (sparklesContainer && !document.body.classList.contains('lite-mode')) {
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
        showToast(`Pemain ${p.name} terputus dari permainan! `);
      }
    }
  });

  socket.on('errorMsg', (msg) => {
    showToast(msg);
  });

  // ─────────────────────────────────────────────
  // SHARED TOURNAMENT REAL-TIME LISTENERS
  // ─────────────────────────────────────────────
  socket.on('connect', () => {
    updateTournamentConnectionStatus(true);
    flushTournamentOfflineQueue();
    ensureTournamentRoomJoined();
  });

  socket.on('disconnect', () => {
    updateTournamentConnectionStatus(false);
  });

  // Menerima pembaruan skor meja dari juri / perangkat lain secara real-time
  socket.on('tournament:tableUpdated', ({ tournamentId, tournament, payload }) => {
    const curId = (tournamentState && tournamentState.id) || localStorage.getItem('gaple_activeTournamentId');
    if (tournament && (!curId || isSameTournament(curId, tournamentId) || isSameTournament(tournament.id, curId))) {
      console.log('[Turnamen Sync Realtime] Menerima update meja:', payload);
      
      const isMyActiveTable = state.currentGame && state.currentGame.isTournamentMatch &&
        state.currentGame.tournamentContext &&
        state.currentGame.tournamentContext.roundIdx === (payload && payload.roundIdx) &&
        state.currentGame.tournamentContext.tableIdx === (payload && payload.tableIdx);

      tournamentState = tournament;
      if (tournament.players) {
        tourneySelectedSize = tournament.players.length;
      }
      saveTournamentStateLocalOnly();
      renderTournamentView();

      if (!isMyActiveTable && payload) {
        const judgeInfo = payload.judgeName ? ` oleh ${payload.judgeName}` : '';
        const roundInfo = payload.roundIdx !== undefined ? `Babak ${payload.roundIdx + 1} ` : '';
        showToast(`${roundInfo}Meja ${payload.tableIdx + 1} diperbarui${judgeInfo}! ⚡`, 2500);
      }
    }
  });

  // Menerima sinkronisasi menyeluruh dari server (Perubahan Nama, Bagan, dll.)
  socket.on('tournament:stateSynced', ({ tournament }) => {
    const curId = (tournamentState && tournamentState.id) || localStorage.getItem('gaple_activeTournamentId');
    if (tournament && (!curId || isSameTournament(curId, tournament.id))) {
      console.log('[Turnamen Sync Realtime] Sinkronisasi data menyeluruh:', tournament.id);
      tournamentState = tournament;
      if (tournament.players) {
        tourneySelectedSize = tournament.players.length;
      }
      saveTournamentStateLocalOnly();
      renderTournamentView();
      showToast('Data turnamen diperbarui secara real-time ✓', 2000);
    }
  });

  // Menerima event reset turnamen dari Host
  socket.on('tournament:reset', ({ tournament }) => {
    const curId = (tournamentState && tournamentState.id) || localStorage.getItem('gaple_activeTournamentId');
    if (tournament && (!curId || isSameTournament(curId, tournament.id))) {
      console.log('[Turnamen Sync Realtime] Reset turnamen:', tournament.id);
      tournamentState = tournament;
      if (tournament.players) {
        tourneySelectedSize = tournament.players.length;
      }
      saveTournamentStateLocalOnly();
      renderTournamentView();
      showToast('Turnamen telah di-reset ke kondisi awal oleh Host! 🔄', 3000);
    }
  });

  socket.on('tournament:userJoined', ({ judgeName, role }) => {
    showToast(`🟢 ${judgeName} (${role}) terhubung ke turnamen`, 2500);
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
      const hostTag = isHost ? `<span class="dealer-badge" style="background: var(--accent-gold); color: #1A1C1E; font-size: 0.65rem; border: 1.5px solid #1A1C1E; box-shadow: 1px 1px 0px #000; padding: 2px 4px; font-weight: bold; text-transform: uppercase;"> HOST</span>` : '';
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
      ${isBottomActive ? '<div style="font-family: var(--font-title); font-size: 0.5rem; color: var(--accent-gold); margin-bottom: 2px; text-shadow: 1px 1px 0px #000; animation: retroFloat 1.2s ease-in-out infinite;"> GILIRAN KAMU</div>' : ''}
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
  const typeLabel = roundLog.type === 'gaple' ? 'GAPLE!' : (roundLog.type === 'gacor' ? 'GACOR! ' : (roundLog.type === 'dung_tak' ? 'DUNG TAK! ' : 'MENANG!'));
  
  outcome.innerHTML = ` ${roundLog.winnerName} ${typeLabel}`;

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
    showToast('GACORRRR KINGGGG! ');
  } else if (roundLog.type === 'dung_tak') {
    showToast('DUNG TAK DUNG DUNG WAWWWW! ');
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

  // Simpan data game over online agar bisa diakses untuk berbagi ke WhatsApp
  state.onlineGameOverData = { players, rounds, leaderboard };

  const winner = leaderboard[0];
  document.getElementById('gameover-subtitle').textContent = ` ${winner.name} menang dengan ${winner.total} poin terkecil!`;

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

  // Render Gelar & Julukan Pertandingan (Online)
  const titlesStatsEl = document.getElementById('gameover-titles-stats');
  const titlesListEl = document.getElementById('gameover-titles-list');
  if (titlesStatsEl && titlesListEl) {
    titlesListEl.innerHTML = '';
    const mockGameObj = { players, rounds };
    const titlesMap = calculatePlayerTitles(mockGameObj);
    const awardedPlayerIdxs = Object.keys(titlesMap);

    if (awardedPlayerIdxs.length > 0) {
      titlesStatsEl.classList.remove('hidden');
      awardedPlayerIdxs.forEach(playerIdxStr => {
        const pIdx = parseInt(playerIdxStr, 10);
        const player = players[pIdx];
        const titleObj = titlesMap[pIdx];
        if (player && titleObj) {
          const row = document.createElement('div');
          row.className = 'go-lb-item';
          row.innerHTML = `
            <div class="go-lb-name" style="display: inline-flex; align-items: center; gap: 0.5rem;">
              ${renderPlayerBadgeHTML(player, 'sm', { showTitle: false, game: mockGameObj })}
            </div>
            <div class="go-lb-score">
              <span class="player-title-tag ${titleObj.class}" style="font-size: 0.8rem; padding: 0.2rem 0.55rem;">${titleObj.label}</span>
            </div>
          `;
          titlesListEl.appendChild(row);
        }
      });
    } else {
      titlesStatsEl.classList.add('hidden');
    }
  }

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
  showToast(isMuted ? 'Suara dimatikan ' : 'Suara diaktifkan ');
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

// ─────────────────────────────────────────────
// WHATSAPP SHARE FUNCTION (BAGIKAN KEMENANGAN)
// ─────────────────────────────────────────────
function shareGameToWhatsApp() {
  const leaderboardItems = document.querySelectorAll('#gameover-leaderboard .go-lb-item');
  if (leaderboardItems.length === 0) {
    showToast('Data permainan tidak ditemukan!');
    return;
  }

  let leaderboardText = '';
  let highestScore = -Infinity;
  let biggestLoser = '';
  let firstPlacePlayer = '';

  leaderboardItems.forEach((item, index) => {
    const rank = index + 1;
    const nameElement = item.querySelector('.player-name-text');
    const name = nameElement ? nameElement.textContent.trim() : `Pemain ${rank}`;
    const scoreElement = item.querySelector('.go-lb-score');
    const score = scoreElement ? parseInt(scoreElement.textContent.trim(), 10) : 0;

    let medal = '';
    if (rank === 1) {
      medal = '1';
      firstPlacePlayer = name;
    } else if (rank === 2) {
      medal = '2';
    } else if (rank === 3) {
      medal = '3';
    } else {
      medal = '';
    }

    leaderboardText += `${medal} *Rank ${rank}: ${name}* — ${score} poin\n`;

    if (score > highestScore) {
      highestScore = score;
      biggestLoser = name;
    }
  });

  // Cari momen spesial (-30 Dung Tak, -25 Gacor, -20 Gaple)
  let specialMoments = [];
  const g = state.currentGame;
  let roundsData = [];
  let playersData = [];

  if (g && g.rounds) {
    roundsData = g.rounds;
    playersData = g.players;
  } else if (state.onlineGameOverData && state.onlineGameOverData.rounds) {
    roundsData = state.onlineGameOverData.rounds;
    playersData = state.onlineGameOverData.players;
  }

  if (roundsData.length > 0) {
    roundsData.forEach((r, roundIdx) => {
      const hasNeg20 = r.scores.includes(-20);
      if (r.gapleCard && !hasNeg20 && r.scores.every(s => s === 0)) {
        specialMoments.push(` *Ronde ${roundIdx + 1}:* Momen *Gaple (Semua Skor 0)* dengan *Balak ${r.gapleCard}!* `);
      }
      r.scores.forEach((score, playerIdx) => {
        if (playersData[playerIdx]) {
          const playerName = playersData[playerIdx].name;
          if (score === -30) {
            specialMoments.push(` *Ronde ${roundIdx + 1}: ${playerName}* menang telak *Dung Tak (-30 poin)!* `);
          } else if (score === -25) {
            specialMoments.push(` *Ronde ${roundIdx + 1}: ${playerName}* menang *Gacor (-25 poin)!* `);
          } else if (score === -20) {
            specialMoments.push(` *Ronde ${roundIdx + 1}: ${playerName}* menang *Gaple (-20 poin)!* `);
          }
        }
      });
    });
  }

  // Susun pesan WhatsApp
  let message = ` *GAPLE SCORE TRACKER* \n`;
  message += `_Permainan selesai! Berikut adalah hasil akhirnya:_\n\n`;
  message += leaderboardText + `\n`;

  if (biggestLoser) {
    message += ` *Beban Game:* *${biggestLoser}* dengan skor *${highestScore} poin*! \n\n`;
  }

  if (specialMoments.length > 0) {
    message += ` *Momen Spektakuler:* \n` + specialMoments.join('\n') + `\n\n`;
  } else {
    message += ` Selamat untuk *${firstPlacePlayer}* atas kemenangannya!\n\n`;
  }

  message += `_Dicatat otomatis menggunakan Gaple Score Tracker._ `;

  const encodedText = encodeURIComponent(message);
  const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  window.open(waUrl, '_blank');
}

function resumeHistoryGame() {
  const game = state.viewingHistoryGame;
  if (!game) return;

  const maxScore = Math.max(...game.players.map(p => p.total), 0);
  if (maxScore >= 100) {
    showToast('Game ini tidak bisa dilanjutkan karena skor sudah mencapai 100 atau lebih.');
    return;
  }

  // Ask confirmation if there's already an active local game
  if (state.currentGame && state.currentGame.status === 'active') {
    if (!confirm('Game yang sedang berlangsung akan diarsipkan (status: Selesai). Anda yakin ingin melanjutkan game ini?')) {
      return;
    }
    // Archive current game
    const current = state.currentGame;
    current.status = 'done';
    const existing = state.allGames.findIndex(ag => ag.id === current.id);
    if (existing >= 0) {
      state.allGames[existing] = { ...current };
    } else {
      state.allGames.unshift({ ...current });
    }
  }

  // Resume the selected game
  const resumedGame = { ...game };
  resumedGame.status = 'active';
  state.currentGame = resumedGame;

  // Remove from state.allGames because it is now active
  state.allGames = state.allGames.filter(ag => ag.id !== resumedGame.id);

  saveState();
  closeModal('modal-history-detail');

  try {
    renderHistoryListPage();
  } catch (e) {
    console.warn(e);
  }

  // Check if we also need to close the main history page
  // The user might be viewing history or home page
  renderDashboard();
  showPage('dashboard');
  showToast('Melanjutkan permainan... ');
}

// ─────────────────────────────────────────────
// TURNAMEN KEMERDEKAAN (17 AGUSTUS) — 16 PESERTA ENGINE
// ─────────────────────────────────────────────

const PRESET_17_PLAYERS = [
  { id: 1, name: 'Pak RT Tejo', avatar: 'fox', color: '#FF5252' },
  { id: 2, name: 'Bang Jago', avatar: 'tiger', color: '#448AFF' },
  { id: 3, name: 'Pak RW Bambang', avatar: 'lion', color: '#FFD740' },
  { id: 4, name: 'Mas Merdeka', avatar: 'cat', color: '#69F0AE' },
  { id: 5, name: 'Cak Lontong', avatar: 'monkey', color: '#E040FB' },
  { id: 6, name: 'Mbah Jiwo', avatar: 'panda', color: '#00E5FF' },
  { id: 7, name: 'Pak Lurah', avatar: 'pig', color: '#FF9100' },
  { id: 8, name: 'Kapten Merdeka', avatar: 'chicken', color: '#FF4081' },
  { id: 9, name: 'Pak Kadus', avatar: 'koala', color: '#FF5252' },
  { id: 10, name: 'Mang Ujang', avatar: 'frog', color: '#448AFF' },
  { id: 11, name: 'Bang Pitung', avatar: 'tiger', color: '#FFD740' },
  { id: 12, name: 'Srikandi', avatar: 'fox', color: '#E040FB' },
  { id: 13, name: 'Pejuang Gaple', avatar: 'cat', color: '#69F0AE' },
  { id: 14, name: 'Jawara RT', avatar: 'lion', color: '#00E5FF' },
  { id: 15, name: 'Si Pitung', avatar: 'monkey', color: '#FF9100' },
  { id: 16, name: 'Kang Agus', avatar: 'panda', color: '#FF4081' }
];

let tournamentState = null;
let tourneySelectedSize = 16;
let roundRobinRoundsCount = 3;

// ─────────────────────────────────────────────
// TOURNAMENT BRACKET ENGINE — Universal Algorithm (Knockout)
// ─────────────────────────────────────────────

function computeBracketRounds(N) {
  if (N <= 4) {
    return [{
      name: 'Final',
      isFinal: true,
      numTables: 1,
      qCount: 4,
      numByes: 0,
      inputCount: 4,
      outputCount: null
    }];
  }

  const stages = [];
  let cur = N;

  while (cur > 4) {
    const numTables = Math.floor(cur / 4);
    // Pola baku Knockout Gaple: Setiap meja 4 pemain, tepat 2 pemain terbaik lolos (q=2), tanpa BYE
    const q = 2;
    const nextCount = numTables * q;

    stages.push({
      numTables,
      qCount: q,
      numByes: 0,
      inputCount: cur,
      outputCount: nextCount
    });

    cur = nextCount;
  }

  const totalRounds = stages.length + 1; // + 1 untuk Babak Final
  const rounds = stages.map((cfg, idx) => {
    let name = '';
    const roundsFromFinal = totalRounds - 1 - idx;
    if (roundsFromFinal === 1) {
      name = 'Semifinal';
    } else if (roundsFromFinal === 2) {
      name = (totalRounds === 3) ? 'Babak Penyisihan' : 'Perempatfinal';
    } else {
      name = `Babak Penyisihan ${idx + 1}`;
    }

    return {
      name,
      isFinal: false,
      numTables: cfg.numTables,
      qCount: cfg.qCount,
      numByes: 0,
      inputCount: cfg.inputCount,
      outputCount: cfg.outputCount
    };
  });

  rounds.push({
    name: 'Final',
    isFinal: true,
    numTables: 1,
    qCount: 4,
    numByes: 0,
    inputCount: 4,
    outputCount: null
  });

  return rounds;
}

function makeTournamentTable(id, label, playerIds) {
  return {
    id,
    name: label,
    playerIds: playerIds || [],
    scores: {},
    winnerIds: [],
    status: 'pending'
  };
}

function initTournamentData(forceReset = false, customPlayerCount = null, targetMode = null) {
  if (!forceReset) {
    try {
      const saved = localStorage.getItem('gaple_tournamentState');
      if (saved) {
        tournamentState = JSON.parse(saved);
        if (tournamentState && tournamentState.players) {
          tourneySelectedSize = tournamentState.players.length;
        }
        if (tournamentState && tournamentState.mode === 'roundrobin' && tournamentState.rrConfig) {
          roundRobinRoundsCount = tournamentState.rrConfig.roundsCount || 3;
        }
        if (tournamentState && tournamentState.stages && !tournamentState.rounds) {
          console.warn('Old tournament format detected, resetting...');
          tournamentState = null;
          localStorage.removeItem('gaple_tournamentState');
        } else {
          return;
        }
      }
    } catch (e) {
      console.warn('Gagal membaca gaple_tournamentState:', e);
    }
  }

  const currentMode = targetMode || (tournamentState ? tournamentState.mode : 'knockout') || 'knockout';
  const N = customPlayerCount || tourneySelectedSize || 16;
  tourneySelectedSize = N;


  // Build players list
  const players = [];
  for (let i = 0; i < N; i++) {
    const avatarIdx = i % DEFAULT_AVATARS.length;
    const colorIdx = i % DEFAULT_COLORS.length;
    players.push({
      id: i + 1,
      name: `Nama Pemain ${i + 1}`,
      avatar: DEFAULT_AVATARS[avatarIdx],
      color: DEFAULT_COLORS[colorIdx]
    });
  }

  const tourneyId = (tournamentState && tournamentState.id) ? tournamentState.id : generateRandomTourneyIdString();

  if (currentMode === 'roundrobin') {
    // Round Robin Mode
    const rrMatches = generateRoundRobinMatches(players, roundRobinRoundsCount);
    tournamentState = {
      id: tourneyId,
      name: 'Turnamen Round Robin Gaple',
      mode: 'roundrobin',
      players,
      rrConfig: {
        roundsCount: roundRobinRoundsCount,
        playerCount: N
      },
      rrMatches,
      activeTab: 'standings',
      winners: { juara1: null, juara2: null, juara3: null, juara4: null }
    };
  } else {
    // Knockout Bracket Mode
    const bracketConfigs = computeBracketRounds(N);
    const firstCfg = bracketConfigs[0];
    const firstByeIds = players.slice(firstCfg.numTables * 4).map(p => p.id);
    const firstActiveIds = players.slice(0, firstCfg.numTables * 4).map(p => p.id);

    const rounds = bracketConfigs.map((cfg, roundIdx) => {
      let tables = [];
      if (roundIdx === 0) {
        for (let t = 0; t < cfg.numTables; t++) {
          const label = cfg.name === 'Final' ? 'Meja Final '
            : cfg.name === 'Semifinal' ? `Meja Semifinal ${t + 1}`
            : `Meja ${t + 1}`;
          tables.push(makeTournamentTable(t + 1, label, firstActiveIds.slice(t * 4, (t + 1) * 4)));
        }
      } else {
        for (let t = 0; t < cfg.numTables; t++) {
          const label = cfg.isFinal ? 'Meja Final '
            : cfg.name === 'Semifinal' ? `Meja Semifinal ${t + 1}`
            : `Meja ${cfg.name} ${t + 1}`;
          tables.push(makeTournamentTable(t + 1, label, []));
        }
      }

      return {
        key: roundIdx === bracketConfigs.length - 1 ? 'final' : `round_${roundIdx}`,
        name: cfg.name,
        isFinal: cfg.isFinal,
        numTables: cfg.numTables,
        qCount: cfg.qCount,
        numByes: cfg.numByes,
        tables,
        byePlayerIds: roundIdx === 0 ? firstByeIds : []
      };
    });

    tournamentState = {
      id: tourneyId,
      name: 'Turnamen Knockout Gaple',
      mode: 'knockout',
      players,
      rounds,
      currentRoundIndex: 0,
      winners: { juara1: null, juara2: null, juara3: null, juara4: null }
    };
  }

  saveTournamentState();
}

/**
 * Generate fixtures for Round Robin tournaments:
 * - Aturan Gaple: Setiap 1 meja HARUS tepat 4 pemain (tidak boleh kurang).
 * - Jika jumlah total peserta N bukan kelipatan 4 (misal: 5, 6, 7, 9, 10, 13, 14, 15, 17):
 *   Jumlah meja bermain = Math.floor(N / 4).
 *   Sisa pemain (N % 4) mendapatkan giliran istirahat (Bye) yang berotasi adil & merata setiap babak.
 */
function generateRoundRobinMatches(players, totalRounds = 3) {
  const matches = [];
  const N = players.length;
  if (N < 4) return matches;

  const numTables = Math.floor(N / 4);
  const byesCount = N % 4;

  // Langkah rotasi: jika ada bye, geser sebesar byesCount agar pemain yang istirahat bergantian adil setiap babak.
  // Jika kelipatan 4 (tanpa bye), geser 3 agar variasi lawan di meja selalu berbeda.
  const shiftStep = byesCount > 0 ? byesCount : 3;

  for (let r = 0; r < totalRounds; r++) {
    const rotatedPlayers = [];
    for (let i = 0; i < N; i++) {
      const offsetIdx = (i + (r * shiftStep)) % N;
      rotatedPlayers.push(players[offsetIdx]);
    }

    // Pemain yang bermain di babak ini (tepat 4 pemain per meja)
    const activePlayers = rotatedPlayers.slice(0, numTables * 4);
    // Pemain yang mendapat giliran istirahat pada babak ini
    const byePlayers = rotatedPlayers.slice(numTables * 4);

    for (let t = 0; t < numTables; t++) {
      const tablePlayers = activePlayers.slice(t * 4, (t + 1) * 4);
      matches.push({
        id: `rr_r${r}_t${t}`,
        roundIdx: r,
        tableIdx: t,
        name: `Babak ${r + 1} • Meja ${t + 1}`,
        playerIds: tablePlayers.map(p => p.id),
        byePlayerIds: byePlayers.map(p => p.id),
        scores: {},
        winnerIds: [],
        status: 'pending'
      });
    }
  }

  return matches;
}

// ─────────────────────────────────────────────
// SHARED MULTI-DEVICE TOURNAMENT SYNC & STORAGE
// ─────────────────────────────────────────────
let currentJudgeName = localStorage.getItem('gaple_judgeName') || 'Laptop Server';
let currentJudgeRole = localStorage.getItem('gaple_judgeRole') || 'host';
let tournamentOfflineQueue = [];

function updateTournamentConnectionStatus(isConnected) {
  const statusEl = document.getElementById('tourney-connection-status');
  const textEl = document.getElementById('tourney-conn-text');
  if (!statusEl || !textEl) return;

  if (isConnected) {
    statusEl.style.background = 'rgba(0, 230, 118, 0.15)';
    statusEl.style.borderColor = '#00E676';
    statusEl.style.color = '#00E676';
    textEl.textContent = 'Live Server';
    const dot = statusEl.querySelector('span');
    if (dot) dot.style.background = '#00E676';
  } else {
    statusEl.style.background = 'rgba(255, 145, 0, 0.15)';
    statusEl.style.borderColor = '#FF9100';
    statusEl.style.color = '#FF9100';
    textEl.textContent = 'Offline (Tersimpan)';
    const dot = statusEl.querySelector('span');
    if (dot) dot.style.background = '#FF9100';
  }
}

function updateTournamentIdDisplay() {
  const idEl = document.getElementById('tourney-shared-id-display');
  const judgeEl = document.getElementById('tourney-judge-name-display');
  const judgeBadge = document.getElementById('tourney-judge-badge');
  const hostToolbar = document.getElementById('tournament-host-toolbar');
  const changeModeBtn = document.querySelector('.btn-tourney-change-mode');

  const isJudge = currentJudgeRole === 'judge';

  if (idEl) {
    idEl.textContent = (tournamentState && tournamentState.id) ? tournamentState.id : 'GAPLE-001';
  }
  if (judgeEl) {
    const roleLabel = isJudge ? '(Juri Meja)' : '(Host/Admin)';
    judgeEl.textContent = `${currentJudgeName || 'Laptop Server'} ${roleLabel}`;
  }
  if (judgeBadge) {
    if (isJudge) {
      judgeBadge.style.background = 'rgba(68, 138, 255, 0.15)';
      judgeBadge.style.borderColor = '#448AFF';
      judgeBadge.style.color = '#448AFF';
    } else {
      judgeBadge.style.background = 'rgba(255, 23, 68, 0.15)';
      judgeBadge.style.borderColor = '#FF1744';
      judgeBadge.style.color = '#FF1744';
    }
  }

  // Pembatasan akses Juri vs Host pada UI
  if (hostToolbar) {
    hostToolbar.style.display = isJudge ? 'none' : 'flex';
  }
  if (changeModeBtn) {
    changeModeBtn.style.display = isJudge ? 'none' : 'inline-flex';
  }
}

function copyTournamentId() {
  const id = (tournamentState && tournamentState.id) ? tournamentState.id : 'GAPLE-001';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(id).then(() => {
      showToast(`ID Turnamen "${id}" disalin ke clipboard! Bagikan ke juri lain.`);
    }).catch(() => {
      showToast(`ID Turnamen: ${id}`);
    });
  } else {
    showToast(`ID Turnamen: ${id}`);
  }
}

function isSameTournament(idA, idB) {
  if (!idA && !idB) return true;
  if (!idA || !idB) return false;
  return String(idA).trim().toUpperCase() === String(idB).trim().toUpperCase();
}

let tourneySyncTimer = null;
let lastTourneyJson = '';

function startTournamentAutoSync() {
  if (tourneySyncTimer) clearInterval(tourneySyncTimer);
  
  tourneySyncTimer = setInterval(() => {
    const activeTourneyId = (tournamentState && tournamentState.id) || localStorage.getItem('gaple_activeTournamentId');
    if (!activeTourneyId) return;

    fetch(`/api/tournaments/${activeTourneyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(t => {
        if (!t || !t.id) return;
        const currentJson = JSON.stringify(t);
        if (currentJson !== lastTourneyJson) {
          console.log('[Auto-Sync Live] Perubahan server terdeteksi, merefresh tampilan turnamen secara otomatis!');
          lastTourneyJson = currentJson;
          tournamentState = t;
          if (t.players) {
            tourneySelectedSize = t.players.length;
          }
          saveTournamentStateLocalOnly();
          if (document.getElementById('page-tournament') && document.getElementById('page-tournament').classList.contains('active')) {
            renderTournamentView();
          }
        }
      })
      .catch(() => {});
  }, 1500);
}

function ensureTournamentRoomJoined() {
  const activeTourneyId = (tournamentState && tournamentState.id) || localStorage.getItem('gaple_activeTournamentId');
  if (activeTourneyId && socket && socket.connected) {
    socket.emit('tournament:join', {
      tournamentId: activeTourneyId,
      role: currentJudgeRole || 'host',
      judgeName: currentJudgeName || (currentJudgeRole === 'host' ? 'Laptop Server' : 'Juri')
    }, (res) => {
      if (res && res.success && res.tournament) {
        tournamentState = res.tournament;
        if (tournamentState.players) {
          tourneySelectedSize = tournamentState.players.length;
        }
        saveTournamentStateLocalOnly();
        if (document.getElementById('page-tournament') && document.getElementById('page-tournament').classList.contains('active')) {
          renderTournamentView();
        }
      }
    });
  }
}

function saveTournamentStateLocalOnly() {
  try {
    if (tournamentState && tournamentState.id) {
      tournamentState.id = String(tournamentState.id).trim().toUpperCase();
      localStorage.setItem('gaple_activeTournamentId', tournamentState.id);
      localStorage.setItem('gaple_tournamentState', JSON.stringify(tournamentState));
      updateTournamentIdDisplay();
    }
  } catch (e) {
    console.warn('Gagal menyimpan local tournamentState:', e);
  }
}

function saveTournamentState() {
  saveTournamentStateLocalOnly();

  if (tournamentState && tournamentState.id) {
    const role = currentJudgeRole || 'host';
    if (role === 'judge') return; // Juri tidak boleh menimpa konfigurasi turnamen secara utuh

    // 1. Simpan ke database server secara persisten (REST API)
    fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...tournamentState, role: 'host' })
    }).then(r => r.json()).then(res => {
      updateTournamentConnectionStatus(true);
    }).catch(err => {
      console.warn('POST /api/tournaments gagal:', err);
    });

    // 2. Broadcast ke semua perangkat via WebSocket
    if (socket && socket.connected) {
      socket.emit('tournament:create', { ...tournamentState, role: 'host' }, (res) => {
        if (res && res.success) {
          updateTournamentConnectionStatus(true);
        }
      });
    }
  }
}

function syncTournamentTableScore(roundIdx, tableIdx, payload) {
  if (!tournamentState || !tournamentState.id) return;
  const data = {
    tournamentId: tournamentState.id,
    payload: {
      mode: tournamentState.mode,
      roundIdx,
      tableIdx,
      scores: payload.scores,
      isDone: payload.isDone,
      ongoingGame: payload.ongoingGame,
      judgeName: currentJudgeName
    }
  };

  if (socket && socket.connected) {
    socket.emit('tournament:updateTable', data, (res) => {
      if (res && res.success) {
        updateTournamentConnectionStatus(true);
      }
    });
  } else {
    fetch(`/api/tournaments/${tournamentState.id}/table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.payload)
    }).then(r => r.json()).then(res => {
      updateTournamentConnectionStatus(true);
    }).catch(err => {
      updateTournamentConnectionStatus(false);
      queueTournamentOfflineAction({ type: 'updateTable', data });
    });
  }
}

function syncTournamentOngoingGame(game) {
  if (!game || !game.isTournamentMatch || !game.tournamentContext || !tournamentState) return;
  const { mode, roundIdx, tableIdx } = game.tournamentContext;
  
  const scoresObj = {};
  if (mode === 'roundrobin') {
    const match = tournamentState.rrMatches ? tournamentState.rrMatches.find(m => m.roundIdx === roundIdx && m.tableIdx === tableIdx) : null;
    if (match) {
      match.ongoingGame = game;
      if (Array.isArray(match.playerIds)) {
        match.playerIds.forEach((pId, idx) => {
          scoresObj[pId] = game.players[idx] ? game.players[idx].total : 0;
        });
      }
    }
  } else {
    const round = tournamentState.rounds ? tournamentState.rounds[roundIdx] : null;
    const tbl = round && round.tables ? round.tables[tableIdx] : null;
    if (tbl) {
      tbl.ongoingGame = game;
      if (Array.isArray(tbl.playerIds)) {
        tbl.playerIds.forEach((pId, idx) => {
          scoresObj[pId] = game.players[idx] ? game.players[idx].total : 0;
        });
      }
    }
  }

  saveTournamentStateLocalOnly();
  syncTournamentTableScore(roundIdx, tableIdx, {
    scores: scoresObj,
    isDone: false,
    ongoingGame: game
  });
}

function queueTournamentOfflineAction(action) {
  tournamentOfflineQueue.push({ ...action, timestamp: Date.now() });
  try {
    localStorage.setItem('gaple_tourneyOfflineQueue', JSON.stringify(tournamentOfflineQueue));
  } catch (e) { }
}

function flushTournamentOfflineQueue() {
  try {
    const saved = localStorage.getItem('gaple_tourneyOfflineQueue');
    if (saved) {
      tournamentOfflineQueue = JSON.parse(saved);
    }
  } catch (e) { }

  if (!tournamentOfflineQueue || tournamentOfflineQueue.length === 0) return;

  const queue = [...tournamentOfflineQueue];
  tournamentOfflineQueue = [];
  localStorage.removeItem('gaple_tourneyOfflineQueue');

  queue.forEach(item => {
    if (item.type === 'updateTable') {
      if (socket && socket.connected) {
        socket.emit('tournament:updateTable', item.data);
      }
    } else if (item.type === 'syncTournament') {
      if (socket && socket.connected) {
        socket.emit('tournament:syncState', { tournamentId: item.data.id, tournamentData: item.data });
      }
    }
  });
}

function openTournamentConnectModal() {
  const hostIdInput = document.getElementById('input-host-tourney-id');
  const hostJudgeInput = document.getElementById('input-host-judge-name');
  const joinIdInput = document.getElementById('input-join-tourney-id');
  const joinJudgeInput = document.getElementById('input-join-judge-name');

  const activeId = (tournamentState && tournamentState.id) ? tournamentState.id : (localStorage.getItem('gaple_activeTournamentId') || '');
  const savedJudgeName = localStorage.getItem('gaple_judgeName') || currentJudgeName || '';

  if (hostIdInput) {
    hostIdInput.value = activeId || generateRandomTourneyIdString();
  }
  if (hostJudgeInput) {
    hostJudgeInput.value = (currentJudgeRole === 'host' && savedJudgeName) ? savedJudgeName : 'Laptop Server';
  }
  if (joinIdInput && activeId) {
    joinIdInput.value = activeId;
  }
  if (joinJudgeInput) {
    joinJudgeInput.value = (currentJudgeRole === 'judge' && savedJudgeName) ? savedJudgeName : '';
  }
  openModal('modal-tournament-connect');
}

function switchTourneyConnectTab(tab) {
  const hostBtn = document.getElementById('btn-tab-host-tourney');
  const joinBtn = document.getElementById('btn-tab-join-tourney');
  const hostContent = document.getElementById('tab-content-host-tourney');
  const joinContent = document.getElementById('tab-content-join-tourney');

  if (tab === 'host') {
    hostBtn.className = 'btn btn-sm btn-primary';
    hostBtn.style.background = '#FF1744';
    joinBtn.className = 'btn btn-sm btn-outline';
    joinBtn.style.background = 'transparent';
    hostContent.classList.remove('hidden');
    joinContent.classList.add('hidden');
  } else {
    joinBtn.className = 'btn btn-sm btn-primary';
    joinBtn.style.background = '#448AFF';
    hostBtn.className = 'btn btn-sm btn-outline';
    hostBtn.style.background = 'transparent';
    joinContent.classList.remove('hidden');
    hostContent.classList.add('hidden');
  }
}

function generateRandomTourneyIdString() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 6; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

function generateRandomTourneyId() {
  const hostIdInput = document.getElementById('input-host-tourney-id');
  if (hostIdInput) {
    hostIdInput.value = generateRandomTourneyIdString();
  }
}

function handleTournamentBack() {
  openTournamentLeaveModal();
}

function openTournamentLeaveModal() {
  openModal('modal-tournament-leave-confirm');
}

function executeLeaveTournament() {
  const activeTourneyId = (tournamentState && tournamentState.id) || localStorage.getItem('gaple_activeTournamentId');
  if (socket && socket.connected && activeTourneyId) {
    socket.emit('tournament:leave', {
      tournamentId: activeTourneyId,
      judgeName: currentJudgeName,
      role: currentJudgeRole
    });
  }

  if (tourneySyncTimer) {
    clearInterval(tourneySyncTimer);
    tourneySyncTimer = null;
  }

  localStorage.removeItem('gaple_activeTournamentId');
  localStorage.removeItem('gaple_tournamentState');
  localStorage.removeItem('gaple_judgeName');
  localStorage.removeItem('gaple_judgeRole');
  localStorage.setItem('gaple_activePage', 'home');

  tournamentState = null;
  currentJudgeRole = 'host';
  currentJudgeName = 'Laptop Server';

  closeModal('modal-tournament-leave-confirm');
  showPage('home');
  showToast('Anda telah keluar dari turnamen. 👋', 3000);
}

function executeHostTournament() {
  const hostIdInput = document.getElementById('input-host-tourney-id');
  const hostJudgeInput = document.getElementById('input-host-judge-name');

  const tourneyId = (hostIdInput && hostIdInput.value.trim()) ? hostIdInput.value.trim().toUpperCase() : generateRandomTourneyIdString();
  currentJudgeName = (hostJudgeInput && hostJudgeInput.value.trim()) ? hostJudgeInput.value.trim() : 'Laptop Server';
  currentJudgeRole = 'host';

  localStorage.setItem('gaple_judgeName', currentJudgeName);
  localStorage.setItem('gaple_judgeRole', currentJudgeRole);

  if (!tournamentState) {
    initTournamentData(true);
  }
  tournamentState.id = tourneyId;

  saveTournamentState();
  updateTournamentIdDisplay();
  closeModal('modal-tournament-connect');
  renderTournamentView();
  showToast(`Turnamen aktif dengan ID: ${tourneyId}! Bagikan ke juri lain.`);
}

function executeJoinTournament() {
  const joinIdInput = document.getElementById('input-join-tourney-id');
  const joinJudgeInput = document.getElementById('input-join-judge-name');

  const tourneyId = joinIdInput ? joinIdInput.value.trim().toUpperCase() : '';
  if (!tourneyId) {
    showToast('Silakan masukkan Tournament ID');
    if (joinIdInput) joinIdInput.focus();
    return;
  }

  const judgeName = joinJudgeInput ? joinJudgeInput.value.trim() : '';
  if (!judgeName) {
    showToast('Silakan masukkan Nama Juri / Meja Tugas Anda!');
    if (joinJudgeInput) joinJudgeInput.focus();
    return;
  }

  currentJudgeName = judgeName;
  currentJudgeRole = 'judge';
  localStorage.setItem('gaple_judgeName', currentJudgeName);
  localStorage.setItem('gaple_judgeRole', currentJudgeRole);

  showToast(`Menghubungkan ke turnamen ${tourneyId}...`);

  if (socket && socket.connected) {
    socket.emit('tournament:join', {
      tournamentId: tourneyId,
      role: 'judge',
      judgeName: currentJudgeName
    }, (res) => {
      if (res && res.success && res.tournament) {
        tournamentState = res.tournament;
        saveTournamentStateLocalOnly();
        updateTournamentIdDisplay();
        updateTournamentConnectionStatus(true);
        closeModal('modal-tournament-connect');
        renderTournamentView();
        showPage('tournament');
        showToast(`Terhubung ke turnamen ${tourneyId}! Selamat bertugas, ${currentJudgeName}! ✓`);
      } else {
        fetchFallbackJoin(tourneyId);
      }
    });
  } else {
    fetchFallbackJoin(tourneyId);
  }
}

function fetchFallbackJoin(tourneyId) {
  fetch(`/api/tournaments/${tourneyId}`)
    .then(r => {
      if (!r.ok) throw new Error('Turnamen tidak ditemukan di server');
      return r.json();
    })
    .then(t => {
      tournamentState = t;
      saveTournamentStateLocalOnly();
      updateTournamentIdDisplay();
      updateTournamentConnectionStatus(true);
      closeModal('modal-tournament-connect');
      renderTournamentView();
      showPage('tournament');
      showToast(`Berhasil bergabung ke turnamen ${tourneyId}!`);
    })
    .catch(err => {
      showToast(err.message || 'Gagal terhubung ke turnamen di server.');
    });
}

function openTournamentMode() {
  if (!tournamentState) {
    openTournamentModeSelectionModal();
  } else {
    renderTournamentView();
    showPage('tournament');
  }
}

function openTournamentModeSelectionModal() {
  if (currentJudgeRole === 'judge') {
    showToast('Akses Ditolak: Hanya Host yang dapat mengubah format turnamen.');
    return;
  }
  openModal('modal-tournament-mode-select');
}

function selectTournamentMode(mode) {
  if (currentJudgeRole === 'judge') {
    showToast('Akses Ditolak: Hanya Host yang dapat mengubah format turnamen.');
    return;
  }
  closeModal('modal-tournament-mode-select');
  const size = tourneySelectedSize || 16;
  initTournamentData(true, size, mode);
  renderTournamentView();
  showPage('tournament');
  const modeName = mode === 'roundrobin' ? 'Round Robin (Pengumpulan Poin)' : 'Knockout System (Eliminasi)';
  showToast(`Mode Turnamen: ${modeName} diaktifkan! `);
}

function autofillTournamentPlayers() {
  const currentMode = tournamentState ? tournamentState.mode : 'knockout';
  initTournamentData(true, tourneySelectedSize, currentMode);
  renderTournamentView();
  showToast(`${tourneySelectedSize} Peserta telah diisi otomatis! `);
}

function selectTournamentSizePreset(size) {
  tourneySelectedSize = size;
  const countEl = document.getElementById('tourney-player-count-display');
  if (countEl) countEl.textContent = size;
  
  document.querySelectorAll('.tourney-preset-btn').forEach(btn => {
    if (btn.textContent.trim().startsWith(size + ' ')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderTournamentSetupInputs(size);
}

function changeTournamentPlayerCount(delta) {
  const isKnockout = !tournamentState || tournamentState.mode === 'knockout';
  if (isKnockout) {
    const validSizes = [4, 8, 16, 32, 64];
    let curIdx = validSizes.indexOf(tourneySelectedSize);
    if (curIdx === -1) {
      curIdx = validSizes.findIndex(s => s >= tourneySelectedSize);
      if (curIdx === -1) curIdx = validSizes.length - 1;
    }
    const nextIdx = Math.max(0, Math.min(validSizes.length - 1, curIdx + delta));
    tourneySelectedSize = validSizes[nextIdx];
  } else {
    tourneySelectedSize = Math.max(4, Math.min(32, tourneySelectedSize + delta));
  }

  const countEl = document.getElementById('tourney-player-count-display');
  if (countEl) countEl.textContent = tourneySelectedSize;

  document.querySelectorAll('.tourney-preset-btn').forEach(btn => {
    if (btn.textContent.trim().startsWith(tourneySelectedSize + ' ')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderTournamentSetupInputs(tourneySelectedSize);
}

function selectRoundRobinRoundsCount(rounds) {
  roundRobinRoundsCount = Number(rounds) || 3;
  document.querySelectorAll('.rr-round-count-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`rr-rounds-btn-${rounds}`);
  if (activeBtn) activeBtn.classList.add('active');

  const infoEl = document.getElementById('rr-selected-rounds-info');
  if (infoEl) {
    infoEl.innerHTML = `✓ Terpilih: <b>${rounds} Babak</b>`;
  }
}

function randomizeTournamentSeeding() {
  if (currentJudgeRole === 'judge') {
    showToast('Akses Ditolak: Hanya Host yang dapat mengacak susunan meja.');
    return;
  }

  if (!tournamentState) initTournamentData();
  
  const shuffledPlayers = [...tournamentState.players];
  for (let i = shuffledPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
  }

  const count = shuffledPlayers.length;
  const currentMode = tournamentState.mode || 'knockout';
  initTournamentData(true, count, currentMode);

  shuffledPlayers.forEach((p, i) => {
    if (tournamentState.players[i]) {
      tournamentState.players[i].name = p.name;
      tournamentState.players[i].avatar = p.avatar;
      tournamentState.players[i].color = p.color;
    }
  });

  saveTournamentState();
  renderTournamentView();
  showToast(`${count} Pemain berhasil diacak! `);
}

function openTournamentResetModal() {
  if (currentJudgeRole === 'judge') {
    showToast('Akses Ditolak: Hanya Host yang dapat melakukan Reset Turnamen.');
    return;
  }
  openModal('modal-tournament-reset-confirm');
}

function executeResetTournament() {
  if (currentJudgeRole === 'judge') {
    showToast('Akses Ditolak: Hanya Host yang dapat melakukan Reset Turnamen.');
    closeModal('modal-tournament-reset-confirm');
    return;
  }

  const currentCount = (tournamentState && tournamentState.players) ? tournamentState.players.length : (tourneySelectedSize || 16);
  const currentMode = (tournamentState && tournamentState.mode) ? tournamentState.mode : 'knockout';
  const tourneyId = (tournamentState && tournamentState.id) ? tournamentState.id : generateRandomTourneyIdString();
  const savedPlayers = (tournamentState && tournamentState.players) ? [...tournamentState.players] : null;

  // 1. Reset state lokal secara instan
  initTournamentData(true, currentCount, currentMode);
  tournamentState.id = tourneyId;

  // Pertahankan nama-nama pemain yang sudah diisi
  if (savedPlayers && savedPlayers.length === tournamentState.players.length) {
    tournamentState.players = savedPlayers;
    if (tournamentState.mode === 'knockout' && tournamentState.rounds && tournamentState.rounds[0]) {
      const firstRound = tournamentState.rounds[0];
      const bracketConfigs = computeBracketRounds(currentCount);
      const firstCfg = bracketConfigs[0];
      const firstActiveIds = savedPlayers.slice(0, firstCfg.numTables * 4).map(p => p.id);
      const firstByeIds = savedPlayers.slice(firstCfg.numTables * 4).map(p => p.id);

      firstRound.tables.forEach((tbl, tIdx) => {
        tbl.playerIds = firstActiveIds.slice(tIdx * 4, (tIdx + 1) * 4);
      });
      firstRound.byePlayerIds = firstByeIds;
    } else if (tournamentState.mode === 'roundrobin') {
      tournamentState.rrMatches = generateRoundRobinMatches(savedPlayers, roundRobinRoundsCount);
    }
  }

  saveTournamentStateLocalOnly();
  closeModal('modal-tournament-reset-confirm');
  renderTournamentView();

  // 2. Simpan dan broadcast ke server
  saveTournamentState();

  if (socket && socket.connected) {
    socket.emit('tournament:reset', { tournamentId: tourneyId, role: 'host' }, (res) => {
      if (res && res.success && res.tournament) {
        tournamentState = res.tournament;
        saveTournamentStateLocalOnly();
        renderTournamentView();
      }
    });
  } else {
    fetch(`/api/tournaments/${tourneyId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'host' })
    }).then(r => r.json()).catch(() => {});
  }

  showToast('Seluruh data skor dan progres turnamen berhasil direset ke awal! 🔄');
}

function openTournamentSetupModal() {
  if (currentJudgeRole === 'judge') {
    showToast('Akses Ditolak: Hanya Host yang dapat mengatur peserta turnamen.');
    return;
  }

  if (!tournamentState) initTournamentData();
  const count = tournamentState.players.length;
  tourneySelectedSize = count;
  const countEl = document.getElementById('tourney-player-count-display');
  if (countEl) countEl.textContent = count;

  const isRR = tournamentState.mode === 'roundrobin';
  const presetContainer = document.getElementById('tourney-preset-buttons-container');
  if (presetContainer) {
    const presets = isRR ? [4, 6, 8, 12, 16] : [4, 8, 16, 32, 64];
    presetContainer.innerHTML = presets.map(p => `
      <button class="btn btn-sm btn-outline tourney-preset-btn ${p === count ? 'active' : ''}" onclick="selectTournamentSizePreset(${p})">${p} Peserta</button>
    `).join('');
  }

  const rrOptions = document.getElementById('rr-setup-options-container');
  const subtitle = document.getElementById('tourney-setup-subtitle');

  if (rrOptions) {
    if (isRR) {
      rrOptions.classList.remove('hidden');
      const curRounds = (tournamentState.rrConfig && tournamentState.rrConfig.roundsCount) ? tournamentState.rrConfig.roundsCount : roundRobinRoundsCount;
      selectRoundRobinRoundsCount(curRounds);
      if (subtitle) subtitle.textContent = 'Atur peserta & jumlah babak untuk Turnamen Round Robin.';
    } else {
      rrOptions.classList.add('hidden');
      if (subtitle) subtitle.textContent = 'Pilih format peserta kelipatan 4 (4, 8, 16, 32, 64) tanpa sistem BYE.';
    }
  }

  renderTournamentSetupInputs(count);
  openModal('modal-tournament-setup');
}

function renderTournamentSetupInputs(count) {
  const grid = document.getElementById('tournament-player-inputs-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const existingPlayers = tournamentState ? tournamentState.players : [];

  for (let i = 0; i < count; i++) {
    const existing = existingPlayers[i];
    const avatarKey = existing ? existing.avatar : DEFAULT_AVATARS[i % DEFAULT_AVATARS.length];
    const avatarColor = existing ? existing.color : DEFAULT_COLORS[i % DEFAULT_COLORS.length];

    // Jika pemain sudah punya nama khusus, isi ke value input
    let inputValue = '';
    if (existing && existing.name && !existing.name.startsWith('Nama Pemain ')) {
      inputValue = existing.name.trim();
    }

    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '0.75rem';
    item.style.width = '100%';
    item.style.marginBottom = '0.25rem';

    item.innerHTML = `
      <span style="font-family: var(--font-title); font-size: 0.95rem; font-weight: bold; width: 22px; color: #94A3B8; text-align: center;">${i + 1}</span>
      <div style="width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background-color: ${avatarColor}; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.35); border: 1.5px solid rgba(255,255,255,0.15);">
        ${getPixelArtSVG(avatarKey, 26)}
      </div>
      <input 
        id="tourney-player-input-${i}" 
        class="form-input" 
        type="text" 
        placeholder="Nama Pemain ${i + 1}" 
        value="${escapeHtml(inputValue)}" 
        maxlength="20" 
        autocomplete="off"
        style="flex: 1; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.04); border: 1.5px solid rgba(255,255,255,0.1); color: #FFFFFF; font-size: 0.95rem; padding: 0 1rem;" 
      />
    `;
    grid.appendChild(item);
  }
}

function saveTournamentSetupNames() {
  if (currentJudgeRole === 'judge') {
    showToast('Akses Ditolak: Hanya Host yang dapat mengubah nama peserta.');
    closeModal('modal-tournament-setup');
    return;
  }

  const count = tourneySelectedSize || 16;
  const currentMode = (tournamentState && tournamentState.mode) ? tournamentState.mode : 'knockout';
  const tourneyId = (tournamentState && tournamentState.id) ? tournamentState.id : generateRandomTourneyIdString();
  const existingPlayers = (tournamentState && tournamentState.players) ? tournamentState.players : [];

  const newPlayers = [];
  for (let i = 0; i < count; i++) {
    const el = document.getElementById(`tourney-player-input-${i}`);
    const typedName = el ? el.value.trim() : '';
    const defaultName = `Nama Pemain ${i + 1}`;
    const existingP = existingPlayers[i];
    newPlayers.push({
      id: i + 1,
      name: typedName || (existingP && existingP.name && !existingP.name.startsWith('Nama Pemain ') ? existingP.name : defaultName),
      avatar: existingP ? existingP.avatar : DEFAULT_AVATARS[i % DEFAULT_AVATARS.length],
      color: existingP ? existingP.color : DEFAULT_COLORS[i % DEFAULT_COLORS.length]
    });
  }

  if (currentMode === 'roundrobin') {
    const rrMatches = generateRoundRobinMatches(newPlayers, roundRobinRoundsCount);
    tournamentState = {
      id: tourneyId,
      name: 'Turnamen Round Robin Gaple',
      mode: 'roundrobin',
      players: newPlayers,
      rrConfig: {
        roundsCount: roundRobinRoundsCount,
        playerCount: count
      },
      rrMatches,
      activeTab: 'standings',
      winners: { juara1: null, juara2: null, juara3: null, juara4: null }
    };
  } else {
    const bracketConfigs = computeBracketRounds(count);
    const firstCfg = bracketConfigs[0];
    const firstActiveIds = newPlayers.slice(0, firstCfg.numTables * 4).map(p => p.id);
    const firstByeIds = newPlayers.slice(firstCfg.numTables * 4).map(p => p.id);

    const rounds = bracketConfigs.map((cfg, roundIdx) => {
      let tables = [];
      if (roundIdx === 0) {
        for (let t = 0; t < cfg.numTables; t++) {
          const label = cfg.name === 'Final' ? 'Meja Final '
            : cfg.name === 'Semifinal' ? `Meja Semifinal ${t + 1}`
            : `Meja ${t + 1}`;
          tables.push(makeTournamentTable(t + 1, label, firstActiveIds.slice(t * 4, (t + 1) * 4)));
        }
      } else {
        for (let t = 0; t < cfg.numTables; t++) {
          const label = cfg.isFinal ? 'Meja Final '
            : cfg.name === 'Semifinal' ? `Meja Semifinal ${t + 1}`
            : `Meja ${cfg.name} ${t + 1}`;
          tables.push(makeTournamentTable(t + 1, label, []));
        }
      }

      return {
        key: roundIdx === bracketConfigs.length - 1 ? 'final' : `round_${roundIdx}`,
        name: cfg.name,
        isFinal: cfg.isFinal,
        numTables: cfg.numTables,
        qCount: cfg.qCount,
        numByes: cfg.numByes,
        tables,
        byePlayerIds: roundIdx === 0 ? firstByeIds : []
      };
    });

    tournamentState = {
      id: tourneyId,
      name: 'Turnamen Knockout Gaple',
      mode: 'knockout',
      players: newPlayers,
      rounds,
      currentRoundIndex: 0,
      winners: { juara1: null, juara2: null, juara3: null, juara4: null }
    };
  }

  // SIMPAN SECARA UTUH KE LOCALSTORAGE DAN KE DISK SERVER
  saveTournamentState();

  closeModal('modal-tournament-setup');
  renderTournamentView();
  showToast(`Perubahan ${count} peserta berhasil disimpan ke server! ✓`);
}

function getTournamentPlayerObj(id) {
  if (!tournamentState) return null;
  return tournamentState.players.find(p => p.id === id) || null;
}

// Master Render Function for Tournament
function renderTournamentView() {
  if (!tournamentState) initTournamentData();
  const st = tournamentState;

  // Update Shared Tournament Info & ID Display
  updateTournamentIdDisplay();

  // Update Header Mode Indicator
  const modeBadge = document.getElementById('tourney-mode-indicator');
  if (modeBadge) {
    if (st.mode === 'roundrobin') {
      modeBadge.textContent = 'ROUND ROBIN (POIN)';
      modeBadge.className = 'stage-badge stage-badge-gold';
    } else {
      modeBadge.textContent = 'KNOCKOUT SYSTEM';
      modeBadge.className = 'stage-badge stage-badge-red';
    }
  }

  const bracketView = document.getElementById('tournament-bracket-view');
  const rrView = document.getElementById('tournament-roundrobin-view');

  if (st.mode === 'roundrobin') {
    if (bracketView) bracketView.classList.add('hidden');
    if (rrView) rrView.classList.remove('hidden');
    renderRoundRobinView();
  } else {
    if (rrView) rrView.classList.add('hidden');
    if (bracketView) bracketView.classList.remove('hidden');
    renderTournamentBracket();
  }
}

// ─────────────────────────────────────────────
// KNOCKOUT BRACKET RENDERER
// ─────────────────────────────────────────────
function renderTournamentBracket() {
  if (!tournamentState) initTournamentData();
  const container = document.getElementById('tournament-bracket-view');
  if (!container) return;

  const st = tournamentState;
  const currentRoundIdx = st.currentRoundIndex;
  let stagesHtml = '';

  const stageBadgeColors = [
    'stage-badge-red', 'stage-badge-orange', 'stage-badge-gold',
    'stage-badge-green', 'stage-badge-blue', 'stage-badge-purple'
  ];

  st.rounds.forEach((round, roundIdx) => {
    const isCurrentRound = (currentRoundIdx !== 'completed') && (roundIdx === currentRoundIdx);
    const isPastRound = (currentRoundIdx === 'completed') || (typeof currentRoundIdx === 'number' && roundIdx < currentRoundIdx);

    // BYE banner for this round
    let roundByeBannerHtml = '';
    if (round.byePlayerIds && round.byePlayerIds.length > 0) {
      const byeNames = round.byePlayerIds.map(id => {
        const p = getTournamentPlayerObj(id);
        return p ? escapeHtml(p.name) : '';
      }).filter(Boolean).join(', ');

      roundByeBannerHtml = `
        <div style="background: linear-gradient(90deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05)); border: 1px solid #FFD740; border-radius: 10px; padding: 0.6rem 0.9rem; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFD740" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/><path d="M13 5v2"/><path d="M13 17v2"/></svg>
            <span style="font-family: var(--font-pixel); font-size: 0.7rem; color: #FFD740; font-weight: bold;">BYE — Lolos Langsung ke ${round.name}:</span>
            <span style="font-size: 0.8rem; color: #FFF; font-weight: bold;">${byeNames}</span>
          </div>
          <span class="stage-badge stage-badge-gold" style="font-size: 0.65rem;">Langsung Lolos ✓</span>
        </div>
      `;
    }

    // Connector (skip before first round)
    if (roundIdx > 0) {
      const connectorLabel = round.isFinal ? 'Final 4 Orang'
        : round.name.includes('Semifinal') ? 'Babak Semifinal'
        : round.name;
      stagesHtml += `
        <div class="bracket-connector">
          <div class="connector-line"></div>
          <div class="connector-badge">${connectorLabel}</div>
          <div class="connector-line"></div>
        </div>
      `;
    }

    // Stage header
    const badgeClass = round.isFinal ? 'stage-badge-crown'
      : stageBadgeColors[roundIdx % stageBadgeColors.length];
    const badgeLabel = round.isFinal ? 'GRAND FINAL'
      : `BABAK ${roundIdx + 1}`;
    const tableSub = round.isFinal
      ? 'Perebutan Juara 1, 2, 3'
      : `${round.numTables} Meja • Ambil ${round.qCount} Terbaik tiap meja${round.numByes > 0 ? ` • ${round.numByes} Peserta BYE` : ''}`;

    const gridClass = round.isFinal ? 'stage-1-table'
      : round.numTables <= 2 ? 'stage-2-tables'
      : round.numTables <= 4 ? 'stage-4-tables'
      : 'stage-many-tables';

    const wrapClass = round.isFinal ? 'stage-final-wrap' : '';

    stagesHtml += `
      <div class="bracket-stage ${wrapClass}">
        <div class="bracket-stage-header">
          <span class="stage-badge ${badgeClass}">${badgeLabel}</span>
          <h3 class="stage-title">${round.isFinal ? 'Meja Final (4 Finalis)' : round.name}</h3>
          <p class="stage-sub">${tableSub}</p>
        </div>
        ${roundByeBannerHtml}
        <div class="stage-tables-grid ${gridClass}">
          ${round.tables.map((tbl, tIdx) => renderTableCardHTML(roundIdx, tIdx, tbl, round)).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = `<div class="tournament-bracket">${stagesHtml}</div>`;

  if (currentRoundIdx === 'completed' && st.winners && st.winners.juara1) {
    renderPodiumCards();
  }
}

function renderTableCardHTML(roundIdx, tableIdx, tableObj, roundObj) {
  if (!roundObj) {
    roundObj = tournamentState && tournamentState.rounds ? tournamentState.rounds[roundIdx] : null;
  }
  const currentIdx = tournamentState ? tournamentState.currentRoundIndex : 0;
  const isCurrentStage = (currentIdx !== 'completed') && (roundIdx === currentIdx);
  const isDone = tableObj.status === 'completed';
  
  let statusBadgeHtml = '<span class="table-status-pill table-status-pending">Belum Main</span>';
  if (isDone) {
    statusBadgeHtml = '<span class="table-status-pill table-status-done" style="display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Selesai</span>';
  } else if (isCurrentStage && tableObj.playerIds.length === 4) {
    statusBadgeHtml = '<span class="table-status-pill table-status-active" style="display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Siap Main</span>';
  }

  let slotsHtml = '';
  for (let i = 0; i < 4; i++) {
    const pId = tableObj.playerIds[i];
    const player = getTournamentPlayerObj(pId);
    
    if (!player) {
      slotsHtml += `
        <div class="bracket-player-slot" style="opacity: 0.4;">
          <div class="bracket-player-info">
            <span style="font-size: 0.75rem; color: #888;">— Slot Pembuka —</span>
          </div>
          <span class="bracket-player-score">—</span>
        </div>
      `;
    } else {
      const isWinner = isDone && tableObj.winnerIds.includes(player.id);
      let slotClass = '';
      let badgeTag = '';

      const isFinalRound = roundObj && roundObj.isFinal;
      if (isFinalRound && isDone) {
        if (tableObj.winnerIds[0] === player.id) {
          slotClass = 'champion-1';
          badgeTag = '<span style="color:#FFD740;">Juara 1 👑</span>';
        } else if (tableObj.winnerIds[1] === player.id) {
          slotClass = 'champion-2';
          badgeTag = '<span style="color:#C0C0C0;">Juara 2 🥈</span>';
        } else if (tableObj.winnerIds[2] === player.id) {
          slotClass = 'champion-3';
          badgeTag = '<span style="color:#CD7F32;">Juara 3 🥉</span>';
        } else if (tableObj.winnerIds[3] === player.id) {
          slotClass = '';
          badgeTag = '<span style="color:#94A3B8;">Peringkat 4</span>';
        }
      } else if (isWinner) {
        slotClass = 'qualified';
        badgeTag = '<span style="color:#69F0AE; font-weight: bold;">Lolos (2 Terbaik) ✓</span>';
      }

      const scoreVal = isDone && tableObj.scores[player.id] !== undefined ? tableObj.scores[player.id] : '';

      slotsHtml += `
        <div class="bracket-player-slot ${slotClass}">
          <div class="bracket-player-info">
            ${renderPlayerBadgeHTML(player, 'sm', { showTitle: false })}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${badgeTag ? `<span style="font-size: 0.65rem; font-weight: bold;">${badgeTag}</span>` : ''}
            <span class="bracket-player-score">${scoreVal !== '' ? scoreVal + ' Poin' : ''}</span>
          </div>
        </div>
      `;
    }
  }

  let actionBtnsHtml = '';
  const has4Players = tableObj.playerIds && tableObj.playerIds.filter(Boolean).length === 4;
  const isOngoing = tableObj.ongoingGame && tableObj.ongoingGame.status === 'active';

  if (!isDone && isCurrentStage && has4Players) {
    const btnLabel = isOngoing ? 'Lanjutkan / Koreksi Skor' : 'Catat Skor Meja';
    const btnBg = isOngoing ? 'linear-gradient(135deg, #FF9100 0%, #FF6D00 100%)' : '#FF1744';
    actionBtnsHtml = `
      <div class="bracket-action-btns">
        <button class="btn btn-sm btn-primary" style="flex: 1; font-family: var(--font-pixel); background: ${btnBg}; display: inline-flex; align-items: center; justify-content: center; gap: 6px;" onclick="startTournamentTableMatch(${roundIdx}, ${tableIdx})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          ${btnLabel}
        </button>
      </div>
    `;
  } else if (isDone && isCurrentStage) {
    // Tombol koreksi jika masih di babak aktif sebelum dikunci
    actionBtnsHtml = `
      <div class="bracket-action-btns">
        <button class="btn btn-sm btn-outline" style="flex: 1; font-family: var(--font-pixel); border-color: rgba(255, 215, 0, 0.5); color: #FFD740; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255, 215, 0, 0.08);" onclick="startTournamentTableMatch(${roundIdx}, ${tableIdx})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Koreksi Skor
        </button>
      </div>
    `;
  }

  return `
    <div class="bracket-table-card ${isCurrentStage ? 'active-stage' : ''} ${isDone ? 'completed' : ''}">
      <div class="table-card-header">
        <span class="table-card-title">${escapeHtml(tableObj.name)}</span>
        ${statusBadgeHtml}
      </div>
      <div class="bracket-players-list">
        ${slotsHtml}
      </div>
      ${actionBtnsHtml}
    </div>
  `;
}

// ─────────────────────────────────────────────
// ROUND ROBIN (PENGUMPULAN POIN) RENDERER
// ─────────────────────────────────────────────
function switchRoundRobinTab(tabName) {
  const standingsBtn = document.getElementById('rr-tab-btn-standings');
  const fixturesBtn = document.getElementById('rr-tab-btn-fixtures');
  const standingsPanel = document.getElementById('rr-panel-standings');
  const fixturesPanel = document.getElementById('rr-panel-fixtures');

  if (tabName === 'fixtures') {
    if (standingsBtn) standingsBtn.classList.remove('active');
    if (fixturesBtn) fixturesBtn.classList.add('active');
    if (standingsPanel) standingsPanel.classList.add('hidden');
    if (fixturesPanel) fixturesPanel.classList.remove('hidden');
  } else {
    if (fixturesBtn) fixturesBtn.classList.remove('active');
    if (standingsBtn) standingsBtn.classList.add('active');
    if (fixturesPanel) fixturesPanel.classList.add('hidden');
    if (standingsPanel) standingsPanel.classList.remove('hidden');
  }

  if (tournamentState) {
    tournamentState.activeTab = tabName;
  }
}

function calculateRoundRobinStandings() {
  if (!tournamentState || !tournamentState.players) return [];

  const playersMap = {};
  tournamentState.players.forEach(p => {
    playersMap[p.id] = {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      matchesPlayed: 0,
      matchesWon: 0,
      totalPoints: 0,
      avgPoints: '0.0',
      avgPointsNum: 0
    };
  });

  const matches = tournamentState.rrMatches || [];
  matches.forEach(m => {
    if (m.status === 'completed' && m.scores) {
      m.playerIds.forEach(pId => {
        if (playersMap[pId]) {
          playersMap[pId].matchesPlayed++;
          const pScore = m.scores[pId] !== undefined ? m.scores[pId] : 0;
          playersMap[pId].totalPoints += pScore;
        }
      });

      if (m.winnerIds && m.winnerIds.length > 0) {
        const winId = m.winnerIds[0];
        if (playersMap[winId]) {
          playersMap[winId].matchesWon++;
        }
      }
    }
  });

  const standingsList = Object.values(playersMap).map(p => {
    const avg = p.matchesPlayed > 0 ? (p.totalPoints / p.matchesPlayed) : 0;
    p.avgPointsNum = avg;
    p.avgPoints = avg.toFixed(1);
    return p;
  });

  // Urutan Klasemen Paling Adil:
  // 1. Peserta yang sudah bermain di atas yang belum main
  // 2. Rata-Rata Poin terkecil (poin sisa/hukuman terendah per game = Top 1)
  // 3. Kemenangan Pertandingan terbanyak (matchesWon)
  // 4. Total poin terkecil
  standingsList.sort((a, b) => {
    if (a.matchesPlayed === 0 && b.matchesPlayed === 0) return a.id - b.id;
    if (a.matchesPlayed === 0) return 1;
    if (b.matchesPlayed === 0) return -1;

    if (a.avgPointsNum !== b.avgPointsNum) {
      return a.avgPointsNum - b.avgPointsNum;
    }
    if (b.matchesWon !== a.matchesWon) {
      return b.matchesWon - a.matchesWon;
    }
    return a.totalPoints - b.totalPoints;
  });

  return standingsList;
}

function renderRoundRobinView() {
  renderRoundRobinStandingsTable();
  renderRoundRobinFixtures();

  // Update top winners in tournamentState
  const standings = calculateRoundRobinStandings();
  if (tournamentState && standings.length > 0) {
    tournamentState.winners = {
      juara1: standings[0] ? getTournamentPlayerObj(standings[0].id) : null,
      juara2: standings[1] ? getTournamentPlayerObj(standings[1].id) : null,
      juara3: standings[2] ? getTournamentPlayerObj(standings[2].id) : null,
      juara4: standings[3] ? getTournamentPlayerObj(standings[3].id) : null
    };
  }
}

function renderRoundRobinStandingsTable() {
  const tbody = document.getElementById('rr-standings-tbody');
  if (!tbody) return;

  const standings = calculateRoundRobinStandings();
  if (standings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #888;">Belum ada data peserta turnamen.</td></tr>`;
    return;
  }

  let html = '';
  standings.forEach((p, idx) => {
    const rank = idx + 1;
    let rankBadgeClass = 'rr-rank-badge-normal';
    let rowClass = '';

    if (rank === 1) {
      rankBadgeClass = 'rr-rank-badge-1';
      rowClass = 'rank-gold';
    } else if (rank === 2) {
      rankBadgeClass = 'rr-rank-badge-2';
      rowClass = 'rank-silver';
    } else if (rank === 3) {
      rankBadgeClass = 'rr-rank-badge-3';
      rowClass = 'rank-bronze';
    }

    const playerObj = getTournamentPlayerObj(p.id) || p;

    html += `
      <tr class="${rowClass}">
        <td style="text-align: center;">
          <span class="rr-rank-badge ${rankBadgeClass}">${rank === 1 ? '' : rank}</span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${renderPlayerBadgeHTML(playerObj, 'sm', { showTitle: false })}
          </div>
        </td>
        <td style="text-align: center; font-family: var(--font-pixel); font-weight: bold; color: #E2E8F0;">
          ${p.matchesPlayed}
        </td>
        <td style="text-align: center; font-family: var(--font-pixel); font-weight: bold; color: #69F0AE;">
          ${p.matchesWon}
        </td>
        <td style="text-align: right;">
          <span class="rr-points-val">${p.totalPoints}</span>
        </td>
        <td style="text-align: right; font-family: var(--font-pixel); color: var(--text-secondary);">
          ${p.avgPoints}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderRoundRobinFixtures() {
  const container = document.getElementById('rr-fixtures-container');
  if (!container || !tournamentState) return;

  const matches = tournamentState.rrMatches || [];
  const roundsCount = (tournamentState.rrConfig && tournamentState.rrConfig.roundsCount) || 3;

  let fixturesHtml = '';

  for (let r = 0; r < roundsCount; r++) {
    const roundMatches = matches.filter(m => m.roundIdx === r);
    if (roundMatches.length === 0) continue;

    const completedCount = roundMatches.filter(m => m.status === 'completed').length;
    const isRoundDone = completedCount === roundMatches.length;

    const firstMatch = roundMatches[0];
    const byeIds = (firstMatch && firstMatch.byePlayerIds) ? firstMatch.byePlayerIds : [];
    let byesBannerHtml = '';
    if (byeIds.length > 0) {
      let byeBadges = '';
      byeIds.forEach(bId => {
        const p = getTournamentPlayerObj(bId);
        if (p) {
          byeBadges += `
            <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.06); padding: 0.3rem 0.6rem; border-radius: 10px; border: 1px dashed rgba(255,215,0,0.35);">
              ${renderPlayerBadgeHTML(p, 'sm', { showTitle: false })}
              <span style="font-size: 0.7rem; color: #FFD740; font-family: var(--font-pixel);">(Istirahat)</span>
            </div>
          `;
        }
      });
      byesBannerHtml = `
        <div style="margin-bottom: 1rem; padding: 0.6rem 0.9rem; background: linear-gradient(90deg, rgba(255,215,0,0.08), rgba(255,145,0,0.03)); border-radius: 12px; border: 1px solid rgba(255,215,0,0.25); display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-size: 0.75rem; color: #FFD740; font-weight: bold; display: flex; align-items: center; gap: 6px;">
             Giliran Istirahat (Bye):
          </span>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${byeBadges}
          </div>
        </div>
      `;
    }

    let tablesHtml = '';
    roundMatches.forEach((m, mIdx) => {
      tablesHtml += renderRoundRobinMatchCardHTML(m, r, mIdx);
    });

    fixturesHtml += `
      <div class="rr-round-section">
        <div class="rr-round-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="stage-badge stage-badge-gold">PUTARAN ${r + 1}</span>
            <h3 style="font-family: var(--font-title); font-size: 1.1rem; color: #FFF; margin: 0;">Babak ${r + 1}</h3>
          </div>
          <span class="table-status-pill ${isRoundDone ? 'table-status-done' : 'table-status-active'}">
            ${completedCount} / ${roundMatches.length} Meja Selesai
          </span>
        </div>
        ${byesBannerHtml}
        <div class="stage-tables-grid stage-4-tables">
          ${tablesHtml}
        </div>
      </div>
    `;
  }

  container.innerHTML = fixturesHtml || '<p style="text-align:center; color:#888;">Tidak ada jadwal pertandingan.</p>';
}

function renderRoundRobinMatchCardHTML(matchObj, roundIdx, tableIdx) {
  const isDone = matchObj.status === 'completed';
  
  let statusBadgeHtml = '<span class="table-status-pill table-status-pending">Belum Main</span>';
  if (isDone) {
    statusBadgeHtml = '<span class="table-status-pill table-status-done" style="display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Selesai</span>';
  } else {
    statusBadgeHtml = '<span class="table-status-pill table-status-active" style="display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Siap Main</span>';
  }

  let slotsHtml = '';
  matchObj.playerIds.forEach(pId => {
    const player = getTournamentPlayerObj(pId);
    if (!player) return;

    const isWinner = isDone && matchObj.winnerIds && matchObj.winnerIds.includes(player.id);
    const scoreVal = isDone && matchObj.scores[player.id] !== undefined ? matchObj.scores[player.id] : '';

    slotsHtml += `
      <div class="bracket-player-slot ${isWinner ? 'champion-1' : ''}">
        <div class="bracket-player-info">
          ${renderPlayerBadgeHTML(player, 'sm', { showTitle: false })}
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          ${isWinner ? '<span style="font-size: 0.65rem; font-weight: bold; color: #FFD740;">Menang ✓</span>' : ''}
          <span class="bracket-player-score">${scoreVal !== '' ? scoreVal + ' Pts' : ''}</span>
        </div>
      </div>
    `;
  });

  let actionBtnsHtml = '';
  const isOngoing = matchObj.ongoingGame && matchObj.ongoingGame.status === 'active';

  if (!isDone) {
    const btnLabel = isOngoing ? 'Lanjutkan / Koreksi Skor' : 'Catat Skor Meja';
    const btnBg = isOngoing ? 'linear-gradient(135deg, #FF9100 0%, #FF6D00 100%)' : '#FF1744';
    actionBtnsHtml = `
      <div class="bracket-action-btns">
        <button class="btn btn-sm btn-primary" style="flex: 1; font-family: var(--font-pixel); background: ${btnBg}; display: inline-flex; align-items: center; justify-content: center; gap: 6px;" onclick="startRoundRobinTableMatch(${roundIdx}, ${tableIdx})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          ${btnLabel}
        </button>
      </div>
    `;
  } else {
    actionBtnsHtml = `
      <div class="bracket-action-btns">
        <button class="btn btn-sm btn-outline" style="flex: 1; font-family: var(--font-pixel); border-color: rgba(255, 215, 0, 0.5); color: #FFD740; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255, 215, 0, 0.08);" onclick="startRoundRobinTableMatch(${roundIdx}, ${tableIdx})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Koreksi Skor
        </button>
      </div>
    `;
  }

  return `
    <div class="bracket-table-card ${!isDone ? 'active-stage' : 'completed'}">
      <div class="table-card-header">
        <span class="table-card-title">${escapeHtml(matchObj.name)}</span>
        ${statusBadgeHtml}
      </div>
      <div class="bracket-players-list">
        ${slotsHtml}
      </div>
      ${actionBtnsHtml}
    </div>
  `;
}

// ─────────────────────────────────────────────
// MATCH LAUNCH & RESULT PROCESSING
// ─────────────────────────────────────────────
function startRoundRobinTableMatch(roundIdx, tableIdx) {
  if (!tournamentState || !tournamentState.rrMatches) return;
  const match = tournamentState.rrMatches.find(m => m.roundIdx === roundIdx && m.tableIdx === tableIdx);
  if (!match || match.playerIds.length === 0) {
    showToast('Meja pertandingan tidak ditemukan!');
    return;
  }

  // Jika meja ini sudah memiliki pertandingan yang sedang berlangsung / selesai tapi ingin dikoreksi
  if (match.ongoingGame) {
    match.ongoingGame.status = 'active';
    state.currentGame = match.ongoingGame;
    saveState();
    renderDashboard();
    showPage('dashboard');
    showToast(`Membuka catatan skor ${match.name}! Data skor siap dikoreksi/dilanjutkan ✓`);
    return;
  }

  const matchPlayers = match.playerIds.map(pId => {
    const p = getTournamentPlayerObj(pId);
    return {
      name: p.name,
      total: 0,
      avatar: p.avatar,
      color: p.color
    };
  });

  const game = {
    id: `tourney_rr_r${roundIdx}_t${tableIdx}_${Date.now()}`,
    name: `Tournament - ${match.name}`,
    players: matchPlayers,
    rounds: [],
    status: 'active',
    startBalak: '0/0',
    createdAt: new Date().toISOString(),
    isTournamentMatch: true,
    tournamentContext: { mode: 'roundrobin', roundIdx, tableIdx }
  };

  match.ongoingGame = game;
  saveTournamentState();

  state.currentGame = game;
  saveState();
  renderDashboard();
  showPage('dashboard');
  showToast(`Membuka Papan Skor untuk ${match.name}! Kumpulkan Poinmu! `);
}

function startTournamentTableMatch(roundIdx, tableIdx) {
  if (!tournamentState) return;
  if (tournamentState.mode === 'roundrobin') {
    startRoundRobinTableMatch(roundIdx, tableIdx);
    return;
  }

  const round = tournamentState.rounds[roundIdx];
  if (!round) return;
  const tbl = round.tables[tableIdx];
  if (!tbl || tbl.playerIds.length === 0) {
    showToast('Meja ini belum memiliki pemain!');
    return;
  }

  // Jika meja ini sudah memiliki pertandingan yang sedang berlangsung / selesai tapi ingin dikoreksi
  if (tbl.ongoingGame) {
    tbl.ongoingGame.status = 'active';
    state.currentGame = tbl.ongoingGame;
    saveState();
    renderDashboard();
    showPage('dashboard');
    showToast(`Membuka catatan skor ${tbl.name}! Data skor siap dikoreksi/dilanjutkan ✓`);
    return;
  }

  const matchPlayers = tbl.playerIds.map(pId => {
    const p = getTournamentPlayerObj(pId);
    return {
      name: p.name,
      total: 0,
      avatar: p.avatar,
      color: p.color
    };
  });

  const game = {
    id: `tourney_r${roundIdx}_t${tableIdx}_${Date.now()}`,
    name: `Tournament - ${tbl.name}`,
    players: matchPlayers,
    rounds: [],
    status: 'active',
    startBalak: '0/0',
    createdAt: new Date().toISOString(),
    isTournamentMatch: true,
    tournamentContext: { mode: 'knockout', roundIdx, tableIdx }
  };

  tbl.ongoingGame = game;
  saveTournamentState();

  state.currentGame = game;
  saveState();
  renderDashboard();
  showPage('dashboard');
  showToast(`Membuka Papan Pencatatan Skor untuk ${tbl.name}! Selamat bertanding! `);
}

function completeActiveTournamentMatch() {
  const g = state.currentGame;
  if (!g || !g.isTournamentMatch || !g.tournamentContext) {
    showPage('tournament');
    return;
  }

  g.status = 'done';
  const existing = state.allGames.findIndex(ag => ag.id === g.id);
  if (existing >= 0) {
    state.allGames[existing] = { ...g };
  } else {
    state.allGames.unshift({ ...g });
  }
  saveState();

  const { mode, roundIdx, tableIdx } = g.tournamentContext;

  if (mode === 'roundrobin') {
    const match = tournamentState.rrMatches.find(m => m.roundIdx === roundIdx && m.tableIdx === tableIdx);
    if (!match) { showPage('tournament'); return; }
    match.ongoingGame = null;

    const scoresObj = {};
    match.playerIds.forEach((pId, idx) => {
      const playerInGame = g.players[idx];
      scoresObj[pId] = playerInGame ? playerInGame.total : 0;
    });

    syncTournamentTableScore(roundIdx, tableIdx, { scores: scoresObj, isDone: true, ongoingGame: null });
    processRoundRobinMatchResult(roundIdx, tableIdx, scoresObj);
  } else {
    const round = tournamentState.rounds[roundIdx];
    if (!round) { showPage('tournament'); return; }
    const tbl = round.tables[tableIdx];
    if (tbl) tbl.ongoingGame = null;

    const scoresObj = {};
    tbl.playerIds.forEach((pId, idx) => {
      const playerInGame = g.players[idx];
      scoresObj[pId] = playerInGame ? playerInGame.total : 0;
    });

    syncTournamentTableScore(roundIdx, tableIdx, { scores: scoresObj, isDone: true, ongoingGame: null });
    processTableMatchResult(roundIdx, tableIdx, scoresObj);
  }
}

function processRoundRobinMatchResult(roundIdx, tableIdx, scoresObj) {
  const st = tournamentState;
  if (!st || !st.rrMatches) return;
  const match = st.rrMatches.find(m => m.roundIdx === roundIdx && m.tableIdx === tableIdx);
  if (!match) return;

  match.scores = scoresObj;
  match.status = 'completed';

  // Find winner in this match (lowest score in gaple wins the match)
  const sortedIds = [...match.playerIds].sort((a, b) => (scoresObj[a] || 0) - (scoresObj[b] || 0));
  match.winnerIds = sortedIds.slice(0, 1);

  saveTournamentState();
  renderTournamentView();
  showPage('tournament');

  // Check if all round robin matches are completed
  const allCompleted = st.rrMatches.every(m => m.status === 'completed');
  if (allCompleted) {
    const standings = calculateRoundRobinStandings();
    if (standings.length > 0) {
      st.winners = {
        juara1: getTournamentPlayerObj(standings[0].id),
        juara2: standings[1] ? getTournamentPlayerObj(standings[1].id) : null,
        juara3: standings[2] ? getTournamentPlayerObj(standings[2].id) : null,
        juara4: standings[3] ? getTournamentPlayerObj(standings[3].id) : null
      };
      saveTournamentState();
      setTimeout(() => showTournamentPodium(), 500);
    }
  } else {
    showToast(`Hasil skor ${match.name} berhasil dicatat ke Klasemen! `);
  }
}

function processTableMatchResult(roundIdx, tableIdx, scoresObj) {
  const st = tournamentState;
  const round = st.rounds[roundIdx];
  if (!round) return;
  const tbl = round.tables[tableIdx];

  tbl.scores = scoresObj;
  tbl.status = 'completed';
  tbl.isDone = true;

  // Sort by score ascending (lowest = winner in gaple knockout)
  const sortedIds = [...tbl.playerIds].sort((a, b) => (scoresObj[a] || 0) - (scoresObj[b] || 0));

  if (round.isFinal) {
    tbl.winnerIds = sortedIds;
  } else {
    tbl.winnerIds = sortedIds.slice(0, round.qCount);
  }

  checkAndAdvanceTournamentRound(roundIdx);

  saveTournamentState();
  renderTournamentView();
  showPage('tournament');
}

function checkAndAdvanceTournamentRound(completedRoundIdx) {
  const st = tournamentState;
  const currentRound = st.rounds[completedRoundIdx];
  if (!currentRound) return;
  const nextRound = st.rounds[completedRoundIdx + 1];

  // Tempatkan 2 pemenang dari meja yang selesai langsung ke meja babak berikutnya
  if (nextRound && nextRound.tables) {
    currentRound.tables.forEach((tbl, tIdx) => {
      if (tbl.winnerIds && tbl.winnerIds.length > 0) {
        const targetTableIdx = Math.floor(tIdx / 2);
        const slotOffset = (tIdx % 2) * 2;
        const targetTable = nextRound.tables[targetTableIdx];
        if (targetTable) {
          if (!targetTable.playerIds) targetTable.playerIds = [];
          tbl.winnerIds.forEach((pId, wIdx) => {
            targetTable.playerIds[slotOffset + wIdx] = pId;
          });
        }
      }
    });

    // Jika ada peserta BYE dari babak pertama
    if (currentRound.byePlayerIds && currentRound.byePlayerIds.length > 0) {
      const allAdvancing = [];
      currentRound.tables.forEach(tbl => {
        if (tbl.winnerIds) allAdvancing.push(...tbl.winnerIds);
      });
      allAdvancing.push(...currentRound.byePlayerIds);

      const playersInTables = nextRound.numTables * 4;
      nextRound.tables.forEach((nxtTbl, tIdx) => {
        nxtTbl.playerIds = allAdvancing.slice(tIdx * 4, (tIdx + 1) * 4);
      });
      nextRound.byePlayerIds = allAdvancing.slice(playersInTables);
    }
  }

  const allDone = currentRound.tables.every(t => t.status === 'completed' || t.isDone);
  if (!allDone) return;

  currentRound.isDone = true;

  if (currentRound.isFinal) {
    st.currentRoundIndex = 'completed';
    const finalTable = currentRound.tables[0];
    const winners = finalTable.winnerIds;
    st.winners = {
      juara1: getTournamentPlayerObj(winners[0]) || null,
      juara2: getTournamentPlayerObj(winners[1]) || null,
      juara3: getTournamentPlayerObj(winners[2]) || null,
      juara4: getTournamentPlayerObj(winners[3]) || null
    };
    saveTournamentState();
    setTimeout(() => showTournamentPodium(), 500);
    return;
  }

  if (nextRound) {
    st.currentRoundIndex = completedRoundIdx + 1;
    const toastMsg = nextRound.isFinal
      ? 'Final 4 Orang telah ditentukan! Selamat untuk Para Finalis '
      : nextRound.name.includes('Semifinal')
        ? `Pemenang lolos ke ${nextRound.name}! `
        : `Lanjut ke ${nextRound.name}! `;
    showToast(toastMsg);
  }
}

function showTournamentPodium() {
  renderPodiumCards();
  openModal('modal-tournament-podium');
  startConfetti();
}

function renderPodiumCards() {
  const container = document.getElementById('tournament-podium-cards');
  if (!container || !tournamentState || !tournamentState.winners) return;

  const isRR = tournamentState.mode === 'roundrobin';
  const modalTitle = document.getElementById('podium-modal-title');
  const modalSubtitle = document.getElementById('podium-modal-subtitle');

  if (modalTitle) modalTitle.textContent = 'PODIUM JUARA TURNAMEN GAPLE';
  if (modalSubtitle) modalSubtitle.textContent = 'Selamat kepada para Pemenang Turnamen Gaple!';

  const w = tournamentState.winners;
  if (!w.juara1) {
    if (isRR) {
      const standings = calculateRoundRobinStandings();
      if (standings.length > 0) {
        w.juara1 = getTournamentPlayerObj(standings[0].id);
        w.juara2 = standings[1] ? getTournamentPlayerObj(standings[1].id) : null;
        w.juara3 = standings[2] ? getTournamentPlayerObj(standings[2].id) : null;
        w.juara4 = standings[3] ? getTournamentPlayerObj(standings[3].id) : null;
      }
    }
  }

  if (!w.juara1) return;

  let score1 = 0, score2 = 0, score3 = 0;
  if (isRR) {
    const standings = calculateRoundRobinStandings();
    const s1 = standings.find(s => s.id === w.juara1.id);
    const s2 = w.juara2 ? standings.find(s => s.id === w.juara2.id) : null;
    const s3 = w.juara3 ? standings.find(s => s.id === w.juara3.id) : null;
    score1 = s1 ? s1.totalPoints : 0;
    score2 = s2 ? s2.totalPoints : 0;
    score3 = s3 ? s3.totalPoints : 0;
  } else {
    const finalRound = tournamentState.rounds ? tournamentState.rounds.find(r => r.isFinal) : null;
    const scores = (finalRound && finalRound.tables[0]) ? finalRound.tables[0].scores || {} : {};
    score1 = scores[w.juara1.id] || 0;
    score2 = w.juara2 ? (scores[w.juara2.id] || 0) : 0;
    score3 = w.juara3 ? (scores[w.juara3.id] || 0) : 0;
  }

  container.innerHTML = `
    <!-- Juara 2 (Silver) -->
    <div class="podium-card podium-2">
      <div class="podium-badge podium-badge-silver">JUARA 2</div>
      <div class="podium-avatar-wrap" style="background-color: ${w.juara2 ? w.juara2.color || '#448AFF' : '#448AFF'};">
        ${w.juara2 ? getPixelArtSVG(w.juara2.avatar, 38) : ''}
      </div>
      <div class="podium-name">${w.juara2 ? escapeHtml(w.juara2.name) : '—'}</div>
      <div class="podium-score">${score2} Poin</div>
    </div>

    <!-- Juara 1 (Gold) -->
    <div class="podium-card podium-1">
      <div class="podium-badge podium-badge-gold">JUARA 1</div>
      <div class="podium-avatar-wrap podium-avatar-gold" style="background-color: ${w.juara1.color || '#FF5252'};">
        ${getPixelArtSVG(w.juara1.avatar, 46)}
      </div>
      <div class="podium-name podium-name-gold">${escapeHtml(w.juara1.name)}</div>
      <div class="podium-score podium-score-gold">${score1} Poin</div>
    </div>

    <!-- Juara 3 (Bronze) -->
    <div class="podium-card podium-3">
      <div class="podium-badge podium-badge-bronze">JUARA 3</div>
      <div class="podium-avatar-wrap" style="background-color: ${w.juara3 ? w.juara3.color || '#FFD740' : '#FFD740'};">
        ${w.juara3 ? getPixelArtSVG(w.juara3.avatar, 38) : ''}
      </div>
      <div class="podium-name">${w.juara3 ? escapeHtml(w.juara3.name) : '—'}</div>
      <div class="podium-score">${score3} Poin</div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// INSTAGRAM VICTORY CARD EXPORT ENGINE (CANVAS HD)
// ─────────────────────────────────────────────

let currentExportData = null;
let currentExportFormat = 'square'; // 'square' (1:1) or 'story' (9:16)
let currentExportCanvas = null;

function openInstagramExportModal(sourceType) {
  let exportData = null;

  if (sourceType === 'tournament') {
    if (!tournamentState || !tournamentState.winners || !tournamentState.winners.juara1) {
      if (tournamentState && tournamentState.mode === 'roundrobin') {
        const standings = calculateRoundRobinStandings();
        if (standings.length > 0) {
          tournamentState.winners = {
            juara1: getTournamentPlayerObj(standings[0].id),
            juara2: standings[1] ? getTournamentPlayerObj(standings[1].id) : null,
            juara3: standings[2] ? getTournamentPlayerObj(standings[2].id) : null,
            juara4: standings[3] ? getTournamentPlayerObj(standings[3].id) : null
          };
        }
      }
    }

    const st = tournamentState;
    if (!st || !st.winners || !st.winners.juara1) {
      showToast('Data pemenang turnamen belum tersedia.');
      return;
    }

    const isRR = st.mode === 'roundrobin';
    let pList = [];

    if (isRR) {
      const standings = calculateRoundRobinStandings();
      pList = standings.slice(0, 4).map((s, idx) => {
        const pObj = getTournamentPlayerObj(s.id);
        return {
          rank: idx + 1,
          name: pObj ? pObj.name : s.name,
          avatar: pObj ? pObj.avatar : s.avatar,
          color: pObj ? pObj.color : s.color,
          score: `${s.totalPoints} Pts`,
          subtitle: `${s.matchesWon} Menang • Rata-rata ${s.avgPoints}`
        };
      });
    } else {
      const finalRound = st.rounds ? st.rounds.find(r => r.isFinal) : null;
      const scores = (finalRound && finalRound.tables[0]) ? finalRound.tables[0].scores || {} : {};
      const w = st.winners;
      const arr = [w.juara1, w.juara2, w.juara3, w.juara4].filter(Boolean);
      pList = arr.map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        score: `${scores[p.id] !== undefined ? scores[p.id] : 0} Pts`,
        subtitle: idx === 0 ? 'Juara Utama' : idx === 1 ? 'Runner Up' : idx === 2 ? 'Juara 3' : 'Finalis'
      }));
    }

    const winner = pList[0];
    exportData = {
      badge: 'EDISI SPESIAL KEMERDEKAAN RI',
      title: 'JUARA TURNAMEN GAPLE',
      gameName: `Turnamen Gaple (${st.players.length} Peserta)`,
      dateStr: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      winner: {
        name: winner.name,
        avatar: winner.avatar,
        color: winner.color,
        scoreText: `SKOR: ${winner.score}`,
        title: 'Juara 1 Turnamen'
      },
      players: pList,
      stats: {
        item1: `${st.players.length} Total Peserta`,
        item2: isRR ? `${st.rrConfig ? st.rrConfig.roundsCount : 3} Putaran Babak` : `${st.rounds ? st.rounds.length : 0} Babak Eliminasi`
      }
    };

  } else if (sourceType === 'history') {
    const game = state.viewingHistoryGame;
    if (!game) {
      showToast('Data riwayat game tidak ditemukan.');
      return;
    }
    const sorted = [...game.players].sort((a, b) => a.total - b.total);
    const winner = sorted[0];
    const titlesMap = calculatePlayerTitles(game);
    const winTitle = titlesMap[game.players.indexOf(winner)];

    exportData = {
      badge: 'EDISI SPESIAL KEMERDEKAAN RI',
      title: 'JUARA TURNAMEN GAPLE',
      gameName: game.name || 'Pertandingan Gaple',
      dateStr: new Date(game.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      winner: {
        name: winner.name,
        avatar: winner.avatar,
        color: winner.color,
        scoreText: `${winner.total} POIN TERENDAH`,
        title: winTitle ? winTitle.label : 'Juara 1 Pertandingan'
      },
      players: sorted.map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        score: `${p.total} Pts`,
        subtitle: idx === 0 ? 'Pemenang Match' : `Peringkat ${idx + 1}`
      })),
      stats: {
        item1: `${game.rounds ? game.rounds.length : 0} Total Ronde`,
        item2: `${(game.gapleMoments || []).length} Momen Gaple`
      }
    };

  } else {
    // Regular Game Over
    const g = state.currentGame;
    if (!g) {
      showToast('Data game aktif tidak ditemukan.');
      return;
    }
    const sorted = [...g.players].sort((a, b) => a.total - b.total);
    const winner = sorted[0];
    const titlesMap = calculatePlayerTitles(g);
    const winTitle = titlesMap[g.players.indexOf(winner)];

    exportData = {
      badge: 'EDISI SPESIAL KEMERDEKAAN RI',
      title: 'JUARA TURNAMEN GAPLE',
      gameName: g.name || 'Pertandingan Gaple',
      dateStr: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      winner: {
        name: winner.name,
        avatar: winner.avatar,
        color: winner.color,
        scoreText: `${winner.total} POIN TERENDAH`,
        title: winTitle ? winTitle.label : 'Juara 1 Pertandingan'
      },
      players: sorted.map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        score: `${p.total} Pts`,
        subtitle: idx === 0 ? 'Pemenang Match' : `Peringkat ${idx + 1}`
      })),
      stats: {
        item1: `${g.rounds ? g.rounds.length : 0} Total Ronde`,
        item2: `${(g.gapleMoments || []).length} Momen Gaple`
      }
    };
  }

  currentExportData = exportData;
  currentExportFormat = 'square';

  updateInstagramFormatButtons();
  renderInstagramExportCard();
  openModal('modal-instagram-export');
}

function switchInstagramExportFormat(format) {
  currentExportFormat = format;
  updateInstagramFormatButtons();
  renderInstagramExportCard();
}

function updateInstagramFormatButtons() {
  const btnSq = document.getElementById('btn-ig-format-square');
  const btnSt = document.getElementById('btn-ig-format-story');
  if (btnSq && btnSt) {
    if (currentExportFormat === 'story') {
      btnSq.classList.remove('active');
      btnSt.classList.add('active');
    } else {
      btnSt.classList.remove('active');
      btnSq.classList.add('active');
    }
  }
}

function drawCanvasPixelAvatar(ctx, avatarKey, x, y, size) {
  const cleanKey = getSanitizedAvatar(avatarKey);
  const data = PIXEL_ART_DATA[cleanKey] || PIXEL_ART_DATA['fox'];
  const grid = data.grid;
  const pixelSize = size / 8;

  for (let r = 0; r < 8; r++) {
    const row = grid[r];
    for (let c = 0; c < 8; c++) {
      const char = row[c];
      if (char !== '.' && data.colors[char]) {
        ctx.fillStyle = data.colors[char];
        ctx.fillRect(Math.round(x + c * pixelSize), Math.round(y + r * pixelSize), Math.ceil(pixelSize), Math.ceil(pixelSize));
      }
    }
  }
}

function drawDominoTileOnCanvas(ctx, x, y, w, h, topDots, botDots) {
  ctx.save();
  // Card body
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1A1C1E';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, 6);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
  ctx.stroke();

  // Dividing line
  ctx.strokeStyle = '#FF1744';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h / 2);
  ctx.lineTo(x + w - 4, y + h / 2);
  ctx.stroke();

  // Dots helper
  const drawDots = (val, cy) => {
    ctx.fillStyle = '#1A1C1E';
    const cx = x + w / 2;
    const r = 2.5;
    if (val === 1) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    } else if (val === 2) {
      ctx.beginPath(); ctx.arc(cx - 5, cy - 5, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy + 5, r, 0, Math.PI * 2); ctx.fill();
    } else if (val === 3) {
      ctx.beginPath(); ctx.arc(cx - 5, cy - 5, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy + 5, r, 0, Math.PI * 2); ctx.fill();
    } else if (val >= 4) {
      ctx.beginPath(); ctx.arc(cx - 6, cy - 6, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, cy - 6, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 6, cy + 6, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, cy + 6, r, 0, Math.PI * 2); ctx.fill();
      if (val === 5) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      } else if (val === 6) {
        ctx.beginPath(); ctx.arc(cx, cy - 6, r, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy + 6, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  drawDots(topDots, y + h / 4);
  drawDots(botDots, y + (h * 3) / 4);
  ctx.restore();
}

function renderInstagramExportCard() {
  const data = currentExportData;
  if (!data) return;

  const isStory = currentExportFormat === 'story';
  const W = 1080;
  const H = isStory ? 1920 : 1080;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const bgGrad = ctx.createRadialGradient(W / 2, H * 0.35, 80, W / 2, H / 2, W * 0.95);
  bgGrad.addColorStop(0, '#2C0912');
  bgGrad.addColorStop(0.45, '#180408');
  bgGrad.addColorStop(1, '#0B0204');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Decorative Ambient Glows
  const glow1 = ctx.createRadialGradient(W * 0.15, H * 0.12, 0, W * 0.15, H * 0.12, 450);
  glow1.addColorStop(0, 'rgba(255, 23, 68, 0.2)');
  glow1.addColorStop(1, 'rgba(255, 23, 68, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(W * 0.85, H * 0.88, 0, W * 0.85, H * 0.88, 500);
  glow2.addColorStop(0, 'rgba(255, 215, 0, 0.15)');
  glow2.addColorStop(1, 'rgba(255, 215, 0, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Outer Merah-Putih & Gold Double Border
  ctx.save();
  ctx.lineWidth = 6;
  const borderGrad = ctx.createLinearGradient(0, 0, W, H);
  borderGrad.addColorStop(0, '#FF1744');
  borderGrad.addColorStop(0.25, '#FFFFFF');
  borderGrad.addColorStop(0.5, '#FFD740');
  borderGrad.addColorStop(0.75, '#FFFFFF');
  borderGrad.addColorStop(1, '#FF1744');
  ctx.strokeStyle = borderGrad;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.strokeRect(34, 34, W - 68, H - 68);

  // Corner Pixel Accents (Merah Putih)
  const drawCorner = (cx, cy) => {
    ctx.fillStyle = '#FF1744';
    ctx.fillRect(cx - 7, cy - 7, 14, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
  };
  drawCorner(24, 24);
  drawCorner(W - 24, 24);
  drawCorner(24, H - 24);
  drawCorner(W - 24, H - 24);
  ctx.restore();

  // Decorative Domino Tiles in background corners
  const dominoTopY = isStory ? 55 : 48;
  const dominoBotY = isStory ? H - 105 : H - 98;
  drawDominoTileOnCanvas(ctx, 52, dominoTopY, 32, 50, 6, 6);
  drawDominoTileOnCanvas(ctx, W - 84, dominoTopY, 32, 50, 5, 5);
  drawDominoTileOnCanvas(ctx, 52, dominoBotY, 32, 50, 1, 1);
  drawDominoTileOnCanvas(ctx, W - 84, dominoBotY, 32, 50, 4, 4);

  // ─────────────────────────────────────────────
  // HEADER (NO OVERLAPPING — STRICT SEQUENTIAL BOXES)
  // ─────────────────────────────────────────────
  if (isStory) {
    // Top Pill Badge (Merah Putih)
    const badgeY = 125;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 23, 68, 0.25)';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    const badgeText = data.badge.toUpperCase();
    ctx.font = 'bold 16px "Inter", sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 36;
    const badgeX = (W - badgeW) / 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, 34, 17);
    else ctx.rect(badgeX, badgeY, badgeW, 34);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, W / 2, badgeY + 17);
    ctx.restore();

    // Main Title (JUARA TURNAMEN GAPLE)
    const titleY = 220;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 23, 68, 0.6)';
    ctx.shadowBlur = 18;
    const titleGrad = ctx.createLinearGradient(W / 2 - 250, titleY - 20, W / 2 + 250, titleY + 20);
    titleGrad.addColorStop(0, '#FFFFFF');
    titleGrad.addColorStop(0.5, '#FFF9C4');
    titleGrad.addColorStop(1, '#FFD740');
    ctx.fillStyle = titleGrad;
    ctx.font = 'bold 40px "Press Start 2P", "Inter", sans-serif';
    ctx.fillText(data.title, W / 2, titleY);
    ctx.restore();

    // Subtitle
    const subY = 280;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '600 20px "Inter", sans-serif';
    ctx.fillText(`${data.gameName}  •  ${data.dateStr}`, W / 2, subY);
    ctx.restore();

  } else {
    // SQUARE (1:1) HEADER
    const badgeY = 62;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 23, 68, 0.25)';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    const badgeText = data.badge.toUpperCase();
    ctx.font = 'bold 15px "Inter", sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 32;
    const badgeX = (W - badgeW) / 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, 30, 15);
    else ctx.rect(badgeX, badgeY, badgeW, 30);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, W / 2, badgeY + 15);
    ctx.restore();

    // Main Title (JUARA TURNAMEN GAPLE)
    const titleY = 132;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 23, 68, 0.6)';
    ctx.shadowBlur = 16;
    const titleGrad = ctx.createLinearGradient(W / 2 - 200, titleY - 15, W / 2 + 200, titleY + 15);
    titleGrad.addColorStop(0, '#FFFFFF');
    titleGrad.addColorStop(0.5, '#FFF9C4');
    titleGrad.addColorStop(1, '#FFD740');
    ctx.fillStyle = titleGrad;
    ctx.font = 'bold 32px "Press Start 2P", "Inter", sans-serif';
    ctx.fillText(data.title, W / 2, titleY);
    ctx.restore();

    // Subtitle
    const subY = 178;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '600 17px "Inter", sans-serif';
    ctx.fillText(`${data.gameName}  •  ${data.dateStr}`, W / 2, subY);
    ctx.restore();
  }

  // ─────────────────────────────────────────────
  // HERO WINNER / CHAMPION SHOWCASE
  // ─────────────────────────────────────────────
  const champBoxW = W - 140; // 940px
  const champBoxX = 70;

  if (isStory) {
    const champBoxY = 340;
    const champBoxH = 580;

    ctx.save();
    // Glassmorphic Hero Box
    ctx.fillStyle = 'rgba(38, 6, 12, 0.85)';
    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(champBoxX, champBoxY, champBoxW, champBoxH, 24);
    else ctx.rect(champBoxX, champBoxY, champBoxW, champBoxH);
    ctx.fill();
    ctx.stroke();

    // Winner Avatar in Glowing Merah Putih Circle
    const avatarCenterY = champBoxY + 180;
    const circleRadius = 90;
    const avatarSize = 120;

    const ringGrad = ctx.createRadialGradient(W / 2, avatarCenterY, circleRadius * 0.7, W / 2, avatarCenterY, circleRadius * 1.35);
    ringGrad.addColorStop(0, 'rgba(255, 23, 68, 0.5)');
    ringGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
    ringGrad.addColorStop(1, 'rgba(255, 23, 68, 0)');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(W / 2, avatarCenterY, circleRadius * 1.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = data.winner.color || '#FF5252';
    ctx.beginPath();
    ctx.arc(W / 2, avatarCenterY, circleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.stroke();

    drawCanvasPixelAvatar(ctx, data.winner.avatar, W / 2 - avatarSize / 2, avatarCenterY - avatarSize / 2, avatarSize);

    // Winner Name
    const nameY = champBoxY + 340;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px "Press Start 2P", "Inter", sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText(data.winner.name, W / 2, nameY);

    // Winner Score Pill (Red to Gold Gradient)
    const pillY = champBoxY + 420;
    const pillH = 46;
    ctx.font = 'bold 20px "Inter", sans-serif';
    const pillText = data.winner.scoreText;
    const pillW = ctx.measureText(pillText).width + 48;
    const pillX = (W - pillW) / 2;

    const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
    pillGrad.addColorStop(0, '#FF1744');
    pillGrad.addColorStop(1, '#D50000');
    ctx.fillStyle = pillGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 23);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, W / 2, pillY + pillH / 2);

    // Title / Julukan
    if (data.winner.title) {
      const titleLabelY = champBoxY + 505;
      ctx.fillStyle = '#FFD740';
      ctx.font = 'bold 20px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(data.winner.title, W / 2, titleLabelY);
    }
    ctx.restore();

  } else {
    // SQUARE (1:1) HERO BOX
    const champBoxY = 210;
    const champBoxH = 340;

    ctx.save();
    // Glassmorphic Hero Box
    ctx.fillStyle = 'rgba(38, 6, 12, 0.85)';
    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(champBoxX, champBoxY, champBoxW, champBoxH, 20);
    else ctx.rect(champBoxX, champBoxY, champBoxW, champBoxH);
    ctx.fill();
    ctx.stroke();

    // Winner Avatar in Glowing Circle
    const avatarCenterY = champBoxY + 95;
    const circleRadius = 58;
    const avatarSize = 80;

    const ringGrad = ctx.createRadialGradient(W / 2, avatarCenterY, circleRadius * 0.7, W / 2, avatarCenterY, circleRadius * 1.35);
    ringGrad.addColorStop(0, 'rgba(255, 23, 68, 0.5)');
    ringGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
    ringGrad.addColorStop(1, 'rgba(255, 23, 68, 0)');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(W / 2, avatarCenterY, circleRadius * 1.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = data.winner.color || '#FF5252';
    ctx.beginPath();
    ctx.arc(W / 2, avatarCenterY, circleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();

    drawCanvasPixelAvatar(ctx, data.winner.avatar, W / 2 - avatarSize / 2, avatarCenterY - avatarSize / 2, avatarSize);

    // Winner Name
    const nameY = champBoxY + 195;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px "Press Start 2P", "Inter", sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText(data.winner.name, W / 2, nameY);

    // Winner Score Pill (Red to Gold Gradient)
    const pillY = champBoxY + 242;
    const pillH = 36;
    ctx.font = 'bold 16px "Inter", sans-serif';
    const pillText = data.winner.scoreText;
    const pillW = ctx.measureText(pillText).width + 38;
    const pillX = (W - pillW) / 2;

    const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
    pillGrad.addColorStop(0, '#FF1744');
    pillGrad.addColorStop(1, '#D50000');
    ctx.fillStyle = pillGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 18);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillText, W / 2, pillY + pillH / 2);

    // Title / Julukan
    if (data.winner.title) {
      const titleLabelY = champBoxY + 305;
      ctx.fillStyle = '#FFD740';
      ctx.font = 'bold 15px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(data.winner.title, W / 2, titleLabelY);
    }
    ctx.restore();
  }

  // ─────────────────────────────────────────────
  // LEADERBOARD / PODIUM ROWS (TOP 4)
  // ─────────────────────────────────────────────
  const players = (data.players || []).slice(0, 4);

  if (isStory) {
    const startY = 970;
    const cardH = 110;
    const gap = 20;

    players.forEach((p, idx) => {
      const cardY = startY + idx * (cardH + gap);
      ctx.save();

      // Row Background (Merah Putih styling)
      let rowBg = 'rgba(255, 255, 255, 0.04)';
      let borderCol = 'rgba(255, 255, 255, 0.12)';
      let rankBadgeBg = '#334155';
      let rankTextColor = '#FFFFFF';

      if (p.rank === 1) {
        rowBg = 'linear-gradient(90deg, rgba(255, 23, 68, 0.28), rgba(255, 255, 255, 0.06))';
        borderCol = '#FF1744';
        rankBadgeBg = '#FFD740';
        rankTextColor = '#100608';
      } else if (p.rank === 2) {
        rowBg = 'rgba(226, 232, 240, 0.08)';
        borderCol = '#FFFFFF';
        rankBadgeBg = '#FFFFFF';
        rankTextColor = '#100608';
      } else if (p.rank === 3) {
        rowBg = 'rgba(205, 127, 50, 0.08)';
        borderCol = '#CD7F32';
        rankBadgeBg = '#CD7F32';
        rankTextColor = '#FFFFFF';
      }

      ctx.fillStyle = (typeof rowBg === 'string' && !rowBg.startsWith('linear')) ? rowBg : 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = p.rank === 1 ? 2 : 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(70, cardY, champBoxW, cardH, 18);
      else ctx.rect(70, cardY, champBoxW, cardH);
      ctx.fill();
      ctx.stroke();

      // Rank Pill Badge
      const badgeCenterX = 125;
      const badgeCenterY = cardY + cardH / 2;
      ctx.fillStyle = rankBadgeBg;
      ctx.beginPath();
      ctx.arc(badgeCenterX, badgeCenterY, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 20px "Press Start 2P", "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rankTextColor;
      ctx.fillText(`${p.rank}`, badgeCenterX, badgeCenterY);

      // Mini Avatar Circle
      const miniSize = 64;
      const miniX = 175;
      const miniY = cardY + (cardH - miniSize) / 2;
      ctx.fillStyle = p.color || '#448AFF';
      ctx.beginPath();
      ctx.arc(miniX + miniSize / 2, miniY + miniSize / 2, miniSize / 2, 0, Math.PI * 2);
      ctx.fill();
      drawCanvasPixelAvatar(ctx, p.avatar, miniX, miniY, miniSize);

      // Player Name
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.rank === 1 ? '#FFFFFF' : '#E2E8F0';
      ctx.font = 'bold 26px "Inter", sans-serif';
      ctx.fillText(p.name, miniX + miniSize + 22, cardY + cardH / 2 - (p.subtitle ? 15 : 0));

      // Player Subtitle
      if (p.subtitle) {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '500 17px "Inter", sans-serif';
        ctx.fillText(p.subtitle, miniX + miniSize + 22, cardY + cardH / 2 + 18);
      }

      // Score Tag
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.rank === 1 ? '#FFD740' : '#FFFFFF';
      ctx.font = 'bold 26px "Press Start 2P", "Inter", sans-serif';
      ctx.fillText(p.score, 70 + champBoxW - 28, cardY + cardH / 2);

      ctx.restore();
    });

    // Story Footer
    ctx.save();
    const footStatsY = 1680;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD740';
    ctx.font = 'bold 20px "Inter", sans-serif';
    ctx.fillText(`${data.stats.item1}   •   ${data.stats.item2}`, W / 2, footStatsY);

    const footBrandY = 1735;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '16px "Inter", sans-serif';
    ctx.fillText('Edisi Spesial Kemerdekaan RI • Gaple Score Tracker', W / 2, footBrandY);
    ctx.restore();

  } else {
    // SQUARE (1:1) LEADERBOARD ROWS
    const startY = 575;
    const cardH = 68;
    const gap = 12;

    players.forEach((p, idx) => {
      const cardY = startY + idx * (cardH + gap);
      ctx.save();

      // Row Background (Merah Putih styling)
      let rowBg = 'rgba(255, 255, 255, 0.04)';
      let borderCol = 'rgba(255, 255, 255, 0.1)';
      let rankBadgeBg = '#334155';
      let rankTextColor = '#FFFFFF';

      if (p.rank === 1) {
        rowBg = 'linear-gradient(90deg, rgba(255, 23, 68, 0.28), rgba(255, 255, 255, 0.06))';
        borderCol = '#FF1744';
        rankBadgeBg = '#FFD740';
        rankTextColor = '#100608';
      } else if (p.rank === 2) {
        rowBg = 'rgba(226, 232, 240, 0.08)';
        borderCol = '#FFFFFF';
        rankBadgeBg = '#FFFFFF';
        rankTextColor = '#100608';
      } else if (p.rank === 3) {
        rowBg = 'rgba(205, 127, 50, 0.08)';
        borderCol = '#CD7F32';
        rankBadgeBg = '#CD7F32';
        rankTextColor = '#FFFFFF';
      }

      ctx.fillStyle = (typeof rowBg === 'string' && !rowBg.startsWith('linear')) ? rowBg : 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = p.rank === 1 ? 2 : 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(70, cardY, champBoxW, cardH, 14);
      else ctx.rect(70, cardY, champBoxW, cardH);
      ctx.fill();
      ctx.stroke();

      // Rank Pill Badge
      const badgeCenterX = 112;
      const badgeCenterY = cardY + cardH / 2;
      ctx.fillStyle = rankBadgeBg;
      ctx.beginPath();
      ctx.arc(badgeCenterX, badgeCenterY, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 15px "Press Start 2P", "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rankTextColor;
      ctx.fillText(`${p.rank}`, badgeCenterX, badgeCenterY);

      // Mini Avatar Circle
      const miniSize = 46;
      const miniX = 146;
      const miniY = cardY + (cardH - miniSize) / 2;
      ctx.fillStyle = p.color || '#448AFF';
      ctx.beginPath();
      ctx.arc(miniX + miniSize / 2, miniY + miniSize / 2, miniSize / 2, 0, Math.PI * 2);
      ctx.fill();
      drawCanvasPixelAvatar(ctx, p.avatar, miniX, miniY, miniSize);

      // Player Name
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.rank === 1 ? '#FFFFFF' : '#E2E8F0';
      ctx.font = 'bold 19px "Inter", sans-serif';
      ctx.fillText(p.name, miniX + miniSize + 16, cardY + cardH / 2 - (p.subtitle ? 10 : 0));

      // Player Subtitle
      if (p.subtitle) {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '500 13px "Inter", sans-serif';
        ctx.fillText(p.subtitle, miniX + miniSize + 16, cardY + cardH / 2 + 13);
      }

      // Score Tag
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.rank === 1 ? '#FFD740' : '#FFFFFF';
      ctx.font = 'bold 19px "Press Start 2P", "Inter", sans-serif';
      ctx.fillText(p.score, 70 + champBoxW - 20, cardY + cardH / 2);

      ctx.restore();
    });

    // Square Footer
    ctx.save();
    const footStatsY = 998;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD740';
    ctx.font = 'bold 16px "Inter", sans-serif';
    ctx.fillText(`${data.stats.item1}   •   ${data.stats.item2}`, W / 2, footStatsY);

    const footBrandY = 1030;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '13px "Inter", sans-serif';
    ctx.fillText('Edisi Spesial Kemerdekaan RI • Gaple Score Tracker', W / 2, footBrandY);
    ctx.restore();
  }

  currentExportCanvas = canvas;
  const previewImg = document.getElementById('ig-export-preview-img');
  if (previewImg) {
    previewImg.src = canvas.toDataURL('image/png');
  }
}

function downloadInstagramExport() {
  if (!currentExportCanvas) return;
  const link = document.createElement('a');
  const now = new Date();
  const dateTag = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  link.download = `gaple-victory-${dateTag}-${Date.now()}.png`;
  link.href = currentExportCanvas.toDataURL('image/png');
  link.click();
  showToast('Gambar kemenangan berhasil diunduh! ');
}

async function shareInstagramExport() {
  if (!currentExportCanvas) return;
  currentExportCanvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], 'gaple-victory.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Gaple Victory Royale ',
          text: 'Lihat kemenangan seru di Gaple Score Tracker! '
        });
        showToast('Menu bagikan berhasil dibuka! ');
      } catch (err) {
        if (err.name !== 'AbortError') {
          downloadInstagramExport();
        }
      }
    } else {
      downloadInstagramExport();
      showToast('Gambar telah diunduh! Siap diposting ke Instagram ');
    }
  }, 'image/png');
}

async function copyInstagramExportToClipboard() {
  if (!currentExportCanvas) return;
  currentExportCanvas.toBlob(async (blob) => {
    if (!blob) return;
    try {
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showToast('Gambar berhasil disalin ke clipboard! ');
      } else {
        downloadInstagramExport();
      }
    } catch (err) {
      downloadInstagramExport();
    }
  }, 'image/png');
}


