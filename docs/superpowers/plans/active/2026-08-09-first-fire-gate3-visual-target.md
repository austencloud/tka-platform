# First Fire Gate 3 — Registered Visual Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce Gate 3's three evidence artifacts for the Cinder Court — a locked camera set registered to the approved Gate 2 walk frames, a visual target board, and a material/lighting brief — plus the one engineering seam the target depends on: registry fire effects on museum performers.

**Architecture:** The Blender contract already emits seven QA cameras derived from the approved plan. Gate 3 adds the one missing camera (`dj-cooling`), binds seven of them one-to-one to the seven Gate 2 walk frames in a new locked-camera module, and lets the graybox route render any locked camera by id. Registration is then provable by construction: every locked camera's transform comes from the same plan contract that produced the frame. Separately, `MuseumPerformerStation3D` gains an `effectId` prop by following the seam `CovenStation` already uses (`buildTipEffectMap` → `PerformerRig showEffects` + `EffectOrchestrator3D` in the `effectsSlot` snippet), so the coal/flame/arc vocabulary can be shown rather than described.

**Tech Stack:** Svelte 5 runes, Threlte, `@austencloud/scene-3d` (`PerformerRig`), Vitest, Chrome DevTools MCP for capture, `sharp` for the board and silhouette composites, Node for the gate validator.

**Spec:** `docs/superpowers/specs/first-fire-cinder-court/2026-08-09-first-fire-gate3-visual-target-design.md`

**Standing constraints for every task in this plan:**
- Run Vitest with `--exclude '.claude/worktrees/**'`.
- The git index is shared with other live sessions. Every commit uses an explicit pathspec: `git commit -m "..." -- <paths>`. Never `git add -A`, `git add .`, or a bare `git commit`.
- Port 5173 is Austen's dev server. Do not restart or kill it. Use it read-only for capture, or `vite --port 5174` if it is unavailable.
- Screenshots use `format: "webp", quality: 70`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/features/museum/data/first-fire-blender-contract.ts` | Modify: add the `dj-cooling` camera. Already owns the contract's camera list. |
| `src/lib/features/museum/data/first-fire-locked-cameras.ts` | Create: the Gate 3 locked set — camera id ↔ Gate 2 frame binding, plus blender→runtime transform conversion. |
| `src/lib/shared/animation-engine/domain/tip-effect-map.ts` | Create: `buildTipEffectMap`, promoted from coven-hub now that a second feature needs it. |
| `src/lib/features/coven-hub/domain/coven-effect-map.ts` | Modify: re-export from the shared owner, no second implementation. |
| `src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte` | Modify: accept `effectId`, drive `PerformerRig` effects through `EffectOrchestrator3D`. |
| `src/routes/test/first-fire-graybox/first-fire-court-vocabulary.ts` | Create: the court → effect id mapping (coal, flame, arc) and its cumulative perimeter layers. |
| `src/routes/test/first-fire-graybox/FirstFireGrayboxWalkScene.svelte` | Modify: `?camera=<id>` locked-camera render mode; pass each court's effect id to its performer. |
| `scripts/build-first-fire-gate3-board.mjs` | Create: composes the target board and the grayscale silhouette sheet from captured frames. |
| `tests/unit/museum/first-fire-locked-cameras.test.ts` | Create: locked-set registration tests. |
| `tests/unit/museum/first-fire-court-vocabulary.test.ts` | Create: cumulative vocabulary tests. |
| `docs/superpowers/specs/first-fire-cinder-court/gate3/` | Create: captured frames, board, silhouette sheet. |
| `docs/superpowers/specs/first-fire-cinder-court/scene-gates.json` | Modify: Gate 3 evidence and checks. |

---

## Task 1: Derive the `dj-cooling` camera in the Gate 3 module

**Corrected 2026-08-09 after the first attempt broke Gate 2.** The original
instruction here was to add `dj-cooling` to the Blender contract. Do not do
that. The contract's source digest is recorded Gate 2 evidence for the graybox
GLB, and cameras contribute no geometry to that export — the verifier asserts
zero cameras in it. Adding a camera upstream invalidates an approved artifact's
digest without moving a vertex, and takes both the gate validator and
`scripts/verify-first-fire-graybox-glb.mjs` red. Regenerating the golden fixture
to make the suite green replaces approved evidence to accommodate new evidence,
which is the one thing the gate system exists to prevent.

Derive the camera inside `first-fire-locked-cameras.ts` from the DJ shrine's
`blenderExit` and `blenderCentre` instead. Registration stays exact because it
comes from the same shrine geometry, and Gate 3 stays additive.

This task is complete as of commit `c775b142dc`. Its content is preserved below
for the record.

The Gate 2 frame `walk-03-dj-cooling.webp` is the visitor looking back at DJ from its exit mouth as the court cools. It is the only walk frame with no matching contract camera. Without it the locked set cannot be seven-for-seven.

**Files:**
- Modify: `src/lib/features/museum/data/first-fire-blender-contract.ts:434-465`
- Test: `tests/unit/museum/first-fire-locked-cameras.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/museum/first-fire-locked-cameras.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildFirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";

