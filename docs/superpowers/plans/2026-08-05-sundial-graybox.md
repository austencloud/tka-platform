# The Sun Room (Sundial) Graybox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A walkable Sun chamber where the visitor's position drives a real shadow-casting sun, the spiral crossing is the only route to the centre, and standing at zenith projects each performer's prop path onto the ring floor.

**Architecture:** Same contract as Water, Fire, Earth and Air: one pure-geometry module (`sundial-layout.ts`) derives every rect, elevation and blocking predicate from the compiled grid, and the graybox renders only what that module reports. One geometry source — a rect the graybox draws that the layout module does not know about is a bug by construction. The new work versus prior rooms is polar geometry (an annulus and a spiral, not rectangles) and a directional light whose direction is recomputed from the player each frame.

**Tech Stack:** Svelte 5 runes, Threlte 8, three.js, vitest.

**Design authority:** `docs/superpowers/specs/2026-08-05-vulcan-cave-sun-room-design.md`. Ornament rule: `docs/superpowers/specs/2026-08-05-vulcan-cave-ornament-grammar.md`. Read both before starting.

---

## Read first

- `src/lib/features/museum/data/air-chimney-layout.ts` — the contract to copy. Note `buildAirChimneyLayout(grid)`, the `probes` block, and `createAirChimneyTerrain`.
- `tests/unit/museum/air-chimney-updraft.test.ts` — the test shape to copy.
- `src/lib/features/museum/data/vulcan-cave-floor-plan.ts` — `cave-sun` is currently `minInterior 7 × 7` with ONE performer. It needs resizing and four.

**Traps that already cost prior sessions:**

1. **`minInteriorWidth`/`Height` are NOT tiles.** Interior metres = `ceil(minInterior × 1.5) × 0.5`. A comment in that file read them as tiles and put Air at 17 × 24 m when it compiled to 25.5 × 36. **Measure the compiled grid; do not trust the comments.**
2. **`elevationAt(x, z, fromY?)` is Y-aware.** Pass the player's foot height and it returns the highest surface at or below it (0.6 m step-up tolerance). Omitting it returns the topmost surface, which teleports anyone under an overhang onto it.
3. **Two `UnifiedCameraController.svelte` copies exist.** The museum imports `@austencloud/camera-3d`, resolved to `packages/camera-3d/src/` via the `"svelte"` export condition. Editing `src/lib/shared/3d/camera/` is a silent no-op for the museum.
4. **A route created after the dev server started will not be served.** Restart, or use a server started after your files exist.

---

## The math, locked

Do not re-derive these. Chamber centre is the origin for all polar work; convert with `const dx = x - centre.x, dz = z - centre.z`.

**Radii (metres from chamber centre).** Chamber ⌀24, so outer wall at r = 12.

| Zone | Radius band | Floor Y | Walkable |
|---|---|---|---|
| Centre disc | `0 ≤ r ≤ 4` | −0.2 | yes |
| Collapse ring | `4 < r < 9` | −4.0 | **no**, except the crossing |
| Rim walk | `9 ≤ r ≤ 12` | −0.4 | yes |
| Pillar caps | 4 at r = 6.5, ⌀2.2 | +0.4 | no |

**The spiral crossing.** An arc winding inward while sweeping exactly 90°:

```
r(t) = 9 - 5t          t ∈ [0, 1]
θ(t) = θ0 + (π/2)·t
```

`θ0` is the bearing where the crossing leaves the rim. Set it so the crossing starts near the north door and ends 90° away — pick `θ0` from the compiled door position, do not hardcode a compass direction.

Test a point for "on the crossing" in closed form — no curve sampling:

