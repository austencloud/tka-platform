# Acolyte Coven Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A walkable forest hub that performs one user-chosen sequence in a center "seed" coven plus a ring of satellite covens, each satellite wearing a different effect from the 16-effect registry.

**Architecture:** Extract the existing `TelekineticFormation3D` coven into a parameterized `CovenStation` (sequence + effect + stage + LOD via props). A `CovenHub` orchestrator reads the `EFFECTS` registry, lays stations out in an expanded `ForestScene` clearing, and drives proximity LOD so only nearby covens run full (12 full covens crashed the tab). Pure layout/LOD/effect-map/state logic lives in testable `.ts`/`.svelte.ts` modules; Svelte components wire them and are verified at runtime (the repo has no component-render tests).

**Tech Stack:** Svelte 5 runes, Threlte (`@threlte/core`/`extras`), `@austencloud/scene-3d` (`PerformerRig`), Vitest 4, existing `browse` engine, `viewer-3d-state` nav.

**Scope (first deliverable):** Engine + ONE template stage. The 15 remaining bespoke GLB stages, per-coven acolyte skins, and `walk` nav mode are deferred (see Deferred section). Template stage = the existing `Stage3D` as a fallback until a Blender GLB is authored; `CovenStation` already loads a GLB when `stageModel` is set.

---

## Reuse ledger (verified during research)

| Need | Reuse | Evidence |
|---|---|---|
| Coven formation + IK | Extract from `TelekineticFormation3D` | `src/lib/features/museum/components/game/TelekineticFormation3D.svelte` |
| Sequence picker UI | `BrowsePanel` (`engine`, `layout`, `onSelect`) | `src/lib/shared/browse/components/BrowsePanel.svelte` |
| Browse engine | `createBrowseEngine()` | `src/lib/shared/browse/engine/createBrowseEngine.svelte.ts` |
| Deep-link load by id | `getBrowseLoader().loadFullSequenceData(id, id)` | `MuseumPerformerStation3D.svelte:66-119` |
| Sequence → avatar | `avatarInstance.loadSequence(SequenceData)` | `src/lib/shared/3d/state/avatar-instance-state.svelte.ts:400-439` |
| Effect map type | `TipEffectMap = Record<string,{effect:EffectType}>` | `src/lib/shared/animation-engine/domain/types/TipEffectTypes.ts:35,49` |
| Effect catalog | `EFFECTS` (16 ids, 1:1 with `EffectType`) | `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts:48` |
| Forest environment | `ForestScene` (GLB trees, flora radial from origin) | `src/lib/shared/3d/environments/scenes/ForestScene.svelte` |
| Orbit/fly/walk nav | `ViewerNavMode` + `Viewer3DCamera` | `src/lib/shared/3d/state/viewer-3d-state.svelte.ts:54`, `Viewer3DCamera.svelte` |
| State factory test pattern | mock localStorage via `vi.stubGlobal` | `tests/unit/scene-features/scene-feature-state.test.ts` |

## Concurrency note (verified)

Each effect renderer creates its own canvas + GL context, so N concurrent covens with different effects is safe — **except** `WebGLFireRenderer.ts:67` has a module-level `activeFireInstanceCount` that globally lowers fire Jacobi iterations (12→8→6) as instances rise. Acceptable: it is a quality auto-scale, not a crash. No action required for first cut.

## File structure

```
src/lib/features/coven-hub/
├── domain/
│   ├── coven-hub-layout.ts        (pure: station ring positions + effect assignment)  [Task 1]
│   ├── coven-effect-map.ts        (pure: effectId → TipEffectMap)                      [Task 2]
│   └── coven-lod.ts               (pure: player pos → per-station LOD band)            [Task 3]
├── state/
│   └── coven-hub-state.svelte.ts  (active sequence, focus, picker, nav)               [Task 4]
├── components/
│   ├── CovenStation.svelte        (extracted parameterized coven)                     [Task 5]
│   ├── CovenHub.svelte            (orchestrator: layout + LOD + scene)                [Task 8]
│   └── CovenSequencePicker.svelte (wraps BrowsePanel)                                 [Task 10]
tests/unit/coven-hub/
├── coven-hub-layout.test.ts                                                            [Task 1]
├── coven-effect-map.test.ts                                                            [Task 2]
├── coven-lod.test.ts                                                                   [Task 3]
└── coven-hub-state.test.ts                                                             [Task 4]
src/routes/coven/+page.svelte      (route shortcut: Canvas + camera + CovenHub)        [Task 10]
static/models/coven-stages/        (template.glb lands here when authored)             [Task 6]
```

