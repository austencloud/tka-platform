# Water Wing Playable Graybox (Gate 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Visual judgment is NOT delegable.** Task 8 is a first-person walk with screenshots. Whoever holds this plan does that themselves, per `.claude/rules/visual-verification-mandatory.md`. A subagent may execute Tasks 1–7; Task 8 must be done by an agent that can open Chrome and read the frames.

**Goal:** Put the Water wing's exhibit furniture — the opener, the three case triptychs, the ramped channel water, and the steam at CCCC — into the drowned-gallery graybox so the room can be walked end to end and judged.

**Architecture:** All fixture placement is derived inside `buildDrownedGalleryLayout()` from rects that already exist, so the graybox and every future board read one geometry source. The channel stays ONE `ReflectivePool`; its wave amplitude ramps along its own length via two new shader uniforms that default to today's behaviour. The review page's chrome moves into a shared shell driven by `WingDeclaration.review`, so the other five wings inherit it.

**Tech Stack:** TypeScript, Svelte 5 runes, Threlte/three.js, vitest.

**Approved by:** Austen, 2026-08-16 — Gate 1 `approved` in `docs/superpowers/specs/drowned-gallery/scene-gates.json`, tracker `kFQ9Cs3HyQSBbV9GkOFf`.

---

## Binding context (read before Task 1)

- Parent spec: `docs/superpowers/specs/2026-08-11-museum-exhibit-hallway-architecture-design.md`
- Gate manifest: `docs/superpowers/specs/drowned-gallery/scene-gates.json` (claims C-007, C-010…C-013 govern this work)
- Gate 1 board: `docs/superpowers/specs/drowned-gallery/water-gate1-board.html`
- Wing declaration shape: `src/lib/features/museum/data/wing-declarations/types.ts`

**Geometry facts this plan depends on** (all from `buildDrownedGalleryLayout`, world metres):

| Rect | x | z | datum |
|---|---|---|---|
| `grotto` | 1.25 → 26.25 | 2.75 → 24.75 | — |
| `shore` (BLOCKED, the case shelf) | 1.25 → 26.25 | 2.75 → 6.25 | `SHELF_Y` −1.0 |
| `channel` (BLOCKED) | 3.75 → 22.75 | 6.25 → 10.25 | surface `GROTTO_WATERLINE_Y` −0.45, bed −2.7 |
| `procession` (walkable near bank) | 3.75 → 22.75 | 10.25 → 12.75 | `CAUSEWAY_Y` −0.3 |
| `pool` (BLOCKED) | 3.75 → 22.75 | 12.75 → 20.25 | surface −0.45, bottom −5.0 |
| `apron` (walkable, the entrance) | 1.25 → 22.75 | 20.25 → 24.75 | `CAUSEWAY_Y` −0.3 |
| `eastWalkway` | 22.75 → 26.25 | 6.25 → 24.75 | `CAUSEWAY_Y` |
| `thresholdOpening` (the Fire door) | — | 16.75 → 17.75 | `CAUSEWAY_Y` |
| `alcoves` | x ≈ 7 / 14 / 21 | z ≈ 5 | `SHELF_Y` |

**Walk order in the grotto:** enter from `galleryCorridor` at the apron (high z) → around the pool → west-to-east along the `procession` facing −z at the three cases → up the east walkway → the Fire threshold at (24.5, 17.25), which is where all three cases read at once (spread 39.1°, C at 12.7 m, A at 21.4 m).

**Water ramp direction:** west → east, i.e. AAAA (x 7, dead still) → BBBB (x 14, slow ripple) → CCCC (x 21, mist), ending at the Fire door. This is the walk direction, and CCCC's steam is Austen's own placement at the water/fire junction.

**Steam is NOT a shader feature.** The shader ramps the wave; the mist at CCCC is a separate reused emitter (`FirstFireSteamVent`).

---

## File Structure

**Modify**
- `src/lib/features/museum/data/drowned-gallery-terrain.ts` — add `ExhibitFixture`, add `exhibitFixtures` to `DrownedGalleryLayout`, derive them in `buildDrownedGalleryLayout`.
- `src/lib/shared/3d/environments/primitives/reflective-pool-shader.ts` — add the amplitude-ramp uniforms + fragment application.
- `src/lib/shared/3d/environments/primitives/ReflectivePool.svelte` — expose the ramp as props.
- `src/routes/test/drowned-gallery-graybox/DrownedGalleryWalkScene.svelte` — render the fixtures, ramp the channel, mount the steam.
- `src/routes/test/drowned-gallery-graybox/+page.svelte` — consume the shared shell.
- `src/lib/features/museum/data/wing-declarations/vulcan-cave-wings.ts` — retire the withdrawn parapet from the split-same payoff beat.

**Create**
- `src/lib/features/museum/components/graybox/resolve-location-label.ts` — pure resolver for `WingDeclaration.review.locationLabels`.
- `src/lib/features/museum/components/graybox/GrayboxReviewShell.svelte` — the review chrome, declaration-driven.
- `tests/unit/museum/drowned-gallery-exhibit-fixtures.test.ts`
- `tests/unit/museum/drowned-gallery-sightlines.test.ts`
- `tests/unit/museum/graybox-location-label.test.ts`
- `tests/unit/museum/reflective-pool-amplitude.test.ts`

**Do not touch:** `src/lib/shared/animation-engine/components/effects-panel/EffectPresetThumbnail.svelte` or `thumbnails/BloomVibeThumbnail.svelte` — another session's in-flight work.

---

## Task 1: Exhibit fixture type and derivation

