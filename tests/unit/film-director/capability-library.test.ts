/**
 * Every capability demo must resolve without rejection, deterministically. A
 * demo that would reject at load time should fail here, not when the user
 * clicks it. The determinism check re-resolves each demo and demands an
 * identical result: the seeded axis streams are the only randomness, so two
 * resolutions of the same input must agree bit for bit.
 *
 * Below that, the per-capability tests: each one is the machine-checkable half
 * of a claim the library makes in one line of prose. "The camera follows a
 * walking performer" is a sentence; the test proves the target actually moved
 * with them.
 */
import { describe, expect, it } from "vitest";

import { getSceneEnvironmentRendererKey } from "../../../src/lib/shared/3d/environments/domain/scene-environment";
import { getStageCoordinateFrame } from "../../../src/lib/shared/3d/environments/domain/stage-coordinate-frame";
import {
  CAPABILITY_LIBRARY,
  capabilityDemo,
} from "../../../src/routes/test/film-director/_capabilities/index";
import { directorFloorY } from "../../../src/routes/test/film-director/_lib/camera-language";
import { resolveStepChange } from "../../../src/routes/test/film-director/_lib/director-step-changes";
import { resolveHeldStep } from "../../../src/routes/test/film-director/_lib/director-step-holds";
import { DIRECTOR_SCENE_CATEGORIES } from "../../../src/routes/test/film-director/_lib/film-director-schema";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import { sampleFilmDirector } from "../../../src/routes/test/film-director/_lib/sample-film-director";

/**
 * Every demo, resolved once. Resolution is pure and deterministic (the test
 * below proves it), so the whole file can share one pass rather than paying
 * for 22 of them per assertion.
 */
const SPECS = CAPABILITY_LIBRARY.map((entry) => ({
  entry,
  spec: resolveFilmDirectorSpec(entry.film),
}));

/**
 * The demo that owns a scene, and that scene resolved. A lead-in scene appears
 * in two demos — `combined-draw` is both its own demo and the callback's
 * establishing shot — and library order puts the owner first, so the search
 * finds the one the user reaches by clicking that capability.
 */
function find(sceneId: string) {
  for (const { spec } of SPECS) {
    const scene = spec.scenes.find((entry) => entry.id === sceneId);
    if (scene) return { spec, scene };
  }
  throw new Error(`No capability scene "${sceneId}"`);
}

const scene = (id: string) => find(id).scene;

/** Every resolved scene in the library, lead-in duplicates included. */
const allScenes = SPECS.flatMap(({ spec }) => spec.scenes);

