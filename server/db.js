'use strict';

const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, 'stats.json');

/**
 * Loads all stats from the stats.json file
 */
function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = fs.readFileSync(STATS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Gagal memuat statistik:', e);
  }
  return {};
}

/**
 * Saves stats back to stats.json
 */
function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  } catch (e) {
    console.error('Gagal menyimpan statistik:', e);
  }
}

/**
 * Retrieves the lifetime stats for a player by name.
 * If the player does not exist, a new profile is initialized.
 */
function getPlayerStats(name) {
  const stats = loadStats();
  if (!name) return null;
  
  if (!stats[name]) {
    stats[name] = {
      name: name,
      totalMatchesPlayed: 0,
      totalRoundsWon: 0,
      totalGaple: 0,
      totalGacor: 0,
      totalDungTak: 0,
      longestWinStreak: 0
    };
  }
  return stats[name];
}

/**
 * Updates a player's lifetime statistics
 */
function updatePlayerStats(name, updates) {
  if (!name) return null;
  const stats = loadStats();
  
  if (!stats[name]) {
    stats[name] = {
      name: name,
      totalMatchesPlayed: 0,
      totalRoundsWon: 0,
      totalGaple: 0,
      totalGacor: 0,
      totalDungTak: 0,
      longestWinStreak: 0
    };
  }

  const p = stats[name];
  if (updates.matchPlayed) p.totalMatchesPlayed++;
  if (updates.roundWon) p.totalRoundsWon++;
  if (updates.gaple) p.totalGaple++;
  if (updates.gacor) p.totalGacor++;
  if (updates.dungTak) p.totalDungTak++;
  if (updates.winStreak !== undefined && updates.winStreak > p.longestWinStreak) {
    p.longestWinStreak = updates.winStreak;
  }

  saveStats(stats);
  return p;
}

module.exports = {
  getPlayerStats,
  updatePlayerStats,
  loadAllStats: loadStats
};