**Files:**
- Modify: `src/lib/features/museum/data/drowned-gallery-terrain.ts`
- Test: `tests/unit/museum/drowned-gallery-exhibit-fixtures.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/unit/museum/drowned-gallery-exhibit-fixtures.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildDrownedGalleryLayout,
  CAUSEWAY_Y,
  SHELF_Y,
  inRectClosed,
  type ExhibitFixture,
  type WorldRect,
} from "$lib/features/museum/data/drowned-gallery-terrain";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";

const layout = buildDrownedGalleryLayout(buildVulcanCaveFloorPlan());
const byId = (id: string): ExhibitFixture => {
  const found = layout.exhibitFixtures.find((fixture) => fixture.id === id);
  if (!found) throw new Error(`no fixture ${id}`);
  return found;
};

const footprint = (fixture: ExhibitFixture): WorldRect => ({
  minX: fixture.centre.x - fixture.size.x / 2,
  maxX: fixture.centre.x + fixture.size.x / 2,
  minZ: fixture.centre.z - fixture.size.z / 2,
  maxZ: fixture.centre.z + fixture.size.z / 2,
});

const corners = (rect: WorldRect): [number, number][] => [
  [rect.minX, rect.minZ],
  [rect.maxX, rect.minZ],
  [rect.minX, rect.maxZ],
  [rect.maxX, rect.maxZ],
];

describe("drowned gallery exhibit fixtures", () => {
  it("declares one showcase, screen and card per case, plus the opener pair", () => {
    const kinds = layout.exhibitFixtures.map((fixture) => fixture.kind);
    expect(kinds.filter((kind) => kind === "case-showcase")).toHaveLength(3);
    expect(kinds.filter((kind) => kind === "case-screen")).toHaveLength(3);
    expect(kinds.filter((kind) => kind === "case-card")).toHaveLength(3);
    expect(kinds.filter((kind) => kind === "opener-dais")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "opener-plinth")).toHaveLength(1);
  });

  it("puts each showcase exactly on its alcove anchor, on the shelf", () => {
    ["AAAA", "BBBB", "CCCC"].forEach((word, index) => {
      const showcase = byId(`case-showcase-${word}`);
      expect(showcase.centre.x).toBeCloseTo(layout.alcoves[index].x, 6);
      expect(showcase.centre.z).toBeCloseTo(layout.alcoves[index].z, 6);
      expect(showcase.baseY).toBe(SHELF_Y);
      expect(showcase.caseWord).toBe(word);
    });
  });

  it("keeps every card sign inside the procession and off the shelf", () => {
    for (const word of ["AAAA", "BBBB", "CCCC"]) {
      const card = byId(`case-card-${word}`);
      expect(card.baseY).toBe(CAUSEWAY_Y);
      for (const [x, z] of corners(footprint(card))) {
        expect(inRectClosed(layout.procession, x, z)).toBe(true);
      }
    }
  });

  it("leaves at least 1.6 m of clear walking width behind the card signs", () => {
    for (const word of ["AAAA", "BBBB", "CCCC"]) {
      const card = byId(`case-card-${word}`);
      const clear = layout.procession.maxZ - footprint(card).maxZ;
      expect(clear).toBeGreaterThanOrEqual(1.6);
    }
  });

  it("stands the opener on the apron without blocking the corridor mouth", () => {
    for (const id of ["opener-dais", "opener-plinth"]) {
      for (const [x, z] of corners(footprint(byId(id)))) {
        expect(inRectClosed(layout.apron, x, z)).toBe(true);
      }
      expect(byId(id).baseY).toBe(CAUSEWAY_Y);
    }
    // The corridor arrives on the apron's east half; the opener sits west of it.
    expect(byId("opener-dais").centre.x).toBeLessThan(12.25);
  });

  it("never places a fixture inside the channel or the pool", () => {
    for (const fixture of layout.exhibitFixtures) {
      for (const [x, z] of corners(footprint(fixture))) {
        expect(inRectClosed(layout.channel, x, z)).toBe(false);
        expect(inRectClosed(layout.pool, x, z)).toBe(false);
      }
    }
  });
});
```

- [x] **Step 2: Run it and confirm it fails**

```bash
npx vitest run tests/unit/museum/drowned-gallery-exhibit-fixtures.test.ts
```

Expected: FAIL — `exhibitFixtures` is not a property of the layout, and `ExhibitFixture` is not exported.

- [x] **Step 3: Add the type**

In `src/lib/features/museum/data/drowned-gallery-terrain.ts`, immediately after the `export interface WaterPlane extends WorldRect { … }` block, insert:

```ts
/**
 * A piece of exhibit furniture the wing needs, placed by the same pass that
 * places the room. Kept here rather than in the scene component so the boards,
 * the graybox and the tests all read one source for where things stand.
 *
 * Every placement below is derived from a room rect, never typed in by eye.
 */
export interface ExhibitFixture {
  id: string;
  kind:
    | "opener-dais"
    | "opener-plinth"
    | "case-showcase"
    | "case-screen"
    | "case-card";
  /** Expanded word for case furniture; absent on the opener. */
  caseWord?: string;
  centre: Point2;
  /** Footprint in metres, x by z. */
  size: { x: number; z: number };
  /** The floor datum the object stands on. */
  baseY: number;
  /** Metres above baseY. */
  height: number;
  /** Facing in radians about +Y. 0 looks toward +z. */
  facing: number;
}
```

- [x] **Step 4: Add it to the layout interface**

In the same file, inside `export interface DrownedGalleryLayout`, directly below the `balustrades: WorldRect[];` line in the grotto section, add:

```ts
  /** The wing's exhibit furniture: the opener pair and the three case triptychs. */
  exhibitFixtures: ExhibitFixture[];
```

- [x] **Step 5: Derive the fixtures**

In `buildDrownedGalleryLayout`, after `alcoves` and `balustrades` are computed and before the layout object is returned, insert:

