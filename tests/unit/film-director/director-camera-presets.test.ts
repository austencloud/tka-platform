import { describe, expect, it } from "vitest";

import {
  fitDistance,
  fitPresetKeyframes,
  measureCastGeometry,
} from "../../../src/routes/test/film-director/_lib/director-camera-fit";
import {
  CAST_GEOMETRY_CLASS,
  DIRECTOR_CAMERA_PRESET_LIBRARY,
  defaultPresetForFormation,
  getCameraPreset,
  isPresetApprovedFor,
  resolvePresetForFormation,
  type DirectorFormation,
} from "../../../src/routes/test/film-director/_lib/director-camera-presets";
import {
  DIRECTOR_CAMERA_PRESETS,
  DIRECTOR_FORMATIONS,
} from "../../../src/routes/test/film-director/_lib/film-director-schema";

const ASPECT = 16 / 9;

function line(count: number, spacing = 2): { x: number; z: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (index - (count - 1) / 2) * spacing,
    z: 0,
  }));
}

describe("camera preset library", () => {
  it("covers every schema preset except the custom escape hatch", () => {
    const covered = DIRECTOR_CAMERA_PRESET_LIBRARY.map((preset) => preset.id);
    const expected = DIRECTOR_CAMERA_PRESETS.filter((id) => id !== "custom");
    expect([...covered].sort()).toEqual([...expected].sort());
  });

  it("classifies every formation the schema allows", () => {
    for (const formation of DIRECTOR_FORMATIONS) {
      expect(CAST_GEOMETRY_CLASS[formation]).toBeDefined();
    }
  });

  it("offers at least one preset for every formation", () => {
    for (const formation of DIRECTOR_FORMATIONS) {
      const offered = DIRECTOR_CAMERA_PRESET_LIBRARY.filter((preset) =>
        isPresetApprovedFor(preset, formation)
      );
      expect(offered.length).toBeGreaterThan(0);
    }
  });

  it("defaults to a preset that is approved for that formation", () => {
    for (const formation of DIRECTOR_FORMATIONS) {
      const id = defaultPresetForFormation(formation);
      expect(isPresetApprovedFor(getCameraPreset(id)!, formation)).toBe(true);
    }
  });

  it("falls back and reports the substitution for an unapproved pairing", () => {
    // three-quarter is not approved for a ringed cast.
    const resolution = resolvePresetForFormation("three-quarter", "circle");
    expect(resolution.preset.id).toBe("front-lockoff");
    expect(resolution.substitutedFor).toBe("three-quarter");
  });

  it("reports no substitution for an approved pairing", () => {
    const resolution = resolvePresetForFormation("high-reveal", "circle");
    expect(resolution.preset.id).toBe("high-reveal");
    expect(resolution.substitutedFor).toBeNull();
  });
});

