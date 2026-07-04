'use strict';

/**
 * Creates a standard deck of 28 domino tiles (0/0 to 6/6)
 */
function createDeck() {
  const deck = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push(`${i}/${j}`);
    }
  }
  return deck;
}

/**
 * Shuffles the deck in-place
 */
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
  return deck;
}

/**
 * Deals cards to players.
 * For 4 players, each gets 7 cards.
 */
function dealCards(deck, numPlayers = 4) {
  const hands = {};
  for (let p = 0; p < numPlayers; p++) {
    hands[p] = [];
  }
  
  // Deal 7 cards to each player
  for (let i = 0; i < 7; i++) {
    for (let p = 0; p < numPlayers; p++) {
      const card = deck.pop();
      if (card) {
        hands[p].push(card);
      }
    }
  }
  return { hands, stockpile: deck };
}

/**
 * Check if a card can be placed on the board
 */
function isValidMove(tile, leftValue, rightValue) {
  if (leftValue === null && rightValue === null) {
    return true; // Any tile is valid on an empty board
  }
  const [a, b] = tile.split('/').map(Number);
  return a === leftValue || b === leftValue || a === rightValue || b === rightValue;
}

/**
 * Place a card on the board on the specified side ('left' or 'right')
 * Returns the new board array and left/right values.
 */
function playCard(board, tile, playSide) {
  const [a, b] = tile.split('/').map(Number);
  
  if (board.length === 0) {
    return {
      board: [tile],
      left: a,
      right: b
    };
  }

  const newBoard = [...board];
  const leftValue = Number(newBoard[0].split('/')[0]);
  const rightValue = Number(newBoard[newBoard.length - 1].split('/')[1]);

  if (playSide === 'left') {
    if (b === leftValue) {
      newBoard.unshift(tile); // Match b: tile is oriented a/b, matching b to leftValue
    } else if (a === leftValue) {
      newBoard.unshift(`${b}/${a}`); // Match a: orient as b/a to match a to leftValue
    } else {
      throw new Error("Langkah tidak sah di sisi kiri");
    }
  } else if (playSide === 'right') {
    if (a === rightValue) {
      newBoard.push(tile); // Match a: tile is oriented a/b, matching a to rightValue
    } else if (b === rightValue) {
      newBoard.push(`${b}/${a}`); // Match b: orient as b/a to match b to rightValue
    } else {
      throw new Error("Langkah tidak sah di sisi kanan");
    }
  } else {
    throw new Error("Sisi penempatan tidak dikenal");
  }

  const newLeft = Number(newBoard[0].split('/')[0]);
  const newRight = Number(newBoard[newBoard.length - 1].split('/')[1]);

  return {
    board: newBoard,
    left: newLeft,
    right: newRight
  };
}

/**
 * Checks if the board is blocked (buntu/gaple)
 */
function isBlocked(board, hands) {
  if (board.length === 0) return false;
  
  const leftValue = Number(board[0].split('/')[0]);
  const rightValue = Number(board[board.length - 1].split('/')[1]);

  for (const playerIdx in hands) {
    const hand = hands[playerIdx];
    for (const tile of hand) {
      const [a, b] = tile.split('/').map(Number);
      if (a === leftValue || b === leftValue || a === rightValue || b === rightValue) {
        return false; // Found a playable card
      }
    }
  }
  return true;
}

/**
 * Sums the total dot points of cards remaining in a hand
 */
function calculateHandSum(hand) {
  return hand.reduce((sum, tile) => {
    const [a, b] = tile.split('/').map(Number);
    return sum + a + b;
  }, 0);
}

/**
 * Identifies the card with the lowest single-tile dot sum in a hand (used as tie-breaker)
 */
function getLowestSingleCardValue(hand) {
  if (hand.length === 0) return Infinity;
  let minVal = Infinity;
  hand.forEach(tile => {
    const [a, b] = tile.split('/').map(Number);
    const sum = a + b;
    if (sum < minVal) {
      minVal = sum;
    }
  });
  return minVal;
}

/**
 * Calculates scores for all players when a round ends.
 * Returns the round result object containing winnerId, scores, and win type.
 */
function calculateScores(hands, board, lastPlayerId, isNormalWin, lastTilePlayed = null) {
  const playerIds = Object.keys(hands);
  const scores = {};
  playerIds.forEach(id => {
    scores[id] = 0;
  });

  if (isNormalWin) {
    // Normal Win: Someone has 0 cards left
    const winnerId = playerIds.find(id => hands[id].length === 0);
    const lastTile = lastTilePlayed || (board.length > 0 ? board[board.length - 1] : null);
    
    let isBalak = false;
    let balakVal = null;
    if (lastTile) {
      const parts = lastTile.split('/');
      isBalak = parts[0] === parts[1];
      balakVal = lastTile; // e.g. "6/6"
    }

    let winType = 'normal';
    let winnerScore = -10;

    // Check if the board is also blocked after this last move (Gaple win)
    const isGapleBlock = isBlocked(board, hands);

    if (isBalak) {
      if (balakVal === '6/6') {
        winType = 'dung_tak';
        winnerScore = -30;
      } else if (balakVal === '0/0') {
        winType = 'gacor';
        winnerScore = -25;
      } else {
        if (isGapleBlock) {
          winType = 'gaple';
          winnerScore = -20;
        } else {
          winType = 'balak';
          winnerScore = -15;
        }
      }
    } else {
      if (isGapleBlock) {
        winType = 'gaple';
        winnerScore = -20;
      } else {
        winType = 'normal';
        winnerScore = -10;
      }
    }

    scores[winnerId] = winnerScore;
    return {
      winnerId,
      scores,
      type: winType,
      gapleCard: isGapleBlock ? lastTile : (isBalak ? lastTile : null)
    };
  } else {
    // Blocked (Buntu)
    const sums = {};
    playerIds.forEach(id => {
      sums[id] = calculateHandSum(hands[id]);
    });

    // Find player with the minimum sum
    let minSum = Infinity;
    let candidates = [];

    playerIds.forEach(id => {
      if (sums[id] < minSum) {
        minSum = sums[id];
        candidates = [id];
      } else if (sums[id] === minSum) {
        candidates.push(id);
      }
    });

    let winnerId = candidates[0];
    if (candidates.length > 1) {
      // Tie breaker: player with the lowest single card in hand
      let lowestCardVal = Infinity;
      candidates.forEach(id => {
        const val = getLowestSingleCardValue(hands[id]);
        if (val < lowestCardVal) {
          lowestCardVal = val;
          winnerId = id;
        }
      });
    }

    // Scores calculation for Buntu:
    // Losers get positive points equal to their remaining hand sums (FR-3.1).
    // Winner gets:
    // - If they caused the block (last player who played the blocking card): they get -20 (Gaple).
    // - If they did not cause the block (passive win): they get 0.
    const isWinnerBlocker = String(winnerId) === String(lastPlayerId);
    const lastTile = lastTilePlayed || (board.length > 0 ? board[board.length - 1] : null);

    playerIds.forEach(id => {
      if (id === winnerId) {
        scores[id] = isWinnerBlocker ? -20 : 0;
      } else {
        scores[id] = sums[id]; // +N
      }
    });

    return {
      winnerId,
      scores,
      type: isWinnerBlocker ? 'gaple' : 'buntu',
      gapleCard: lastTile // the blocking card is recorded
    };
  }
}

module.exports = {
  createDeck,
  shuffle,
  dealCards,
  isValidMove,
  playCard,
  isBlocked,
  calculateHandSum,
  calculateScores
};