```ts
  // ── Exhibit furniture ─────────────────────────────────────────────────────
  // The visitor enters at the apron, walks the procession west→east facing the
  // cases across the channel, and leaves through the east threshold. So the
  // opener meets them on arrival, the showcases sit on the shelf, the screens
  // go on the shore wall behind each showcase, and the card signs sit on the
  // near bank at the visitor's own eye level.
  const CASE_WORDS = ["AAAA", "BBBB", "CCCC"] as const;

  const SHOWCASE_FOOTPRINT = { x: 2.0, z: 2.0 };
  const SCREEN_FOOTPRINT = { x: 2.2, z: 0.2 };
  const CARD_FOOTPRINT = { x: 0.9, z: 0.45 };
  const OPENER_DAIS_FOOTPRINT = { x: 2.4, z: 2.4 };
  const OPENER_PLINTH_FOOTPRINT = { x: 0.9, z: 0.45 };

  /** Facing −z: back to the entrance, looking across the channel. */
  const FACE_SOUTH = Math.PI;
  /** Facing +z: presenting itself to a visitor who stands south of it. */
  const FACE_NORTH = 0;

  const caseFixtures: ExhibitFixture[] = alcoves.flatMap((anchor, index) => {
    const word = CASE_WORDS[index];
    return [
      {
        id: `case-showcase-${word}`,
        kind: "case-showcase" as const,
        caseWord: word,
        centre: { x: anchor.x, z: anchor.z },
        size: SHOWCASE_FOOTPRINT,
        baseY: SHELF_Y,
        height: 2.0,
        // The performer faces the visitor across the channel.
        facing: FACE_NORTH,
      },
      {
        id: `case-screen-${word}`,
        kind: "case-screen" as const,
        caseWord: word,
        // Flat against the shore's back wall, directly behind the showcase.
        centre: { x: anchor.x, z: shore.minZ + SCREEN_FOOTPRINT.z / 2 + 0.1 },
        size: SCREEN_FOOTPRINT,
        baseY: SHELF_Y,
        height: 2.6,
        facing: FACE_NORTH,
      },
      {
        id: `case-card-${word}`,
        kind: "case-card" as const,
        caseWord: word,
        // A lectern on the near bank, at the channel's edge, in line with its case.
        centre: {
          x: anchor.x,
          z: procession.minZ + CARD_FOOTPRINT.z / 2 + 0.35,
        },
        size: CARD_FOOTPRINT,
        baseY: CAUSEWAY_Y,
        height: 1.05,
        // Tilted to a visitor standing south of it, who then looks past it.
        facing: FACE_NORTH,
      },
    ];
  });

  // The corridor arrives on the apron's east half, so the opener stands in the
  // west half: seen on entry, walked past rather than walked around.
  const openerX = apron.minX + (apron.maxX - apron.minX) * 0.3;
  const openerDaisZ = apron.maxZ - 2.35;
  const openerFixtures: ExhibitFixture[] = [
    {
      id: "opener-dais",
      kind: "opener-dais",
      centre: { x: openerX, z: openerDaisZ },
      size: OPENER_DAIS_FOOTPRINT,
      baseY: CAUSEWAY_Y,
      height: 0.25,
      facing: FACE_SOUTH,
    },
    {
      id: "opener-plinth",
      kind: "opener-plinth",
      centre: {
        x: openerX,
        z: openerDaisZ - OPENER_DAIS_FOOTPRINT.z / 2 - 0.85,
      },
      size: OPENER_PLINTH_FOOTPRINT,
      baseY: CAUSEWAY_Y,
      height: 1.05,
      facing: FACE_SOUTH,
    },
  ];

  const exhibitFixtures: ExhibitFixture[] = [
    ...openerFixtures,
    ...caseFixtures,
  ];
```

Then add `exhibitFixtures,` to the returned layout object, next to `balustrades,`.

- [x] **Step 6: Run the test**

```bash
npx vitest run tests/unit/museum/drowned-gallery-exhibit-fixtures.test.ts
```

Expected: PASS, 6/6.

If the clear-width or apron-containment assertions fail, adjust the derivation constants (`0.35` setback, `0.3` apron fraction, `2.35` dais setback) — **not** the assertions. The assertions are the room's requirements.

**Deviations taken while executing (2026-08-16, commit `a0ef3e99c5`):**

1. `buildDrownedGalleryLayout` takes the grid and returns `DrownedGalleryLayout | null`. The test builds the layout as
   `buildDrownedGalleryLayout(buildVulcanCaveFloorPlan().grid)!`, matching `drowned-gallery-terrain.test.ts:33-36`.
2. The plan put the opener plinth **south** of the dais (`openerDaisZ − DAIS/2 − 0.85`). That overhangs `pool.maxZ`, which is
   also `apron.minZ`, so both the apron-containment and the no-fixture-in-water assertions failed. Fixed in the derivation, per
   the instruction above: the visitor arrives from **+z**, so the plinth now stands **north** of the dais — between the visitor
   and it — and both face `FACE_NORTH`. The group's depth (`dais + gap + plinth`) is centred in the apron band that starts at
   `apron.minZ + RAIL_T`, clearing the pool's south rail. `FACE_SOUTH` became unused and was removed.
   Resulting values: dais at z 21.975, plinth at z 24.25, both at x 7.7.

- [x] **Step 7: Run the existing terrain tests to prove nothing regressed**

```bash
npx vitest run tests/unit/museum/drowned-gallery-terrain.test.ts tests/unit/museum/drowned-gallery-traversal.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add tests/unit/museum/drowned-gallery-exhibit-fixtures.test.ts
git commit -m "feat(museum): derive Water wing exhibit fixtures from the room geometry" -- src/lib/features/museum/data/drowned-gallery-terrain.ts tests/unit/museum/drowned-gallery-exhibit-fixtures.test.ts
```

---

## Task 2: Lock the doorway sightline with a test