describe("preset fit policy", () => {
  const frontLockoff = getCameraPreset("front-lockoff")!;

  it("clamps a solo to the preset's near bound instead of pulling in", () => {
    const cast = measureCastGeometry(line(1), 0);
    const distance = fitDistance(frontLockoff, cast, ASPECT);
    const [minimum, maximum] = frontLockoff.distanceRangeMeters;
    expect(distance).toBeGreaterThanOrEqual(minimum);
    expect(distance).toBeLessThanOrEqual(maximum);
  });

  it("clamps an absurdly wide cast to the preset's far bound", () => {
    const cast = measureCastGeometry(line(8, 40), 0);
    const distance = fitDistance(frontLockoff, cast, ASPECT);
    expect(distance).toBe(frontLockoff.distanceRangeMeters[1]);
  });

  it("backs off as the cast widens, up to the bound", () => {
    const near = fitDistance(frontLockoff, measureCastGeometry(line(2), 0), ASPECT);
    const far = fitDistance(frontLockoff, measureCastGeometry(line(8), 0), ASPECT);
    expect(far).toBeGreaterThan(near);
  });

  it("keeps every preset inside its own bound for casts of 1 through 8", () => {
    for (const preset of DIRECTOR_CAMERA_PRESET_LIBRARY) {
      for (let count = 1; count <= 8; count += 1) {
        const cast = measureCastGeometry(line(count), 0);
        const distance = fitDistance(preset, cast, ASPECT);
        const [minimum, maximum] = preset.distanceRangeMeters;
        expect(distance).toBeGreaterThanOrEqual(minimum);
        expect(distance).toBeLessThanOrEqual(maximum);
      }
    }
  });

  it("places a front shot on the audience side of the cast", () => {
    const cast = measureCastGeometry(line(4), 0);
    const [frame] = fitPresetKeyframes(frontLockoff, cast, {
      aspectRatio: ASPECT,
      durationSeconds: 8,
    });
    // A film's default cast faces -Z, so the camera belongs there too.
    expect(frame!.position[2]).toBeLessThan(cast.centerZ);
  });

  it("emits a single keyframe for a static preset", () => {
    const cast = measureCastGeometry(line(4), 0);
    const frames = fitPresetKeyframes(frontLockoff, cast, {
      aspectRatio: ASPECT,
      durationSeconds: 8,
    });
    expect(frames).toHaveLength(1);
  });

  it("dollies inward across the scene rather than outward", () => {
    const preset = getCameraPreset("hero-dolly-in")!;
    const cast = measureCastGeometry(line(1), 0);
    const frames = fitPresetKeyframes(preset, cast, {
      aspectRatio: ASPECT,
      durationSeconds: 8,
    });
    const distanceAt = (index: number) =>
      Math.hypot(
        frames[index]!.position[0] - frames[index]!.target[0],
        frames[index]!.position[1] - frames[index]!.target[1],
        frames[index]!.position[2] - frames[index]!.target[2]
      );
    expect(distanceAt(frames.length - 1)).toBeLessThan(distanceAt(0));
  });

  it("descends across the scene rather than climbing", () => {
    const preset = getCameraPreset("high-reveal")!;
    const cast = measureCastGeometry(line(4), 0);
    const frames = fitPresetKeyframes(preset, cast, {
      aspectRatio: ASPECT,
      durationSeconds: 8,
    });
    expect(frames.at(-1)!.position[1]).toBeLessThan(frames[0]!.position[1]);
  });

  it("orbits at a constant radius and height", () => {
    const preset = getCameraPreset("group-orbit")!;
    const cast = measureCastGeometry(line(4), 0);
    const frames = fitPresetKeyframes(preset, cast, {
      aspectRatio: ASPECT,
      durationSeconds: 8,
    });
    expect(frames.length).toBeGreaterThan(2);
    const radii = frames.map((frame) =>
      Math.hypot(
        frame.position[0] - frame.target[0],
        frame.position[2] - frame.target[2]
      )
    );
    for (const radius of radii) {
      expect(radius).toBeCloseTo(radii[0]!, 6);
    }
    for (const frame of frames) {
      expect(frame.position[1]).toBeCloseTo(frames[0]!.position[1], 6);
    }
  });

  it("aims at the cast center, not at the world origin", () => {
    const offsetCast = measureCastGeometry(
      line(3).map((position) => ({ x: position.x + 5, z: position.z - 3 })),
      0
    );
    const [frame] = fitPresetKeyframes(frontLockoff, offsetCast, {
      aspectRatio: ASPECT,
      durationSeconds: 8,
    });
    expect(frame!.target[0]).toBeCloseTo(5, 6);
    expect(frame!.target[2]).toBeCloseTo(-3, 6);
  });
});

describe("cast geometry", () => {
  it("measures a solo as one performer's own extent", () => {
    const cast = measureCastGeometry(line(1), 0);
    expect(cast.radiusMeters).toBeCloseTo(1.2, 6);
    expect(cast.centerX).toBeCloseTo(0, 6);
  });

  it("grows the radius with the cast's span", () => {
    expect(measureCastGeometry(line(4), 0).radiusMeters).toBeGreaterThan(
      measureCastGeometry(line(2), 0).radiusMeters
    );
  });

  it("tracks the floor with the ground offset", () => {
    const atZero = measureCastGeometry(line(1), 0).floorY;
    const raised = measureCastGeometry(line(1), 2).floorY;
    expect(raised - atZero).toBeCloseTo(2, 6);
  });
});

describe("formation coverage of the sample films", () => {
  // Every formation a film can name has to survive resolution, including the
  // ones a directive picks at random.
  it("resolves a preset for every formation without throwing", () => {
    for (const formation of DIRECTOR_FORMATIONS as readonly DirectorFormation[]) {
      for (const requested of DIRECTOR_CAMERA_PRESETS) {
        if (requested === "custom") continue;
        const resolution = resolvePresetForFormation(requested, formation);
        expect(resolution.preset).toBeDefined();
      }
    }
  });
});
