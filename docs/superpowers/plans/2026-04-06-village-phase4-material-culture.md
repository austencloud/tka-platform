# Village Phase 4: Material Culture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prop identity (artifacts with ownership history and wear), a prop maker role, prop-specific wear profiles, and visual prop drops/prop wall to the TKA Village simulation.

**Architecture:** New `PropComponent` on every entity tracks their held `PropArtifact`. A new `PropSystem` manages wear accumulation, death drops, pickup logic, and the prop wall. A specialized "maker" entity crafts replacement props. Visuals include pulsing dropped props on the ground and a prop wall display at the arena edge. All headless logic is pure TypeScript; visuals are Svelte/Threlte components.

**Tech Stack:** Svelte 5 + Threlte + Miniplex ECS, Vitest for tests

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `domain/village-types.ts` | MODIFY | Add PropArtifact, PropComponent, WearProfile, DroppedProp, extend VillageEntity |
| `domain/village-constants.ts` | MODIFY | Add prop wear constants, village prop types, maker constants |
| `engine/systems/PropSystem.ts` | CREATE | Wear accumulation, death drops, pickup, wall, preference transfer |
| `engine/VillageWorld.ts` | MODIFY | Create PropArtifact on entity birth, assign propPreference |
| `engine/systems/PopulationSystem.ts` | MODIFY | Spawn maker entity, create prop on birth |
| `engine/systems/SocialSystem.ts` | MODIFY | Add "commissioning" state handler, propless seeking |
| `engine/VillageOrchestrator.ts` | MODIFY | Add PropSystem to tick loop, expose droppedProps/propWall |
| `components/VillageDroppedProp.svelte` | CREATE | Pulsing ground prop at death location |
| `components/VillagePropWall.svelte` | CREATE | Arena-edge display board with retired props |
| `components/VillageScene.svelte` | MODIFY | Render dropped props and prop wall |
| `components/VillageAvatar.svelte` | MODIFY | Show prop type indicator on label |
| `components/VillageControls.svelte` | MODIFY | Prop stats, inspector additions |
| `state/village-visual-state.svelte.ts` | MODIFY | Add droppedProps tracking |
| `tests/unit/village/PropSystem.test.ts` | CREATE | Wear, drops, pickup, wall, preference transfer |

**Key paths:**
- Village root: `src/lib/features/village/`
- Tests: `tests/unit/village/`
- PropType enum: `src/lib/shared/pictograph/prop/domain/enums/PropType.ts`

---

### Task 1: Types, Constants, and Entity Extension

**Files:**
- Modify: `src/lib/features/village/domain/village-types.ts`
- Modify: `src/lib/features/village/domain/village-constants.ts`
- Modify: `src/lib/features/village/engine/VillageWorld.ts`

- [ ] **Step 1: Add prop types to village-types.ts**

Add these interfaces after the existing `StyleSchool` interface:

```typescript
export interface PropArtifact {
  id: string;
  propType: string;              // "staff" | "fan" | "club" | "poi" | "torch"
  createdAtTick: number;
  createdBy: string;             // entity id of original owner or maker
  ownershipChain: string[];      // entity ids in order
  totalBeatsPerformed: number;   // accumulates over all owners
  wear: number;                  // 0-1, increases with use
  favoriteSequenceId: string | null;
  customHue: number;             // 0-360, subtle color shift
  broken: boolean;
}

export interface PropComponent {
  heldProp: PropArtifact | null;
  propPreference: string;        // preferred prop type
}

export interface WearProfile {
  wearRate: number;
  failureMode: string;
  repairTicks: number;
}

export interface DroppedProp {
  artifact: PropArtifact;
  x: number;
  z: number;
  droppedAtTick: number;
}
```

Add `prop: PropComponent` to `VillageEntity`:

```typescript
export interface VillageEntity {
  id: string;
  identity: IdentityComponent;
  knowledge: KnowledgeComponent;
  personality: PersonalityComponent;
  lifecycle: LifecycleComponent;
  social: SocialComponent;
  transform: VillageTransformComponent;
  prop: PropComponent;  // NEW
}
```

Add `"commissioning"` to `AvatarBehaviorState`:

