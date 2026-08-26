import { describe, expect, it } from "vitest";

import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import { sampleDirectorBlockingTrack } from "../../../src/routes/test/film-director/_lib/director-blocking-track";

function film(performance: Record<string, unknown>, durationSeconds = 8) {
  return {
    version: 2,
    id: "blocking-film",
    title: "Blocking Film",
    scenes: [{ id: "s1", title: "S1", durationSeconds, performance }],
  };
}

function performersOf(doc: ReturnType<typeof film>) {
  return resolveFilmDirectorSpec(doc).scenes[0]!.performance.performers;
}

describe("blocking in the resolved spec", () => {
  it("gives every performer a track, even one that never moves", () => {
    const performers = performersOf(film({ cast: { count: 4 } }));
    for (const performer of performers) {
      expect(performer.blocking.length).toBeGreaterThanOrEqual(2);
      expect(performer.blocking[0]!.atSeconds).toBe(0);
      expect(performer.blocking.at(-1)!.atSeconds).toBeCloseTo(8, 6);
    }
  });

  it("a track with no moves holds the opening mark", () => {
    const [performer] = performersOf(film({ cast: { count: 2 } }));
    const opening = performer!.position;
    for (const seconds of [0, 4, 8]) {
      const frame = sampleDirectorBlockingTrack(performer!.blocking, seconds);
      expect(frame.position.x).toBeCloseTo(opening.x, 6);
      expect(frame.position.z).toBeCloseTo(opening.z, 6);
      expect(frame.isMoving).toBe(false);
    }
  });

  it("an end formation walks the cast from its opening marks onto the new ones", () => {
    const performers = performersOf(
      film({
        formation: "circle",
        blocking: { endFormation: "line" },
        cast: { count: 4 },
      })
    );
    const arrivals = performers.map(
      (performer) =>
        sampleDirectorBlockingTrack(performer.blocking, 8).position
    );
    // Everyone ends on one line: a single z, spread across x.
    const zs = arrivals.map((mark) => mark.z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(1e-6);
    expect(new Set(arrivals.map((mark) => mark.x.toFixed(4))).size).toBe(4);
    expect(
      performers.some((performer) =>
        performer.blocking.some((frame) => frame.walking)
      )
    ).toBe(true);
  });

  it("an end formation keeps the cast facing the way it opened", () => {
    const performers = performersOf(
      film({ formation: "grid-2x2", blocking: { endFormation: "line" }, cast: { count: 4 } })
    );
    for (const performer of performers) {
      const frame = sampleDirectorBlockingTrack(performer.blocking, 8);
      expect(frame.facingAngle).toBeCloseTo(performer.facingAngle, 6);
    }
  });

  it("a performer already on their end mark stands instead of walking in place", () => {
    const performers = performersOf(
      film({ formation: "line", blocking: { endFormation: "line" }, cast: { count: 4 } })
    );
    for (const performer of performers) {
      expect(performer.blocking.every((frame) => !frame.walking)).toBe(true);
    }
  });

  it("a performer's own blocking wins over the cast's end formation", () => {
    const performers = performersOf(
      film({
        formation: "line",
        blocking: { endFormation: "circle" },
        cast: {
          count: 4,
          performers: [
            {
              id: "performer-1",
              blocking: [{ move: "walk", direction: "right", amount: { meters: 1 } }],
            },
          ],
        },
      })
    );
    const own = performers[0]!;
    const arrival = sampleDirectorBlockingTrack(own.blocking, 8).position;
    const sideways = {
      x: own.position.x + Math.cos(own.facingAngle),
      z: own.position.z - Math.sin(own.facingAngle),
    };
    expect(arrival.x).toBeCloseTo(sideways.x, 6);
    expect(arrival.z).toBeCloseTo(sideways.z, 6);
  });

  it("cast defaults can hand the same blocking to everyone", () => {
    const performers = performersOf(
      film({
        formation: "line",
        cast: {
          count: 4,
          defaults: {
            blocking: [{ move: "walk", direction: "forward", amount: { meters: 1 } }],
          },
        },
      })
    );
    for (const performer of performers) {
      const arrival = sampleDirectorBlockingTrack(performer.blocking, 8).position;
      expect(arrival.x).toBeCloseTo(
        performer.position.x + Math.sin(performer.facingAngle),
        6
      );
      expect(arrival.z).toBeCloseTo(
        performer.position.z + Math.cos(performer.facingAngle),
        6
      );
    }
  });

  it("rejects an end formation that cannot hold the cast", () => {
    expect(() =>
      performersOf(film({ blocking: { endFormation: "solo" }, cast: { count: 4 } }))
    ).toThrow(/does not support 4 performers/);
  });

  it("rejects a custom end formation, which has no marks of its own", () => {
    expect(() =>
      performersOf(film({ blocking: { endFormation: "custom" }, cast: { count: 4 } }))
    ).toThrow(/no marks of its own/);
  });

  it("rejects blocking that would have a performer sprint across the stage", () => {
    expect(() =>
      performersOf(
        film(
          {
            formation: "line",
            cast: {
              count: 2,
              defaults: {
                blocking: [
                  { move: "walk", direction: "forward", amount: { meters: 30 } },
                ],
              },
            },
          },
          2
        )
      )
    ).toThrow(/Travel tops out at/);
  });
});