Modified:
- `effect-registry.ts` — add `ready3d?`, `stageModel?`, `skin?` to `EffectMeta` [Task 7]
- `TelekineticFormation3D.svelte` — becomes a thin wrapper around `CovenStation` [Task 5]
- `ForestScene.svelte` — add `showStage?`, `clearingRadius?` overrides [Task 9]
- viewer overflow menu — add "View in coven hub" action [Task 11]

---

## Task 1: Coven layout (pure)

**Files:**
- Create: `src/lib/features/coven-hub/domain/coven-hub-layout.ts`
- Test: `tests/unit/coven-hub/coven-hub-layout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/coven-hub/coven-hub-layout.test.ts
import { describe, it, expect } from "vitest";
import { computeCovenLayout, type CovenSlot } from "$lib/features/coven-hub/domain/coven-hub-layout";

describe("computeCovenLayout", () => {
  it("places the seed coven at the origin", () => {
    const slots = computeCovenLayout(["fire", "water"]);
    const seed = slots.find((s) => s.kind === "seed")!;
    expect(seed.x).toBe(0);
    expect(seed.z).toBe(0);
    expect(seed.effectId).toBeNull();
  });

  it("rings satellites around the origin, one per effect", () => {
    const slots = computeCovenLayout(["fire", "water", "led"]);
    const sats = slots.filter((s) => s.kind === "satellite");
    expect(sats.map((s) => s.effectId)).toEqual(["fire", "water", "led"]);
    for (const s of sats) {
      const r = Math.hypot(s.x, s.z);
      expect(r).toBeGreaterThan(0);
    }
  });

  it("spaces adjacent satellites at least the footprint apart", () => {
    const slots = computeCovenLayout(["fire", "water", "led", "echo", "bloom", "zap"]);
    const sats = slots.filter((s) => s.kind === "satellite");
    for (let i = 0; i < sats.length; i++) {
      const a = sats[i];
      const b = sats[(i + 1) % sats.length];
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(8);
    }
  });

  it("grows ring radius with count so spacing holds", () => {
    const small = computeCovenLayout(["a", "b", "c"]);
    const big = computeCovenLayout(Array.from({ length: 16 }, (_, i) => `e${i}`));
    const rSmall = Math.hypot(small[1].x, small[1].z);
    const rBig = Math.hypot(big[1].x, big[1].z);
    expect(rBig).toBeGreaterThan(rSmall);
  });

  it("returns a stable id per slot", () => {
    const slots = computeCovenLayout(["fire"]);
    expect(slots.find((s) => s.kind === "seed")!.id).toBe("coven-seed");
    expect(slots.find((s) => s.kind === "satellite")!.id).toBe("coven-fire");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- tests/unit/coven-hub/coven-hub-layout.test.ts`
Expected: FAIL — `computeCovenLayout` not exported / module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/features/coven-hub/domain/coven-hub-layout.ts

/** One coven's placement in the hub clearing. */
export interface CovenSlot {
  id: string;
  kind: "seed" | "satellite";
  /** Effect id for satellites; null for the seed coven. */
  effectId: string | null;
  x: number;
  z: number;
}

/** Min center-to-center spacing (meters) so coven platforms never overlap. */
const FOOTPRINT = 8;
const MIN_RING_RADIUS = 10;

/**
 * Place a seed coven at the origin and one satellite per effect on a ring
 * sized so adjacent satellites stay at least FOOTPRINT apart.
 */
export function computeCovenLayout(effectIds: readonly string[]): CovenSlot[] {
  const slots: CovenSlot[] = [
    { id: "coven-seed", kind: "seed", effectId: null, x: 0, z: 0 },
  ];
  const n = effectIds.length;
  if (n === 0) return slots;

  // chord = 2 r sin(pi/n) >= FOOTPRINT  ->  r >= FOOTPRINT / (2 sin(pi/n))
  const radius = Math.max(MIN_RING_RADIUS, FOOTPRINT / (2 * Math.sin(Math.PI / n)));

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    slots.push({
      id: `coven-${effectIds[i]}`,
      kind: "satellite",
      effectId: effectIds[i],
      x: Math.sin(angle) * radius,
      z: Math.cos(angle) * radius,
    });
  }
  return slots;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- tests/unit/coven-hub/coven-hub-layout.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/coven-hub/domain/coven-hub-layout.ts tests/unit/coven-hub/coven-hub-layout.test.ts