```ts
/** Half-width of the walkable crossing, metres. */
const CROSSING_HALF_WIDTH = 1.0;

function onCrossing(r: number, theta: number, theta0: number): boolean {
  if (r < 4 || r > 9) return false;
  const t = (9 - r) / 5;                      // 0 at the rim, 1 at the disc
  const expected = theta0 + (Math.PI / 2) * t;
  // Smallest signed angular difference, wrapped to [-π, π].
  let d = theta - expected;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  // Arc-length offset from the spiral's centreline.
  return Math.abs(d) * r <= CROSSING_HALF_WIDTH;
}
```

Crossing elevation lerps with `t`: `y = -0.4 + 0.2 * t` (−0.4 at the rim, −0.2 at the disc).

**The sun.** Given the player's world position:

```ts
const r = Math.hypot(dx, dz);
const theta = Math.atan2(dx, dz);            // bearing of the PLAYER from centre
const k = Math.min(r / 12, 1);
const elevationDeg = 90 - 82 * k;            // 90° at centre, 8° at the rim
const e = (elevationDeg * Math.PI) / 180;
// Sun sits on the player's own bearing — i.e. at their back — so every shadow
// in the room runs parallel with theirs.
const dir = {
  x: Math.sin(theta) * Math.cos(e),
  y: Math.sin(e),
  z: Math.cos(theta) * Math.cos(e),
};
// Light position: far enough out that it reads as directional.
light.position.set(centre.x + dir.x * 40, dir.y * 40, centre.z + dir.z * 40);
light.target.position.set(centre.x, 0, centre.z);
```

At `r = 0` the bearing is undefined; that is harmless because `e` is 90° and azimuth stops mattering. Guard `r < 0.01` by holding the previous `theta` rather than letting `atan2(0,0)` snap it to 0.

---

### Task 1: Resize the Sun bay and give it four performers

**Files:** Modify `src/lib/features/museum/data/vulcan-cave-floor-plan.ts`, `museum-room-content.ts`, `museum-exhibit-sequences.ts`

- [ ] **Step 1: Resize.** In the `cave-sun` wing definition set `minInteriorWidth: 43`, `minInteriorHeight: 45` (targets 32.5 × 34.0 m). Add `roomPresentation: { suppressTileGeometry: true }` as Air has.
- [ ] **Step 2: Verify the compiled size.** Write a throwaway test that calls `buildVulcanCaveFloorPlan()` and `console.log`s the `cave-sun` wing bounds in metres. Confirm ≥ 24 m in both axes so the chamber fits. Delete the test after.
- [ ] **Step 3: Four sequences.** `cave-sun-seq` currently holds `STST`. Replace with four entries `cave-sun-seq-s|t|u|v` for words `SSSS`, `TTTT`, `UUUU`, `VVVV`. Generate each through the Flow Arts MCP `get_sequence_data` with `constraintPreset: "smooth"` and transcribe — all four are verified to compile as 4-step closed loops with perfect continuity (S/T close on `gamma3`, U/V on `gamma11`).
- [ ] **Step 4: Four performers.** In `CAVE_MODE_ROOMS` set `performerIds: ["cave-sun-automaton-s","-t","-u","-v"]` and matching `sequenceIds`. Add the four to `museum-room-content.ts`. **Station assignment: U north, V south, S east, T west** — U opposite V puts the leader/follower inversion on one axis and S/T on the cross axis.
- [ ] **Step 5:** `npx svelte-check --threshold error --output human` → 0 errors. Commit with an explicit pathspec.

---

### Task 2: The layout module

**Files:** Create `src/lib/features/museum/data/sundial-layout.ts`

- [ ] **Step 1: Write the failing test** at `tests/unit/museum/sundial-layout.test.ts`, asserting the invariants that define the room:

