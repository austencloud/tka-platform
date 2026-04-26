# Village Phase 5: PerformerRig Migration + Effects + Seasons

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate VillageAvatar from bare Avatar3D to PerformerRig (unlocking effect rendering), add effect affinities with culture circles, and add seasonal parameter modulation.

**Architecture:** VillageAvatar gets rewritten to use PerformerRig, which provides tipEffectMap support, prop rendering, and effects out of the box. A new EffectComponent on each entity tracks their visual effect affinity (fire/LED/charcoal/trails/pure). A CircleSystem detects affinity clusters and applies bonuses. A SeasonSystem modulates village config on a timer. All headless logic is pure TypeScript; visuals are Svelte/Threlte.

**Tech Stack:** Svelte 5 + Threlte + Miniplex ECS, TipEffectMap from animation-engine, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `domain/village-types.ts` | MODIFY | Add EffectComponent, EffectAffinity, EffectCircle, Season types |
| `domain/village-constants.ts` | MODIFY | Circle radius, bonuses, exposure thresholds, season config |
| `engine/systems/CircleSystem.ts` | CREATE | Detect affinity clusters, apply bonuses, manage circle lifecycle |
| `engine/systems/SeasonSystem.ts` | CREATE | Cycle through seasons, modulate config parameters |
| `engine/VillageWorld.ts` | MODIFY | Assign initial effect affinity on birth |
| `engine/systems/TeachingSystem.ts` | MODIFY | Transfer effect affinity during teaching |
| `engine/VillageOrchestrator.ts` | MODIFY | Add CircleSystem + SeasonSystem to tick loop |
| `components/VillageAvatar.svelte` | REWRITE | Migrate to PerformerRig, wire tipEffectMap from affinity |
| `components/VillageCircle.svelte` | MODIFY | Support effect affinity circles (colored, with point light) |
| `components/VillageScene.svelte` | MODIFY | Render effect circles |
| `components/VillageControls.svelte` | MODIFY | Season display, effect stats |
| `VillageLabTab.svelte` | MODIFY | Wire circle/season events to toasts |
| `tests/unit/village/CircleSystem.test.ts` | CREATE | Circle formation, bonuses, dissolution |
| `tests/unit/village/SeasonSystem.test.ts` | CREATE | Season cycling, parameter modulation |

---

### Task 1: EffectComponent + Season Types + Constants

**Files:**
- Modify: `src/lib/features/village/domain/village-types.ts`
- Modify: `src/lib/features/village/domain/village-constants.ts`
- Modify: `src/lib/features/village/engine/VillageWorld.ts`

- [ ] **Step 1: Add types to village-types.ts**

```typescript
export type EffectAffinity = "fire" | "led" | "charcoal" | "trails" | "pure";

export interface EffectComponent {
  affinity: EffectAffinity;
  affinityStrength: number;  // 0-1
  exposureHistory: Map<EffectAffinity, number>;
}

export interface EffectCircle {
  id: string;
  affinity: EffectAffinity;
  centerX: number;
  centerZ: number;
  radius: number;
  memberIds: Set<string>;
  formedAtTick: number;
}

export type Season = "normal" | "festival" | "winter" | "migration";
```

Add `effect: EffectComponent` to VillageEntity:

```typescript
export interface VillageEntity {
  id: string;
  identity: IdentityComponent;
  knowledge: KnowledgeComponent;
  personality: PersonalityComponent;
  lifecycle: LifecycleComponent;
  social: SocialComponent;
  transform: VillageTransformComponent;
  prop: PropComponent;
  effect: EffectComponent;
}
```

Add new events:

```typescript
"circle:formed": (circle: EffectCircle) => void;
"circle:dissolved": (circleId: string) => void;
"season:changed": (season: Season) => void;
```

- [ ] **Step 2: Add constants**

