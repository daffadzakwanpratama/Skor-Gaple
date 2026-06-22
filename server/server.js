'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const gameEngine = require('./gameEngine');
const botPlayer = require('./botPlayer');
const db = require('./db');

const app = express();
app.use(cors());

// Serve static files from the client folder
app.use(express.static(path.join(__dirname, '../client')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Port configuration
const PORT = process.env.PORT || 3000;

// In-memory Room store
const rooms = {};

// Helper: Generate a unique 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]);
  return code;
}

// Helper: Generate a random bot player profile
function generateBotProfile(existingPlayers) {
  const names = ['Bot Fox', 'Bot Frog', 'Bot Cat', 'Bot Panda', 'Bot Tiger', 'Bot Koala', 'Bot Pig', 'Bot Lion', 'Bot Chicken', 'Bot Monkey'];
  const avatars = ['fox', 'frog', 'cat', 'panda', 'tiger', 'koala', 'pig', 'lion', 'chicken', 'monkey'];
  const colors = ['#FF5252', '#448AFF', '#69F0AE', '#FFD740', '#E040FB', '#FF9100', '#00E5FF', '#FF4081'];
  
  // Pick unused name
  let name = '';
  do {
    name = names[Math.floor(Math.random() * names.length)];
  } while (existingPlayers.some(p => p.name === name));

  // Pick unused avatar
  let avatar = '';
  do {
    avatar = avatars[Math.floor(Math.random() * avatars.length)];
  } while (existingPlayers.some(p => p.avatar === avatar));

  // Pick unused color
  let color = '';
  do {
    color = colors[Math.floor(Math.random() * colors.length)];
  } while (existingPlayers.some(p => p.color === color));

  return {
    id: `bot_${Math.random().toString(36).substr(2, 9)}`,
    name,
    avatar,
    color,
    isBot: true,
    total: 0,
    winStreak: 0,
    isOnFire: false
  };
}

// Core Game Flow: Start a Round
function startRound(room) {
  const game = room.game;
  
  // Reset round-specific variables
  game.board = [];
  game.leftValue = null;
  game.rightValue = null;
  game.passCount = 0;
  game.lastPlayerId = null;

  // Starting Balak for this round
  const currentBalak = game.startingBalakSequence[game.currentStartingBalakIdx];

  // Deal cards
  const deck = gameEngine.createDeck();
  gameEngine.shuffle(deck);
  const { hands } = gameEngine.dealCards(deck, 4);

  // Map hands to player IDs
  game.hands = {};
  room.players.forEach((p, idx) => {
    game.hands[p.id] = hands[idx];
  });

  // Determine starting player
  let startingPlayerId = null;

  // Standard Indonesian rule:
  // If we have a firstPlayerId (Jalan Duluan) from a normal winner in the previous round, they go first.
  // Otherwise (first round, or previous round ended in a block/buntu), the player holding the starting balak goes first.
  if (game.firstPlayerId && room.players.some(p => p.id === game.firstPlayerId)) {
    startingPlayerId = game.firstPlayerId;
  } else {
    // Find who holds the current starting balak
    room.players.forEach(p => {
      if (game.hands[p.id].includes(currentBalak)) {
        startingPlayerId = p.id;
      }
    });
  }

  // Fallback: If for some reason the balak isn't held (e.g. custom hands), pick player 0
  if (!startingPlayerId) {
    startingPlayerId = room.players[0].id;
  }

  game.currentTurnIdx = room.players.findIndex(p => p.id === startingPlayerId);
  game.dealerId = room.players[getDealerIdx(room)].id;
  game.status = 'playing';

  // Broadcast round start to all players
  io.to(room.id).emit('gameStateUpdate', getClientGameState(room));

  // Trigger bot if the starting player is a bot
  triggerBotTurnIfNeeded(room);
}

// Helper to determine the Dealer (Pengocok) index based on current scores
function getDealerIdx(room) {
  const totals = room.players.map(p => p.total);
  const maxScore = Math.max(...totals);
  if (maxScore === 0) {
    // Diundi acak/first player index
    return 0;
  }
  return totals.indexOf(maxScore);
}

// Core Game Flow: End a Round
function endRound(room, winnerId, isNormalWin) {
  const game = room.game;
  
  // Calculate scores
  const roundResult = gameEngine.calculateScores(game.hands, game.board, game.lastPlayerId, isNormalWin);

  // Update scores and streaks
  room.players.forEach(p => {
    const roundScore = roundResult.scores[p.id] || 0;
    p.total += roundScore;

    // Streaks logic:
    if (p.id === roundResult.winnerId) {
      p.winStreak++;
    } else {
      p.winStreak = 0;
    }
    p.isOnFire = (p.winStreak >= 3);

    // Save statistics in file DB for humans
    if (!p.isBot) {
      db.updatePlayerStats(p.name, {
        roundWon: p.id === roundResult.winnerId,
        gaple: p.id === roundResult.winnerId && roundResult.type === 'gaple',
        gacor: p.id === roundResult.winnerId && roundResult.type === 'gacor',
        dungTak: p.id === roundResult.winnerId && roundResult.type === 'dung_tak',
        winStreak: p.winStreak
      });
    }
  });

  // Determine who goes first in the next round
  // Pemenang ronde sebelumnya dengan skor -10 (menang normal) dapat Jalan Duluan
  if (isNormalWin && roundResult.scores[winnerId] === -10) {
    game.firstPlayerId = winnerId;
  } else {
    game.firstPlayerId = null; // No one gets "Jalan Duluan", will fall back to starting balak holder
  }

  // Push round history log
  const roundLog = {
    roundNum: game.rounds.length + 1,
    winnerName: room.players.find(p => p.id === roundResult.winnerId).name,
    winnerAvatar: room.players.find(p => p.id === roundResult.winnerId).avatar,
    type: roundResult.type,
    scores: room.players.map(p => ({
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      score: roundResult.scores[p.id] || 0
    })),
    gapleCard: roundResult.gapleCard
  };
  game.rounds.push(roundLog);

  // Advance starting balak sequence for subsequent round
  game.currentStartingBalakIdx = (game.currentStartingBalakIdx + 1) % game.startingBalakSequence.length;

  // Check Game Over condition
  const reached100 = room.players.some(p => p.total >= 100);
  if (reached100) {
    // Match ends
    room.status = 'ended';
    game.status = 'ended';

    // Determine winner of match (lowest score)
    const sorted = [...room.players].sort((a, b) => a.total - b.total);
    const minTotal = sorted[0].total;
    room.players.forEach(p => {
      if (!p.isBot && p.total === minTotal) {
        db.updatePlayerStats(p.name, { matchWon: true });
      }
    });

    // Construct unified history object
    const historyObj = {
      id: room.id + '_' + Date.now(),
      name: `Online Room ${room.id}`,
      players: room.players.map(p => ({
        name: p.name,
        total: p.total,
        avatar: p.avatar,
        color: p.color
      })),
      rounds: game.rounds.map(r => ({
        scores: room.players.map(p => {
          const scoreRow = (r.scores || []).find(s => s.name === p.name);
          return scoreRow ? scoreRow.score : 0;
        }),
        gapleCard: r.gapleCard
      })),
      status: 'done',
      createdAt: new Date().toISOString()
    };
    db.saveGameToHistory(historyObj);

    // Broadcast Game Over
    io.to(room.id).emit('gameOver', {
      players: room.players,
      rounds: game.rounds,
      leaderboard: [...room.players].sort((a, b) => a.total - b.total)
    });
  } else {
    // Broadcast round result
    game.status = 'roundEnded';
    io.to(room.id).emit('roundEnded', {
      roundLog,
      players: room.players,
      nextRoundNum: game.rounds.length + 1
    });
  }
}

// Bot Automation Trigger
function triggerBotTurnIfNeeded(room) {
  const game = room.game;
  if (room.status !== 'playing' || game.status !== 'playing') return;

  const currentPlayer = room.players[game.currentTurnIdx];
  if (!currentPlayer || !currentPlayer.isBot) return;

  // Simulate AI thinking time
  setTimeout(() => {
    // Safety check that turn hasn't changed or game ended
    if (room.status !== 'playing' || game.status !== 'playing') return;
    const activePlayer = room.players[game.currentTurnIdx];
    if (activePlayer.id !== currentPlayer.id) return;

    const hand = game.hands[currentPlayer.id];
    const decision = botPlayer.selectMove(hand, game.leftValue, game.rightValue);

    if (decision) {
      // Play card
      const { tile, side } = decision;
      
      // First round first turn rule: if it's the first move of round 1, bot MUST play starting balak
      if (game.board.length === 0 && game.rounds.length === 0) {
        const startBalak = game.startingBalakSequence[0];
        if (hand.includes(startBalak)) {
          // Play the start balak
          makeMove(room, currentPlayer.id, startBalak, 'right');
          return;
        }
      }

      makeMove(room, currentPlayer.id, tile, side);
    } else {
      // Pass
      makePass(room, currentPlayer.id);
    }
  }, 1500);
}

// Core Move logic
function makeMove(room, playerId, tile, side) {
  const game = room.game;
  const hand = game.hands[playerId];
  
  // Remove tile from hand
  const cardIdx = hand.indexOf(tile);
  if (cardIdx !== -1) {
    hand.splice(cardIdx, 1);
  }

  // Play tile on board
  const result = gameEngine.playCard(game.board, tile, side);
  game.board = result.board;
  game.leftValue = result.left;
  game.rightValue = result.right;
  game.lastPlayerId = playerId;
  game.passCount = 0; // reset passes

  // Check round win (hand empty)
  if (hand.length === 0) {
    endRound(room, playerId, true);
    return;
  }

  // Check round block (board blocked)
  if (gameEngine.isBlocked(game.board, game.hands)) {
    endRound(room, playerId, false);
    return;
  }

  // Advance turn
  game.currentTurnIdx = (game.currentTurnIdx + 1) % room.players.length;
  io.to(room.id).emit('gameStateUpdate', getClientGameState(room));

  // Trigger next bot if applicable
  triggerBotTurnIfNeeded(room);
}

// Core Pass logic
function makePass(room, playerId) {
  const game = room.game;
  game.passCount++;

  // Check if all players passed (Gaple block due to passes)
  if (game.passCount >= room.players.length) {
    endRound(room, game.lastPlayerId, false);
    return;
  }

  // Advance turn
  game.currentTurnIdx = (game.currentTurnIdx + 1) % room.players.length;
  io.to(room.id).emit('gameStateUpdate', getClientGameState(room));

  // Trigger next bot if applicable
  triggerBotTurnIfNeeded(room);
}

// Helper: Filter state information sent to the clients (hides card hands of other players)
function getClientGameState(room) {
  const game = room.game;
  if (!game) return null;

  const clientHands = {};
  room.players.forEach(p => {
    // For each player, we send their own hand, and only the *count* of other players' hands
    clientHands[p.id] = {
      count: game.hands[p.id].length,
      tiles: game.hands[p.id] // We send the full array, but the client socket listener will filter it!
    };
  });

  return {
    roomId: room.id,
    players: room.players,
    board: game.board,
    leftValue: game.leftValue,
    rightValue: game.rightValue,
    currentTurnIdx: game.currentTurnIdx,
    dealerId: game.dealerId,
    firstPlayerId: game.firstPlayerId,
    roundsCount: game.rounds.length,
    startingBalak: game.startingBalakSequence[game.currentStartingBalakIdx],
    status: game.status,
    hands: clientHands
  };
}

// WebSocket Listeners
io.on('connection', socket => {
  console.log(`Pemain tersambung: ${socket.id}`);

  // Create Room
  socket.on('createRoom', ({ name, avatar, color }) => {
    const code = generateRoomCode();
    rooms[code] = {
      id: code,
      hostId: socket.id,
      players: [
        {
          id: socket.id,
          name,
          avatar,
          color,
          isBot: false,
          total: 0,
          winStreak: 0,
          isOnFire: false
        }
      ],
      status: 'lobby',
      game: null
    };

    socket.join(code);
    socket.emit('roomJoined', { room: rooms[code], myId: socket.id });
    console.log(`Lobby ${code} dibuat oleh ${name}`);
  });

  // Join Room
  socket.on('joinRoom', ({ roomId, name, avatar, color }) => {
    const code = roomId.toUpperCase();
    const room = rooms[code];

    if (!room) {
      socket.emit('errorMsg', 'Ruangan tidak ditemukan.');
      return;
    }
    if (room.status !== 'lobby') {
      socket.emit('errorMsg', 'Ruangan sudah mulai bermain.');
      return;
    }
    if (room.players.length >= 4) {
      socket.emit('errorMsg', 'Ruangan sudah penuh (maks 4 pemain).');
      return;
    }

    // Add player
    const newPlayer = {
      id: socket.id,
      name,
      avatar,
      color,
      isBot: false,
      total: 0,
      winStreak: 0,
      isOnFire: false
    };
    room.players.push(newPlayer);
    socket.join(code);

    io.to(code).emit('roomJoined', { room, myId: null });
    socket.emit('roomJoined', { room, myId: socket.id });
    console.log(`${name} bergabung ke lobby ${code}`);
  });

  // Get Long-term Stats
  socket.on('getLifetimeStats', ({ name }, callback) => {
    const stats = db.getPlayerStats(name);
    callback(stats);
  });

  // Get All Long-term Stats
  socket.on('getAllLifetimeStats', (callback) => {
    const allStats = db.loadAllStats();
    callback(allStats);
  });

  // Get Online Games History
  socket.on('getOnlineHistory', (callback) => {
    const history = db.loadAllHistory();
    callback(history);
  });

  // Start Game
  socket.on('startGame', ({ startBalak }) => {
    // Find room hosted by this socket
    const room = Object.values(rooms).find(r => r.hostId === socket.id);
    if (!room) return;

    room.status = 'playing';
    
    // Fill remaining spots with bots to enforce 4 players
    while (room.players.length < 4) {
      const bot = generateBotProfile(room.players);
      room.players.push(bot);
    }

    // Initialize stats database counters for human players
    room.players.forEach(p => {
      if (!p.isBot) {
        db.updatePlayerStats(p.name, { matchPlayed: true });
      }
    });

    // Create Game Schema
    const sequence = ['0/0', '1/1', '2/2', '3/3', '4/4', '5/5', '6/6'];
    const startIdx = sequence.indexOf(startBalak || '0/0');
    
    room.game = {
      board: [],
      leftValue: null,
      rightValue: null,
      hands: {},
      stockpile: [],
      currentTurnIdx: 0,
      rounds: [],
      startingBalakSequence: sequence,
      currentStartingBalakIdx: startIdx !== -1 ? startIdx : 0,
      dealerId: null,
      firstPlayerId: null,
      lastPlayerId: null,
      passCount: 0,
      status: 'playing'
    };

    startRound(room);
  });

  // Play Card Move
  socket.on('playCard', ({ tile, side }) => {
    const room = Object.values(rooms).find(r => r.players.some(p => p.id === socket.id));
    if (!room || room.status !== 'playing') return;

    const game = room.game;
    const currentPlayer = room.players[game.currentTurnIdx];
    
    if (currentPlayer.id !== socket.id) {
      socket.emit('errorMsg', 'Bukan giliran Anda!');
      return;
    }

    // Validate valid move
    const hand = game.hands[socket.id];
    if (!hand.includes(tile)) {
      socket.emit('errorMsg', 'Kartu tidak ada di tangan Anda.');
      return;
    }

    if (!gameEngine.isValidMove(tile, game.leftValue, game.rightValue)) {
      socket.emit('errorMsg', 'Kartu tidak cocok dengan meja.');
      return;
    }

    // First round first turn validation
    if (game.board.length === 0 && game.rounds.length === 0) {
      const startBalak = game.startingBalakSequence[game.currentStartingBalakIdx];
      if (tile !== startBalak && hand.includes(startBalak)) {
        socket.emit('errorMsg', `Ronde pertama harus membuang kartu Balak awal (${startBalak})!`);
        return;
      }
    }

    makeMove(room, socket.id, tile, side);
  });

  // Pass Turn
  socket.on('passTurn', () => {
    const room = Object.values(rooms).find(r => r.players.some(p => p.id === socket.id));
    if (!room || room.status !== 'playing') return;

    const game = room.game;
    const currentPlayer = room.players[game.currentTurnIdx];

    if (currentPlayer.id !== socket.id) {
      socket.emit('errorMsg', 'Bukan giliran Anda!');
      return;
    }

    // Validate that the player ACTUALLY has no moves
    const hand = game.hands[socket.id];
    const canPlay = hand.some(tile => gameEngine.isValidMove(tile, game.leftValue, game.rightValue));
    
    if (canPlay) {
      socket.emit('errorMsg', 'Anda memiliki kartu yang bisa dimainkan. Tidak boleh Lewat!');
      return;
    }

    makePass(room, socket.id);
  });

  // Next Round Trigger
  socket.on('nextRound', () => {
    const room = Object.values(rooms).find(r => r.hostId === socket.id);
    if (!room || room.status !== 'playing' || room.game.status !== 'roundEnded') return;
    startRound(room);
  });

  // Rematch / Main Lagi
  socket.on('rematch', () => {
    const room = Object.values(rooms).find(r => r.hostId === socket.id);
    if (!room || room.status !== 'ended') return;

    // Reset scores & streaks
    room.players.forEach(p => {
      p.total = 0;
      p.winStreak = 0;
      p.isOnFire = false;
      if (!p.isBot) {
        db.updatePlayerStats(p.name, { matchPlayed: true });
      }
    });

    room.status = 'playing';

    // We advance the starting balak idx based on the last one used
    // (FR-4.4: rematch room code preserved, stats advanced)
    room.game = {
      board: [],
      leftValue: null,
      rightValue: null,
      hands: {},
      stockpile: [],
      currentTurnIdx: 0,
      rounds: [],
      startingBalakSequence: room.game.startingBalakSequence,
      currentStartingBalakIdx: room.game.currentStartingBalakIdx, // continues sequence
      dealerId: null,
      firstPlayerId: null,
      lastPlayerId: null,
      passCount: 0,
      status: 'playing'
    };

    startRound(room);
  });

  // Disconnect Handling
  socket.on('disconnect', () => {
    console.log(`Pemain terputus: ${socket.id}`);
    
    // Find room the socket was in
    const roomCode = Object.keys(rooms).find(code => 
      rooms[code].players.some(p => p.id === socket.id)
    );

    if (roomCode) {
      const room = rooms[roomCode];
      
      // If room is in lobby, simply remove them
      if (room.status === 'lobby') {
        room.players = room.players.filter(p => p.id !== socket.id);
        
        if (room.players.length === 0) {
          delete rooms[roomCode];
          console.log(`Lobby ${roomCode} dihapus karena kosong.`);
        } else {
          // If host left, assign new host
          if (room.hostId === socket.id) {
            room.hostId = room.players[0].id;
          }
          io.to(roomCode).emit('roomJoined', { room, myId: null });
        }
      } else {
        // If match in progress, mark player as offline or replace with Bot/allow reconnect
        // For simplicity in v1, we can trigger a system message or just treat them as disconnected
        // ( reconnect handling could allow matching socket IDs, but to stay simple we alert others )
        io.to(roomCode).emit('playerDisconnected', { socketId: socket.id });
      }
    }
  });
});

// Start listening
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Server online di http://localhost:${PORT}`);
  console.log(`Mainkan Gaple Online bersama teman di browser Anda!`);
  console.log(`===================================================`);
});
