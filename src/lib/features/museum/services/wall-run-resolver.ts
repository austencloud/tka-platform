import type { ResolvedWalls, WallRun, DoorOpening } from "../domain/museum-kit-types";

export interface RoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resolve a room's perimeter into merged wall runs + door openings.
 * Walks each of the four borders, splitting maximal wall stretches at gaps.
 * Mirrors the stamper's border model (north/south advance x, east/west advance z).
 */
export function resolveWallRuns(
  room: RoomRect,
  isWall: (x: number, y: number) => boolean,
): ResolvedWalls {
  const runs: WallRun[] = [];
  const doors: DoorOpening[] = [];
  const x0 = room.x,
    x1 = room.x + room.w - 1;
  const y0 = room.y,
    y1 = room.y + room.h - 1;

  // axis="x" borders: north (y0) and south (y1). axis="z" borders: west (x0), east (x1).
  const borders: {
    axis: "x" | "z";
    fixed: number;
    from: number;
    to: number;
    at: (i: number) => [number, number];
  }[] = [
    { axis: "x", fixed: y0, from: x0, to: x1, at: (i) => [i, y0] },
    { axis: "x", fixed: y1, from: x0, to: x1, at: (i) => [i, y1] },
    { axis: "z", fixed: x0, from: y0, to: y1, at: (i) => [x0, i] },
    { axis: "z", fixed: x1, from: y0, to: y1, at: (i) => [x1, i] },
  ];

  for (const b of borders) {
    let runStart: number | null = null;
    let gapStart: number | null = null;
    const flushRun = (end: number) => {
      if (runStart !== null) {
        runs.push({ axis: b.axis, fixed: b.fixed, start: runStart, end });
        runStart = null;
      }
    };
    const flushGap = (end: number) => {
      if (gapStart !== null) {
        doors.push({ axis: b.axis, fixed: b.fixed, start: gapStart, end });
        gapStart = null;
      }
    };
    for (let i = b.from; i <= b.to; i++) {
      const [tx, ty] = b.at(i);
      if (isWall(tx, ty)) {
        flushGap(i - 1);
        if (runStart === null) runStart = i;
      } else {
        flushRun(i - 1);
        if (gapStart === null) gapStart = i;
      }
    }
    flushRun(b.to);
    flushGap(b.to);
  }

  return { runs, doors, posts: [] };
}