```typescript
// Effect affinities
export const EFFECT_AFFINITIES: EffectAffinity[] = ["fire", "led", "charcoal", "trails", "pure"];
export const CIRCLE_RADIUS = 4;
export const CIRCLE_MIN_MEMBERS = 3;
export const AFFINITY_TRANSFER_STRENGTH = 0.6;
export const AFFINITY_EXPOSURE_THRESHOLD = 5;

export const CIRCLE_BONUSES: Record<EffectAffinity, { stat: string; value: number }> = {
  fire:     { stat: "creativity",  value: 0.2  },
  led:      { stat: "attraction",  value: 2.0  },  // multiplier on attraction radius
  charcoal: { stat: "patience",    value: 0.15 },
  trails:   { stat: "invention",   value: 0.1  },
  pure:     { stat: "fidelity",    value: 0.2  },
};

export const CIRCLE_COLORS: Record<EffectAffinity, string> = {
  fire:     "#f97316",
  led:      "#3b82f6",
  charcoal: "#6b7280",
  trails:   "#a855f7",  // purple for trails (can't do conic gradient in Three.js easily)
  pure:     "#f8fafc",
};

// Seasons
export const SEASON_DURATION = 300;
export const SEASON_CYCLE: Season[] = ["normal", "festival", "normal", "winter", "normal", "migration"];
```

Import `EffectAffinity` and `Season` types at top of constants file.

- [ ] **Step 3: Update VillageWorld.ts — assign effect affinity on birth**

In `createAvatarEntity`, add `effect` component to the entity after `prop`:

```typescript
effect: {
  affinity: EFFECT_AFFINITIES[Math.floor(Math.random() * EFFECT_AFFINITIES.length)],
  affinityStrength: 0.5 + Math.random() * 0.5,
  exposureHistory: new Map(),
},
```

Import `EFFECT_AFFINITIES` from constants.

- [ ] **Step 4: Update all test files**

Any test creating entity objects directly needs the `effect` component. The `createAvatarEntity` function handles it automatically.

- [ ] **Step 5: Run tests**

Run: `npm test -- --run tests/unit/village/`

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/village/domain/ src/lib/features/village/engine/VillageWorld.ts tests/unit/village/
git commit -m "feat(village): add EffectComponent, Season types and constants for Phase 5"
```

---

### Task 2: CircleSystem — Affinity Cluster Detection

**Files:**
- Create: `src/lib/features/village/engine/systems/CircleSystem.ts`
- Create: `tests/unit/village/CircleSystem.test.ts`

- [ ] **Step 1: Write tests**

Test that: 3+ performing entities with same affinity within CIRCLE_RADIUS form a circle; circles dissolve when performers leave; circle bonuses apply.

- [ ] **Step 2: Implement CircleSystem**

```typescript
import type { World } from "miniplex";
import type { VillageEntity, EffectCircle, EffectAffinity } from "../../domain/village-types";
import type { VillageEventEmitter } from "../VillageEventEmitter";
import { CIRCLE_RADIUS, CIRCLE_MIN_MEMBERS, CIRCLE_COLORS } from "../../domain/village-constants";

export class CircleSystem {
  circles: EffectCircle[] = [];

  constructor(private emitter: VillageEventEmitter) {}

