/**
 * Time allocation for any list of director moves.
 *
 * A director states a duration when it matters ("hold on her for two seconds")
 * and leaves it off when it doesn't. Moves that state one keep it; whatever is
 * left over is split evenly among the moves that didn't.
 */
export interface DirectorMoveWindow {
  start: number;
  end: number;
}

export function allocateMoveWindows(
  moves: readonly { durationSeconds?: number }[],
  durationSeconds: number,
  subject: string
): DirectorMoveWindow[] {
  const explicit = moves.reduce(
    (sum, move) => sum + (move.durationSeconds ?? 0),
    0
  );
  if (explicit > durationSeconds + 1e-6) {
    throw new Error(
      `${subject} total ${explicit}s but the scene's duration is ${durationSeconds}s.`
    );
  }
  const openCount = moves.filter(
    (move) => move.durationSeconds === undefined
  ).length;
  const openShare = openCount ? (durationSeconds - explicit) / openCount : 0;
  let cursor = 0;
  return moves.map((move) => {
    const length = move.durationSeconds ?? openShare;
    const window = { start: cursor, end: cursor + length };
    cursor += length;
    return window;
  });
}