```typescript
export type AvatarBehaviorState =
  | "idle" | "wandering" | "seeking" | "approaching"
  | "teaching" | "learning" | "practicing"
  | "performing" | "socializing" | "inventing" | "passing"
  | "watching" | "jamming" | "mourning" | "pilgrim"
  | "commissioning";  // NEW: waiting for maker to craft a prop
```

Add `role?: "spinner" | "maker"` to `IdentityComponent`:

```typescript
export interface IdentityComponent {
  name: string;
  visualTraits: AvatarVisualTraits;
  generation: number;
  avatarModelId: string;
  role: "spinner" | "maker";  // NEW
}
```

Add new events to `VillageEventMap`:

```typescript
"prop:dropped": (artifact: PropArtifact, x: number, z: number) => void;
"prop:pickedUp": (entity: VillageEntity, artifact: PropArtifact) => void;
"prop:broken": (entity: VillageEntity, artifact: PropArtifact) => void;
"prop:crafted": (maker: VillageEntity, artifact: PropArtifact) => void;
```

- [ ] **Step 2: Add constants to village-constants.ts**

```typescript
// Prop system
export const VILLAGE_PROP_TYPES = ["staff", "fan", "club", "poi", "torch"];
export const PROP_PREFERENCE_TRANSFER_CHANCE = 0.3;
export const PROP_WEAR_LIFESPAN = 500; // beats until wear = 1.0
export const PROP_WEAR_VISUAL_THRESHOLD = 0.8;

export const PROP_WEAR_PROFILES: Record<string, WearProfile> = {
  staff:  { wearRate: 0.0005, failureMode: "crack",          repairTicks: 20 },
  fan:    { wearRate: 0.0008, failureMode: "fabric-tear",     repairTicks: 30 },
  poi:    { wearRate: 0.0003, failureMode: "tangle",          repairTicks: 5  },
  torch:  { wearRate: 0.001,  failureMode: "fuel-depleted",   repairTicks: 10 },
  club:   { wearRate: 0.0004, failureMode: "grip-worn",       repairTicks: 15 },
};

// Prop maker
export const MAKER_CRAFT_DURATION = 30;
export const MAKER_POSITION_ANGLE = Math.PI; // opposite side of arena from entry
export const PROP_WALL_MAX_DISPLAY = 12;
```

Import the `WearProfile` type at the top of village-constants.ts:

```typescript
import type { WearProfile } from "./village-types";
```

- [ ] **Step 3: Update VillageWorld.ts — create prop on entity birth**

In `createAvatarEntity`, add a `prop` component to the entity. After the `transform` block:

```typescript
prop: {
  heldProp: {
    id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    propType: VILLAGE_PROP_TYPES[Math.floor(Math.random() * VILLAGE_PROP_TYPES.length)],
    createdAtTick: options.currentTick,
    createdBy: "", // will be set to entity id after creation
    ownershipChain: [],
    totalBeatsPerformed: 0,
    wear: 0,
    favoriteSequenceId: null,
    customHue: Math.floor(Math.random() * 360),
    broken: false,
  },
  propPreference: VILLAGE_PROP_TYPES[Math.floor(Math.random() * VILLAGE_PROP_TYPES.length)],
},
```

Import `VILLAGE_PROP_TYPES` from constants. Also add `role: "spinner"` to the identity block.

After the entity is created, set `createdBy` and initial ownership:
```typescript
entity.prop.heldProp!.createdBy = entity.id;
entity.prop.heldProp!.ownershipChain = [entity.id];
entity.prop.heldProp!.propType = entity.prop.propPreference;
```

- [ ] **Step 4: Update all test files that create entities**

Every test file that calls `createAvatarEntity` or creates entity literals needs the `prop` component. The `createAvatarEntity` function handles it automatically. But test files that create entity objects directly need updating. Search for `social:` in test files and add `prop: { heldProp: null, propPreference: "staff" }` where needed.

Also update any test that accesses `identity` to include `role: "spinner"`.

- [ ] **Step 5: Run tests**

Run: `npm test -- --run tests/unit/village/`
Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/village/domain/ src/lib/features/village/engine/VillageWorld.ts tests/unit/village/
git commit -m "feat(village): add PropArtifact, PropComponent types and entity extension for material culture"
```

---

### Task 2: PropSystem — Core Headless Logic

**Files:**
- Create: `src/lib/features/village/engine/systems/PropSystem.ts`
- Create: `tests/unit/village/PropSystem.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/unit/village/PropSystem.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { PropSystem } from "$lib/features/village/engine/systems/PropSystem";
import {
  createVillageWorld,
  createAvatarEntity,
} from "$lib/features/village/engine/VillageWorld";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";
import type {
  VillageEventMap,
  VillageEventKey,
  PropArtifact,
} from "$lib/features/village/domain/village-types";