git commit -m "feat(coven-hub): pure coven layout (seed + effect ring)"
```

---

## Task 2: Effect-map builder (pure)

**Files:**
- Create: `src/lib/features/coven-hub/domain/coven-effect-map.ts`
- Test: `tests/unit/coven-hub/coven-effect-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/coven-hub/coven-effect-map.test.ts
import { describe, it, expect } from "vitest";
import { buildTipEffectMap } from "$lib/features/coven-hub/domain/coven-effect-map";

describe("buildTipEffectMap", () => {
  it("maps a valid effect id onto the wildcard tip key", () => {
    expect(buildTipEffectMap("fire")).toEqual({ "*": { effect: "fire" } });
  });

  it("falls back to led for the seed coven (null id)", () => {
    expect(buildTipEffectMap(null)).toEqual({ "*": { effect: "led" } });
  });

  it("falls back to led for an unknown id rather than emitting garbage", () => {
    expect(buildTipEffectMap("not-an-effect")).toEqual({ "*": { effect: "led" } });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- tests/unit/coven-hub/coven-effect-map.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/features/coven-hub/domain/coven-effect-map.ts
import type { TipEffectMap, EffectType } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";

const VALID = new Set<string>(EFFECTS.map((e) => e.id));

/**
 * Build a wildcard TipEffectMap for one coven. Seed coven (null) and unknown
 * ids fall back to "led" — the registry ids are 1:1 with EffectType, so a
 * known id passes straight through.
 */
export function buildTipEffectMap(effectId: string | null): TipEffectMap {
  const effect = (effectId && VALID.has(effectId) ? effectId : "led") as EffectType;
  return { "*": { effect } };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- tests/unit/coven-hub/coven-effect-map.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/coven-hub/domain/coven-effect-map.ts tests/unit/coven-hub/coven-effect-map.test.ts
git commit -m "feat(coven-hub): effectId -> TipEffectMap builder"
```

---

## Task 3: Proximity LOD (pure)

**Files:**
- Create: `src/lib/features/coven-hub/domain/coven-lod.ts`
- Test: `tests/unit/coven-hub/coven-lod.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/coven-hub/coven-lod.test.ts
import { describe, it, expect } from "vitest";
import { computeCovenLods, type LodBand } from "$lib/features/coven-hub/domain/coven-lod";

const stations = [
  { id: "a", x: 0, z: 0 },
  { id: "b", x: 0, z: 20 },
  { id: "c", x: 0, z: 40 },
];

describe("computeCovenLods", () => {
  it("marks the nearest station hero, mid idle, far frozen", () => {
    const lods = computeCovenLods(0, 0, stations, new Map());
    expect(lods.get("a")).toBe<LodBand>("hero");
    expect(lods.get("b")).toBe<LodBand>("idle");
    expect(lods.get("c")).toBe<LodBand>("frozen");
  });

  it("applies hysteresis: a hero station stays hero just past the boundary", () => {
    const prev = new Map<string, LodBand>([["a", "hero"]]);
    // player at z=13 — just past the 12m hero threshold for station a
    const lods = computeCovenLods(0, 13, stations, prev);
    expect(lods.get("a")).toBe<LodBand>("hero");
  });

  it("without prior state, the same station past the boundary is not hero", () => {
    const lods = computeCovenLods(0, 13, stations, new Map());
    expect(lods.get("a")).not.toBe<LodBand>("hero");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- tests/unit/coven-hub/coven-lod.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/features/coven-hub/domain/coven-lod.ts
export type LodBand = "hero" | "idle" | "frozen";

export interface LodStation {
  id: string;
  x: number;
  z: number;
}

export interface LodOptions {
  heroRadius: number;
  idleRadius: number;
  /** Extra distance a current-hero keeps its band before demotion. */
  hysteresis: number;
}

const DEFAULTS: LodOptions = { heroRadius: 12, idleRadius: 30, hysteresis: 4 };

/**
 * Classify each station by distance to the player, with hysteresis so a
 * station at a threshold does not thrash bands frame to frame.
 */
export function computeCovenLods(
  playerX: number,
  playerZ: number,
  stations: readonly LodStation[],
  prev: ReadonlyMap<string, LodBand>,
  options: Partial<LodOptions> = {},
): Map<string, LodBand> {
  const o = { ...DEFAULTS, ...options };
  const out = new Map<string, LodBand>();
  for (const s of stations) {
    const d = Math.hypot(s.x - playerX, s.z - playerZ);
    const wasHero = prev.get(s.id) === "hero";
    const wasIdle = prev.get(s.id) === "idle";
    const heroEdge = o.heroRadius + (wasHero ? o.hysteresis : 0);
    const idleEdge = o.idleRadius + (wasIdle || wasHero ? o.hysteresis : 0);
    out.set(s.id, d <= heroEdge ? "hero" : d <= idleEdge ? "idle" : "frozen");
  }
  return out;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- tests/unit/coven-hub/coven-lod.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/coven-hub/domain/coven-lod.ts tests/unit/coven-hub/coven-lod.test.ts
git commit -m "feat(coven-hub): proximity LOD with hysteresis"
```

---

## Task 4: Hub state factory

**Files:**
- Create: `src/lib/features/coven-hub/state/coven-hub-state.svelte.ts`
- Test: `tests/unit/coven-hub/coven-hub-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/coven-hub/coven-hub-state.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createCovenHubState } from "$lib/features/coven-hub/state/coven-hub-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

const seq = { id: "s1", word: "CAKE", steps: [], isCircular: true } as unknown as SequenceData;

describe("createCovenHubState", () => {
  let s: ReturnType<typeof createCovenHubState>;
  beforeEach(() => (s = createCovenHubState()));

  it("starts empty with the picker open", () => {
    expect(s.activeSequence).toBeNull();
    expect(s.pickerOpen).toBe(true);
  });

  it("loading a sequence sets it active and closes the picker", () => {
    s.setSequence(seq);
    expect(s.activeSequence?.id).toBe("s1");
    expect(s.pickerOpen).toBe(false);
  });

  it("can reopen the picker without clearing the active sequence", () => {
    s.setSequence(seq);
    s.openPicker();
    expect(s.pickerOpen).toBe(true);
    expect(s.activeSequence?.id).toBe("s1");
  });

  it("defaults nav mode to orbit and can switch it", () => {
    expect(s.navMode).toBe("orbit");
    s.setNavMode("fly");
    expect(s.navMode).toBe("fly");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- tests/unit/coven-hub/coven-hub-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/features/coven-hub/state/coven-hub-state.svelte.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ViewerNavMode } from "$lib/shared/3d/state/viewer-3d-state.svelte";

export function createCovenHubState() {
  let activeSequence = $state<SequenceData | null>(null);
  let pickerOpen = $state(true);
  let navMode = $state<ViewerNavMode>("orbit");
  let focusedEffect = $state<string | null>(null);

  return {
    get activeSequence() { return activeSequence; },
    get pickerOpen() { return pickerOpen; },
    get navMode() { return navMode; },
    get focusedEffect() { return focusedEffect; },

    setSequence(seq: SequenceData) {
      activeSequence = seq;
      pickerOpen = false;
    },
    openPicker() { pickerOpen = true; },
    closePicker() { pickerOpen = false; },
    setNavMode(mode: ViewerNavMode) { navMode = mode; },
    setFocusedEffect(id: string | null) { focusedEffect = id; },
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -- tests/unit/coven-hub/coven-hub-state.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/coven-hub/state/coven-hub-state.svelte.ts tests/unit/coven-hub/coven-hub-state.test.ts
git commit -m "feat(coven-hub): hub state factory"
```

---

## Task 5: Extract `CovenStation` from `TelekineticFormation3D`

Make `TelekineticFormation3D` a thin wrapper so the museum exhibit keeps working, and the generalized coven becomes reusable. No unit test (no component-render tests in repo); verified at runtime in Task 10/the skeleton.

**Files:**
- Create: `src/lib/features/coven-hub/components/CovenStation.svelte`
- Modify: `src/lib/features/museum/components/game/TelekineticFormation3D.svelte`

- [ ] **Step 1: Create `CovenStation.svelte`** — copy the body of `TelekineticFormation3D.svelte` and change its `Props` + the parts noted below. Everything else (center configs, IK `acolytePropOverrides`, platform, lights, prop-type derivation) is copied verbatim.

New props block (replaces lines 33-46):

```svelte
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { buildTipEffectMap } from "$lib/features/coven-hub/domain/coven-effect-map";
  import type { LodBand } from "$lib/features/coven-hub/domain/coven-lod";
  import { useGltf } from "@threlte/extras";
  import Stage3D from "$lib/shared/3d/components/Stage3D.svelte";

  interface Props {
    stationId: string;
    worldX: number;
    worldZ: number;
    sequence: SequenceData | null;
    effectId?: string | null;
    stageModel?: string | null;
    lod?: LodBand;
    autoPlay?: boolean;
  }
  const props: Props = $props();
  const stationId = props.stationId;
  const worldX = props.worldX;
  const worldZ = props.worldZ;
  const autoPlay = props.autoPlay ?? true;
  const lod = $derived(props.lod ?? "hero");
```

Replace the hardcoded `LED_EFFECT_MAP` (lines 99-101) with a per-coven derived map:

```svelte
  const tipEffectMap = $derived(buildTipEffectMap(props.effectId ?? null));
```

Replace the sequence-load `$effect` (lines 138-169) so it loads the `sequence` prop directly instead of the museum manifest:

```svelte
  $effect(() => {
    const seq = props.sequence;
    untrack(() => {
      if (!seq || centerInstances.length === 0) return;
      for (let i = 0; i < centerInstances.length; i++) {
        const instance = centerInstances[i];
        const planeCfg = CENTER_PLANES[i];
        if (!instance || !planeCfg) continue;
        instance.loadSequence(seq);
        instance.loop = true;
        if (planeCfg.plane === Plane.WALL) {
          instance.setPlaneMode(PlaneMode.WALL);
        } else {
          instance.setHandPlane("blue", planeCfg.blue);
          instance.setHandPlane("red", planeCfg.red);
        }
        if (autoPlay) instance.play();
      }
    });
  });
```

Add LOD-driven visibility derivations (place near the top of the markup section):

```svelte
  // hero: all 6 center + 6 acolytes. idle/frozen: only the first center rig.
  const visibleCenter = $derived(lod === "hero" ? centerInstances : centerInstances.slice(0, 1));
  const showAcolytes = $derived(lod === "hero");
  const stationPlaying = $derived(lod !== "frozen");
  const stageGltf = $derived(props.stageModel ? useGltf(props.stageModel) : null);
```

In the center-rig `{#each}` (lines 287-308), iterate `visibleCenter` instead of `centerInstances`, and set `isPlaying={instance.isPlaying && stationPlaying}`.

In the acolyte `{#each}` (lines 311-331), wrap with `{#if showAcolytes}`.

Replace the platform mesh (lines 260-263) with the GLB stage when `stageModel`
is set, else keep the ORIGINAL stone-disc cylinder (do not substitute Stage3D —
that regresses the museum exhibit's look):

```svelte
  {#if stageGltf}
    {#await stageGltf then gltf}
      <T is={gltf.scene} position.y={PLATFORM_HEIGHT} />
    {/await}
  {:else}
    <T.Mesh position.y={PLATFORM_HEIGHT / 2} receiveShadow>
      <T.CylinderGeometry args={[PLATFORM_RADIUS, PLATFORM_RADIUS + 0.1, PLATFORM_HEIGHT, 32]} />
      <T.MeshStandardMaterial color={platformColor} roughness={0.9} />
    </T.Mesh>
  {/if}
```

- [ ] **Step 2: Rewrite `TelekineticFormation3D.svelte` as a thin wrapper.** Replace the whole file with:

```svelte
<script lang="ts">
  import CovenStation from "$lib/features/coven-hub/components/CovenStation.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import { MUSEUM_EXHIBIT_SEQUENCES } from "../../data/museum-exhibit-sequences";

  interface Props {
    stationId: string;
    worldX: number;
    worldZ: number;
    sequenceId?: string;
    autoPlay?: boolean;
  }
  const props: Props = $props();

  const sequence = $derived.by((): SequenceData | null => {
    const ms = props.sequenceId ? MUSEUM_EXHIBIT_SEQUENCES[props.sequenceId] : null;
    if (!ms) return null;
    return {
      id: `museum-formation-${props.stationId}`,
      word: ms.word,
      steps: ms.steps as readonly StepData[],
      isCircular: true,
    } as SequenceData;
  });
</script>

<CovenStation
  stationId={props.stationId}
  worldX={props.worldX}
  worldZ={props.worldZ}
  {sequence}
  effectId="led"
  autoPlay={props.autoPlay ?? true}
/>
```

- [ ] **Step 3: Type-check the changed files.**

Run: `npm run check:fast`
Expected: no new errors in `CovenStation.svelte` or `TelekineticFormation3D.svelte`. Fix any until clean.

- [ ] **Step 4: Runtime-verify the museum exhibit still renders.** With the dev server on :5173, confirm the museum performer station (telekinetic formation) still shows the coven performing with the LED effect — it now flows through `CovenStation`.

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` → expect `200`. Then ask Austen to open the museum telekinetic formation and confirm it looks identical to before (acolytes + center rigs + LED). State explicitly that this needs his eyes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/coven-hub/components/CovenStation.svelte src/lib/features/museum/components/game/TelekineticFormation3D.svelte
git commit -m "refactor(coven): extract CovenStation; TelekineticFormation3D delegates"
```

---

## Task 6: Template stage placeholder

**Files:**
- Create: `static/models/coven-stages/README.md` (documents the slot; GLB lands later)

The engine ships with `stageModel` unset, so every coven uses the `Stage3D` fallback from Task 5. This task just reserves the directory + documents the contract so a Blender-authored `template.glb` can drop in with zero code change.

- [ ] **Step 1: Create the doc**

```md
# Coven stage GLBs

Drop optimized GLBs here (Blender → gltf-transform optimize, per
`.claude/rules/blender-first-3d-scenes.md`). Wire a stage to an effect by
setting `EffectMeta.stageModel` in
`src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`
to `/models/coven-stages/<file>.glb`. Unset → CovenStation keeps its original
stone-disc platform. First target: `template.glb` (shared template stage).
```

- [ ] **Step 2: Commit**

```bash
git add static/models/coven-stages/README.md
git commit -m "docs(coven-hub): reserve coven-stages GLB slot + contract"
```

---

## Task 7: Extend `EffectMeta` with 3D fields

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts:30-35`

- [ ] **Step 1: Add optional fields to the interface**

```ts
export interface EffectMeta {
  readonly id: string;
  readonly label: string;
  readonly icon: `fa-${string}`;
  readonly color: `#${string}`;
  /** Show this effect's coven in the hub. Defaults to true when omitted. */
  readonly ready3d?: boolean;
  /** GLB path for the coven stage; omitted → Stage3D fallback. */
  readonly stageModel?: string;
  /** Acolyte skin id; omitted → default avatar. (Deferred capability.) */
  readonly skin?: string;
}
```

- [ ] **Step 2: Add a `readyEffectIds` helper** at the end of the registry file:

```ts
/** Effect ids whose covens should appear in the hub (ready3d !== false). */
export function readyEffectIds(): string[] {
  return EFFECTS.filter((e) => e.ready3d !== false).map((e) => e.id);
}
```

- [ ] **Step 3: Type-check.**

Run: `npm run check:fast`
Expected: clean (fields optional, no call sites break).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts
git commit -m "feat(effects): EffectMeta 3D fields + readyEffectIds()"
```

---

## Task 8: `CovenHub` orchestrator

**Files:**
- Create: `src/lib/features/coven-hub/components/CovenHub.svelte`

No unit test (component). Verified at runtime in Task 10.

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import { useThrelte, useTask } from "@threlte/core";
  import { Vector3 } from "three";
  import { readyEffectIds } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import { computeCovenLayout } from "$lib/features/coven-hub/domain/coven-hub-layout";
  import { computeCovenLods, type LodBand } from "$lib/features/coven-hub/domain/coven-lod";
  import { EFFECT_LABELS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import { getRegistration } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import CovenStation from "./CovenStation.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";

  interface Props { sequence: SequenceData | null; }
  const props: Props = $props();

  const slots = $derived(computeCovenLayout(readyEffectIds()));
  let lods = $state<Map<string, LodBand>>(new Map());

  const { camera } = useThrelte();
  const tmp = new Vector3();

  // Recompute LOD from camera position. Throttle to ~6 Hz to avoid per-frame churn.
  let acc = 0;
  useTask((delta) => {
    acc += delta;
    if (acc < 0.16) return;
    acc = 0;
    const cam = camera.current;
    if (!cam) return;
    cam.getWorldPosition(tmp);
    lods = computeCovenLods(
      tmp.x,
      tmp.z,
      slots.map((s) => ({ id: s.id, x: s.x, z: s.z })),
      lods,
    );
  });

  function stageModelFor(effectId: string | null): string | null {
    if (!effectId) return null;
    return getRegistration(effectId)?.meta.stageModel ?? null;
  }
</script>

{#each slots as slot (slot.id)}
  <CovenStation
    stationId={slot.id}
    worldX={slot.x}
    worldZ={slot.z}
    sequence={props.sequence}
    effectId={slot.effectId}
    stageModel={stageModelFor(slot.effectId)}
    lod={lods.get(slot.id) ?? (slot.kind === "seed" ? "hero" : "frozen")}
  />
{/each}
```

- [ ] **Step 2: Type-check.**

Run: `npm run check:fast`
Expected: clean. Note: confirm `getRegistration`/`EFFECT_LABELS` exist in the registry (they do per `effect-registry.ts:71,83`). Remove the unused `EFFECT_LABELS`/`EFFECTS` imports if check flags them.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/coven-hub/components/CovenHub.svelte
git commit -m "feat(coven-hub): CovenHub orchestrator with proximity LOD"
```

---

## Task 9: Expand `ForestScene` for N stations

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ForestScene.svelte:33-43` (props), `:375-377` (stage mount)

- [ ] **Step 1: Add `showStage` + `clearingRadius` overrides to the props** (lines 33-43):

```svelte
  interface Props {
    variant?: ForestVariant;
    config?: ForestSceneConfig;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
    /** Hide the single built-in Stage3D (hub mounts its own coven stages). */
    showStage?: boolean;
    /** Override the clearing radius so the hub can widen it for N stations. */
    clearingRadius?: number;
  }
  let {
    variant = "firefly", config, stageWidth = 6, stageDepth = 4.5, stageZOffset = 0,
    showStage = true, clearingRadius,
  }: Props = $props();
```

- [ ] **Step 2: Apply the clearing override** where `activeConfig` is derived (line 45):

```svelte
  const activeConfig = $derived.by(() => {
    const base = config ?? createDefaultForestFireflyConfig();
    return clearingRadius != null ? { ...base, clearingRadius } : base;
  });
```

- [ ] **Step 3: Gate the single stage** (lines 375-377):

```svelte
  {#if showStage}
    <T.Group position.z={stageZOffset}>
      <Stage3D width={stageWidth} depth={stageDepth} />
    </T.Group>
  {/if}
```

- [ ] **Step 4: Type-check + runtime-verify forest still renders normally** (default `showStage=true`).

Run: `npm run check:fast` → clean. Then confirm the existing forest scene (Scene Lab or wherever it mounts) is unchanged. Needs Austen's eyes; state so.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ForestScene.svelte
git commit -m "feat(forest): showStage + clearingRadius overrides for coven hub"
```

---

## Task 10: Route + picker wiring

**Files:**
- Create: `src/lib/features/coven-hub/components/CovenSequencePicker.svelte`
- Create: `src/routes/coven/+page.svelte`

- [ ] **Step 1: Implement the picker** (wraps `BrowsePanel`):

```svelte
<!-- CovenSequencePicker.svelte -->
<script lang="ts">
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import { createBrowseEngine } from "$lib/shared/browse/engine/createBrowseEngine.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface Props { onSelect: (seq: SequenceData) => void; }
  const props: Props = $props();
  const engine = createBrowseEngine();
</script>

<div class="picker">
  <BrowsePanel {engine} layout="compact" onSelect={(seq) => props.onSelect(seq)} title="Choose a sequence" />
</div>

<style>
  .picker {
    position: absolute; inset: 0; z-index: 20;
    display: grid; place-items: center;
    background: rgba(8, 8, 14, 0.78); backdrop-filter: blur(6px);
  }
</style>
```

Note: confirm `createBrowseEngine`'s exact export name + arg signature against `src/lib/shared/browse/engine/createBrowseEngine.svelte.ts` before running; adjust the import/call if it requires options.

- [ ] **Step 2: Implement the route**

```svelte
<!-- src/routes/coven/+page.svelte -->
<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { page } from "$app/stores";
  import Viewer3DCamera from "$lib/shared/3d/components/Viewer3DCamera.svelte";
  import ForestScene from "$lib/shared/3d/environments/scenes/ForestScene.svelte";
  import CovenHub from "$lib/features/coven-hub/components/CovenHub.svelte";
  import CovenSequencePicker from "$lib/features/coven-hub/components/CovenSequencePicker.svelte";
  import { createCovenHubState } from "$lib/features/coven-hub/state/coven-hub-state.svelte";
  import { getBrowseLoader } from "$lib/shared/browse/engine/createBrowseEngine.svelte";

  const hub = createCovenHubState();

  // Deep-link: /coven?seq=<id> loads that sequence and skips the picker.
  $effect(() => {
    const id = $page.url.searchParams.get("seq");
    if (!id) return;
    getBrowseLoader().loadFullSequenceData(id, id).then((seq) => {
      if (seq) hub.setSequence(seq);
    });
  });
</script>

<div class="page">
  {#if hub.pickerOpen}
    <CovenSequencePicker onSelect={(seq) => hub.setSequence(seq)} />
  {/if}

  <div class="nav">
    {#each ["orbit", "fly"] as const as mode}
      <button type="button" class:active={hub.navMode === mode}
        aria-pressed={hub.navMode === mode} onclick={() => hub.setNavMode(mode)}>{mode}</button>
    {/each}
    <button type="button" onclick={() => hub.openPicker()}>change sequence</button>
  </div>

  <Canvas>
    <Viewer3DCamera />
    <ForestScene showStage={false} clearingRadius={28} />
    <CovenHub sequence={hub.activeSequence} />
  </Canvas>
</div>

<style>
  .page { position: relative; width: 100%; height: 100vh; height: 100dvh; overflow: hidden; background: #0a0a12; }
  .nav { position: absolute; top: 1rem; right: 1rem; z-index: 15; display: flex; gap: 0.4rem; }
  .nav button {
    min-height: 2.5rem; padding: 0.4rem 0.8rem; border-radius: 0.5rem;
    border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: #e8e8f0; cursor: pointer;
  }
  .nav button.active { background: #3a7fd9; border-color: #3a7fd9; color: #fff; }
</style>
```

Note: `Viewer3DCamera` reads nav mode from `viewer-3d-state`. Wire `hub.setNavMode` to that store's setter (confirm the setter name in `viewer-3d-state.svelte.ts`) so the toggle actually drives the camera. If `Viewer3DCamera` needs `cameraPlayerAvatar`/`cameraPlayerPhysics` for the chosen mode, orbit + fly work with them null.

- [ ] **Step 3: Type-check.**

Run: `npm run check:fast` → fix until clean.

- [ ] **Step 4: Runtime-verify.**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/coven` → expect `200`. Then ask Austen to open `/coven`, pick a sequence, and confirm: picker appears, selecting loads the seed coven + effect ring, orbit/fly works, distant covens are frozen (LOD). State this needs his eyes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/coven-hub/components/CovenSequencePicker.svelte src/routes/coven/+page.svelte
git commit -m "feat(coven-hub): /coven route + sequence picker"
```

---

## Task 11: Viewer deep-link action

**Files:**
- Modify: the sequence viewer overflow menu — `src/lib/shared/sequence-viewer/components/ViewerOverflowMenu.svelte`

- [ ] **Step 1: Add a "View in coven hub" menu item** that navigates to `/coven?seq=<currentSequenceId>`. Match the existing menu-item pattern in that file (read it first; reuse its item component + the current sequence id source). Use `goto(\`/coven?seq=${id}\`)` from `$app/navigation`.

- [ ] **Step 2: Type-check.**

Run: `npm run check:fast` → clean.

- [ ] **Step 3: Runtime-verify.** Ask Austen to open a sequence in the viewer, use the overflow menu → "View in coven hub", and confirm it lands on `/coven` with that sequence pre-loaded (no picker). State this needs his eyes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerOverflowMenu.svelte
git commit -m "feat(viewer): View in coven hub deep-link"
```

---

## Task 12: Full gate + skeleton cleanup

- [ ] **Step 1: Run the full check once (commit gate).**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log`
Expected: no errors. Fix any, re-run once.

- [ ] **Step 2: Run the unit suite.**

Run: `npm run test -- tests/unit/coven-hub/`
Expected: all coven-hub tests pass.

- [ ] **Step 3: Delete the throwaway skeleton** now that `/coven` supersedes it.

```bash
git rm src/routes/test/coven-hub/+page.svelte
git commit -m "chore(coven-hub): remove layout skeleton (superseded by /coven)"
```

---

## Deferred (not in first deliverable)

- **Per-coven acolyte skins** — `EffectMeta.skin` is wired but unused. Avatar skin-swap is a net-new system (avatar variation is design-only today). Separate spec.
- **15 bespoke GLB stages** — author per-effect in Blender; drop into `static/models/coven-stages/` and set `EffectMeta.stageModel`. Art pipeline.
- **`walk` nav mode** — orbit + fly ship first (camera-only). Walk needs the player avatar + physics provider; crib from `StageWorld.svelte`'s `cameraPlayerAvatar`/`cameraPlayerPhysics` construction in a follow-up.
- **Wake/sleep crossfade** between LOD bands — first cut snaps.
- **Museum room surfacing** — route ships first; add a museum room tile later.

## Self-review

- **Spec coverage:** generative hub (Tasks 8/10) ✓; effect axis via registry (Tasks 7/8) ✓; both entry points — picker (Task 10) + deep-link (Tasks 10/11) ✓; forest home (Tasks 9/10) ✓; registry-driven + LOD (Tasks 1/3/8) ✓; bespoke stage, template-first (Tasks 5/6/7) ✓; nav reuse (Task 10) ✓; skeleton throwaway removed (Task 12) ✓. Deferred items match the spec's deferred list.
- **Placeholders:** none in code steps; the three "confirm exact export/setter name before running" notes are verification instructions against named files, not vague TODOs.
- **Type consistency:** `CovenSlot`/`computeCovenLayout` (T1), `buildTipEffectMap` (T2), `LodBand`/`computeCovenLods` (T3), `createCovenHubState`/`setSequence`/`setNavMode` (T4) are used with matching names in Tasks 5/8/10. `readyEffectIds`/`stageModel` (T7) consumed in T8.