const contract = buildFirstFireBlenderContract();

describe("First Fire contract cameras", () => {
  it("carries a dj-cooling camera at the DJ exit mouth looking back at the court", () => {
    const camera = contract.cameras.find((entry) => entry.id === "dj-cooling");
    expect(camera).toBeDefined();
    const dj = contract.shrines.find((entry) => entry.id === "dj")!;
    // The camera stands at the exit mouth the visitor actually leaves through.
    expect(camera!.position.x).toBeCloseTo(dj.blenderExit.x, 3);
    expect(camera!.position.y).toBeCloseTo(dj.blenderExit.y, 3);
    // And it faces the court centre, not the next court.
    expect(camera!.target.x).toBeCloseTo(dj.blenderCentre.x, 3);
    expect(camera!.target.y).toBeCloseTo(dj.blenderCentre.y, 3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/museum/first-fire-locked-cameras.test.ts --exclude '.claude/worktrees/**'
```

Expected: FAIL — `expected undefined to be defined`.

- [ ] **Step 3: Add the camera**

In `src/lib/features/museum/data/first-fire-blender-contract.ts`, inside the `cameras: [` array, immediately after the `dj-threshold` entry, add:

```ts
      camera("dj-cooling", dj.exit, dj.centre, planCentre, 62),
```

The `camera()` helper at line 239 already converts plan points to Blender space at eye height and targets at 1.05 m.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/museum/first-fire-locked-cameras.test.ts --exclude '.claude/worktrees/**'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(museum): add the First Fire dj-cooling contract camera" -- src/lib/features/museum/data/first-fire-blender-contract.ts tests/unit/museum/first-fire-locked-cameras.test.ts
```

---

## Task 2: The locked camera set

Binds seven contract cameras to the seven approved Gate 2 frames and exposes each as a runtime transform the walk scene can teleport to. `overview`, `plan`, and `water-entry` remain QA cameras outside the locked set.

Runtime conversion is the contract's documented exporter transform: `(Blender X, Y, Z) -> (runtime X, Z, -Y)`.

**Files:**
- Create: `src/lib/features/museum/data/first-fire-locked-cameras.ts`
- Test: `tests/unit/museum/first-fire-locked-cameras.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/museum/first-fire-locked-cameras.test.ts`:

```ts
import {
  FIRST_FIRE_LOCKED_CAMERAS,
  buildFirstFireLockedCameraViews,
} from "$lib/features/museum/data/first-fire-locked-cameras";

describe("First Fire locked camera set", () => {
  it("binds exactly the seven approved Gate 2 walk frames", () => {
    expect(FIRST_FIRE_LOCKED_CAMERAS).toHaveLength(7);
    expect(FIRST_FIRE_LOCKED_CAMERAS.map((entry) => entry.frame)).toEqual([
      "walk-01-ember-bridge.webp",
      "walk-02-dj-mouth.webp",
      "walk-03-dj-cooling.webp",
      "walk-04-ek-mouth.webp",
      "walk-05-fl-mouth.webp",
      "walk-06-blackout.webp",
      "walk-07-earth-growth.webp",
    ]);
  });

  it("resolves every locked camera against the contract", () => {
    const views = buildFirstFireLockedCameraViews(contract);
    expect(views).toHaveLength(7);
    for (const view of views) {
      expect(Number.isFinite(view.position.x)).toBe(true);
      expect(Number.isFinite(view.position.y)).toBe(true);
      expect(Number.isFinite(view.position.z)).toBe(true);
      expect(view.horizontalFovDegrees).toBeGreaterThan(0);
    }
  });

  it("converts blender space to runtime space with the exporter transform", () => {
    const views = buildFirstFireLockedCameraViews(contract);
    const bridge = views.find((view) => view.id === "ember-bridge")!;
    const source = contract.cameras.find((entry) => entry.id === "ember-bridge")!;
    expect(bridge.position.x).toBeCloseTo(source.position.x, 6);
    expect(bridge.position.y).toBeCloseTo(source.position.z, 6);
    expect(bridge.position.z).toBeCloseTo(-source.position.y, 6);
  });

  it("faces each camera at its authored target", () => {
    const views = buildFirstFireLockedCameraViews(contract);
    for (const view of views) {
      const dx = view.target.x - view.position.x;
      const dz = view.target.z - view.position.z;
      // A camera pointed at its own position has no facing and cannot register.
      expect(Math.hypot(dx, dz)).toBeGreaterThan(0.5);
      expect(view.yaw).toBeCloseTo(Math.atan2(dx, dz), 6);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/museum/first-fire-locked-cameras.test.ts --exclude '.claude/worktrees/**'
```

Expected: FAIL — cannot resolve `first-fire-locked-cameras`.

- [ ] **Step 3: Create the module**

Create `src/lib/features/museum/data/first-fire-locked-cameras.ts`:

```ts
/**
 * First Fire Gate 3 locked camera set.
 *
 * Each entry binds one contract camera to one approved Gate 2 walk frame.
 * Registration is by construction: the transform is derived from the same plan
 * contract that produced the frame, so a Gate 4 render from these cameras is
 * provably the same room the user approved.
 */
import type {
  FirstFireBlenderContract,
  FirstFireBlenderCamera,
} from "./first-fire-blender-contract";

export interface FirstFireLockedCamera {
  /** Contract camera id. */
  id: string;
  /** Gate 2 walk frame this camera reproduces. */
  frame: string;
  /** What the frame is for, in one line. */
  intent: string;
}

export interface FirstFireLockedCameraView extends FirstFireLockedCamera {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  /** Runtime yaw toward the target, radians. */
  yaw: number;
  horizontalFovDegrees: number;
}

export const FIRST_FIRE_LOCKED_CAMERAS: readonly FirstFireLockedCamera[] = [
  {
    id: "ember-bridge",
    frame: "walk-01-ember-bridge.webp",
    intent: "Arrival. The vent chamber reads as a volcano before any court is legible.",
  },
  {
    id: "dj-threshold",
    frame: "walk-02-dj-mouth.webp",
    intent: "Coal announced. Narrowest throat, closest performer, hardest heat distortion.",
  },
  {
    id: "dj-cooling",
    frame: "walk-03-dj-cooling.webp",
    intent: "The walked court cooling to coals behind the visitor.",
  },
  {
    id: "ek-threshold",
    frame: "walk-04-ek-mouth.webp",
    intent: "Flame added. The court opens and breathes after DJ's proximity.",
  },
  {
    id: "fl-threshold",
    frame: "walk-05-fl-mouth.webp",
    intent: "Arc added. The full instrument, and the only fire arriving from outside.",
  },
  {
    id: "blackout",
    frame: "walk-06-blackout.webp",
    intent: "Three accumulated layers gone at once. No light source survives.",
  },
  {
    id: "earth-reveal",
    frame: "walk-07-earth-growth.webp",
    intent: "Green rising from the strike scars along the route already walked.",
  },
] as const;

/** The contract's documented exporter transform: (X, Y, Z) -> (X, Z, -Y). */
function toRuntime(point: { x: number; y: number; z: number }) {
  return { x: point.x, y: point.z, z: -point.y };
}

export function buildFirstFireLockedCameraViews(
  contract: FirstFireBlenderContract
): FirstFireLockedCameraView[] {
  return FIRST_FIRE_LOCKED_CAMERAS.map((locked) => {
    const source: FirstFireBlenderCamera | undefined = contract.cameras.find(
      (candidate) => candidate.id === locked.id
    );
    if (!source) {
      throw new Error(
        `Locked camera ${locked.id} is missing from the First Fire contract`
      );
    }
    const position = toRuntime(source.position);
    const target = toRuntime(source.target);
    return {
      ...locked,
      position,
      target,
      yaw: Math.atan2(target.x - position.x, target.z - position.z),
      horizontalFovDegrees: source.horizontalFovDegrees,
    };
  });
}

export function findFirstFireLockedCameraView(
  contract: FirstFireBlenderContract,
  id: string
): FirstFireLockedCameraView | undefined {
  return buildFirstFireLockedCameraViews(contract).find(
    (view) => view.id === id
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/museum/first-fire-locked-cameras.test.ts --exclude '.claude/worktrees/**'
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(museum): lock the First Fire Gate 3 camera set to the approved walk frames" -- src/lib/features/museum/data/first-fire-locked-cameras.ts tests/unit/museum/first-fire-locked-cameras.test.ts
```

---

## Task 3: The court fire vocabulary

Coal, flame, arc — cumulative. This module is the single owner of which effect each court adds and which layers are burning by the time the visitor reaches it. The walk scene reads it; the tests assert it.

**Files:**
- Create: `src/routes/test/first-fire-graybox/first-fire-court-vocabulary.ts`
- Test: `tests/unit/museum/first-fire-court-vocabulary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/museum/first-fire-court-vocabulary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FIRST_FIRE_COURT_VOCABULARY,
  firstFireCourtEffectId,
  firstFireCourtLayers,
} from "../../../src/routes/test/first-fire-graybox/first-fire-court-vocabulary";

describe("First Fire court vocabulary", () => {
  it("adds one voice per court in walk order", () => {
    expect(FIRST_FIRE_COURT_VOCABULARY.map((entry) => entry.shrineId)).toEqual([
      "dj",
      "ek",
      "fl",
    ]);
    expect(FIRST_FIRE_COURT_VOCABULARY.map((entry) => entry.addsEffectId)).toEqual([
      "charcoal",
      "fire",
      "zap",
    ]);
  });

  it("accumulates rather than replaces", () => {
    expect(firstFireCourtLayers("dj")).toEqual(["charcoal"]);
    expect(firstFireCourtLayers("ek")).toEqual(["charcoal", "fire"]);
    expect(firstFireCourtLayers("fl")).toEqual(["charcoal", "fire", "zap"]);
  });

  it("gives each performer the voice its own court adds", () => {
    // The performer states the NEW voice; the accumulated layers burn at the
    // court perimeter. If the performer carried every layer, no mouth would be
    // legible and the room would read as one orange blur.
    expect(firstFireCourtEffectId("dj")).toBe("charcoal");
    expect(firstFireCourtEffectId("ek")).toBe("fire");
    expect(firstFireCourtEffectId("fl")).toBe("zap");
  });

  it("uses only ids that exist in the effect registry", async () => {
    const { EFFECTS } = await import(
      "$lib/shared/animation-engine/components/effects-panel/effect-registry"
    );
    const known = new Set(EFFECTS.map((effect) => effect.id));
    for (const entry of FIRST_FIRE_COURT_VOCABULARY) {
      expect(known.has(entry.addsEffectId)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/museum/first-fire-court-vocabulary.test.ts --exclude '.claude/worktrees/**'
```

Expected: FAIL — cannot resolve `first-fire-court-vocabulary`.

- [ ] **Step 3: Create the module**

Create `src/routes/test/first-fire-graybox/first-fire-court-vocabulary.ts`:

```ts
/**
 * The Cinder Court states three forms of fire, cumulatively: each court adds a
 * voice rather than replacing the previous one. The performer carries the voice
 * its own court adds, so every mouth announces exactly one new thing; the
 * accumulated layers burn at the court perimeter.
 *
 * Design: docs/superpowers/specs/first-fire-cinder-court/2026-08-09-first-fire-gate3-visual-target-design.md
 */
import type { FirstFireShrineId } from "$lib/features/museum/data/first-fire-procession-plan";

export interface FirstFireCourtVoice {
  shrineId: FirstFireShrineId;
  /** Effect registry id this court introduces. */
  addsEffectId: string;
  /** What the visitor is meant to feel at this mouth. */
  intent: string;
}

export const FIRST_FIRE_COURT_VOCABULARY: readonly FirstFireCourtVoice[] = [
  {
    shrineId: "dj",
    addsEffectId: "charcoal",
    intent: "Coal is the hotter fire. Too close to something lethal.",
  },
  {
    shrineId: "ek",
    addsEffectId: "fire",
    intent: "Release. Fire gains a shape instead of only a temperature.",
  },
  {
    shrineId: "fl",
    addsEffectId: "zap",
    intent: "The full instrument, and the only fire that arrives from outside.",
  },
] as const;

export function firstFireCourtEffectId(shrineId: FirstFireShrineId): string {
  const voice = FIRST_FIRE_COURT_VOCABULARY.find(
    (entry) => entry.shrineId === shrineId
  );
  return voice?.addsEffectId ?? "charcoal";
}

/** Every voice burning by the time the visitor reaches this court. */
export function firstFireCourtLayers(
  shrineId: FirstFireShrineId
): readonly string[] {
  const index = FIRST_FIRE_COURT_VOCABULARY.findIndex(
    (entry) => entry.shrineId === shrineId
  );
  if (index < 0) return [];
  return FIRST_FIRE_COURT_VOCABULARY.slice(0, index + 1).map(
    (entry) => entry.addsEffectId
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/museum/first-fire-court-vocabulary.test.ts --exclude '.claude/worktrees/**'
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(museum): First Fire court vocabulary — coal, flame, arc, cumulative" -- src/routes/test/first-fire-graybox/first-fire-court-vocabulary.ts tests/unit/museum/first-fire-court-vocabulary.test.ts
```

---

## Task 4: Promote `buildTipEffectMap` to a shared owner

A second feature now needs it. Per `never-hand-roll.md` this is **extend the owner**, not a second implementation: the function moves to the animation-engine domain and coven-hub re-exports it so every existing import keeps working.

**Files:**
- Create: `src/lib/shared/animation-engine/domain/tip-effect-map.ts`
- Modify: `src/lib/features/coven-hub/domain/coven-effect-map.ts`

- [ ] **Step 1: Create the shared owner**

Create `src/lib/shared/animation-engine/domain/tip-effect-map.ts` with the current implementation, moved verbatim:

```ts
import type {
  TipEffectMap,
  EffectType,
} from "$lib/shared/animation-engine/domain/types/tip-effect-types";
import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";

const VALID = new Set<string>(EFFECTS.map((effect) => effect.id));

/**
 * Build a wildcard TipEffectMap for one station. A null or unknown id falls
 * back to "led" — the registry ids are 1:1 with EffectType, so a known id
 * passes straight through.
 */
export function buildTipEffectMap(effectId: string | null): TipEffectMap {
  const effect = (
    effectId && VALID.has(effectId) ? effectId : "led"
  ) as EffectType;
  return { "*": { effect } };
}
```

- [ ] **Step 2: Replace the coven-hub copy with a re-export**

Replace the entire contents of `src/lib/features/coven-hub/domain/coven-effect-map.ts` with:

```ts
/**
 * Coven's tip-effect map. The behaviour owner is the animation-engine domain
 * now that the museum needs it too; this re-export keeps coven's imports stable.
 */
export { buildTipEffectMap } from "$lib/shared/animation-engine/domain/tip-effect-map";
```

- [ ] **Step 3: Verify nothing broke**

```bash
npx vitest run tests/unit --exclude '.claude/worktrees/**' 2>&1 | tail -6
```

Expected: same pass count as before this task, zero failures.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(effects): promote buildTipEffectMap to the animation-engine domain" -- src/lib/shared/animation-engine/domain/tip-effect-map.ts src/lib/features/coven-hub/domain/coven-effect-map.ts
```

---

## Task 5: Give museum performers a registry effect

`MuseumPerformerStation3D` renders `PerformerRig` with no effects. `CovenStation` already drives effects through the rig's `effectsSlot` snippet with `EffectOrchestrator3D`. Follow that seam exactly.

**Files:**
- Modify: `src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte`

- [ ] **Step 1: Add the prop**

In the `interface Props` block (around line 33), add after `userSequenceDataMap`:

```ts
    /**
     * Registry effect id for this performer's props (Coal, fire, zap, ...).
     * Null or omitted renders the rig with no effect layer, which is the
     * museum's existing behaviour.
     */
    effectId?: string | null;
```

- [ ] **Step 2: Add the imports**

With the other imports at the top of the `<script>` block:

```ts
  import EffectOrchestrator3D from "$lib/shared/3d/effects/EffectOrchestrator3D.svelte";
  import { buildTipEffectMap } from "$lib/shared/animation-engine/domain/tip-effect-map";
```

- [ ] **Step 3: Derive the map**

After `const props: Props = $props();` and its neighbouring derived values, add:

```ts
  const tipEffectMap = $derived(
    props.effectId ? buildTipEffectMap(props.effectId) : null
  );
```

- [ ] **Step 4: Wire the rig**

Replace the `<PerformerRig ... />` self-closing element at line 212 with an element that carries the effects slot. Keep every existing prop:

```svelte
    <PerformerRig
      position={{ x: 0, z: 0 }}
      {facingAngle}
      planeMode={PlaneMode.WALL}
      avatarState={performerState}
      {showGrid}
      visiblePlanes={new Set([Plane.WALL])}
      gridMode={(resolvedSequence?.gridMode ?? "diamond") as GridMode}
      bluePropType={toScenePropType(bluePropType)}
      redPropType={toScenePropType(redPropType)}
      groundOffset={museumGroundOffset}
      enableLocomotion={true}
      enableFootPlanting={true}
      showEffects={tipEffectMap !== null}
      tipEffectMap={tipEffectMap ?? undefined}
      isPlaying={performerState.isPlaying}
    >
      {#snippet effectsSlot({
        bluePropState,
        redPropState,
        blueHandPos,
        redHandPos,
        isPlaying: rigPlaying,
        staffHalfLength,
        effectsParentRef,
      })}
        {#if tipEffectMap}
          <EffectOrchestrator3D
            {bluePropState}
            {redPropState}
            isPlaying={rigPlaying}
            {staffHalfLength}
            tipEffectMap={tipEffectMap}
            {blueHandPos}
            {redHandPos}
            {effectsParentRef}
            currentStep={performerState.currentStepIndex + performerState.progress}
          />
        {/if}
      {/snippet}
    </PerformerRig>
```

- [ ] **Step 5: Typecheck**

Only one `svelte-check` may run machine-wide. Confirm none is running, then:

```bash
npm run check > /tmp/gate3-check.log 2>&1; grep -niE "error" /tmp/gate3-check.log | head -20
```

Expected: no errors mentioning `MuseumPerformerStation3D`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(museum): let performer stations carry a registry prop effect" -- src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte
```

---

## Task 6: Wire the vocabulary and the locked cameras into the graybox route

**Files:**
- Modify: `src/routes/test/first-fire-graybox/FirstFireGrayboxWalkScene.svelte`

- [ ] **Step 1: Import both modules**

With the other imports:

```ts
  import { firstFireCourtEffectId } from "./first-fire-court-vocabulary";
  import { findFirstFireLockedCameraView } from "$lib/features/museum/data/first-fire-locked-cameras";
```

- [ ] **Step 2: Pass each court its effect**

Find the `MuseumPerformerStation3D` usage in the markup and add:

```svelte
      effectId={firstFireCourtEffectId(shrineId)}
```

where `shrineId` is the id already in scope for that station. If the station is rendered inside an `{#each}` over the contract's shrines, use that loop's shrine id.

- [ ] **Step 3: Add the locked-camera render mode**

Beside the existing `?proof=N` handling, add a `?camera=<id>` path. Add this function next to `teleportForReviewPhase`:

```ts
  function teleportToLockedCamera(cameraId: string): boolean {
    const view = findFirstFireLockedCameraView(contract, cameraId);
    if (!view) return false;
    const destination = { x: view.position.x, y: view.position.y, z: view.position.z };
    physicsProvider?.teleport?.(destination);
    playerPosition = destination;
    avatarState.snapFacingAngle?.(view.yaw);
    cameraRevision += 1;
    return true;
  }
```

Then in the same place the route reads `proof` from the query string, read `camera` and call `teleportToLockedCamera(value)` when present. The locked camera wins over `?proof` when both are supplied.

- [ ] **Step 4: Verify in the browser**

Start or reuse the shared instance:

```bash
pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
```

Open a background task-owned page at `https://localhost:5173/test/first-fire-graybox?camera=dj-threshold`, keep its page id, `emulate` `1408x792x1`, and `take_screenshot` with `format: "webp", quality: 70`. Confirm the frame matches `docs/superpowers/specs/first-fire-cinder-court/gate2/walk-02-dj-mouth.webp` in composition, and that the DJ performer now shows the Coal effect on its props.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(museum): First Fire locked-camera render mode and per-court fire vocabulary" -- src/routes/test/first-fire-graybox/FirstFireGrayboxWalkScene.svelte
```

---

## Task 6b: Dress the room from the ember scene

Without this the Gate 3 board is two graybox photographs side by side, which
proves registration but shows no target. This task is what makes the right-hand
column a *target*: the volcano material and lighting applied at the locked
cameras. It is deliberately scoped to dressing and light — no geometry moves.

**Files:**
- Modify: `src/routes/test/first-fire-graybox/FirstFireGrayboxWalkScene.svelte`

- [ ] **Step 1: Read the ember components before wiring any of them**

```bash
ls src/lib/shared/3d/environments/scenes/ember/
sed -n '1,80p' src/lib/shared/3d/environments/domain/models/scene-configs/ember-scene-config.ts
```

Each component's props come from `ember-scene-config.ts`. Read the config
interface for a component before mounting it; do not guess prop names.

- [ ] **Step 2: Mount the dressing set**

Per the brief's component mapping, mount inside the graybox scene:
`CraterGround` for the floor, `LavaRivers` in the court trenches, `LavaCracks`
along the walked route, `LavaPool` in the far field, `VolcanicHaze` for depth,
`HeatDistortion` strongest at DJ, `FireWisps` at the existing flame anchors.

Two hard constraints from the brief, both load-bearing:
1. **No ambient fill and no sky.** Every light in the room must be extinguishable,
   or the blackout before the Earth reveal is impossible.
2. **Fire never owns collision.** The Gate 2 `collision` check stands. Dressing
   is visual only; `first-fire-graybox-colliders.ts` does not change.

- [ ] **Step 3: Verify the blackout still goes black**

Load `https://localhost:5173/test/first-fire-graybox?proof=6`, screenshot at
`1408x792x1`, `format: "webp", quality: 70`. The frame must be black apart from
any light the design explicitly allows. If dressing left a light burning, remove
that light — do not dim it.

- [ ] **Step 4: Verify the staged reveal still holds**

```bash
node scripts/verify-first-fire-graybox-glb.mjs
npx vitest run tests/unit/museum --exclude '.claude/worktrees/**' 2>&1 | tail -6
```

Expected: verifier green, all museum tests pass. No green geometry may appear
before `growth-complete`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(museum): dress the Cinder Court from the ember volcano set" -- src/routes/test/first-fire-graybox/FirstFireGrayboxWalkScene.svelte
```

---

## Task 7: Capture the locked-camera frames

**Files:**
- Create: `docs/superpowers/specs/first-fire-cinder-court/gate3/camera-*.webp` (7 files)

- [ ] **Step 1: Capture all seven**

For each id in `ember-bridge`, `dj-threshold`, `dj-cooling`, `ek-threshold`, `fl-threshold`, `blackout`, `earth-reveal`: navigate the task-owned page to `https://localhost:5173/test/first-fire-graybox?camera=<id>`, wait for the graybox ready signal, and `take_screenshot` with `format: "webp", quality: 70` and `filePath` set to `docs/superpowers/specs/first-fire-cinder-court/gate3/camera-<id>.webp`.

`blackout` and `earth-reveal` additionally need their phase: append `&proof=6` and `&proof=7` respectively so the staged reveal state matches the frame.

- [ ] **Step 2: Read every frame**

Read each captured file and check it against the matching Gate 2 walk frame. Same court, same occlusion, same throat. A camera whose frame does not reproduce its Gate 2 counterpart fails `camera-registration` — fix the camera, do not adjust the check.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs(museum): First Fire Gate 3 locked-camera captures" -- docs/superpowers/specs/first-fire-cinder-court/gate3/
```

---

## Task 8: The board and the silhouette sheet

**Files:**
- Create: `scripts/build-first-fire-gate3-board.mjs`
- Create: `docs/superpowers/specs/first-fire-cinder-court/gate3/first-fire-gate3-target-board.webp`
- Create: `docs/superpowers/specs/first-fire-cinder-court/gate3/first-fire-gate3-silhouette.webp`

- [ ] **Step 1: Write the script**

Create `scripts/build-first-fire-gate3-board.mjs`:

```js
#!/usr/bin/env node
/**
 * Compose the First Fire Gate 3 evidence images.
 *
 * Board: each locked camera's Gate 2 graybox frame beside its Gate 3 capture,
 * so the reviewer can see the target is the same room, not a different one.
 * Silhouette: the three court mouths in grayscale, for the silhouette-read
 * check — if two courts share a shape without colour, the vocabulary failed.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const gate2 = resolve("docs/superpowers/specs/first-fire-cinder-court/gate2");
const gate3 = resolve("docs/superpowers/specs/first-fire-cinder-court/gate3");
mkdirSync(gate3, { recursive: true });

const PAIRS = [
  ["ember-bridge", "walk-01-ember-bridge.webp"],
  ["dj-threshold", "walk-02-dj-mouth.webp"],
  ["dj-cooling", "walk-03-dj-cooling.webp"],
  ["ek-threshold", "walk-04-ek-mouth.webp"],
  ["fl-threshold", "walk-05-fl-mouth.webp"],
  ["blackout", "walk-06-blackout.webp"],
  ["earth-reveal", "walk-07-earth-growth.webp"],
];

const CELL_WIDTH = 704;
const CELL_HEIGHT = 396;

async function cell(path) {
  return sharp(path).resize(CELL_WIDTH, CELL_HEIGHT, { fit: "cover" }).toBuffer();
}

async function buildBoard() {
  const composites = [];
  for (const [index, [id, frame]] of PAIRS.entries()) {
    composites.push({
      input: await cell(resolve(gate2, frame)),
      left: 0,
      top: index * CELL_HEIGHT,
    });
    composites.push({
      input: await cell(resolve(gate3, `camera-${id}.webp`)),
      left: CELL_WIDTH,
      top: index * CELL_HEIGHT,
    });
  }
  await sharp({
    create: {
      width: CELL_WIDTH * 2,
      height: CELL_HEIGHT * PAIRS.length,
      channels: 3,
      background: { r: 8, g: 6, b: 6 },
    },
  })
    .composite(composites)
    .webp({ quality: 82 })
    .toFile(resolve(gate3, "first-fire-gate3-target-board.webp"));
}

async function buildSilhouette() {
  const mouths = ["dj-threshold", "ek-threshold", "fl-threshold"];
  const composites = [];
  for (const [index, id] of mouths.entries()) {
    composites.push({
      input: await sharp(resolve(gate3, `camera-${id}.webp`))
        .resize(CELL_WIDTH, CELL_HEIGHT, { fit: "cover" })
        .grayscale()
        .normalise()
        .toBuffer(),
      left: index * CELL_WIDTH,
      top: 0,
    });
  }
  await sharp({
    create: {
      width: CELL_WIDTH * mouths.length,
      height: CELL_HEIGHT,
      channels: 3,
      background: { r: 8, g: 6, b: 6 },
    },
  })
    .composite(composites)
    .webp({ quality: 82 })
    .toFile(resolve(gate3, "first-fire-gate3-silhouette.webp"));
}

await buildBoard();
await buildSilhouette();
console.log(JSON.stringify({ board: "built", silhouette: "built" }, null, 2));
```

- [ ] **Step 2: Run it**

```bash
node scripts/build-first-fire-gate3-board.mjs
```

Expected: `{ "board": "built", "silhouette": "built" }`.

- [ ] **Step 3: Read the silhouette sheet and rule on it**

Read `first-fire-gate3-silhouette.webp`. The `silhouette-read` check passes only if DJ, EK, and FL are distinguishable with colour stripped: coal reads as tight bright cores, flame as a plume, arc as branching lines. If two courts read the same, the check fails and the vocabulary needs work before Gate 3 can be presented. Report the honest verdict.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(museum): First Fire Gate 3 target board and silhouette sheet" -- scripts/build-first-fire-gate3-board.mjs docs/superpowers/specs/first-fire-cinder-court/gate3/
```

---

## Task 9: Record Gate 3 in the manifest

**Files:**
- Modify: `docs/superpowers/specs/first-fire-cinder-court/scene-gates.json`

- [ ] **Step 1: Hash every artifact**

```bash
sha256sum docs/superpowers/specs/first-fire-cinder-court/gate3/first-fire-gate3-target-board.webp docs/superpowers/specs/first-fire-cinder-court/gate3/first-fire-gate3-silhouette.webp docs/superpowers/specs/first-fire-cinder-court/2026-08-09-first-fire-gate3-visual-target-design.md src/lib/features/museum/data/first-fire-locked-cameras.ts
```

- [ ] **Step 2: Fill in the gate**

Set the `registered-visual-target` gate's `status` to `"ready-for-review"`, leave `approval` as `null`, and populate it with the validator's required evidence kinds and check names. The required kinds are `locked-camera-set`, `visual-target-board`, `material-lighting-brief`; the required checks are `camera-registration` and `silhouette-read`.

```json
    {
      "id": "registered-visual-target",
      "status": "ready-for-review",
      "evidence": [
        {
          "kind": "locked-camera-set",
          "path": "src/lib/features/museum/data/first-fire-locked-cameras.ts",
          "sha256": "<hash from step 1>",
          "note": "Seven cameras bound one to one to the approved Gate 2 walk frames, resolved from the same plan contract that produced them."
        },
        {
          "kind": "visual-target-board",
          "path": "docs/superpowers/specs/first-fire-cinder-court/gate3/first-fire-gate3-target-board.webp",
          "sha256": "<hash from step 1>"
        },
        {
          "kind": "material-lighting-brief",
          "path": "docs/superpowers/specs/first-fire-cinder-court/2026-08-09-first-fire-gate3-visual-target-design.md",
          "sha256": "<hash from step 1>"
        },
        {
          "kind": "silhouette-sheet",
          "path": "docs/superpowers/specs/first-fire-cinder-court/gate3/first-fire-gate3-silhouette.webp",
          "sha256": "<hash from step 1>"
        }
      ],
      "checks": [
        {
          "name": "camera-registration",
          "status": "passed",
          "evidence": "<replace with the measured result: each locked camera resolves from the contract and its capture reproduces its Gate 2 frame>"
        },
        {
          "name": "silhouette-read",
          "status": "passed",
          "evidence": "<replace with the honest verdict from reading the grayscale sheet>"
        }
      ],
      "approval": null
    },
```

Do not write a `passed` status for either check until its evidence is real. A check whose evidence is a prediction is a fabricated gate.

- [ ] **Step 3: Validate**

```bash
node .claude/skills/museum-scene-production/scripts/validate-scene-gates.mjs docs/superpowers/specs/first-fire-cinder-court/scene-gates.json
```

Expected: `PASS: first-fire-cinder-court gate manifest is valid`.

Note: `currentGate` stays `3` while the gate is `ready-for-review`. It advances to `4` only when Austen approves and the approval record is written.

- [ ] **Step 4: Run the full museum suite**

```bash
npx vitest run tests/unit/museum --exclude '.claude/worktrees/**' 2>&1 | tail -6
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git commit -m "docs(museum): First Fire Gate 3 ready for review" -- docs/superpowers/specs/first-fire-cinder-court/scene-gates.json
```

---

## Task 10: Present Gate 3

- [ ] **Step 1: Present the board to Austen**

Send the target board and the silhouette sheet, with the seven camera intents. Ask him to describe what he expects to see at the FL mouth before he looks at it — a correct read is part of approval per the visual-bridge rule.

- [ ] **Step 2: Record the approval, or return the gate**

On approval, write the approval record with `approvedBy`, an ISO UTC `approvedAt`, his verbatim quote, `museumTrackerItem: "1bUBNo26hJpRq4Bf36gh"`, and `visualComprehensionConfirmed: true`; set the gate to `approved` and `currentGate` to `4`; revalidate; commit.

Praise, curiosity, or "nice" is not approval. On rejection the gate returns to `ready-for-review` with its evidence intact.