The Gate 1 board's payoff is that all three cases read at once from inside the Fire threshold. C's reflected head lands 0.29 m inside the channel's east edge — the tightest number on the board, and the first thing that can break when a fixture moves.

**Files:**
- Test: `tests/unit/museum/drowned-gallery-sightlines.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/museum/drowned-gallery-sightlines.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildDrownedGalleryLayout,
  CAUSEWAY_Y,
  EYE_ABOVE_FLOOR,
  GROTTO_WATERLINE_Y,
  SHELF_Y,
  inRectClosed,
} from "$lib/features/museum/data/drowned-gallery-terrain";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";

const layout = buildDrownedGalleryLayout(buildVulcanCaveFloorPlan());

/** Where the visitor takes the last look: inside the Fire threshold. */
const STAND = { x: 24.5, z: 17.25, y: CAUSEWAY_Y + EYE_ABOVE_FLOOR };
/** Head height of a performer standing on the shelf. */
const HEAD_Y = SHELF_Y + 1.7;

const showcases = ["AAAA", "BBBB", "CCCC"].map((word) => {
  const fixture = layout.exhibitFixtures.find(
    (candidate) => candidate.id === `case-showcase-${word}`
  );
  if (!fixture) throw new Error(`no showcase for ${word}`);
  return { word, x: fixture.centre.x, z: fixture.centre.z };
});

const bearing = (target: { x: number; z: number }) =>
  (Math.atan2(target.x - STAND.x, target.z - STAND.z) * 180) / Math.PI;

const distance = (target: { x: number; z: number }) =>
  Math.hypot(target.x - STAND.x, target.z - STAND.z);

/**
 * The mirrored head sits HEAD_Y - waterline below the surface; the bounce is
 * where the eye-to-mirror-image ray crosses the water plane.
 */
const bouncePoint = (target: { x: number; z: number }) => {
  const eyeAbove = STAND.y - GROTTO_WATERLINE_Y;
  const headAbove = HEAD_Y - GROTTO_WATERLINE_Y;
  const t = eyeAbove / (eyeAbove + headAbove);
  return {
    x: STAND.x + (target.x - STAND.x) * t,
    z: STAND.z + (target.z - STAND.z) * t,
  };
};

describe("the doorway payoff", () => {
  it("holds all three cases inside a single field of view", () => {
    const bearings = showcases.map((showcase) => bearing(showcase));
    const spread = Math.max(...bearings) - Math.min(...bearings);
    expect(spread).toBeGreaterThan(30);
    expect(spread).toBeLessThan(55);
  });

  it("keeps every case within a readable distance", () => {
    for (const showcase of showcases) {
      expect(distance(showcase)).toBeGreaterThan(10);
      expect(distance(showcase)).toBeLessThan(24);
    }
  });

  it("bounces all three reflections inside the channel surface", () => {
    for (const showcase of showcases) {
      const bounce = bouncePoint(showcase);
      expect(
        inRectClosed(layout.channel, bounce.x, bounce.z),
        `${showcase.word} bounce at (${bounce.x.toFixed(2)}, ${bounce.z.toFixed(2)})`
      ).toBe(true);
    }
  });

  it("flags how little margin the east-most bounce has", () => {
    const bounce = bouncePoint(showcases[2]);
    const margin = layout.channel.maxX - bounce.x;
    // Recorded, not asserted tight: this is the number that breaks first.
    expect(margin).toBeGreaterThan(0.15);
  });
});
```

- [ ] **Step 2: Run it**

```bash
npx vitest run tests/unit/museum/drowned-gallery-sightlines.test.ts
```

Expected: PASS immediately (Task 1 already supplies the fixtures). If the bounce test fails, **stop and report the numbers** — that means the payoff the board promised does not hold, which is a Gate 1 finding, not something to tune away.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/museum/drowned-gallery-sightlines.test.ts
git commit -m "test(museum): lock the Water wing doorway sightline and reflection bounces" -- tests/unit/museum/drowned-gallery-sightlines.test.ts
```

---

## Task 3: Wave-amplitude ramp in the pool shader

One surface, ramped along its own length. Defaults keep every existing consumer byte-identical.

**Files:**
- Modify: `src/lib/shared/3d/environments/primitives/reflective-pool-shader.ts`
- Modify: `src/lib/shared/3d/environments/primitives/ReflectivePool.svelte`
- Test: `tests/unit/museum/reflective-pool-amplitude.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/museum/reflective-pool-amplitude.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  REFLECTIVE_POOL_DEFAULTS,
  ReflectivePoolShader,
} from "$lib/shared/3d/environments/primitives/reflective-pool-shader";