  tick(world: World<VillageEntity>, currentTick: number): void {
    // Find performing entities grouped by affinity
    const performersByAffinity = new Map<EffectAffinity, VillageEntity[]>();

    for (const entity of world.entities) {
      const isPerforming =
        entity.social.state === "performing" ||
        entity.social.state === "practicing" ||
        entity.social.state === "jamming";

      if (!isPerforming) continue;

      const affinity = entity.effect.affinity;
      if (!performersByAffinity.has(affinity)) {
        performersByAffinity.set(affinity, []);
      }
      performersByAffinity.get(affinity)!.push(entity);
    }

    const newCircles: EffectCircle[] = [];

    for (const [affinity, performers] of performersByAffinity) {
      // Simple clustering: check if enough performers are near each other
      for (let i = 0; i < performers.length; i++) {
        const pivot = performers[i];
        const cluster = new Set<string>([pivot.id]);

        for (let j = 0; j < performers.length; j++) {
          if (i === j) continue;
          const dx = pivot.transform.x - performers[j].transform.x;
          const dz = pivot.transform.z - performers[j].transform.z;
          if (Math.sqrt(dx * dx + dz * dz) <= CIRCLE_RADIUS) {
            cluster.add(performers[j].id);
          }
        }

        if (cluster.size >= CIRCLE_MIN_MEMBERS) {
          // Check if this cluster overlaps an existing new circle
          const alreadyCovered = newCircles.some(
            (c) => c.affinity === affinity && [...cluster].some((id) => c.memberIds.has(id)),
          );
          if (alreadyCovered) continue;

          // Compute center
          let cx = 0, cz = 0;
          for (const id of cluster) {
            const e = performers.find((p) => p.id === id)!;
            cx += e.transform.x;
            cz += e.transform.z;
          }
          cx /= cluster.size;
          cz /= cluster.size;

          newCircles.push({
            id: `circle-${affinity}-${currentTick}`,
            affinity,
            centerX: cx,
            centerZ: cz,
            radius: CIRCLE_RADIUS,
            memberIds: cluster,
            formedAtTick: currentTick,
          });
        }
      }
    }

    // Emit events
    const oldIds = new Set(this.circles.map((c) => c.id));
    const newIds = new Set(newCircles.map((c) => c.id));

    for (const circle of newCircles) {
      // Check if this is genuinely new (same affinity + similar location = continuation)
      const continued = this.circles.some(
        (old) => old.affinity === circle.affinity &&
        Math.abs(old.centerX - circle.centerX) < CIRCLE_RADIUS &&
        Math.abs(old.centerZ - circle.centerZ) < CIRCLE_RADIUS,
      );
      if (!continued) {
        this.emitter.emit("circle:formed", circle);
      }
    }
    for (const old of this.circles) {
      const stillExists = newCircles.some(
        (n) => n.affinity === old.affinity &&
        Math.abs(n.centerX - old.centerX) < CIRCLE_RADIUS &&
        Math.abs(n.centerZ - old.centerZ) < CIRCLE_RADIUS,
      );
      if (!stillExists) {
        this.emitter.emit("circle:dissolved", old.id);
      }
    }

    this.circles = newCircles;
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
git add src/lib/features/village/engine/systems/CircleSystem.ts tests/unit/village/CircleSystem.test.ts
git commit -m "feat(village): CircleSystem — effect affinity cluster detection with ground circles"
```

---

### Task 3: SeasonSystem

**Files:**
- Create: `src/lib/features/village/engine/systems/SeasonSystem.ts`
- Create: `tests/unit/village/SeasonSystem.test.ts`

- [ ] **Step 1: Write tests**

Test: season cycles through SEASON_CYCLE array; festival boosts invention rate; winter reduces speeds; migration relocates entities.

- [ ] **Step 2: Implement SeasonSystem**

```typescript
import type { World } from "miniplex";
import type { VillageEntity, Season } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";
import type { VillageEventEmitter } from "../VillageEventEmitter";
import { SEASON_DURATION, SEASON_CYCLE } from "../../domain/village-constants";

export class SeasonSystem {
  currentSeason: Season = "normal";
  private seasonIndex = 0;
  private ticksInSeason = 0;

  constructor(
    private config: VillageConfig,
    private emitter: VillageEventEmitter,
  ) {}

  tick(world: World<VillageEntity>, currentTick: number): void {
    this.ticksInSeason++;

    if (this.ticksInSeason >= SEASON_DURATION) {
      this.ticksInSeason = 0;
      this.seasonIndex = (this.seasonIndex + 1) % SEASON_CYCLE.length;
      this.currentSeason = SEASON_CYCLE[this.seasonIndex];
      this.emitter.emit("season:changed", this.currentSeason);
      this.applySeasonEffects(world);
    }
  }

  private applySeasonEffects(world: World<VillageEntity>): void {
    switch (this.currentSeason) {
      case "migration":
        // Relocate half the population to random positions
        const entities = world.entities.filter((e) => e.social.state !== "passing" && e.identity.role !== "maker");
        const toRelocate = entities.slice(0, Math.floor(entities.length / 2));
        for (const entity of toRelocate) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * this.config.arenaRadius * 0.8;
          entity.transform.targetX = Math.cos(angle) * dist;
          entity.transform.targetZ = Math.sin(angle) * dist;
          entity.transform.speed = 1.5;
          entity.social.state = "wandering";
        }
        break;
    }
  }

  getInventionRateMultiplier(): number {
    return this.currentSeason === "festival" ? 3.0 : 1.0;
  }

  getSpeedMultiplier(): number {
    return this.currentSeason === "winter" ? 0.6 : 1.0;
  }

  getInteractionRadiusMultiplier(): number {
    return this.currentSeason === "winter" ? 0.7 : 1.0;
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
git add src/lib/features/village/engine/systems/SeasonSystem.ts tests/unit/village/SeasonSystem.test.ts
git commit -m "feat(village): SeasonSystem — cyclical parameter modulation (festival/winter/migration)"
```

---

### Task 4: Effect Affinity Transfer in Teaching + Wire Systems

**Files:**
- Modify: `src/lib/features/village/engine/systems/TeachingSystem.ts`
- Modify: `src/lib/features/village/engine/VillageOrchestrator.ts`

- [ ] **Step 1: Add affinity transfer to TeachingSystem**

In `completeTeaching`, after the prop preference transfer block, add:

```typescript
// Effect affinity inheritance
const transferStrength = teacher.effect.affinityStrength * AFFINITY_TRANSFER_STRENGTH;
if (transferStrength > learner.effect.affinityStrength) {
  learner.effect.affinity = teacher.effect.affinity;
  learner.effect.affinityStrength = transferStrength;
}
```

Import `AFFINITY_TRANSFER_STRENGTH` from constants.

- [ ] **Step 2: Wire CircleSystem + SeasonSystem into orchestrator**

Import both systems. Add fields, instantiate in constructor, add to tick loop (CircleSystem after PerformanceSystem, SeasonSystem at end before PopulationSystem), add to reset(), add getters:

```typescript
get effectCircles() { return this.circleSystem.circles; }
get currentSeason() { return this.seasonSystem.currentSeason; }
get seasonSystem() { return this._seasonSystem; }
```

- [ ] **Step 3: Run tests, commit**

```bash
git add src/lib/features/village/engine/systems/TeachingSystem.ts src/lib/features/village/engine/VillageOrchestrator.ts
git commit -m "feat(village): wire CircleSystem + SeasonSystem, effect affinity transfer in teaching"
```

---

### Task 5: VillageAvatar PerformerRig Migration

**Files:**
- Modify: `src/lib/features/village/components/VillageAvatar.svelte`

This is the big visual task. Replace Avatar3D with PerformerRig.

- [ ] **Step 1: Rewrite VillageAvatar to use PerformerRig**

Replace the Avatar3D import with PerformerRig:

```typescript
import PerformerRig from "$lib/shared/3d/components/PerformerRig.svelte";
```

Import TipEffectMap type:

```typescript
import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
```

Add effect map derived based on entity's affinity (only during active states):

```typescript
const isActiveForEffects = $derived(
  socialState === "performing" ||
  socialState === "practicing" ||
  socialState === "jamming"
);

const affinityToEffect: Record<string, string> = {
  fire: "fire",
  led: "led",
  charcoal: "charcoal",
  trails: "trails",
  pure: "none",
};

const tipEffectMap = $derived<TipEffectMap>(
  isActiveForEffects
    ? { "*": { effect: (affinityToEffect[renderState.entity.effect.affinity] ?? "none") as any } }
    : {}
);
```

Replace the `<Avatar3D>` block with `<PerformerRig>`:

```svelte
<PerformerRig
  position={{ x: avatarPosition.x, z: avatarPosition.z }}
  facingAngle={facingAngle}
  avatarState={renderState.instanceState}
  showAvatar={showAvatar && deathOpacity > 0.01}
  showGrid={false}
  showProps={true}
  showEffects={isActiveForEffects}
  {tipEffectMap}
  bluePropType={propType}
  redPropType={propType}
/>
```

Add prop type derived from entity's held prop:

```typescript
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

const propType = $derived(
  renderState.entity.prop.heldProp
    ? (PropType[renderState.entity.prop.heldProp.propType.toUpperCase() as keyof typeof PropType] ?? PropType.STAFF)
    : PropType.STAFF
);
```

Keep the elder knowledge glow mesh and name label as-is (they render outside the PerformerRig).

- [ ] **Step 2: Run check**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/village/components/VillageAvatar.svelte
git commit -m "feat(village): migrate VillageAvatar from Avatar3D to PerformerRig — effects + props unlocked"
```

---

### Task 6: Effect Circles Visual + Scene Wiring

**Files:**
- Create: `src/lib/features/village/components/VillageEffectCircle.svelte`
- Modify: `src/lib/features/village/components/VillageScene.svelte`

- [ ] **Step 1: Create VillageEffectCircle.svelte**

```svelte
<!--
  VillageEffectCircle — Ground ring colored by effect affinity with point light.
  Steady opacity (no pulse), distinguishing from jam circles which pulse.
-->
<script lang="ts">
  import { T } from "@threlte/core";
  import type { EffectCircle } from "../domain/village-types";
  import { CIRCLE_COLORS } from "../domain/village-constants";

  interface Props {
    circle: EffectCircle;
  }

  const { circle }: Props = $props();
  const color = $derived(CIRCLE_COLORS[circle.affinity] ?? "#ffffff");
</script>

<T.Mesh
  rotation.x={-Math.PI / 2}
  position.x={circle.centerX}
  position.y={0.004}
  position.z={circle.centerZ}
>
  <T.RingGeometry args={[circle.radius - 0.15, circle.radius, 64]} />
  <T.MeshBasicMaterial
    {color}
    transparent
    opacity={0.25}
    depthWrite={false}
  />
</T.Mesh>

<T.PointLight
  position.x={circle.centerX}
  position.y={0.5}
  position.z={circle.centerZ}
  {color}
  intensity={0.3}
  distance={circle.radius + 1}
/>
```

- [ ] **Step 2: Add to VillageScene**

Import `VillageEffectCircle`. Add derived:

```typescript
const effectCircles = $derived(villageState.orchestrator.effectCircles ?? []);
```

Render:

```svelte
{#if visualState.showCircleRings}
  {#each effectCircles as circle (circle.id)}
    <VillageEffectCircle {circle} />
  {/each}
{/if}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/village/components/VillageEffectCircle.svelte src/lib/features/village/components/VillageScene.svelte
git commit -m "feat(village): VillageEffectCircle — affinity-colored ground ring with point light"
```

---

### Task 7: Controls + Events + Season UI

**Files:**
- Modify: `src/lib/features/village/components/VillageControls.svelte`
- Modify: `src/lib/features/village/VillageLabTab.svelte`

- [ ] **Step 1: Add season and effect stats to controls**

In VillageControls, add to Population section:

```svelte
<div class="stat">Season: {villageState.orchestrator.currentSeason ?? "normal"}</div>
<div class="stat">Effect Circles: {villageState.orchestrator.effectCircles?.length ?? 0}</div>
```

In avatar inspector, add:

```svelte
<div class="stat">Effect: {selectedEntity.effect.affinity} ({(selectedEntity.effect.affinityStrength * 100).toFixed(0)}%)</div>
```

- [ ] **Step 2: Wire events in VillageLabTab**

```typescript
villageState.orchestrator.on("circle:formed", (circle) => {
  vs.pushToast(
    `${circle.affinity} circle formed`,
    CIRCLE_COLORS[circle.affinity] ?? "#fff",
    circle.centerX,
    circle.centerZ,
    3000,
  );
});

villageState.orchestrator.on("season:changed", (season) => {
  const seasonColors: Record<string, string> = {
    normal: "#ffffff",
    festival: "#fbbf24",
    winter: "#60a5fa",
    migration: "#a855f7",
  };
  vs.pushToast(
    `Season: ${season}`,
    seasonColors[season] ?? "#fff",
    0, 0,
    4000,
  );
});
```

Import `CIRCLE_COLORS` from constants.

- [ ] **Step 3: Run tests, commit**

```bash
git add src/lib/features/village/components/VillageControls.svelte src/lib/features/village/VillageLabTab.svelte
git commit -m "feat(village): season display, effect stats, circle/season event toasts"
```

---

## Summary

| Task | Feature | What It Does |
|------|---------|-------------|
| 1 | Foundation | EffectComponent, Season types, constants, entity extension |
| 2 | Effect Affinities | CircleSystem — detect affinity clusters, ground circles |
| 3 | Seasons | SeasonSystem — cyclical parameter modulation |
| 4 | Integration | Effect transfer in teaching, wire systems into orchestrator |
| 5 | PerformerRig | Migrate VillageAvatar from Avatar3D to PerformerRig |
| 6 | Visual | VillageEffectCircle — colored ground ring + point light |
| 7 | UI + Events | Season display, effect stats, event toasts |
