'use strict';

const fs = require('fs');
const path = require('path');

const TOURNAMENTS_FILE = path.join(__dirname, 'tournaments.json');

/**
 * Membaca seluruh data turnamen dari tournaments.json
 */
function loadTournaments() {
  try {
    if (fs.existsSync(TOURNAMENTS_FILE)) {
      const raw = fs.readFileSync(TOURNAMENTS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Gagal membaca tournaments.json:', e);
  }
  return {};
}

/**
 * Menyimpan seluruh data turnamen ke tournaments.json
 */
function saveTournaments(data) {
  try {
    fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Gagal menyimpan tournaments.json:', e);
  }
}

/**
 * Mengambil data satu turnamen berdasarkan ID
 */
function getTournament(id) {
  if (!id) return null;
  const all = loadTournaments();
  return all[id] || null;
}

/**
 * Membuat atau memperbarui turnamen secara utuh
 */
function saveTournament(tournament) {
  if (!tournament || !tournament.id) return null;
  const all = loadTournaments();

  tournament.updatedAt = new Date().toISOString();
  tournament.revision = (tournament.revision || 0) + 1;

  all[tournament.id] = tournament;
  saveTournaments(all);
  return tournament;
}

/**
 * Memperbarui skor meja tertentu secara atomik (tanpa menimpa meja lain)
 */
function updateTable(tournamentId, payload) {
  const all = loadTournaments();
  const t = all[tournamentId];
  if (!t) return { success: false, error: 'Turnamen tidak ditemukan' };

  const { mode, roundIdx, tableIdx, scores, isDone, ongoingGame, judgeName } = payload;
  const isRR = (mode || t.mode) === 'roundrobin';

  if (isRR) {
    if (!t.rrMatches) t.rrMatches = [];
    const match = t.rrMatches.find(m => m.roundIdx === roundIdx && m.tableIdx === tableIdx);
    if (!match) return { success: false, error: 'Meja Round Robin tidak ditemukan' };

    if (scores !== undefined) match.scores = scores;
    if (isDone !== undefined) match.status = isDone ? 'completed' : 'pending';
    if (ongoingGame !== undefined) match.ongoingGame = ongoingGame;
    if (judgeName !== undefined) match.judgeName = judgeName;

    if (isDone && scores) {
      // Tentukan pemenang (poin penalti terendah menang)
      const sortedIds = [...match.playerIds].sort((a, b) => (scores[a] || 0) - (scores[b] || 0));
      match.winnerIds = sortedIds.slice(0, 1);
    }

    // Periksa apakah semua pertandingan sudah selesai untuk menentukan podium
    const allDone = t.rrMatches.every(m => m.status === 'completed');
    if (allDone) {
      t.standings = calculateRRStandings(t);
      if (t.standings.length > 0) {
        t.winners = {
          juara1: getPlayerFromList(t.players, t.standings[0].id),
          juara2: t.standings[1] ? getPlayerFromList(t.players, t.standings[1].id) : null,
          juara3: t.standings[2] ? getPlayerFromList(t.players, t.standings[2].id) : null,
          juara4: t.standings[3] ? getPlayerFromList(t.players, t.standings[3].id) : null
        };
      }
    }
  } else {
    // Knockout System
    if (!t.rounds || !t.rounds[roundIdx]) return { success: false, error: 'Babak Knockout tidak ditemukan' };
    const round = t.rounds[roundIdx];
    const tbl = round.tables[tableIdx];
    if (!tbl) return { success: false, error: 'Meja Knockout tidak ditemukan' };

    if (scores !== undefined) tbl.scores = scores;
    if (isDone !== undefined) tbl.isDone = isDone;
    if (ongoingGame !== undefined) tbl.ongoingGame = ongoingGame;
    if (judgeName !== undefined) tbl.judgeName = judgeName;

    if (isDone && scores) {
      // Ambil 2 pemain dengan skor terendah di meja ini untuk lolos
      const sorted = tbl.playerIds.map(pId => ({ id: pId, score: scores[pId] !== undefined ? scores[pId] : 999 }))
        .sort((a, b) => a.score - b.score);
      const advancingCount = round.isFinal ? 1 : 2;
      tbl.winnerIds = sorted.slice(0, advancingCount).map(s => s.id);

      // Cek apakah seluruh meja pada babak ini telah selesai
      advanceKnockoutStageIfReady(t, roundIdx);
    }
  }

  t.updatedAt = new Date().toISOString();
  t.revision = (t.revision || 0) + 1;

  all[tournamentId] = t;
  saveTournaments(all);
  return { success: true, tournament: t };
}

/**
 * Kalkulasi klasemen Round Robin di server
 */
function calculateRRStandings(t) {
  if (!t.players || !t.rrMatches) return [];
  const playerStats = {};

  t.players.forEach(p => {
    playerStats[p.id] = {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      totalPoints: 0,
      matchesPlayed: 0,
      wins: 0
    };
  });

  t.rrMatches.forEach(m => {
    if (m.status === 'completed' && m.scores) {
      m.playerIds.forEach(pId => {
        if (playerStats[pId] && m.scores[pId] !== undefined) {
          playerStats[pId].totalPoints += Number(m.scores[pId]) || 0;
          playerStats[pId].matchesPlayed += 1;
        }
      });
      if (m.winnerIds && m.winnerIds[0] && playerStats[m.winnerIds[0]]) {
        playerStats[m.winnerIds[0]].wins += 1;
      }
    }
  });

  return Object.values(playerStats).sort((a, b) => {
    const avgA = a.matchesPlayed > 0 ? a.totalPoints / a.matchesPlayed : 999;
    const avgB = b.matchesPlayed > 0 ? b.totalPoints / b.matchesPlayed : 999;
    if (avgA !== avgB) return avgA - avgB;
    if (a.wins !== b.wins) return b.wins - a.wins;
    return a.totalPoints - b.totalPoints;
  });
}

function getPlayerFromList(players, id) {
  if (!players) return null;
  return players.find(p => p.id === id) || null;
}

/**
 * Otomatis memajukan pemenang Knockout ke babak berikutnya di server jika satu babak tuntas
 */
function advanceKnockoutStageIfReady(t, roundIdx) {
  const currentRound = t.rounds[roundIdx];
  if (!currentRound) return;
  const allTablesDone = currentRound.tables.every(tbl => tbl.isDone);

  if (allTablesDone) {
    currentRound.isDone = true;

    // Jika ini Final, tentukan Juara
    if (currentRound.isFinal) {
      const finalTable = currentRound.tables[0];
      if (finalTable && finalTable.scores) {
        const sorted = finalTable.playerIds.map(pId => ({ id: pId, score: finalTable.scores[pId] !== undefined ? finalTable.scores[pId] : 999 }))
          .sort((a, b) => a.score - b.score);
        t.winners = {
          juara1: getPlayerFromList(t.players, sorted[0] ? sorted[0].id : null),
          juara2: getPlayerFromList(t.players, sorted[1] ? sorted[1].id : null),
          juara3: getPlayerFromList(t.players, sorted[2] ? sorted[2].id : null),
          juara4: getPlayerFromList(t.players, sorted[3] ? sorted[3].id : null)
        };
      }
      return;
    }

    // Jika bukan final, masukkan pemenang ke babak berikutnya
    const nextRound = t.rounds[roundIdx + 1];
    if (nextRound) {
      const allWinners = [];
      currentRound.tables.forEach(tbl => {
        if (tbl.winnerIds) allWinners.push(...tbl.winnerIds);
      });

      // Distribusikan pemenang ke meja babak berikutnya
      let wIdx = 0;
      nextRound.tables.forEach(nxtTbl => {
        nxtTbl.playerIds = [];
        for (let i = 0; i < 4 && wIdx < allWinners.length; i++) {
          nxtTbl.playerIds.push(allWinners[wIdx++]);
        }
      });
      t.currentRoundIndex = roundIdx + 1;
    }
  }
}

/**
 * Menghapus data turnamen
 */
function deleteTournament(id) {
  if (!id) return false;
  const all = loadTournaments();
  if (all[id]) {
    delete all[id];
    saveTournaments(all);
    return true;
  }
  return false;
}

/**
 * Mengambil ringkasan daftar turnamen yang ada
 */
function listTournaments() {
  const all = loadTournaments();
  return Object.values(all).map(t => ({
    id: t.id,
    name: t.name,
    mode: t.mode,
    playerCount: t.players ? t.players.length : 0,
    updatedAt: t.updatedAt,
    revision: t.revision,
    isCompleted: Boolean(t.winners)
  }));
}

module.exports = {
  getTournament,
  saveTournament,
  updateTable,
  deleteTournament,
  listTournaments
};