describe("reflective pool amplitude ramp", () => {
  it("defaults to a uniform surface, so existing pools are unchanged", () => {
    expect(REFLECTIVE_POOL_DEFAULTS.waveAmplitudeStart).toBe(1);
    expect(REFLECTIVE_POOL_DEFAULTS.waveAmplitudeEnd).toBe(1);
    expect(ReflectivePoolShader.uniforms.uWaveAmplitude.value.x).toBe(1);
    expect(ReflectivePoolShader.uniforms.uWaveAmplitude.value.y).toBe(1);
  });

  it("applies the ramp across the plane's own length before any wave is used", () => {
    const source = ReflectivePoolShader.fragmentShader;
    expect(source).toContain("uniform vec2 uWaveAmplitude;");
    expect(source).toContain(
      "float amplitude = mix( uWaveAmplitude.x, uWaveAmplitude.y, vPlaneUv.x );"
    );
    // The normal, the glint and the foam wobble all read the ramped wave.
    expect(source).toContain("h *= amplitude;");
    expect(source).toContain("dx *= amplitude;");
    expect(source).toContain("dz *= amplitude;");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run tests/unit/museum/reflective-pool-amplitude.test.ts
```

Expected: FAIL — `waveAmplitudeStart` is undefined.

- [ ] **Step 3: Add the uniform contract**

In `src/lib/shared/3d/environments/primitives/reflective-pool-shader.ts`:

Add to `ReflectivePoolUniformValues`, after `shoreFade: number;`:

```ts
  /**
   * Wave amplitude at the plane's u=0 and u=1 edges, interpolated across it.
   * 1 is the surface as authored; 0 is dead flat. Both default to 1, so a
   * surface that does not ask for a ramp behaves exactly as before.
   *
   * This exists so a long body of water can change state along its length
   * without being cut into separate surfaces. Cutting it would put a foam line
   * at every internal edge, because the shoreline term below foams wherever
   * water meets an authored edge.
   */
  waveAmplitudeStart: number;
  waveAmplitudeEnd: number;
```

Add to `REFLECTIVE_POOL_DEFAULTS`, after `shoreFade: 2.2,`:

```ts
  waveAmplitudeStart: 1,
  waveAmplitudeEnd: 1,
```

Add to `uniforms`, after the `uShoreFade` entry:

```ts
    uWaveAmplitude: {
      value: new Vector2(
        REFLECTIVE_POOL_DEFAULTS.waveAmplitudeStart,
        REFLECTIVE_POOL_DEFAULTS.waveAmplitudeEnd
      ),
    },
```

- [ ] **Step 4: Apply it in the fragment shader**

In the same file's `fragmentShader`, add this declaration directly after `uniform float uShoreFade;`:

```glsl
    uniform vec2 uWaveAmplitude;
```

Then replace this existing block:

```glsl
      const float EPS = 0.06;
      float h = waveHeight( rippleP, uTime );
      float dx = waveHeight( rippleP + vec2( EPS, 0.0 ), uTime ) - h;
      float dz = waveHeight( rippleP + vec2( 0.0, EPS ), uTime ) - h;
```

with:

```glsl
      const float EPS = 0.06;
      float h = waveHeight( rippleP, uTime );
      float dx = waveHeight( rippleP + vec2( EPS, 0.0 ), uTime ) - h;
      float dz = waveHeight( rippleP + vec2( 0.0, EPS ), uTime ) - h;

      // Scale the wave and its slope together across the plane's length, so a
      // single surface can run from dead still to fully rippling. Scaling the
      // slope as well as the height is what makes the normal, the glint and
      // the foam wobble all agree at every point along the ramp.
      float amplitude = mix( uWaveAmplitude.x, uWaveAmplitude.y, vPlaneUv.x );
      h *= amplitude;
      dx *= amplitude;
      dz *= amplitude;
```

- [ ] **Step 5: Run the test**

```bash
npx vitest run tests/unit/museum/reflective-pool-amplitude.test.ts
```

Expected: PASS, 2/2.

- [ ] **Step 6: Expose it on the component**

In `src/lib/shared/3d/environments/primitives/ReflectivePool.svelte`, add `waveAmplitudeStart` and `waveAmplitudeEnd` to the `Props` interface (both `number`, optional), default both to `1` in the `$props()` destructuring alongside the other numeric props, and wire them into the same reactive block that writes the other uniforms:

```ts
  $effect(() => {
    uniforms.uWaveAmplitude.value.set(waveAmplitudeStart, waveAmplitudeEnd);
  });
```

Follow the file's existing uniform-writing idiom exactly — if it assigns uniforms inside one `$effect`, add these two lines there rather than creating a second effect.

- [ ] **Step 7: Prove the two existing consumers still typecheck**

```bash
npx svelte-check --threshold error --output human 2>&1 | grep -iE "ReflectivePool|OliveCloudbreak|DrownedGalleryWalkScene" || echo "no errors in the pool consumers"
```

Expected: `no errors in the pool consumers`.

- [ ] **Step 8: Commit**

```bash
git add tests/unit/museum/reflective-pool-amplitude.test.ts
git commit -m "feat(3d): ramp wave amplitude along a reflective pool's length" -- src/lib/shared/3d/environments/primitives/reflective-pool-shader.ts src/lib/shared/3d/environments/primitives/ReflectivePool.svelte tests/unit/museum/reflective-pool-amplitude.test.ts
```

---

## Task 4: Ramp the channel, leave the mirror pool alone

**Files:**
- Modify: `src/routes/test/drowned-gallery-graybox/DrownedGalleryWalkScene.svelte`

- [ ] **Step 1: Distinguish the two surfaces**

The scene currently maps every `GROTTO_WATERLINE_Y` plane to an identical `ReflectivePool`. There are exactly two: the channel and the mirror pool. Replace the `grottoWater` derivation so each entry knows which it is, by testing its rect against `layout.channel`:

```ts
  const grottoWater = layout.waterPlanes
    .filter((plane) => plane.surfaceY === GROTTO_WATERLINE_Y)
    .map((plane, index) => {
      const centreX = (plane.minX + plane.maxX) / 2;
      const centreZ = (plane.minZ + plane.maxZ) / 2;
      const isChannel = inRectClosed(layout.channel, centreX, centreZ);
      return {
        id: `grotto-water-${index}`,
        isChannel,
        width: plane.maxX - plane.minX,
        depth: plane.maxZ - plane.minZ,
        centre: [centreX - origin.x, centreZ - origin.z] as [number, number],
        surfaceY: plane.surfaceY,
      };
    });
```

Add `inRectClosed` to the existing import from `$lib/features/museum/data/drowned-gallery-terrain`.

- [ ] **Step 2: Ramp only the channel**

Replace the `{#each grottoWater}` body's `<ReflectivePool …/>` with:

```svelte
    <ReflectivePool
      width={entry.width}
      depth={entry.depth}
      position={[entry.centre[0], entry.surfaceY, entry.centre[1]]}
      deepColor="#0a2c38"
      shallowColor="#2c8394"
      reflectionTint={0x9fbcc2}
      shoreFade={2.6}
      rippleScale={1.25}
      rippleStrength={0.09}
      foamWidth={0.2}
      flowSpeed={0.8}
      waveAmplitudeStart={entry.isChannel ? 0 : 1}
      waveAmplitudeEnd={entry.isChannel ? 1 : 1}
    />
```

The plane's u runs with world +x, so `Start` is the west end (AAAA, dead still) and `End` is the east end (CCCC, fully rippling under the steam). Confirm that direction in Task 8; if the ramp reads backwards on screen, swap the two values — do not rotate the plane.

- [ ] **Step 3: Verify the branch is reachable**

```bash
npx vitest run tests/unit/museum/drowned-gallery-terrain.test.ts
```

Expected: PASS. (The scene itself is judged in Task 8; this only proves the layout still builds.)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(museum): ramp the grotto channel from still to rippling, west to east" -- src/routes/test/drowned-gallery-graybox/DrownedGalleryWalkScene.svelte
```

---

## Task 5: Render the exhibit furniture

Graybox massing only — boxes at the right size, in the right place, in the room's palette. No avatars, no pictographs, no text. Those are Gate 3+.

**Files:**
- Modify: `src/routes/test/drowned-gallery-graybox/DrownedGalleryWalkScene.svelte`

- [ ] **Step 1: Derive scene-space fixtures**

Add near the other origin-shifted derivations:

```ts
  /**
   * Graybox massing for the wing's furniture. A box of the right size in the
   * right place answers the only Gate 2 question — does the room read when you
   * walk it — and answers it without waiting on avatars or card art.
   */
  const fixtureMeshes = layout.exhibitFixtures.map((fixture) => ({
    id: fixture.id,
    kind: fixture.kind,
    position: [
      fixture.centre.x - origin.x,
      fixture.baseY + fixture.height / 2,
      fixture.centre.z - origin.z,
    ] as [number, number, number],
    scale: [fixture.size.x, fixture.height, fixture.size.z] as [
      number,
      number,
      number,
    ],
    rotation: [0, fixture.facing, 0] as [number, number, number],
    color:
      fixture.kind === "case-screen"
        ? "#123742"
        : fixture.kind === "case-showcase"
          ? "#6b7f86"
          : "#2b3a41",
    emissive: fixture.kind === "case-screen" ? "#1d6d84" : "#000000",
  }));
```

- [ ] **Step 2: Render them**

Add inside the scene graph, next to the `{#each grottoWater}` block:

```svelte
  {#each fixtureMeshes as fixture (fixture.id)}
    <T.Mesh
      position={fixture.position}
      rotation={fixture.rotation}
      scale={fixture.scale}
      castShadow
      receiveShadow
    >
      <T.BoxGeometry />
      <T.MeshStandardMaterial
        color={fixture.color}
        emissive={fixture.emissive}
        emissiveIntensity={fixture.kind === "case-screen" ? 0.85 : 0}
        roughness={0.72}
        metalness={0.04}
      />
    </T.Mesh>
  {/each}
```

- [ ] **Step 3: Typecheck**

```bash
npx svelte-check --threshold error --output human 2>&1 | grep -i "DrownedGalleryWalkScene" || echo "walk scene clean"
```

Expected: `walk scene clean`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(museum): mass the Water wing opener and case triptychs in the graybox" -- src/routes/test/drowned-gallery-graybox/DrownedGalleryWalkScene.svelte
```

---

## Task 6: Steam at the water/fire junction

Austen's own direction: *"I'd love to have steam at the junction of water and fire."* CCCC is the east-most case, three metres from the Fire threshold. `FirstFireSteamVent` already exists and already carries the three limits that matter — white blows to a peach smear under AgX on additive blending, a full-height column flattens the room's depth, and inside a couple of metres the visitor stands inside the cloud. The route passes within a metre of CCCC, so the plume stays low and thin.

**Files:**
- Modify: `src/routes/test/drowned-gallery-graybox/DrownedGalleryWalkScene.svelte`

- [ ] **Step 1: Read the component's props before wiring it**

```bash
sed -n '1,80p' src/lib/shared/3d/environments/scenes/first-fire/FirstFireSteamVent.svelte
```

Note the exact prop names for position, width, depth, plume height, ceiling and rate. Wire what the file actually declares — do not assume the names below match.

- [ ] **Step 2: Mount it over the channel's east end**

Import it, then add to the scene graph, placing it over the channel in line with CCCC:

```svelte
  <FirstFireSteamVent
    position={[
      layout.alcoves[2].x - origin.x,
      GROTTO_WATERLINE_Y,
      (layout.channel.minZ + layout.channel.maxZ) / 2 - origin.z,
    ]}
    width={2.6}
    depth={layout.channel.maxZ - layout.channel.minZ}
    plumeHeight={1.1}
    ceilingY={GROTTO_WATERLINE_Y + 2.2}
    steamRate={0.55}
  />
```

A 1.1 m plume caps the mist below head height, so a visitor on the near bank looks over it at CCCC rather than through it. `steamRate` 0.55 keeps the count near 19 particles — enough to read as mist off warm water, not enough to become the pale wash the Fire scene's comments warn about.

- [ ] **Step 3: Typecheck**

```bash
npx svelte-check --threshold error --output human 2>&1 | grep -i "DrownedGalleryWalkScene" || echo "walk scene clean"
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(museum): steam off the channel at the Water/Fire junction" -- src/routes/test/drowned-gallery-graybox/DrownedGalleryWalkScene.svelte
```

---

## Task 7: Shared graybox review shell

Six wings will each need this page. The chrome is currently hardcoded in the Water route; `WingDeclaration.review` already declares everything it hardcodes.

**Files:**
- Create: `src/lib/features/museum/components/graybox/resolve-location-label.ts`
- Create: `src/lib/features/museum/components/graybox/GrayboxReviewShell.svelte`
- Modify: `src/routes/test/drowned-gallery-graybox/+page.svelte`
- Modify: `src/lib/features/museum/data/wing-declarations/vulcan-cave-wings.ts`
- Test: `tests/unit/museum/graybox-location-label.test.ts`

- [ ] **Step 1: Write the failing resolver test**

Create `tests/unit/museum/graybox-location-label.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveLocationLabel } from "$lib/features/museum/components/graybox/resolve-location-label";
import { VULCAN_CAVE_WINGS } from "$lib/features/museum/data/wing-declarations/vulcan-cave-wings";

const labels = [
  { label: "Flooded approach", whenZAbove: 22 },
  { label: "Descent shaft", whenZAbove: 17 },
  { label: "The drowned gallery", whenZAbove: -2 },
  { label: "Fire threshold" },
];

describe("resolveLocationLabel", () => {
  it("takes the first entry whose threshold the player is above", () => {
    expect(resolveLocationLabel(labels, 33)).toBe("Flooded approach");
    expect(resolveLocationLabel(labels, 19)).toBe("Descent shaft");
    expect(resolveLocationLabel(labels, 0)).toBe("The drowned gallery");
  });

  it("falls back to the entry without a threshold", () => {
    expect(resolveLocationLabel(labels, -40)).toBe("Fire threshold");
  });

  it("treats the boundary as belonging to the lower band", () => {
    expect(resolveLocationLabel(labels, 22)).toBe("Descent shaft");
  });

  it("returns an empty string rather than throwing on an empty list", () => {
    expect(resolveLocationLabel([], 0)).toBe("");
  });

  it("every declared wing ends in a fallback entry", () => {
    for (const wing of VULCAN_CAVE_WINGS) {
      const last = wing.review.locationLabels.at(-1);
      expect(last?.whenZAbove, wing.wingId).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run tests/unit/museum/graybox-location-label.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the resolver**

Create `src/lib/features/museum/components/graybox/resolve-location-label.ts`:

```ts
import type { WingDeclaration } from "$lib/features/museum/data/wing-declarations/types";

type LocationLabel = WingDeclaration["review"]["locationLabels"][number];

/**
 * The HUD readout for a first-person graybox walk. Entries are ordered from the
 * far end of the route inward; the first one the player is still beyond wins,
 * and the entry without a threshold is the fallback at the near end.
 */
export function resolveLocationLabel(
  labels: readonly LocationLabel[],
  playerZ: number
): string {
  for (const entry of labels) {
    if (entry.whenZAbove === undefined) return entry.label;
    if (playerZ > entry.whenZAbove) return entry.label;
  }
  return labels.at(-1)?.label ?? "";
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/unit/museum/graybox-location-label.test.ts
```

Expected: PASS, 5/5.

- [ ] **Step 5: Build the shell**

Create `src/lib/features/museum/components/graybox/GrayboxReviewShell.svelte`. Move the HUD, the loading card, the reset button and every style rule out of `src/routes/test/drowned-gallery-graybox/+page.svelte` verbatim, replacing each hardcoded value with the declaration:

- `--theme-accent` and the `.review-label p` colour ← `declaration.review.accentColor`
- `<h1>` ← the wing's room title, passed as a `title` prop (the declaration carries `wingId`, not a display name)
- the eyebrow line ← `declaration.beats[0].stamp`
- loading strong/span ← `loadingTitle` / `loadingSubtitle`
- the location span ← `resolveLocationLabel(declaration.review.locationLabels, position.z)`

Props: `declaration: WingDeclaration`, `title: string`, `position: { x: number; y: number; z: number }`, `assetReady: boolean`, `onReset: () => void`, and a `children` snippet for the `<Canvas>`.

Keep the existing `1680` and `2600` media tiers exactly as written — they are the site's documented big-screen seams (`.claude/rules/4k-native-layout.md`).

- [ ] **Step 6: Migrate the route**

Rewrite `src/routes/test/drowned-gallery-graybox/+page.svelte` to hold only: the `<svelte:head>`, the `<Canvas>` with `DrownedGalleryWalkScene` inside the shell's snippet, and the four pieces of state. Look the declaration up by id:

```ts
  const declaration = VULCAN_CAVE_WINGS.find((wing) => wing.wingId === "split-same");
  if (!declaration) throw new Error("split-same wing declaration is missing");
```

- [ ] **Step 7: Retire the withdrawn parapet from the declaration**

`vulcan-cave-wings.ts` still names `cave-water-parapet` as the split-same payoff viewpoint. Austen rejected the parapet on 2026-08-12; the payoff now happens inside the Fire threshold. Replace that payoff beat with:

```ts
			{
				kind: "payoff",
				viewpointRef: "cave-water-fire-threshold",
				visibleCases: ["AAAA", "BBBB", "CCCC"],
				description:
					"The last look back from inside the Fire threshold: all three cases across the water at once, and each one doubled in it.",
			},
```

Also drop the `signatureProgram` block naming `water-dive-passage` and the parapet, or repoint it — check whether anything reads `signatureProgram.id` before deleting:

```bash
grep -rn "water-dive-passage\|cave-water-parapet" src/ tests/ docs/
```

Update every hit. If a hit is in a spec or board that records the old design as history, leave it.

- [ ] **Step 8: Run the declaration validator and the full museum suite**

```bash
npx vitest run tests/unit/museum/
```

Expected: PASS. Fix any wing-declaration validation failure in the declaration, not the validator.

- [ ] **Step 9: Commit**

```bash
git add src/lib/features/museum/components/graybox/resolve-location-label.ts src/lib/features/museum/components/graybox/GrayboxReviewShell.svelte tests/unit/museum/graybox-location-label.test.ts
git commit -m "refactor(museum): drive graybox review chrome from the wing declaration" -- src/lib/features/museum/components/graybox/resolve-location-label.ts src/lib/features/museum/components/graybox/GrayboxReviewShell.svelte src/routes/test/drowned-gallery-graybox/+page.svelte src/lib/features/museum/data/wing-declarations/vulcan-cave-wings.ts tests/unit/museum/graybox-location-label.test.ts
```

---

## Task 8: Walk it and look at it — NOT DELEGABLE

This is the gate's actual deliverable. Everything above is setup.

**Route:** [localhost:5173/test/drowned-gallery-graybox](https://localhost:5173/test/drowned-gallery-graybox)

The dev server on :5173 is Austen's. Never start, restart or kill it. If it is down, ask him to press the Agent Hub button. `npm run dev` binds IPv6 only — check with `curl -k -g 'https://[::1]:5173/'`, never `curl https://localhost:5173/`.

- [ ] **Step 1: Open the shared browser**

```bash
pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
```

Then `new_page(..., background: true)`, keep the returned page id, and pass that `pageId` to every page-scoped call. Never `--force-device-scale-factor`. Screenshots are `format: "webp", quality: 70`.

- [ ] **Step 2: Drive the walk with the dev bridge**

The scene exposes `window.__dgWalk` with `go(planX, planZ, y = CAUSEWAY_Y + EYE_ABOVE_FLOOR)`, `lookAt(planX, planZ)`, `where()`, `scene()`, `water`, and `layout`. Use it instead of pointer lock. Walk and screenshot these six stations in order:

| # | Stand at | Look at | The question that frame answers |
|---|---|---|---|
| 1 | apron entrance, (13, 23) | (8.5, 21) | Does the opener meet you on arrival, or is it furniture you walk past? |
| 2 | procession west, (7, 11.5) | (7, 5) | Does AAAA read, and is the water in front of it genuinely still? |
| 3 | procession middle, (14, 11.5) | (14, 5) | Does the ripple at BBBB read as a different state, or as noise? |
| 4 | procession east, (21, 11.5) | (21, 5) | Is the mist at CCCC low and thin, or a pale wash over the room? |
| 5 | **the doorway stand, (24.5, 17.25)** | (7, 5) | **The payoff. Do all three cases read at once, each doubled?** |
| 6 | the doorway stand | (21, 5) | Does the steam sit at the junction, with the Fire door in frame? |

- [ ] **Step 3: Measure what the eye can't**

`evaluate_script` returning JSON, so a rounding error costs no image:

```js
({
  fixtures: window.__dgWalk.layout.exhibitFixtures.map((f) => [f.id, f.centre.x, f.centre.z]),
  waterSurfaces: window.__dgWalk.water.length,
  drawCalls: window.__dgWalk.scene().renderer?.info?.render?.calls ?? null,
})
```

`waterSurfaces` must be exactly 2. If it is 3 or more, the channel got split — stop, that is the defect claim C-011 exists to prevent.

- [ ] **Step 4: Read the frames**

Every one, against `.claude/rules/visual-verification-mandatory.md` → "What To Actually Look For". The two specific judgments this gate owes:

1. **Does the doorway view actually hold all three cases?** The arithmetic says yes at a 39.1° spread, and C's reflection bounces only 0.29 m inside the channel's east edge. Arithmetic is not composition. If C's double is clipped or falls on the walkway instead of the water, say so plainly — that is a Gate 1 finding and it goes back on the board.
2. **Does the ramped water read as intent, or as a gimmick?** Still → rippling → misty across one surface either tells the visitor the room is changing under them, or it looks like a broken shader. There is no third reading. If it is the second, the honest report is that the treatment failed, not that it needs tuning.

- [ ] **Step 5: Clear emulation, close only the task-owned page**

Never close or resize the shared window.

- [ ] **Step 6: Update the gate manifest**

Set `playable-graybox` evidence and checks in `docs/superpowers/specs/drowned-gallery/scene-gates.json`, then:

```bash
node .claude/skills/museum-scene-production/scripts/validate-scene-gates.mjs docs/superpowers/specs/drowned-gallery/scene-gates.json
```

Leave the status at `ready-for-review`. **Only Austen moves it to `approved`**, and only with his quote recorded. Do not infer approval from enthusiasm.

- [ ] **Step 7: Full check before handing it over**

```bash
npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log | head -30
```

One `check` per turn — it is a cold multi-minute run. Grep the log rather than re-running it.

- [ ] **Step 8: Commit and report**

```bash
git commit -m "docs(museum): record the Water wing playable graybox walk" -- docs/superpowers/specs/drowned-gallery/scene-gates.json
```

Then give Austen the frames and the two judgments, in plain English, with the route as a clickable link.

---

## Deferred, deliberately

- **Avatars, pictographs, card art, screen content** — Gate 3 (visual targets) and Gate 4 (the production slice). Gate 2 is massing.
- **The board generator still lives in the scratchpad** and re-reads the geometry instead of importing `drowned-gallery-terrain.ts`. It becomes a committed generator alongside `scripts/generate-earth-long-terrace-board.ts` when the shared harness proves out — not in this plan.
- **The other five wings' Gate 1 boards** wait on Austen approving this slice. That sequencing is the approved vertical-slice amendment.

## Self-review notes

- Every task carries the code it needs; no step says "similar to Task N".
- Types are consistent: `ExhibitFixture` is defined in Task 1 and consumed unchanged in Tasks 2, 5 and 8.
- Task 3's defaults are asserted before Task 4 uses them, so the two existing pool consumers can never silently change.
- The one place this plan cannot guarantee exactness is Task 6's prop names, which is why its first step is to read the component instead of assuming.
