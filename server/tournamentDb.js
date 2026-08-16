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
  const cleanId = String(id).trim().toUpperCase();
  const all = loadTournaments();
  return all[cleanId] || null;
}

/**
 * Membuat atau memperbarui turnamen secara utuh
 */
function saveTournament(tournament) {
  if (!tournament || !tournament.id) return null;
  const cleanId = String(tournament.id).trim().toUpperCase();
  tournament.id = cleanId;
  const all = loadTournaments();

  tournament.updatedAt = new Date().toISOString();
  tournament.revision = (tournament.revision || 0) + 1;

  all[cleanId] = tournament;
  saveTournaments(all);
  return tournament;
}

/**
 * Memperbarui skor meja tertentu secara atomik (tanpa menimpa meja lain)
 */
function updateTable(tournamentId, payload) {
  const cleanId = String(tournamentId || '').trim().toUpperCase();
  const all = loadTournaments();
  const t = all[cleanId];
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
    if (isDone !== undefined) {
      tbl.isDone = isDone;
      tbl.status = isDone ? 'completed' : 'pending';
    }
    if (ongoingGame !== undefined) tbl.ongoingGame = ongoingGame;
    if (judgeName !== undefined) tbl.judgeName = judgeName;

    if (isDone && scores) {
      // Ambil pemain terbaik di meja ini untuk lolos (2 pemain terbaik per meja di babak non-final, atau urutan finalis di final)
      const sorted = tbl.playerIds.map(pId => ({
        id: pId,
        score: scores[pId] !== undefined ? Number(scores[pId]) : 999
      })).sort((a, b) => a.score - b.score);

      const advancingCount = round.isFinal ? 4 : (round.qCount || 2);
      tbl.winnerIds = round.isFinal ? sorted.map(s => s.id) : sorted.slice(0, advancingCount).map(s => s.id);

      // Alirkan pemenang langsung ke babak berikutnya dan cek kemajuan turnamen
      advanceKnockoutStageIfReady(t, roundIdx);
    }
  }

  t.updatedAt = new Date().toISOString();
  t.revision = (t.revision || 0) + 1;

  all[cleanId] = t;
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
 * Otomatis memajukan pemenang Knockout ke babak berikutnya di server
 */
function advanceKnockoutStageIfReady(t, roundIdx) {
  const currentRound = t.rounds[roundIdx];
  if (!currentRound) return;
  const nextRound = t.rounds[roundIdx + 1];

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

    // Jika ada peserta BYE dari babak penyisihan pertama
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

  // Cek apakah seluruh meja pada babak ini telah selesai
  const allTablesDone = currentRound.tables.every(tbl => tbl.isDone || tbl.status === 'completed');

  if (allTablesDone) {
    currentRound.isDone = true;

    // Jika ini Final, tentukan Juara
    if (currentRound.isFinal) {
      t.currentRoundIndex = 'completed';
      const finalTable = currentRound.tables[0];
      if (finalTable && finalTable.scores) {
        const sorted = finalTable.playerIds.map(pId => ({
          id: pId,
          score: finalTable.scores[pId] !== undefined ? Number(finalTable.scores[pId]) : 999
        })).sort((a, b) => a.score - b.score);

        t.winners = {
          juara1: getPlayerFromList(t.players, sorted[0] ? sorted[0].id : null),
          juara2: getPlayerFromList(t.players, sorted[1] ? sorted[1].id : null),
          juara3: getPlayerFromList(t.players, sorted[2] ? sorted[2].id : null),
          juara4: getPlayerFromList(t.players, sorted[3] ? sorted[3].id : null)
        };
      }
    } else if (nextRound) {
      t.currentRoundIndex = roundIdx + 1;
    }
  }
}

/**
 * Memperbarui nama/data peserta turnamen (Hanya Host)
 */
function updatePlayers(tournamentId, players, role) {
  if (role !== 'host') {
    return { success: false, error: 'Akses ditolak: Hanya Host yang dapat mengubah nama/data peserta.' };
  }
  const cleanId = String(tournamentId || '').trim().toUpperCase();
  const all = loadTournaments();
  let t = all[cleanId];
  if (!t) {
    t = {
      id: cleanId,
      name: 'Turnamen Gaple',
      mode: 'knockout',
      players: Array.isArray(players) ? players : [],
      rounds: [],
      currentRoundIndex: 0,
      winners: { juara1: null, juara2: null, juara3: null, juara4: null }
    };
  }

  if (Array.isArray(players)) {
    t.players = players;
    // Sinkronkan nama di babak pertama jika turnamen knockout belum berjalan
    if (t.mode === 'knockout' && Array.isArray(t.rounds) && t.rounds[0] && t.currentRoundIndex === 0) {
      const firstRound = t.rounds[0];
      if (Array.isArray(firstRound.tables)) {
        firstRound.tables.forEach((tbl, tIdx) => {
          tbl.playerIds = players.slice(tIdx * 4, (tIdx + 1) * 4).map(p => p.id);
        });
      }
    }
  }

  t.updatedAt = new Date().toISOString();
  t.revision = (t.revision || 0) + 1;
  all[cleanId] = t;
  saveTournaments(all);
  return { success: true, tournament: t };
}

/**
 * Mereset turnamen ke kondisi awal (Hanya Host)
 */
function resetTournament(tournamentId, role) {
  if (role !== 'host') {
    return { success: false, error: 'Akses ditolak: Hanya Host yang dapat mereset turnamen.' };
  }
  const cleanId = String(tournamentId || '').trim().toUpperCase();
  const all = loadTournaments();
  let t = all[cleanId];
  if (!t) {
    t = {
      id: cleanId,
      name: 'Turnamen Gaple',
      mode: 'knockout',
      players: [],
      rounds: [],
      currentRoundIndex: 0,
      winners: { juara1: null, juara2: null, juara3: null, juara4: null }
    };
  }

  t.winners = { juara1: null, juara2: null, juara3: null, juara4: null };
  t.currentRoundIndex = 0;

  if (t.mode === 'roundrobin') {
    if (Array.isArray(t.rrMatches)) {
      t.rrMatches.forEach(m => {
        m.scores = {};
        m.winnerIds = [];
        m.status = 'pending';
        m.ongoingGame = null;
        m.judgeName = null;
      });
    }
    t.standings = [];
  } else {
    // Knockout System
    if (Array.isArray(t.rounds)) {
      t.rounds.forEach((round, rIdx) => {
        round.isDone = false;
        if (Array.isArray(round.tables)) {
          round.tables.forEach((tbl, tIdx) => {
            tbl.scores = {};
            tbl.winnerIds = [];
            tbl.status = 'pending';
            tbl.isDone = false;
            tbl.ongoingGame = null;
            tbl.judgeName = null;
            // Babak 0 tetap memiliki playerIds awal, babak lanjutan dikosongkan
            if (rIdx > 0) {
              tbl.playerIds = [];
            }
          });
        }
      });
    }
  }

  t.updatedAt = new Date().toISOString();
  t.revision = (t.revision || 0) + 1;
  all[cleanId] = t;
  saveTournaments(all);
  return { success: true, tournament: t };
}

/**
 * Menghapus data turnamen
 */
function deleteTournament(id, role) {
  if (role && role !== 'host') {
    return false;
  }
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
    isCompleted: Boolean(t.winners && t.winners.juara1)
  }));
}

module.exports = {
  getTournament,
  saveTournament,
  updateTable,
  updatePlayers,
  resetTournament,
  deleteTournament,
  listTournaments
};