type EventHandler = (...args: unknown[]) => void;

function makeEmitter() {
  const events: Record<string, unknown[][]> = {};
  const handlers: Record<string, EventHandler[]> = {};
  return {
    events,
    emitter: {
      emit<K extends VillageEventKey>(event: K, ...args: Parameters<VillageEventMap[K]>) {
        if (!events[event]) events[event] = [];
        events[event].push(args);
        if (handlers[event]) {
          for (const handler of handlers[event]) handler(...args);
        }
      },
      on<K extends VillageEventKey>(event: K, handler: VillageEventMap[K]) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler as EventHandler);
      },
    },
  };
}

function makeEntity(world: ReturnType<typeof createVillageWorld>, name = "Test") {
  return createAvatarEntity(world, {
    name,
    generation: 1,
    currentTick: 0,
    lifespanTicks: 600,
    arenaRadius: 8,
    personalityGenerator: new PersonalityGenerator(),
    traitMean: 0.5,
    traitStdDev: 0.15,
  });
}

describe("PropSystem", () => {
  it("accumulates wear during performing state", () => {
    const world = createVillageWorld();
    const { emitter } = makeEmitter();
    const system = new PropSystem(emitter);

    const entity = makeEntity(world, "Performer");
    entity.social.state = "performing";
    const initialWear = entity.prop.heldProp!.wear;

    system.tick(world, 1);

    expect(entity.prop.heldProp!.wear).toBeGreaterThan(initialWear);
    expect(entity.prop.heldProp!.totalBeatsPerformed).toBe(1);
  });

  it("breaks prop when wear exceeds 1.0", () => {
    const world = createVillageWorld();
    const { emitter, events } = makeEmitter();
    const system = new PropSystem(emitter);

    const entity = makeEntity(world, "WornOut");
    entity.social.state = "performing";
    entity.prop.heldProp!.wear = 0.999;

    system.tick(world, 1);

    expect(entity.prop.heldProp).toBeNull();
    expect(system.propWall.length).toBe(1);
    expect(system.propWall[0].broken).toBe(true);
    expect(events["prop:broken"]?.length).toBe(1);
  });

  it("drops prop on entity death", () => {
    const world = createVillageWorld();
    const { emitter, events } = makeEmitter();
    const system = new PropSystem(emitter);

    const entity = makeEntity(world, "Dying");
    entity.social.state = "passing";

    // Simulate death event
    system.onEntityDied(entity);

    expect(system.droppedProps.length).toBe(1);
    expect(system.droppedProps[0].artifact.id).toBe(entity.prop.heldProp!.id);
    expect(events["prop:dropped"]?.length).toBe(1);
  });

  it("propless entity picks up dropped prop when nearby", () => {
    const world = createVillageWorld();
    const { emitter, events } = makeEmitter();
    const system = new PropSystem(emitter);

    const dropper = makeEntity(world, "Dropper");
    const droppedArtifact = { ...dropper.prop.heldProp! };
    system.droppedProps.push({
      artifact: droppedArtifact,
      x: 1,
      z: 1,
      droppedAtTick: 0,
    });

    const picker = makeEntity(world, "Picker");
    picker.prop.heldProp = null; // propless
    picker.transform.x = 1.2;
    picker.transform.z = 1.2;
    picker.social.state = "idle";

    system.tick(world, 10);

    expect(picker.prop.heldProp).not.toBeNull();
    expect(picker.prop.heldProp!.id).toBe(droppedArtifact.id);
    expect(system.droppedProps.length).toBe(0);
    expect(events["prop:pickedUp"]?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/village/PropSystem.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement PropSystem**

Create `src/lib/features/village/engine/systems/PropSystem.ts`:

```typescript
import type { World } from "miniplex";
import type { VillageEntity, DroppedProp, PropArtifact } from "../../domain/village-types";
import type { VillageEventEmitter } from "../VillageEventEmitter";
import { PROP_WEAR_PROFILES, PROP_WEAR_LIFESPAN, PROP_WALL_MAX_DISPLAY } from "../../domain/village-constants";

const PICKUP_RADIUS = 1.5;

export class PropSystem {
  droppedProps: DroppedProp[] = [];
  propWall: PropArtifact[] = [];

  constructor(private emitter: VillageEventEmitter) {
    this.emitter.on("entity:died", (entity) => this.onEntityDied(entity));
  }

  tick(world: World<VillageEntity>, currentTick: number): void {
    this.accumulateWear(world, currentTick);
    this.handlePickups(world, currentTick);
  }

  onEntityDied(entity: VillageEntity): void {
    if (!entity.prop.heldProp || entity.prop.heldProp.broken) return;

    const artifact = entity.prop.heldProp;
    this.droppedProps.push({
      artifact,
      x: entity.transform.x,
      z: entity.transform.z,
      droppedAtTick: 0,
    });
    this.emitter.emit("prop:dropped", artifact, entity.transform.x, entity.transform.z);
  }

  private accumulateWear(world: World<VillageEntity>, currentTick: number): void {
    for (const entity of world.entities) {
      if (!entity.prop.heldProp || entity.prop.heldProp.broken) continue;

      const isActive =
        entity.social.state === "performing" ||
        entity.social.state === "practicing" ||
        entity.social.state === "teaching" ||
        entity.social.state === "jamming";

      if (!isActive) continue;

      const prop = entity.prop.heldProp;
      const profile = PROP_WEAR_PROFILES[prop.propType];
      const wearRate = profile?.wearRate ?? (1 / PROP_WEAR_LIFESPAN);

      prop.totalBeatsPerformed++;
      prop.wear = Math.min(1.5, prop.wear + wearRate);

      // Track favorite sequence
      const performingSeq = entity.social.performingSequenceId ?? entity.social.sequenceBeingTransferred;
      if (performingSeq) {
        prop.favoriteSequenceId = performingSeq;
      }

      // Prop breaks
      if (prop.wear >= 1.0) {
        prop.broken = true;
        this.propWall.push(prop);
        if (this.propWall.length > PROP_WALL_MAX_DISPLAY) {
          this.propWall.shift();
        }
        this.emitter.emit("prop:broken", entity, prop);
        entity.prop.heldProp = null;
      }
    }
  }

  private handlePickups(world: World<VillageEntity>, _currentTick: number): void {
    const remainingDrops: DroppedProp[] = [];

    for (const drop of this.droppedProps) {
      let pickedUp = false;

      for (const entity of world.entities) {
        if (entity.social.state === "passing") continue;
        if (entity.prop.heldProp !== null) continue; // already holding

        const dx = entity.transform.x - drop.x;
        const dz = entity.transform.z - drop.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= PICKUP_RADIUS) {
          entity.prop.heldProp = drop.artifact;
          drop.artifact.ownershipChain.push(entity.id);
          this.emitter.emit("prop:pickedUp", entity, drop.artifact);
          pickedUp = true;
          break;
        }
      }

      if (!pickedUp) {
        remainingDrops.push(drop);
      }
    }

    this.droppedProps = remainingDrops;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --run tests/unit/village/PropSystem.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/engine/systems/PropSystem.ts tests/unit/village/PropSystem.test.ts
git commit -m "feat(village): PropSystem — wear accumulation, death drops, pickup, prop wall"
```

---

### Task 3: Prop Maker Entity

**Files:**
- Modify: `src/lib/features/village/engine/systems/PopulationSystem.ts`
- Modify: `src/lib/features/village/engine/systems/SocialSystem.ts`
- Modify: `src/lib/features/village/engine/systems/PropSystem.ts`

- [ ] **Step 1: Add maker spawning to PopulationSystem**

In `PopulationSystem.ts`, after spawning replacement entities, add maker spawning logic. The village should always have exactly one maker. Add a method:

```typescript
private ensureMaker(world: World<VillageEntity>, currentTick: number): void {
  const hasMaker = world.entities.some((e) => e.identity.role === "maker" && e.social.state !== "passing");
  if (hasMaker) return;

  const name = "The Maker";
  const maker = createAvatarEntity(world, {
    name,
    generation: this.generation,
    currentTick,
    lifespanTicks: this.config.lifespanTicks * 1.5, // makers live longer
    arenaRadius: this.config.arenaRadius,
    personalityGenerator: this.personalityGenerator,
    traitMean: 0.5,
    traitStdDev: 0.15,
  });

  // Override traits for maker archetype
  maker.identity.role = "maker";
  maker.personality.patience = 0.9;
  maker.personality.sociability = 0.2;
  maker.personality.creativity = 0.8;

  // Station at arena edge
  const makerAngle = MAKER_POSITION_ANGLE;
  maker.transform.x = Math.cos(makerAngle) * (this.config.arenaRadius - 1);
  maker.transform.z = Math.sin(makerAngle) * (this.config.arenaRadius - 1);
  maker.transform.targetX = maker.transform.x;
  maker.transform.targetZ = maker.transform.z;
  maker.transform.speed = 0;

  this.lineageTracker.recordBirth(maker);
  this.emitter.emit("entity:born", maker);
}
```

Import `MAKER_POSITION_ANGLE` from constants. Call `this.ensureMaker(world, currentTick)` at the end of `tick()`.

- [ ] **Step 2: Add "commissioning" handler to SocialSystem**

In the switch statement, add:

```typescript
case "commissioning":
  this.handleCommissioning(entity);
  break;
```

Add the handler:

```typescript
private handleCommissioning(entity: VillageEntity): void {
  entity.social.idleTimer++;
  if (entity.social.idleTimer > MAKER_CRAFT_DURATION) {
    entity.social.state = "idle";
    entity.social.partner = null;
    entity.social.idleTimer = 0;
    entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
  }
}
```

Import `MAKER_CRAFT_DURATION` from constants.

Also add propless-seeking logic to `handleIdle`. Before the existing idle threshold check, add:

```typescript
// Propless entities seek the maker
if (entity.prop.heldProp === null && entity.identity.role !== "maker") {
  // Will be handled by PropSystem.handleCommissioning
  return;
}
```

- [ ] **Step 3: Add crafting to PropSystem**

In `PropSystem`, add a `handleCrafting` method called from `tick()`:

```typescript
private handleCrafting(world: World<VillageEntity>, currentTick: number): void {
  const maker = world.entities.find(
    (e) => e.identity.role === "maker" && e.social.state !== "passing",
  );
  if (!maker) return;

  for (const entity of world.entities) {
    if (entity.prop.heldProp !== null) continue;
    if (entity.identity.role === "maker") continue;
    if (entity.social.state === "passing") continue;

    const dx = entity.transform.x - maker.transform.x;
    const dz = entity.transform.z - maker.transform.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= 2.0 && entity.social.state !== "commissioning") {
      // Start commissioning
      entity.social.state = "commissioning";
      entity.social.partner = maker.id;
      entity.social.idleTimer = 0;
      entity.transform.speed = 0;
    }

    if (entity.social.state === "commissioning" && entity.social.idleTimer >= MAKER_CRAFT_DURATION) {
      // Craft complete
      const qualityBonus = maker.personality.patience * 0.3;
      const newProp: PropArtifact = {
        id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        propType: entity.prop.propPreference,
        createdAtTick: currentTick,
        createdBy: maker.id,
        ownershipChain: [entity.id],
        totalBeatsPerformed: 0,
        wear: 0,
        favoriteSequenceId: null,
        customHue: Math.floor(Math.random() * 360),
        broken: false,
      };
      entity.prop.heldProp = newProp;
      entity.social.state = "idle";
      entity.social.partner = null;
      entity.social.idleTimer = 0;
      this.emitter.emit("prop:crafted", maker, newProp);
    }
  }

  // Propless entities pathfind toward maker
  for (const entity of world.entities) {
    if (entity.prop.heldProp !== null) continue;
    if (entity.identity.role === "maker") continue;
    if (entity.social.state === "commissioning" || entity.social.state === "passing") continue;

    const dx = maker.transform.x - entity.transform.x;
    const dz = maker.transform.z - entity.transform.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 2.0) {
      entity.transform.targetX = maker.transform.x;
      entity.transform.targetZ = maker.transform.z;
      entity.transform.speed = 1;
    }
  }
}
```

Import `MAKER_CRAFT_DURATION` from constants. Add `this.handleCrafting(world, currentTick)` to the `tick()` method after `handlePickups`.

- [ ] **Step 4: Prevent maker from teaching/performing**

In `SocialSystem.handleIdle`, add at the very top of the method:

```typescript
if (entity.identity.role === "maker") return; // makers don't interact socially
```

- [ ] **Step 5: Run tests**

Run: `npm test -- --run tests/unit/village/`
Expected: All village tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/village/engine/systems/PopulationSystem.ts src/lib/features/village/engine/systems/SocialSystem.ts src/lib/features/village/engine/systems/PropSystem.ts
git commit -m "feat(village): prop maker entity — stationary crafter, commissioning state, propless seeking"
```

---

### Task 4: Wire PropSystem into Orchestrator

**Files:**
- Modify: `src/lib/features/village/engine/VillageOrchestrator.ts`

- [ ] **Step 1: Import and wire PropSystem**

```typescript
import { PropSystem } from "./systems/PropSystem";
```

Add field: `propSystem: PropSystem;`

In constructor: `this.propSystem = new PropSystem(this);`

In `tick()`, add after `styleDriftSystem.tick(...)` and before `movementSystem.tick(...)`:
```typescript
this.propSystem.tick(this.world, this._currentTick);
```

In `reset()`: `this.propSystem = new PropSystem(this);`

Add getters:
```typescript
get droppedProps() {
  return this.propSystem.droppedProps;
}

get propWall() {
  return this.propSystem.propWall;
}
```

- [ ] **Step 2: Add prop preference transfer to TeachingSystem**

In `TeachingSystem.completeTeaching`, after the ego increment, add:

```typescript
// Prop preference spread: 30% chance teaching transfers prop preference
if (Math.random() < PROP_PREFERENCE_TRANSFER_CHANCE) {
  learner.prop.propPreference = teacher.prop.propPreference;
}
```

Import `PROP_PREFERENCE_TRANSFER_CHANCE` from constants.

- [ ] **Step 3: Run all village tests**

Run: `npm test -- --run tests/unit/village/`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/village/engine/VillageOrchestrator.ts src/lib/features/village/engine/systems/TeachingSystem.ts
git commit -m "feat(village): wire PropSystem into orchestrator, add prop preference transfer in teaching"
```

---

### Task 5: VillageDroppedProp Visual

**Files:**
- Create: `src/lib/features/village/components/VillageDroppedProp.svelte`
- Modify: `src/lib/features/village/components/VillageScene.svelte`

- [ ] **Step 1: Create VillageDroppedProp.svelte**

```svelte
<!--
  VillageDroppedProp — Pulsing prop on the ground at a death location.
  Emissive intensity oscillates 0.3-0.7 on a 3-second sine cycle.
-->
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import type { DroppedProp } from "../domain/village-types";

  interface Props {
    drop: DroppedProp;
  }

  const { drop }: Props = $props();

  let emissiveIntensity = $state(0.5);

  useTask(() => {
    const t = performance.now() * 0.001;
    emissiveIntensity = 0.5 + Math.sin(t * Math.PI * (2 / 3)) * 0.2;
  });

  // Map prop type to a simple color
  const propColors: Record<string, string> = {
    staff: "#8B4513",
    fan: "#FF69B4",
    club: "#4169E1",
    poi: "#32CD32",
    torch: "#FF4500",
  };
  const color = $derived(propColors[drop.artifact.propType] ?? "#e8a87c");
</script>

<!-- Prop lying flat on ground -->
<T.Mesh
  position.x={drop.x}
  position.y={0.05}
  position.z={drop.z}
  rotation.x={-Math.PI / 2}
>
  <T.CapsuleGeometry args={[0.03, 0.3, 4, 8]} />
  <T.MeshStandardMaterial
    {color}
    emissive={color}
    {emissiveIntensity}
    transparent
    opacity={0.9}
  />
</T.Mesh>

<!-- Ground glow ring -->
<T.Mesh
  rotation.x={-Math.PI / 2}
  position.x={drop.x}
  position.y={0.003}
  position.z={drop.z}
>
  <T.RingGeometry args={[0.15, 0.25, 16]} />
  <T.MeshBasicMaterial
    {color}
    transparent
    opacity={emissiveIntensity * 0.4}
    depthWrite={false}
  />
</T.Mesh>
```

- [ ] **Step 2: Add to VillageScene.svelte**

Import the component:
```typescript
import VillageDroppedProp from "./VillageDroppedProp.svelte";
```

Add a derived for dropped props:
```typescript
const droppedProps = $derived(villageState.orchestrator.droppedProps);
```

Add the rendering block after the death marks section:

```svelte
<!-- Dropped props (pulsing ground props at death locations) -->
{#each droppedProps as drop (drop.artifact.id)}
  <VillageDroppedProp {drop} />
{/each}
```

- [ ] **Step 3: Run check**

Run: `npm run check`
Expected: No new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/village/components/VillageDroppedProp.svelte src/lib/features/village/components/VillageScene.svelte
git commit -m "feat(village): VillageDroppedProp — pulsing ground prop visual at death locations"
```

---

### Task 6: VillagePropWall Visual

**Files:**
- Create: `src/lib/features/village/components/VillagePropWall.svelte`
- Modify: `src/lib/features/village/components/VillageScene.svelte`

- [ ] **Step 1: Create VillagePropWall.svelte**

```svelte
<!--
  VillagePropWall — Display board at arena edge showing retired/broken props.
  Dark panel with small prop representations arranged in a grid.
-->
<script lang="ts">
  import { T } from "@threlte/core";
  import { HTML } from "@threlte/extras";
  import type { PropArtifact } from "../domain/village-types";
  import { MAKER_POSITION_ANGLE, DEFAULT_ARENA_RADIUS } from "../domain/village-constants";

  interface Props {
    artifacts: PropArtifact[];
  }

  const { artifacts }: Props = $props();

  // Position at arena edge, opposite from maker
  const wallAngle = MAKER_POSITION_ANGLE + Math.PI; // opposite side
  const wallX = Math.cos(wallAngle) * (DEFAULT_ARENA_RADIUS - 0.5);
  const wallZ = Math.sin(wallAngle) * (DEFAULT_ARENA_RADIUS - 0.5);

  const propColors: Record<string, string> = {
    staff: "#8B4513",
    fan: "#FF69B4",
    club: "#4169E1",
    poi: "#32CD32",
    torch: "#FF4500",
  };

  let hoveredProp = $state<string | null>(null);
</script>

{#if artifacts.length > 0}
  <!-- Back panel -->
  <T.Mesh
    position.x={wallX}
    position.y={0.75}
    position.z={wallZ}
    rotation.y={wallAngle + Math.PI}
  >
    <T.BoxGeometry args={[2, 1.5, 0.1]} />
    <T.MeshStandardMaterial color="#1a1a1a" />
  </T.Mesh>

  <!-- Mounted props as small capsules -->
  {#each artifacts.slice(-12) as artifact, i (artifact.id)}
    {@const col = i % 4}
    {@const row = Math.floor(i / 4)}
    {@const offsetX = (col - 1.5) * 0.4}
    {@const offsetY = 1.2 - row * 0.4}
    {@const color = propColors[artifact.propType] ?? "#666"}

    <T.Mesh
      position.x={wallX + Math.cos(wallAngle + Math.PI) * 0.08 + Math.sin(wallAngle + Math.PI) * offsetX}
      position.y={offsetY}
      position.z={wallZ + Math.sin(wallAngle + Math.PI) * 0.08 - Math.cos(wallAngle + Math.PI) * offsetX}
      rotation.z={Math.PI / 4}
      onpointerenter={() => (hoveredProp = artifact.id)}
      onpointerleave={() => (hoveredProp = null)}
    >
      <T.CapsuleGeometry args={[0.02, 0.15, 4, 8]} />
      <T.MeshStandardMaterial
        {color}
        emissive="#000000"
        transparent
        opacity={0.6}
      />
    </T.Mesh>

    {#if hoveredProp === artifact.id}
      <T.Group
        position.x={wallX}
        position.y={offsetY + 0.2}
        position.z={wallZ}
      >
        <HTML center sprite>
          <div class="prop-tooltip">
            <div>{artifact.propType} — {artifact.totalBeatsPerformed} beats</div>
            <div>Owners: {artifact.ownershipChain.length}</div>
            <div>{PROP_WEAR_PROFILES[artifact.propType]?.failureMode ?? "retired"}</div>
          </div>
        </HTML>
      </T.Group>
    {/if}
  {/each}
{/if}

<script context="module">
  import { PROP_WEAR_PROFILES } from "../domain/village-constants";
</script>

<style>
  .prop-tooltip {
    font-size: 10px;
    font-family: monospace;
    color: #fff;
    background: rgba(0, 0, 0, 0.85);
    padding: 3px 5px;
    border-radius: 3px;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
  }
</style>
```

- [ ] **Step 2: Add to VillageScene.svelte**

Import:
```typescript
import VillagePropWall from "./VillagePropWall.svelte";
```

Add derived:
```typescript
const propWall = $derived(villageState.orchestrator.propWall);
```

Add rendering after the dropped props:
```svelte
<!-- Prop wall (retired props display) -->
<VillagePropWall artifacts={propWall} />
```

- [ ] **Step 3: Run check**

Run: `npm run check`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/village/components/VillagePropWall.svelte src/lib/features/village/components/VillageScene.svelte
git commit -m "feat(village): VillagePropWall — arena-edge display board for retired props"
```

---

### Task 7: Avatar Prop Indicator + Controls + Events

**Files:**
- Modify: `src/lib/features/village/components/VillageAvatar.svelte`
- Modify: `src/lib/features/village/components/VillageControls.svelte`
- Modify: `src/lib/features/village/VillageLabTab.svelte`

- [ ] **Step 1: Add prop indicator to VillageAvatar name label**

In `VillageAvatar.svelte`, add a derived for the prop type emoji:

```typescript
const propIndicator = $derived(
  renderState.entity.prop.heldProp
    ? ` [${renderState.entity.prop.heldProp.propType.charAt(0).toUpperCase()}]`
    : " [—]"
);
```

Append it to the name label after the phase indicator:

```svelte
{avatarName}
<span class="phase-indicator">{phaseIndicator}</span>
<span class="prop-indicator">{propIndicator}</span>
```

Add to the `<style>` block:
```css
.prop-indicator {
  opacity: 0.5;
  font-size: 9px;
}
```

- [ ] **Step 2: Add prop info to VillageControls inspector**

In `VillageControls.svelte`, in the selected entity inspector section, after the Style stats, add:

```svelte
{#if selectedEntity.prop.heldProp}
  <div class="stat">Prop: {selectedEntity.prop.heldProp.propType}</div>
  <div class="stat">Wear: {(selectedEntity.prop.heldProp.wear * 100).toFixed(0)}%</div>
  <div class="stat">Beats: {selectedEntity.prop.heldProp.totalBeatsPerformed}</div>
  <div class="stat">Owners: {selectedEntity.prop.heldProp.ownershipChain.length}</div>
{:else}
  <div class="stat">Prop: none (seeking maker)</div>
{/if}
```

Add to population stats:

```svelte
<div class="stat">Dropped Props: {villageState.orchestrator.droppedProps.length}</div>
<div class="stat">Prop Wall: {villageState.orchestrator.propWall.length}</div>
```

- [ ] **Step 3: Wire prop events to toasts in VillageLabTab**

In the event wiring section, add:

```typescript
villageState.orchestrator.on("prop:broken", (entity, artifact) => {
  vs.pushToast(
    `${entity.identity.name}'s ${artifact.propType} broke`,
    "#ef4444",
    entity.transform.x,
    entity.transform.z,
  );
});

villageState.orchestrator.on("prop:crafted", (maker, artifact) => {
  vs.pushToast(
    `${maker.identity.name} crafted a ${artifact.propType}`,
    "#4ade80",
    maker.transform.x,
    maker.transform.z,
    3000,
  );
});
```

- [ ] **Step 4: Run tests and check**

Run: `npm test -- --run tests/unit/village/`
Run: `npm run check`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/components/VillageAvatar.svelte src/lib/features/village/components/VillageControls.svelte src/lib/features/village/VillageLabTab.svelte
git commit -m "feat(village): prop indicators, inspector stats, and event toasts for material culture"
```

---

## Summary

| Task | Feature | What It Does |
|------|---------|-------------|
| 1 | Foundation | PropArtifact/PropComponent types, constants, extend VillageEntity, update entity creation |
| 2 | Prop Identity | PropSystem — wear, death drops, pickup, prop wall |
| 3 | Prop Maker | Maker entity role, commissioning state, prop crafting |
| 4 | Integration | Wire PropSystem into orchestrator, prop preference transfer in teaching |
| 5 | Visual | VillageDroppedProp — pulsing ground prop |
| 6 | Visual | VillagePropWall — arena-edge retired props display |
| 7 | UI + Events | Avatar prop indicator, inspector stats, event toasts |
