'use strict';

/**
 * Prioritizes a list of valid moves.
 * Heuristic:
 * 1. Balaks (double cards) are prioritized first.
 * 2. High-value cards (sum of dots) are prioritized second.
 */
function prioritizeMoves(moves) {
  return [...moves].sort((m1, m2) => {
    const [a1, b1] = m1.tile.split('/').map(Number);
    const [a2, b2] = m2.tile.split('/').map(Number);
    const isBalak1 = a1 === b1;
    const isBalak2 = a2 === b2;
    const sum1 = a1 + b1;
    const sum2 = a2 + b2;

    // Prioritize balaks over normal cards
    if (isBalak1 && !isBalak2) return -1;
    if (!isBalak1 && isBalak2) return 1;

    // Otherwise, prioritize higher dot sums (dumping heavy cards)
    return sum2 - sum1;
  });
}

/**
 * Selects the best move from the bot's hand.
 * Returns { tile, side } or null if no valid moves exist.
 */
function selectMove(hand, leftValue, rightValue) {
  // If the board is completely empty, the bot can play any card.
  if (leftValue === null && rightValue === null) {
    const moves = hand.map(tile => ({ tile, side: 'right' }));
    const sorted = prioritizeMoves(moves);
    return sorted[0] || null;
  }

  const validMoves = [];
  const leftMatches = new Set();
  const rightMatches = new Set();

  hand.forEach(tile => {
    const [a, b] = tile.split('/').map(Number);
    
    let canPlayLeft = (a === leftValue || b === leftValue);
    let canPlayRight = (a === rightValue || b === rightValue);

    if (canPlayLeft) {
      validMoves.push({ tile, side: 'left' });
    }
    if (canPlayRight) {
      validMoves.push({ tile, side: 'right' });
    }
  });

  if (validMoves.length === 0) {
    return null; // Bot must pass
  }

  // Choose the best move according to the heuristic
  const sortedMoves = prioritizeMoves(validMoves);
  return sortedMoves[0];
}

module.exports = {
  selectMove
};