```ts
import { describe, it, expect } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import { buildSundialLayout } from "$lib/features/museum/data/sundial-layout";

const plan = buildVulcanCaveFloorPlan();
const layout = buildSundialLayout(plan.grid)!;

/** Point at radius r, bearing theta, in world space. */
function at(r: number, theta: number) {
  return {
    x: layout.centre.x + Math.sin(theta) * r,
    z: layout.centre.z + Math.cos(theta) * r,
  };
}

describe("sundial layout", () => {
  it("builds", () => expect(layout).toBeTruthy());

  it("blocks the collapse ring everywhere except the crossing", () => {
    let blocked = 0;
    let open = 0;
    for (let i = 0; i < 720; i++) {
      const theta = (i / 720) * Math.PI * 2;
      const p = at(6.5, theta);
      layout.blockedAt(p.x, p.z) ? blocked++ : open++;
    }
    expect(open).toBeGreaterThan(0);          // the crossing exists
    expect(blocked / 720).toBeGreaterThan(0.9); // and it is a slot, not a gap
  });

  it("lets you walk the whole rim", () => {
    for (let i = 0; i < 360; i++) {
      const theta = (i / 360) * Math.PI * 2;
      const p = at(10.5, theta);
      expect(layout.blockedAt(p.x, p.z)).toBe(false);
    }
  });

  it("puts the centre disc at -0.2 and the rim at -0.4", () => {
    expect(layout.elevationAt(layout.centre.x, layout.centre.z)).toBeCloseTo(-0.2, 2);
    const rim = at(10.5, 0);
    expect(layout.elevationAt(rim.x, rim.z)).toBeCloseTo(-0.4, 2);
  });

  it("sweeps exactly 90 degrees from rim to disc", () => {
    const d = layout.crossingEndTheta - layout.crossingStartTheta;
    expect(Math.abs(d)).toBeCloseTo(Math.PI / 2, 5);
  });

  it("puts the sun overhead at the centre and low at the rim", () => {
    expect(layout.sunElevationDeg(layout.centre.x, layout.centre.z)).toBeCloseTo(90, 1);
    const rim = at(12, 0);
    expect(layout.sunElevationDeg(rim.x, rim.z)).toBeCloseTo(8, 1);
  });

  it("keeps the sun on the visitor's own bearing", () => {
    for (const theta of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const p = at(10, theta);
      const az = layout.sunAzimuth(p.x, p.z);
      const d = Math.atan2(Math.sin(az - theta), Math.cos(az - theta));
      expect(Math.abs(d)).toBeLessThan(1e-6);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail.** `npx vitest run tests/unit/museum/sundial-layout.test.ts` → FAIL, module not found.
- [ ] **Step 3: Implement `sundial-layout.ts`** using the locked math above, following `air-chimney-layout.ts`'s structure: exported radius/Y constants, a `SundialLayout` interface, `buildSundialLayout(grid)`, and a `probes` block (`entry`, `rim`, `crossingStart`, `crossingMid`, `centre`, `ringGap`, `exit`). Export `blockedAt`, `elevationAt`, `sunElevationDeg`, `sunAzimuth`, `crossingStartTheta`, `crossingEndTheta`, `centre`, plus the rect lists the graybox renders.
- [ ] **Step 4:** Test passes, 7 tests. Then `npx vitest run tests/unit/museum/` → all museum suites still green (284 before this task; expect 291).
- [ ] **Step 5:** Commit with an explicit pathspec.

---

### Task 3: The eye — the rising plinth and the iris hatch

The room's ending. Reuses Air's Y-drive; do NOT build moving collision.

**Files:** Modify `sundial-layout.ts`, `SundialGraybox.svelte`

- [ ] **Step 1: Geometry.** Add to the layout module: `eyeRadius = 1.0` at the
  chamber centre, `EYE_TOP_Y` (the ceiling medallion's underside), and
  `EYE_SPEED` as a single exported constant so the ride can be retuned in one
  place — Air's `UPDRAFT_SPEED = 1.0` is the reference, and Austen has never
  signed off on that rate either, so expect to tune it.
- [ ] **Step 2: The annular sky.** The ceiling is a ring opening around a solid
  central medallion of radius ≥ `eyeRadius + 1.5`. Assert in the layout test that
  the medallion covers the eye — if the eye is not under solid ceiling, there is
  nothing for the hatch to open in.
- [ ] **Step 3: The ride.** Reuse the updraft path: when the player is within
  `eyeRadius` of centre AND standing on the disc, drive Y upward at `EYE_SPEED`
  toward `EYE_TOP_Y`. Render a `T.Mesh` cylinder whose top face tracks the
  player's feet, so it reads as the ground carrying them.
- [ ] **Step 4: The hatch.** The medallion irises open as the plinth approaches.
  Graybox it as a simple radial scale or two sliding halves — do NOT author a
  real iris mechanism yet. Judge the timing: it must finish opening BEFORE the
  player reaches it, or the moment reads as a collision rather than a door.
- [ ] **Step 5: Test** that the eye is walkable, that the rest of the centre disc
  is NOT a lift (only the eye lifts), and that the disc still reports −0.2
  everywhere outside `eyeRadius`. Commit.

### Task 4: The graybox scene

**Files:** Create `src/lib/features/museum/components/game/SundialGraybox.svelte`

- [ ] **Step 1:** Render only what the layout reports — rim annulus, centre disc, spiral crossing, ring floor at −4.0, four pillars, chamber wall, the collapsed roof opening. Untextured grey. Follow `FirstFireGraybox.svelte` for structure.
- [ ] **Step 2: The sun.** One `T.DirectionalLight` with `castShadow`, shadow camera fitted to the chamber bounds (`left/right/top/bottom = ±14`, `near 1`, `far 80`), `mapSize 2048`. Recompute its position each frame from the player via `useTask`, using the locked mapping.
- [ ] **Step 3: The visitor's shadow.** A capsule mesh at the player position with `castShadow` true and layered so the first-person camera does not render it. **This is not optional** — the visitor's own shadow is how the mechanism explains itself.
- [ ] **Step 4: Shadow bias.** Tune `bias` and `normalBias` against the RIM frame (8° raking light over 24 m), not the noon frame. Noon will look fine long before the rim does.
- [ ] **Step 5:** Register in the cave scene beside the other rooms. Commit.

---

### Task 5: Look at it

Per `visual-verification-mandatory.md` this needs no permission.

- [ ] **Step 1:** Start the shared browser: `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`. Seed the player into the Sun room via the `museum-cave-3d-state-v1` sessionStorage key **in the navigation `initScript`, not `evaluate_script` + reload** — the page's unload handler overwrites anything set beforehand. Note: **yaw 0 faces +Z (south), yaw −π/2 faces west.**
- [ ] **Step 2: The rim frame.** Stand at r ≈ 10.5. Expect four enormous parallel shadows raking up the chamber wall, and the visitor's own among them, all running the same way.
- [ ] **Step 3: The crossing.** Walk the spiral inward. The shadows must lengthen, shorten and slew through a quarter of the compass in one continuous move. If azimuth does not visibly swing, `θ0` or the sweep is wrong.
- [ ] **Step 4: The noon frame — the gate.** Stand at the centre. Each performer's prop path must project onto the ring floor as a readable disc of notation. **If it does not read as notation, the room's thesis is wrong and it needs rethinking, not polishing.** Say so plainly.
- [ ] **Step 5: Cost.** Measure frame time against Fire's three rigs. Four rigs plus a moving shadow-caster is the heaviest room in the wing.
- [ ] **Step 6:** Screenshot each frame at `format: "webp", quality: 70`. Write what you actually saw into Loose ends below.

---

## Out of scope

- **The C4 ring-floor mandala inlay.** Ornament is a Phase 2 art pass; the graybox proves the mechanism. The noon frame is judged on the live shadows alone.
- **Wall motif traces.** Same reason. They depend on the effects migration (`2026-08-05-effects-3d-migration.md`) landing first.
- **Volumetric shafts, colour grade, ember kit.** Judge legibility before spending on atmosphere.

## Loose ends

Append what the frames actually show.
