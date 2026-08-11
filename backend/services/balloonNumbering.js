// backend/services/balloonNumbering.js

/**
 * Get the next balloon number.
 *
 * Important:
 * We calculate the number from the actual balloons
 * belonging to the current project/drawing.
 */

export function getNextBalloonNumber(
  balloons = []
) {
  if (!Array.isArray(balloons) || balloons.length === 0) {
    return 1;
  }

  const numbers = balloons
    .map((balloon) => Number(balloon.number))
    .filter((number) => Number.isFinite(number));

  if (numbers.length === 0) {
    return 1;
  }

  return Math.max(...numbers) + 1;
}

/**
 * Re-number balloons sequentially.
 *
 * This is useful when the user wants the balloons
 * ordered as:
 *
 * 1, 2, 3, 4, 5...
 */
export function renumberBalloons(balloons = []) {
  return balloons.map((balloon, index) => ({
    ...balloon,
    number: index + 1
  }));
}