describe("capability library", () => {
  it("has unique ids", () => {
    const ids = CAPABILITY_LIBRARY.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("addresses every demo by its id", () => {
    for (const entry of CAPABILITY_LIBRARY) {
      expect(capabilityDemo(entry.id)).toBe(entry);
    }
    expect(() => capabilityDemo("no-such-capability")).toThrow();
  });

  it("says what each demo shows, in one line", () => {
    for (const entry of CAPABILITY_LIBRARY) {
      expect(entry.label.length).toBeGreaterThan(0);
      // The whole point of the rewrite: a line, not a paragraph. Anything
      // longer than this stops being something anyone reads on the way past.
      expect(entry.demonstrates.length).toBeGreaterThan(0);
      expect(entry.demonstrates.length).toBeLessThanOrEqual(90);
    }
  });

  it("groups every demo under a category, and spends every category", () => {
    // The front door groups by category, so an uncategorized demo would fall
    // out of the list entirely. And a category nothing uses is a heading that
    // can never appear — the enum is closed precisely so the list stays a real
    // description of what the director does rather than an aspiration.
    const used = new Set(CAPABILITY_LIBRARY.map((entry) => entry.category));
    expect([...DIRECTOR_SCENE_CATEGORIES].filter((c) => !used.has(c))).toEqual(
      []
    );
  });

  it("keeps a demo to the one scene it demonstrates, plus any setup it needs", () => {
    for (const entry of CAPABILITY_LIBRARY) {
      // Clicking a capability plays that capability. A lead-in is allowed
      // where the point cannot be made cold — a tempo CHANGE needs a tempo to
      // change away from — and the demonstrated scene is always the last one.
      expect(entry.film.scenes.length).toBeLessThanOrEqual(2);
      expect(entry.film.scenes.at(-1)!.id).toBe(entry.id);
    }
  });

  for (const entry of CAPABILITY_LIBRARY) {
    describe(`"${entry.label}" (${entry.id})`, () => {
      it("resolves without rejection", () => {
        const resolved = resolveFilmDirectorSpec(entry.film);
        expect(resolved.scenes.length).toBeGreaterThan(0);
        for (const scene of resolved.scenes) {
          // Gap 21 made zero a legal cast, so this is a sanity floor on the
          // shape of the resolved list rather than a minimum head count.
          expect(scene.performance.performers.length).toBeGreaterThanOrEqual(0);
        }
      });

      it("resolves deterministically", () => {
        const first = resolveFilmDirectorSpec(entry.film);
        const second = resolveFilmDirectorSpec(entry.film);
        expect(second).toEqual(first);
      });
    });
  }

  it("draws six planes at once, and never the wall", () => {
    const combined = scene("combined-draw");
    const lefts = combined.performance.performers.map((p) => p.leftPlane);
    const rights = combined.performance.performers.map((p) => p.rightPlane);
    expect(new Set(lefts).size).toBe(lefts.length);
    expect(new Set(rights).size).toBe(rights.length);
    expect(lefts).not.toContain("wall");
    expect(rights).not.toContain("wall");
    // Distinctness is only guaranteed PER axis — the pinned seed additionally
    // produces zero cross-axis repeats, so the frame actually shows six
    // different planes rather than four unique ones reused across six slots.
    expect(new Set([...lefts, ...rights]).size).toBe(6);
  });

  it("counts a scene in beats, and lands a walker on the beat it names", () => {
    const onBeat = scene("on-the-beat");
    expect(onBeat.durationSeconds).toBe(8);
    const pushStart = onBeat.camera.keyframes.find(
      (frame) => Math.abs(frame.atSeconds - 0) < 1e-6
    );
    const pushArrival = onBeat.camera.keyframes.find(
      (frame) => Math.abs(frame.atSeconds - 4) < 1e-6
    );
    expect(pushStart).toBeDefined();
    expect(pushArrival).toBeDefined();
    // A keyframe existing at 4s isn't proof the push actually moved the
    // camera — compare against the 0s keyframe to prove it did.
    expect(pushArrival!.position).not.toEqual(pushStart!.position);
    const walker = onBeat.performance.performers[1]!;
    const arrival = walker.blocking.find(
      (frame) => Math.abs(frame.atSeconds - 4) < 1e-6
    );
    expect(arrival).toBeDefined();
    expect(arrival!.position).toEqual({ x: -1.5, z: -1 });
  });

  it("trucks, zooms and rolls the frame without turning it", () => {
    const edges = scene("camera-edges");
    expect(edges.durationSeconds).toBe(12);
    expect(edges.transition).toMatchObject({ durationSeconds: 1 });
    const kf = edges.camera.keyframes;
    const at = (t: number) =>
      kf.find((frame) => Math.abs(frame.atSeconds - t) < 1e-6)!;
    // Truck (0-4s): position and target translate by the same 1m ground vector.
    const truckDelta = [0, 1, 2].map(
      (axis) => at(4).position[axis]! - at(0).position[axis]!
    );
    const targetDelta = [0, 1, 2].map(
      (axis) => at(4).target[axis]! - at(0).target[axis]!
    );
    // toBeCloseTo, not toEqual: position and target sit at different absolute
    // magnitudes, so adding the identical translation vector to each rounds
    // to a ~1e-16 difference on subtraction — real floating point, not a bug.
    truckDelta.forEach((value, axis) => {
      expect(value).toBeCloseTo(targetDelta[axis]!, 9);
    });
    expect(Math.hypot(...truckDelta)).toBeCloseTo(1, 4);
    expect(truckDelta[1]).toBeCloseTo(0, 6);
    // Zoom (4-8s): fov 50 -> 35 with the camera parked.
    expect(at(4).fovDeg).toBe(50);
    expect(at(8).fovDeg).toBe(35);
    expect(at(8).position).toEqual(at(4).position);
    // Roll (8-10s): explicit 0 anchor ramping to +10 (clockwise on screen).
    expect(at(8).rollDeg).toBe(0);
    expect(at(10).rollDeg).toBe(10);
    // Scenes that never roll stay sparse:
    expect(
      scene("on-the-beat").camera.keyframes.every(
        (frame) => !("rollDeg" in frame)
      )
    ).toBe(true);
  });

  it("follows a walking performer instead of losing them", () => {
    const { spec: resolved, scene: tracking } = find("tracking-shot");
    expect(tracking.camera.tracking).toEqual({
      performerId: "performer-2",
      mode: "follow",
    });
    // Only the scene that asked carries the key at all, so every other scene
    // in the library resolves exactly as it did before tracking existed.
    for (const other of allScenes) {
      if (other.id === "tracking-shot") continue;
      expect("tracking" in other.camera).toBe(false);
    }

    const trackedWalker = tracking.performance.performers.find(
      (performer) => performer.id === "performer-2"
    )!;
    const arrivalMark = trackedWalker.blocking.at(-1)!.position;
    const walked = {
      x: arrivalMark.x - trackedWalker.position.x,
      z: arrivalMark.z - trackedWalker.position.z,
    };
    expect(Math.hypot(walked.x, walked.z)).toBeCloseTo(3, 6);

    const sampleAt = (offset: number) =>
      sampleFilmDirector(resolved, tracking.startSeconds + offset).camera;
    const opening = sampleAt(0);
    const crossed = sampleAt(4);
    expect(crossed.target[0]! - opening.target[0]!).toBeCloseTo(walked.x, 6);
    expect(crossed.target[2]! - opening.target[2]!).toBeCloseTo(walked.z, 6);
    expect(crossed.position[0]! - opening.position[0]!).toBeCloseTo(
      walked.x,
      6
    );
    expect(crossed.position[2]! - opening.position[2]!).toBeCloseTo(
      walked.z,
      6
    );
    // The frame stops when the walker does: the standing half of the scene
    // holds the offset the crossing produced rather than drifting on.
    const standing = sampleAt(6);
    expect(standing.position).toEqual(crossed.position);
    expect(standing.target).toEqual(crossed.target);
  });

  it("cuts between three framings inside one scene", () => {
    const { spec: resolved, scene: shots } = find("three-shots");
    expect(shots.durationSeconds).toBe(8);
    const shotKeyframes = shots.camera.keyframes;
    const atCut = (t: number) =>
      shotKeyframes.filter((frame) => Math.abs(frame.atSeconds - t) < 1e-6);
    // Six beats at 120bpm is 3s; the third shot takes what is left.
    expect(atCut(3)).toHaveLength(2);
    expect(atCut(6)).toHaveLength(2);
    expect(atCut(3)[0]!.interpolation).toBe("step");
    expect(atCut(6)[0]!.interpolation).toBe("step");

    const shotSample = (offset: number) =>
      sampleFilmDirector(resolved, shots.startSeconds + offset).camera;
    const jump = (a: number, b: number) => {
      const from = shotSample(a).position;
      const to = shotSample(b).position;
      return Math.hypot(
        to[0]! - from[0]!,
        to[1]! - from[1]!,
        to[2]! - from[2]!
      );
    };
    // A cut, not a glide: a metre of travel inside ten milliseconds.
    expect(jump(2.99, 3)).toBeGreaterThan(1);
    expect(jump(5.99, 6)).toBeGreaterThan(1);

    const opener = shotKeyframes[0]!;
    expect(opener.atSeconds).toBe(0);
    const range = (frame: (typeof shotKeyframes)[number]) =>
      Math.hypot(
        frame.position[0]! - frame.target[0]!,
        frame.position[1]! - frame.target[1]!,
        frame.position[2]! - frame.target[2]!
      );
    // Shot one is wide; shot two is a close-up, so it sits nearer its subject.
    expect(range(opener)).toBeGreaterThan(range(atCut(3)[1]!));
  });

  it("puts a saved sequence beside two transforms of it", () => {
    const derived = scene("derived-sequences");
    expect(
      derived.performance.performers.map((performer) => performer.sequence)
    ).toEqual([
      { library: "0c7e6529-1dca-4254-903e-7068e38c030c" },
      {
        transformOf: "performer-1",
        transforms: [
          { op: "rotate", degrees: 90, direction: "cw" },
          { op: "swap-hands" },
        ],
      },
      { transformOf: "performer-1", transforms: [{ op: "rewind" }] },
    ]);
    expect(derived.durationSeconds).toBe(8);
  });

  it("walks a performer in from outside the frame, along a curve", () => {
    const edgesOfStage = scene("edges-of-the-stage");
    expect(edgesOfStage.durationSeconds).toBe(8);
    const entrant = edgesOfStage.performance.performers.find(
      (performer) => performer.id === "performer-3"
    )!;
    // The opening mark is off camera and unclamped, and the stage extent
    // stretched to include it rather than pulling it in.
    expect(entrant.position).toEqual({ x: 8, z: -1 });
    expect(edgesOfStage.performance.stageExtent).toContainEqual({
      x: 8,
      z: -1,
    });

    const walkFrames = entrant.blocking.filter((frame) => frame.walking);
    // Fifteen chords: about 7.2m of arc at a 0.5m target chord length.
    expect(walkFrames).toHaveLength(15);
    expect(entrant.blocking.at(-1)!.position).toEqual({ x: 1.8, z: -0.3 });

    // The path is a bow, not a line: the halfway keyframe sits well off the
    // straight route between the two marks (the sagitta is a quarter of the
    // 6.24m chord, about 1.56m).
    const from = entrant.position;
    const to = { x: 1.8, z: -0.3 };
    const chord = Math.hypot(to.x - from.x, to.z - from.z);
    const halfway = entrant.blocking[7]!.position;
    const offChord =
      Math.abs(
        (to.x - from.x) * (from.z - halfway.z) -
          (from.x - halfway.x) * (to.z - from.z)
      ) / chord;
    expect(offChord).toBeGreaterThan(1.4);

    // Constant ground speed: every chord is the same length and lands on the
    // same time step.
    const legLengths = walkFrames.map((frame, index) => {
      const next = entrant.blocking[index + 1]!;
      return Math.hypot(
        next.position.x - frame.position.x,
        next.position.z - frame.position.z
      );
    });
    for (const leg of legLengths) expect(leg).toBeCloseTo(legLengths[0]!, 6);
    // Arc length over the six seconds twelve beats buy, under the 2.6 ceiling.
    const arcLength = legLengths.reduce((sum, leg) => sum + leg, 0);
    expect(arcLength / 6).toBeLessThan(2.6);
    expect(arcLength).toBeGreaterThan(chord);

    // The watcher spins nothing at all, beside two performers who do.
    expect(
      edgesOfStage.performance.performers.find((p) => p.id === "performer-1")!
        .sequence
    ).toEqual({ source: "none" });
  });

  it("changes effect, effort and holds partway through a scene", () => {
    const perStep = scene("per-step-changes");
    expect(perStep.durationSeconds).toBe(8);
    const [changer, holder] = perStep.performance.performers;
    expect(changer!.stepEffects).toEqual([
      { step: 0, effect: "none" },
      { step: 4, effect: "trails" },
      { step: 8, effect: "fire" },
    ]);
    expect(changer!.stepEfforts).toEqual([{ step: 8, effort: "punch" }]);
    expect(changer!.holds).toEqual([]);
    expect(holder!.holds).toEqual([{ fromStep: 4, steps: 4 }]);
    expect(holder!.stepEffects).toEqual([]);

    // The lookup the frame loop performs: base value before the first entry,
    // then each entry holding until the next supersedes it.
    const effectAt = (step: number) =>
      resolveStepChange(
        changer!.stepEffects.map((entry) => ({
          step: entry.step,
          value: entry.effect,
        })),
        step,
        changer!.effect
      );
    expect(effectAt(3)).toBe("none");
    expect(effectAt(4)).toBe("trails");
    expect(effectAt(7)).toBe("trails");
    expect(effectAt(8)).toBe("fire");

    // The hold, read the way the scene component reads it: pinned through its
    // window, then four steps behind the shared clock for good.
    const holdAt = (step: number) =>
      resolveHeldStep(step, 0, holder!.beatOffset, holder!.holds, 0);
    expect(holdAt(3)).toEqual({ step: 3, progress: 0 });
    expect(holdAt(4)).toEqual({ step: 4, progress: 0 });
    expect(holdAt(7)).toEqual({ step: 4, progress: 0 });
    expect(holdAt(8)).toEqual({ step: 4, progress: 0 });
    expect(holdAt(12)).toEqual({ step: 8, progress: 0 });
  });

  it("cuts where it says cut, with no dissolve window anywhere", () => {
    for (const id of [
      "on-the-beat",
      "tracking-shot",
      "three-shots",
      "derived-sequences",
      "edges-of-the-stage",
      "per-step-changes",
    ]) {
      expect(scene(id).transition).toEqual({ kind: "cut", durationSeconds: 0 });
    }
  });

  it("a 90 degree orbit mirrors when only the direction flips", () => {
    const orbit = capabilityDemo("orbit-clockwise");

    // The library used to carry a counterclockwise twin of this scene,
    // staged identically, so the pair could be judged side by side while the
    // sign convention was still open. The convention is settled — clockwise
    // decreases azimuth — so the twin is built here instead. The invariant is
    // worth guarding; a second 16-beat demo of it is not.
    const authored = orbit.film.scenes.at(-1)!;
    const flipped = {
      ...authored,
      id: "orbit-counterclockwise",
      title: "Orbit Counterclockwise",
      camera: {
        ...authored.camera,
        moves: [{ move: "orbit", amount: { degrees: 90 }, direction: "ccw" }],
      },
    } as (typeof orbit.film.scenes)[number];

    const resolved = resolveFilmDirectorSpec({
      ...orbit.film,
      scenes: [authored, flipped],
    });

    const cw = resolved.scenes.find((scene) => scene.id === "orbit-clockwise")!;
    const ccw = resolved.scenes.find(
      (scene) => scene.id === "orbit-counterclockwise"
    )!;
    expect(cw).toBeDefined();
    expect(ccw).toBeDefined();
    expect(cw.performance.performers.map((p) => p.characterId)).toEqual(
      ccw.performance.performers.map((p) => p.characterId)
    );

    const cwStart = cw.camera.keyframes[0]!.position;
    const cwEnd = cw.camera.keyframes.at(-1)!.position;
    const ccwEnd = ccw.camera.keyframes.at(-1)!.position;
    // Same start, mirrored end: a 90 degree orbit each way from the same
    // front framing lands on opposite sides of the line.
    expect(ccw.camera.keyframes[0]!.position).toEqual(cwStart);
    expect(cwEnd[0]).toBeCloseTo(-ccwEnd[0], 6);
    expect(cwEnd[2]).toBeCloseTo(ccwEnd[2], 6);
  });
});

describe("capability library: off the tripod", () => {
  it("keeps each demo inside the six to eight second window", () => {
    expect(scene("dolly-zoom").durationSeconds).toBe(8);
    expect(scene("handheld").durationSeconds).toBe(7);
    expect(scene("whip-pans").durationSeconds).toBe(8);
  });

  it("the dolly zoom holds subject size while the rig travels", () => {
    const keyframes = scene("dolly-zoom").camera.keyframes;
    const size = (frame: (typeof keyframes)[number]) =>
      Math.tan((frame.fovDeg * Math.PI) / 360) *
      Math.hypot(
        frame.position[0]! - frame.target[0]!,
        frame.position[1]! - frame.target[1]!,
        frame.position[2]! - frame.target[2]!
      );
    const opening = size(keyframes[0]!);
    for (const frame of keyframes) {
      expect(Math.abs(size(frame) - opening) / opening).toBeLessThan(0.01);
    }
    expect(keyframes.at(-1)!.fovDeg).toBeGreaterThan(keyframes[0]!.fovDeg + 10);
  });

  it("only the handheld scene carries a handheld envelope", () => {
    expect(scene("handheld").camera.handheld).toMatchObject({
      meters: 0.05,
      degrees: 1,
    });
    for (const other of allScenes) {
      if (other.id === "handheld") continue;
      expect("handheld" in other.camera).toBe(false);
    }
  });

  it("the whip pans end aimed at each performer in turn", () => {
    const { spec: resolved, scene: target } = find("whip-pans");
    const marks = new Map(
      target.performance.performers.map((performer) => [
        performer.id,
        performer.position,
      ])
    );
    const aimedAt = (offset: number, performerId: string) => {
      const camera = sampleFilmDirector(
        resolved,
        target.startSeconds + offset
      ).camera;
      const mark = marks.get(performerId)!;
      const aim = Math.atan2(
        camera.target[0]! - camera.position[0]!,
        camera.target[2]! - camera.position[2]!
      );
      const want = Math.atan2(
        mark.x - camera.position[0]!,
        mark.z - camera.position[2]!
      );
      expect(aim).toBeCloseTo(want, 3);
    };
    aimedAt(2.5, "him");
    aimedAt(5, "her");
    aimedAt(7.9, "him");
  });
});

describe("capability library: callback, empty stage, waltz", () => {
  it("keeps each demo inside its stated count", () => {
    expect(scene("callback").durationSeconds).toBe(6);
    expect(scene("empty-stage").durationSeconds).toBe(3);
    // Gap 22. Four bars of three at 90 bpm is twelve beats, which is 8s.
    expect(scene("waltz").durationSeconds).toBe(8);
  });

  it("the callback inherits its parent's staging and draw, changing only the camera", () => {
    const parent = scene("combined-draw");
    const child = scene("callback");
    expect(child.extends).toBe("combined-draw");
    expect(child.seedSource).toBe("combined-draw");
    expect(child.location).toEqual(parent.location);
    expect(child.performance.formation).toBe(parent.performance.formation);
    // Gap 14's whole point: the same distinct-and-not draw, dealt again under
    // the parent's name, lands on the same six planes.
    expect(
      child.performance.performers.map((performer) => [
        performer.leftPlane,
        performer.rightPlane,
      ])
    ).toEqual(
      parent.performance.performers.map((performer) => [
        performer.leftPlane,
        performer.rightPlane,
      ])
    );
    // The one word that was stated: the camera moved to the other side.
    expect(child.camera.keyframes[0]!.position[2]).toBeGreaterThan(0);
    expect(parent.camera.keyframes[0]!.position[2]).toBeLessThan(0);
  });

  it("the empty stage casts nobody and frames the origin at head height", () => {
    const empty = scene("empty-stage");
    expect(empty.performance.performers).toEqual([]);
    expect(empty.performance.stageExtent).toEqual([{ x: 0, z: 0 }]);
    const frame = empty.camera.keyframes[0]!;
    expect(frame.target[0]).toBeCloseTo(0, 6);
    expect(frame.target[2]).toBeCloseTo(0, 6);
    const floorY = directorFloorY(
      getStageCoordinateFrame(
        getSceneEnvironmentRendererKey(empty.location.environmentId),
        empty.location.showStage
      ).performerAnchorY
    );
    expect(frame.target[1] - floorY).toBeCloseTo(1.4, 6);
    expect(frame.position.every(Number.isFinite)).toBe(true);
  });

  it("the waltz counts its scene and its push in bars", () => {
    const waltz = scene("waltz");
    expect(waltz.performance.bpm).toBe(90);
    // Two bars of three at 90 bpm is six beats, which is 4s, so the push
    // finishes halfway through the scene and the hold carries the rest.
    const keyframes = waltz.camera.keyframes;
    expect(keyframes.at(-1)!.atSeconds).toBeCloseTo(8, 6);
    const settled = keyframes.find((frame) => frame.atSeconds >= 4)!;
    expect(settled.atSeconds).toBeCloseTo(4, 6);
  });
});
