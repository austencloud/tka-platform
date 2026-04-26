# TKA Village Phase 1: Headless Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure-TypeScript simulation engine where avatars with personality traits autonomously teach, learn, invent, age, and die — passing TKA sequences across generations.

**Architecture:** Miniplex ECS with a separate `World<VillageEntity>` (not reusing realm's world). Six systems (Lifecycle, Social, Teaching, Recombination, Movement, Population) process entities each tick. An orchestrator owns the world and exposes a typed event emitter for renderer subscription. Zero Svelte imports — testable in Node.js via Vitest.

**Tech Stack:** TypeScript, Miniplex ECS, Vitest, existing `ISequenceTransformer` from DI container

**Spec:** `docs/superpowers/specs/2026-04-05-tka-village-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/lib/features/village/domain/village-types.ts` | All component interfaces, entity type, event map, behavior states |
| `src/lib/features/village/domain/village-constants.ts` | Default config, name lists, tuning parameters |
| `src/lib/features/village/engine/VillageWorld.ts` | Miniplex `World<VillageEntity>` factory + entity creation helpers |
| `src/lib/features/village/engine/VillageConfig.ts` | `VillageConfig` interface + `createDefaultConfig()` |
| `src/lib/features/village/engine/VillageOrchestrator.ts` | Owns world + systems, tick loop, typed event emitter |
| `src/lib/features/village/engine/systems/LifecycleSystem.ts` | Age advancement, phase transitions, death triggering |
| `src/lib/features/village/engine/systems/MovementSystem.ts` | Position updates, collision avoidance, speed-by-age |
| `src/lib/features/village/engine/systems/SocialSystem.ts` | Behavioral state machine transitions |
| `src/lib/features/village/engine/systems/TeachingSystem.ts` | Beat-by-beat teaching choreography, proficiency, fumbles |
| `src/lib/features/village/engine/systems/RecombinationSystem.ts` | LOOP transform application, validation, novelty check |
| `src/lib/features/village/engine/systems/PopulationSystem.ts` | Birth/death population management, seed distribution |
| `src/lib/features/village/services/contracts/ISequenceMutator.ts` | Interface for transform + validate |
| `src/lib/features/village/services/implementations/SequenceMutator.ts` | Wraps `ISequenceTransformer` with sequence validity check |
| `src/lib/features/village/services/contracts/IPersonalityGenerator.ts` | Interface for trait generation |
| `src/lib/features/village/services/implementations/PersonalityGenerator.ts` | Normal distribution trait rolls |
| `src/lib/features/village/services/contracts/ILineageTracker.ts` | Interface for transmission history |
| `src/lib/features/village/services/implementations/LineageTracker.ts` | Records who taught what to whom |
| `tests/unit/village/VillageWorld.test.ts` | Entity creation, world queries |
| `tests/unit/village/LifecycleSystem.test.ts` | Aging, phase transitions, death |
| `tests/unit/village/MovementSystem.test.ts` | Position updates, boundary, collision |
| `tests/unit/village/SocialSystem.test.ts` | State machine transitions |
| `tests/unit/village/TeachingSystem.test.ts` | Knowledge transfer, fumbles, proficiency |
| `tests/unit/village/RecombinationSystem.test.ts` | Transform application, novelty |
| `tests/unit/village/PopulationSystem.test.ts` | Birth/death, population target |
| `tests/unit/village/PersonalityGenerator.test.ts` | Distribution, bounds |
| `tests/unit/village/VillageOrchestrator.test.ts` | Full integration: multi-generation runs |

---

### Task 1: Domain Types

**Files:**
- Create: `src/lib/features/village/domain/village-types.ts`
- Create: `src/lib/features/village/domain/village-constants.ts`

- [ ] **Step 1: Create village-types.ts with all component interfaces**

```typescript
// src/lib/features/village/domain/village-types.ts

export interface AvatarVisualTraits {
  skinTone: number;       // 0-1, maps to color palette
  hairColor: number;      // 0-1, maps to color palette
  heightScale: number;    // 0.9-1.1
}

export interface IdentityComponent {
  name: string;
  visualTraits: AvatarVisualTraits;
  generation: number;
}

export interface LearnedSequence {
  sequenceId: string;
  proficiency: number;          // 0-1
  source: "seed" | "taught" | "invented";
  learnedAt: number;            // simulation tick
  learnedFrom: string | null;   // entity id
  lineage: string[];            // chain of entity ids
}

export interface KnowledgeComponent {
  knownSequences: Map<string, LearnedSequence>;
  maxCapacity: number;
}

export interface PersonalityComponent {
  learnSpeed: number;     // 0-1
  sociability: number;    // 0-1
  creativity: number;     // 0-1
  patience: number;       // 0-1
  curiosity: number;      // 0-1
}

export type LifecyclePhase = "youth" | "adult" | "elder";

export interface LifecycleComponent {
  birthTick: number;
  currentAge: number;       // 0-1 normalized
  lifespan: number;         // ticks
  phase: LifecyclePhase;
  knowledgeGlow: number;    // 0-1 derived from knowledge breadth
}

export type AvatarBehaviorState =
  | "idle"
  | "wandering"
  | "seeking"
  | "approaching"
  | "teaching"
  | "learning"
  | "practicing"
  | "performing"
  | "socializing"
  | "inventing"
  | "passing";

export interface SocialComponent {
  state: AvatarBehaviorState;
  partner: string | null;
  teachingProgress: number;
  sequenceBeingTransferred: string | null;
  currentBeatIndex: number;
  frustrationLevel: number;
  idleTimer: number;
  interactionCooldown: number;
}

export interface VillageTransformComponent {
  x: number;
  z: number;
  facingAngle: number;
  targetX: number;
  targetZ: number;
  speed: number;
}

export interface VillageEntity {
  id: string;
  identity: IdentityComponent;
  knowledge: KnowledgeComponent;
  personality: PersonalityComponent;
  lifecycle: LifecycleComponent;
  social: SocialComponent;
  transform: VillageTransformComponent;
}

export interface VillageEventMap {
  "entity:born": (entity: VillageEntity) => void;
  "entity:died": (entity: VillageEntity) => void;
  "teaching:started": (teacher: VillageEntity, learner: VillageEntity, sequenceId: string) => void;
  "teaching:completed": (teacher: VillageEntity, learner: VillageEntity, sequenceId: string) => void;
  "teaching:fumble": (learner: VillageEntity, beatIndex: number) => void;
  "sequence:invented": (inventor: VillageEntity, sequenceId: string) => void;
  "sequence:extinct": (sequenceId: string) => void;
  "generation:changed": (generation: number) => void;
}

export type VillageEventKey = keyof VillageEventMap;

export interface PopulationStats {
  alive: number;
  averageAge: number;
  totalKnowledge: number;       // sum of all known sequences across all avatars
  uniqueSequences: number;      // distinct sequence ids in population
  extinctionCount: number;      // sequences that were known but are now lost
  currentGeneration: number;
}
```

- [ ] **Step 2: Create village-constants.ts with defaults and name lists**

```typescript
// src/lib/features/village/domain/village-constants.ts

export const AVATAR_NAMES = [
  "Ember", "Soot", "Birch", "Flint", "Reed", "Cinder", "Moss", "Basalt",
  "Sage", "Dune", "Rill", "Briar", "Slate", "Pyre", "Glen", "Thistle",
  "Ash", "Wren", "Pike", "Fern", "Rust", "Tarn", "Opal", "Quill",
  "Brine", "Hazel", "Frost", "Lark", "Coral", "Rune", "Cedar", "Storm",
];

export const DEFAULT_ARENA_RADIUS = 8; // world units

export const IDLE_THRESHOLD_BASE = 30; // ticks before seeking interaction
export const INTERACTION_COOLDOWN_BASE = 20; // ticks after interaction ends
export const TEACHING_SPEED_TICKS_PER_BEAT = 10; // ticks to demonstrate one beat
export const PROFICIENCY_THRESHOLD = 0.7; // proficiency needed to "learn" a sequence
export const FUMBLE_BASE_PROBABILITY = 0.3; // base chance of fumbling a beat
export const FRUSTRATION_DECAY_RATE = 0.05; // per tick between beats
export const FRUSTRATION_GIVE_UP_THRESHOLD = 0.8;
export const LOSSY_TRANSMISSION_BASE = 0.1; // per-beat mutation chance
export const INVENTION_BASE_PROBABILITY = 0.005; // per idle tick
export const PASSING_DURATION_TICKS = 15; // ticks in "passing" state before removal

export const WALK_SPEED_YOUTH = 1.0;
export const WALK_SPEED_ADULT = 0.8;
export const WALK_SPEED_ELDER = 0.5;

export const COLLISION_AVOIDANCE_RADIUS = 1.0; // world units
export const ARRIVAL_THRESHOLD = 0.3; // distance to consider "arrived"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/village/domain/village-types.ts src/lib/features/village/domain/village-constants.ts
git commit -m "feat(village): add domain types and constants for TKA Village simulation"
```

---

### Task 2: VillageConfig

**Files:**
- Create: `src/lib/features/village/engine/VillageConfig.ts`

- [ ] **Step 1: Create VillageConfig interface and default factory**

```typescript
// src/lib/features/village/engine/VillageConfig.ts

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface VillageConfig {
  targetPopulation: number;
  initialSeedSequences: SequenceData[];
  lifespanTicks: number;
  ticksPerSecond: number;
  traitDistribution: {
    mean: number;
    stdDev: number;
  };
  lossyTransmissionRate: number;
  inventionRate: number;
  arenaRadius: number;
  youthPhaseRatio: number;
  adultPhaseRatio: number;
  elderPhaseRatio: number;
}

export function createDefaultConfig(
  overrides?: Partial<VillageConfig>
): VillageConfig {
  return {
    targetPopulation: 6,
    initialSeedSequences: [],
    lifespanTicks: 600,       // ~1 minute at 10 tps
    ticksPerSecond: 10,
    traitDistribution: { mean: 0.5, stdDev: 0.15 },
    lossyTransmissionRate: 0.1,
    inventionRate: 0.005,
    arenaRadius: 8,
    youthPhaseRatio: 0.1,
    adultPhaseRatio: 0.7,
    elderPhaseRatio: 0.2,
    ...overrides,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/village/engine/VillageConfig.ts
git commit -m "feat(village): add VillageConfig with defaults"
```

---

### Task 3: PersonalityGenerator Service

**Files:**
- Create: `src/lib/features/village/services/contracts/IPersonalityGenerator.ts`
- Create: `src/lib/features/village/services/implementations/PersonalityGenerator.ts`
- Create: `tests/unit/village/PersonalityGenerator.test.ts`

- [ ] **Step 1: Write the interface**

```typescript
// src/lib/features/village/services/contracts/IPersonalityGenerator.ts

import type { PersonalityComponent } from "../../domain/village-types";

export interface IPersonalityGenerator {
  generate(mean: number, stdDev: number): PersonalityComponent;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// tests/unit/village/PersonalityGenerator.test.ts

import { describe, it, expect } from "vitest";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";

describe("PersonalityGenerator", () => {
  const generator = new PersonalityGenerator();

  it("generates all five traits", () => {
    const personality = generator.generate(0.5, 0.15);
    expect(personality).toHaveProperty("learnSpeed");
    expect(personality).toHaveProperty("sociability");
    expect(personality).toHaveProperty("creativity");
    expect(personality).toHaveProperty("patience");
    expect(personality).toHaveProperty("curiosity");
  });

  it("clamps all traits between 0 and 1", () => {
    // Use extreme stdDev to force edge cases
    for (let i = 0; i < 100; i++) {
      const personality = generator.generate(0.5, 0.5);
      for (const value of Object.values(personality)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("produces varied traits (not all identical)", () => {
    const personality = generator.generate(0.5, 0.15);
    const values = Object.values(personality);
    const allSame = values.every((v) => v === values[0]);
    // With stdDev=0.15, it's astronomically unlikely all 5 traits are identical
    expect(allSame).toBe(false);
  });

  it("respects mean — high mean produces higher average traits", () => {
    let highSum = 0;
    let lowSum = 0;
    const runs = 200;
    for (let i = 0; i < runs; i++) {
      const high = generator.generate(0.8, 0.1);
      const low = generator.generate(0.2, 0.1);
      highSum += Object.values(high).reduce((a, b) => a + b, 0);
      lowSum += Object.values(low).reduce((a, b) => a + b, 0);
    }
    expect(highSum / runs).toBeGreaterThan(lowSum / runs);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/village/PersonalityGenerator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write implementation**

```typescript
// src/lib/features/village/services/implementations/PersonalityGenerator.ts

import type { PersonalityComponent } from "../../domain/village-types";
import type { IPersonalityGenerator } from "../contracts/IPersonalityGenerator";

export class PersonalityGenerator implements IPersonalityGenerator {
  generate(mean: number, stdDev: number): PersonalityComponent {
    return {
      learnSpeed: this.clampedNormal(mean, stdDev),
      sociability: this.clampedNormal(mean, stdDev),
      creativity: this.clampedNormal(mean, stdDev),
      patience: this.clampedNormal(mean, stdDev),
      curiosity: this.clampedNormal(mean, stdDev),
    };
  }

  private clampedNormal(mean: number, stdDev: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.min(1, mean + z * stdDev));
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/village/PersonalityGenerator.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/village/services/ tests/unit/village/PersonalityGenerator.test.ts
git commit -m "feat(village): add PersonalityGenerator with normal distribution traits"
```

---

### Task 4: VillageWorld (Entity Factory)

**Files:**
- Create: `src/lib/features/village/engine/VillageWorld.ts`
- Create: `tests/unit/village/VillageWorld.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/village/VillageWorld.test.ts

import { describe, it, expect } from "vitest";
import { createVillageWorld, createAvatarEntity } from "$lib/features/village/engine/VillageWorld";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";
import { AVATAR_NAMES } from "$lib/features/village/domain/village-constants";

describe("VillageWorld", () => {
  it("creates an empty world", () => {
    const world = createVillageWorld();
    expect(world.entities.length).toBe(0);
  });

  it("creates an avatar entity with all components", () => {
    const world = createVillageWorld();
    const generator = new PersonalityGenerator();
    const entity = createAvatarEntity(world, {
      name: "Ember",
      generation: 1,
      currentTick: 0,
      lifespanTicks: 600,
      arenaRadius: 8,
      personalityGenerator: generator,
      traitMean: 0.5,
      traitStdDev: 0.15,
    });

    expect(entity.id).toBeTruthy();
    expect(entity.identity.name).toBe("Ember");
    expect(entity.identity.generation).toBe(1);
    expect(entity.knowledge.knownSequences.size).toBe(0);
    expect(entity.lifecycle.phase).toBe("youth");
    expect(entity.lifecycle.currentAge).toBe(0);
    expect(entity.social.state).toBe("idle");
    expect(entity.transform.x).toBeDefined();
    expect(entity.transform.z).toBeDefined();
  });

  it("spawns entity at arena edge", () => {
    const world = createVillageWorld();
    const generator = new PersonalityGenerator();
    const entity = createAvatarEntity(world, {
      name: "Soot",
      generation: 1,
      currentTick: 0,
      lifespanTicks: 600,
      arenaRadius: 8,
      personalityGenerator: generator,
      traitMean: 0.5,
      traitStdDev: 0.15,
    });

    const distFromCenter = Math.sqrt(entity.transform.x ** 2 + entity.transform.z ** 2);
    // Should spawn near the arena edge (within 20% tolerance)
    expect(distFromCenter).toBeGreaterThan(8 * 0.7);
    expect(distFromCenter).toBeLessThanOrEqual(8);
  });

  it("adds entity to the world", () => {
    const world = createVillageWorld();
    const generator = new PersonalityGenerator();
    createAvatarEntity(world, {
      name: "Birch",
      generation: 1,
      currentTick: 0,
      lifespanTicks: 600,
      arenaRadius: 8,
      personalityGenerator: generator,
      traitMean: 0.5,
      traitStdDev: 0.15,
    });

    expect(world.entities.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/village/VillageWorld.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/features/village/engine/VillageWorld.ts

import { World } from "miniplex";
import type { VillageEntity, AvatarVisualTraits } from "../domain/village-types";
import type { IPersonalityGenerator } from "../services/contracts/IPersonalityGenerator";

export function createVillageWorld(): World<VillageEntity> {
  return new World<VillageEntity>();
}

export interface CreateAvatarOptions {
  name: string;
  generation: number;
  currentTick: number;
  lifespanTicks: number;
  arenaRadius: number;
  personalityGenerator: IPersonalityGenerator;
  traitMean: number;
  traitStdDev: number;
  seedSequences?: Map<string, any>; // pre-populated knowledge
}

export function createAvatarEntity(
  world: World<VillageEntity>,
  options: CreateAvatarOptions
): VillageEntity {
  const angle = Math.random() * Math.PI * 2;
  const radius = options.arenaRadius * (0.8 + Math.random() * 0.2);

  const visualTraits: AvatarVisualTraits = {
    skinTone: Math.random(),
    hairColor: Math.random(),
    heightScale: 0.9 + Math.random() * 0.2,
  };

  const personality = options.personalityGenerator.generate(
    options.traitMean,
    options.traitStdDev
  );

  const entity: VillageEntity = {
    id: `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    identity: {
      name: options.name,
      visualTraits,
      generation: options.generation,
    },
    knowledge: {
      knownSequences: options.seedSequences ?? new Map(),
      maxCapacity: 5 + Math.floor(personality.curiosity * 5), // 5-10
    },
    personality,
    lifecycle: {
      birthTick: options.currentTick,
      currentAge: 0,
      lifespan: options.lifespanTicks * (0.8 + Math.random() * 0.4), // +/- 20%
      phase: "youth",
      knowledgeGlow: 0,
    },
    social: {
      state: "idle",
      partner: null,
      teachingProgress: 0,
      sequenceBeingTransferred: null,
      currentBeatIndex: 0,
      frustrationLevel: 0,
      idleTimer: 0,
      interactionCooldown: 0,
    },
    transform: {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      facingAngle: angle + Math.PI, // face inward
      targetX: 0,
      targetZ: 0,
      speed: 0,
    },
  };

  world.add(entity);
  return entity;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/village/VillageWorld.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/engine/VillageWorld.ts tests/unit/village/VillageWorld.test.ts
git commit -m "feat(village): add VillageWorld with Miniplex entity factory"
```

---

### Task 5: LifecycleSystem

**Files:**
- Create: `src/lib/features/village/engine/systems/LifecycleSystem.ts`
- Create: `tests/unit/village/LifecycleSystem.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/village/LifecycleSystem.test.ts

import { describe, it, expect } from "vitest";
import { LifecycleSystem } from "$lib/features/village/engine/systems/LifecycleSystem";
import { createVillageWorld, createAvatarEntity } from "$lib/features/village/engine/VillageWorld";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";
import { createDefaultConfig } from "$lib/features/village/engine/VillageConfig";

function makeEntity(world: ReturnType<typeof createVillageWorld>, overrides?: { lifespanTicks?: number }) {
  return createAvatarEntity(world, {
    name: "Test",
    generation: 1,
    currentTick: 0,
    lifespanTicks: overrides?.lifespanTicks ?? 100,
    arenaRadius: 8,
    personalityGenerator: new PersonalityGenerator(),
    traitMean: 0.5,
    traitStdDev: 0.15,
  });
}

describe("LifecycleSystem", () => {
  it("advances age each tick", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig({ lifespanTicks: 100 });
    const system = new LifecycleSystem(config);

    system.tick(world, 1);

    expect(entity.lifecycle.currentAge).toBeGreaterThan(0);
  });

  it("transitions from youth to adult at correct threshold", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world, { lifespanTicks: 100 });
    entity.lifecycle.lifespan = 100; // Fix to prevent random variance
    const config = createDefaultConfig({ lifespanTicks: 100 });
    const system = new LifecycleSystem(config);

    // Tick past youth phase (10% of lifespan)
    for (let i = 0; i < 15; i++) {
      system.tick(world, i);
    }

    expect(entity.lifecycle.phase).toBe("adult");
  });

  it("transitions from adult to elder at correct threshold", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world, { lifespanTicks: 100 });
    entity.lifecycle.lifespan = 100; // Fix to prevent random variance
    const config = createDefaultConfig({ lifespanTicks: 100 });
    const system = new LifecycleSystem(config);

    // Tick past adult phase (youth 10% + adult 70% = 80%)
    for (let i = 0; i < 85; i++) {
      system.tick(world, i);
    }

    expect(entity.lifecycle.phase).toBe("elder");
  });

  it("sets state to passing when lifespan exceeded", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world, { lifespanTicks: 100 });
    // Force exact lifespan for predictability
    entity.lifecycle.lifespan = 100;
    const config = createDefaultConfig({ lifespanTicks: 100 });
    const system = new LifecycleSystem(config);

    for (let i = 0; i <= 100; i++) {
      system.tick(world, i);
    }

    expect(entity.social.state).toBe("passing");
  });

  it("updates knowledgeGlow based on knowledge count", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig();
    const system = new LifecycleSystem(config);

    // Add some knowledge
    entity.knowledge.knownSequences.set("seq1", {
      sequenceId: "seq1", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    });
    entity.knowledge.knownSequences.set("seq2", {
      sequenceId: "seq2", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    });

    system.tick(world, 1);

    expect(entity.lifecycle.knowledgeGlow).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/village/LifecycleSystem.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/features/village/engine/systems/LifecycleSystem.ts

import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";

export class LifecycleSystem {
  constructor(private config: VillageConfig) {}

  tick(world: World<VillageEntity>, currentTick: number): void {
    for (const entity of world.entities) {
      if (entity.social.state === "passing") continue;

      const elapsed = currentTick - entity.lifecycle.birthTick;
      entity.lifecycle.currentAge = Math.min(1, elapsed / entity.lifecycle.lifespan);

      // Phase transitions
      const { youthPhaseRatio, adultPhaseRatio } = this.config;
      const adultThreshold = youthPhaseRatio;
      const elderThreshold = youthPhaseRatio + adultPhaseRatio;

      if (entity.lifecycle.currentAge < adultThreshold) {
        entity.lifecycle.phase = "youth";
      } else if (entity.lifecycle.currentAge < elderThreshold) {
        entity.lifecycle.phase = "adult";
      } else {
        entity.lifecycle.phase = "elder";
      }

      // Knowledge glow: 0-1 based on sequences known vs capacity
      entity.lifecycle.knowledgeGlow = Math.min(
        1,
        entity.knowledge.knownSequences.size / Math.max(1, entity.knowledge.maxCapacity)
      );

      // Death
      if (elapsed >= entity.lifecycle.lifespan) {
        entity.social.state = "passing";
        entity.social.partner = null;
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/village/LifecycleSystem.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/engine/systems/LifecycleSystem.ts tests/unit/village/LifecycleSystem.test.ts
git commit -m "feat(village): add LifecycleSystem with aging, phases, and death"
```

---

### Task 6: MovementSystem

**Files:**
- Create: `src/lib/features/village/engine/systems/MovementSystem.ts`
- Create: `tests/unit/village/MovementSystem.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/village/MovementSystem.test.ts

import { describe, it, expect } from "vitest";
import { MovementSystem } from "$lib/features/village/engine/systems/MovementSystem";
import { createVillageWorld, createAvatarEntity } from "$lib/features/village/engine/VillageWorld";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";
import { createDefaultConfig } from "$lib/features/village/engine/VillageConfig";
import { ARRIVAL_THRESHOLD } from "$lib/features/village/domain/village-constants";

function makeEntity(world: ReturnType<typeof createVillageWorld>) {
  return createAvatarEntity(world, {
    name: "Test",
    generation: 1,
    currentTick: 0,
    lifespanTicks: 600,
    arenaRadius: 8,
    personalityGenerator: new PersonalityGenerator(),
    traitMean: 0.5,
    traitStdDev: 0.15,
  });
}

describe("MovementSystem", () => {
  it("moves entity toward target", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig();
    const system = new MovementSystem(config);

    entity.transform.x = 0;
    entity.transform.z = 0;
    entity.transform.targetX = 5;
    entity.transform.targetZ = 0;
    entity.transform.speed = 1;

    system.tick(world);

    expect(entity.transform.x).toBeGreaterThan(0);
  });

  it("stops when arriving at target", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig();
    const system = new MovementSystem(config);

    entity.transform.x = 4.9;
    entity.transform.z = 0;
    entity.transform.targetX = 5;
    entity.transform.targetZ = 0;
    entity.transform.speed = 1;

    system.tick(world);

    expect(entity.transform.speed).toBe(0);
  });

  it("keeps entities within arena bounds", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig({ arenaRadius: 8 });
    const system = new MovementSystem(config);

    entity.transform.x = 7.5;
    entity.transform.z = 7.5;
    entity.transform.targetX = 20;
    entity.transform.targetZ = 20;
    entity.transform.speed = 5;

    system.tick(world);

    const dist = Math.sqrt(entity.transform.x ** 2 + entity.transform.z ** 2);
    expect(dist).toBeLessThanOrEqual(config.arenaRadius + 0.1);
  });

  it("updates facing angle toward movement direction", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig();
    const system = new MovementSystem(config);

    entity.transform.x = 0;
    entity.transform.z = 0;
    entity.transform.targetX = 5;
    entity.transform.targetZ = 0;
    entity.transform.speed = 1;
    entity.transform.facingAngle = Math.PI; // facing away

    system.tick(world);

    // Should be rotating toward target (angle ~0)
    expect(Math.abs(entity.transform.facingAngle)).toBeLessThan(Math.PI);
  });

  it("scales speed by age phase", () => {
    const world = createVillageWorld();
    const youthEntity = makeEntity(world);
    const elderEntity = makeEntity(world);
    const config = createDefaultConfig();
    const system = new MovementSystem(config);

    youthEntity.lifecycle.phase = "youth";
    elderEntity.lifecycle.phase = "elder";

    youthEntity.transform.x = 0; youthEntity.transform.z = 0;
    youthEntity.transform.targetX = 10; youthEntity.transform.targetZ = 0;
    youthEntity.transform.speed = 1;

    elderEntity.transform.x = 0; elderEntity.transform.z = 0;
    elderEntity.transform.targetX = 10; elderEntity.transform.targetZ = 0;
    elderEntity.transform.speed = 1;

    system.tick(world);

    // Youth should have moved further than elder
    expect(youthEntity.transform.x).toBeGreaterThan(elderEntity.transform.x);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/village/MovementSystem.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/features/village/engine/systems/MovementSystem.ts

import type { World } from "miniplex";
import type { VillageEntity, LifecyclePhase } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";
import {
  WALK_SPEED_YOUTH, WALK_SPEED_ADULT, WALK_SPEED_ELDER,
  ARRIVAL_THRESHOLD, COLLISION_AVOIDANCE_RADIUS,
} from "../../domain/village-constants";

const PHASE_SPEED: Record<LifecyclePhase, number> = {
  youth: WALK_SPEED_YOUTH,
  adult: WALK_SPEED_ADULT,
  elder: WALK_SPEED_ELDER,
};

const FACING_LERP_RATE = 0.15;

export class MovementSystem {
  constructor(private config: VillageConfig) {}

  tick(world: World<VillageEntity>): void {
    for (const entity of world.entities) {
      if (entity.social.state === "passing") continue;
      if (entity.transform.speed === 0) continue;

      const dx = entity.transform.targetX - entity.transform.x;
      const dz = entity.transform.targetZ - entity.transform.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < ARRIVAL_THRESHOLD) {
        entity.transform.speed = 0;
        continue;
      }

      // Normalize direction
      const nx = dx / dist;
      const nz = dz / dist;

      // Collision avoidance steering
      let steerX = 0;
      let steerZ = 0;
      for (const other of world.entities) {
        if (other.id === entity.id) continue;
        const ox = entity.transform.x - other.transform.x;
        const oz = entity.transform.z - other.transform.z;
        const oDist = Math.sqrt(ox * ox + oz * oz);
        if (oDist < COLLISION_AVOIDANCE_RADIUS && oDist > 0.01) {
          const repulsion = (COLLISION_AVOIDANCE_RADIUS - oDist) / COLLISION_AVOIDANCE_RADIUS;
          steerX += (ox / oDist) * repulsion * 0.5;
          steerZ += (oz / oDist) * repulsion * 0.5;
        }
      }

      const moveX = nx + steerX;
      const moveZ = nz + steerZ;
      const moveMag = Math.sqrt(moveX * moveX + moveZ * moveZ) || 1;

      const phaseSpeed = PHASE_SPEED[entity.lifecycle.phase];
      const step = entity.transform.speed * phaseSpeed * 0.1; // per-tick distance

      entity.transform.x += (moveX / moveMag) * step;
      entity.transform.z += (moveZ / moveMag) * step;

      // Arena bounds clamping
      const currentDist = Math.sqrt(entity.transform.x ** 2 + entity.transform.z ** 2);
      if (currentDist > this.config.arenaRadius) {
        const scale = this.config.arenaRadius / currentDist;
        entity.transform.x *= scale;
        entity.transform.z *= scale;
      }

      // Facing angle — lerp toward movement direction
      const targetAngle = Math.atan2(moveZ, moveX);
      entity.transform.facingAngle = lerpAngle(
        entity.transform.facingAngle,
        targetAngle,
        FACING_LERP_RATE
      );
    }
  }
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/village/MovementSystem.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/engine/systems/MovementSystem.ts tests/unit/village/MovementSystem.test.ts
git commit -m "feat(village): add MovementSystem with collision avoidance and age-scaled speed"
```

---

### Task 7: SocialSystem (Behavioral State Machine)

**Files:**
- Create: `src/lib/features/village/engine/systems/SocialSystem.ts`
- Create: `tests/unit/village/SocialSystem.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/village/SocialSystem.test.ts

import { describe, it, expect } from "vitest";
import { SocialSystem } from "$lib/features/village/engine/systems/SocialSystem";
import { createVillageWorld, createAvatarEntity } from "$lib/features/village/engine/VillageWorld";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";
import { createDefaultConfig } from "$lib/features/village/engine/VillageConfig";
import { IDLE_THRESHOLD_BASE } from "$lib/features/village/domain/village-constants";

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

describe("SocialSystem", () => {
  it("increments idle timer when idle", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig();
    const system = new SocialSystem(config);
    entity.social.state = "idle";
    entity.social.idleTimer = 0;

    system.tick(world, 1);

    expect(entity.social.idleTimer).toBe(1);
  });

  it("transitions from idle to seeking/wandering/performing after threshold", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig();
    const system = new SocialSystem(config);
    entity.social.state = "idle";
    entity.social.idleTimer = IDLE_THRESHOLD_BASE + 1;
    entity.social.interactionCooldown = 0;

    system.tick(world, 1);

    expect(["seeking", "wandering", "performing"]).toContain(entity.social.state);
  });

  it("decrements interaction cooldown each tick", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig();
    const system = new SocialSystem(config);
    entity.social.state = "idle";
    entity.social.interactionCooldown = 5;

    system.tick(world, 1);

    expect(entity.social.interactionCooldown).toBe(4);
  });

  it("pairs two seeking entities that are close", () => {
    const world = createVillageWorld();
    const entity1 = makeEntity(world, "A");
    const entity2 = makeEntity(world, "B");
    const config = createDefaultConfig();
    const system = new SocialSystem(config);

    // Place them near each other
    entity1.transform.x = 0; entity1.transform.z = 0;
    entity2.transform.x = 1; entity2.transform.z = 0;
    entity1.social.state = "seeking";
    entity2.social.state = "seeking";
    entity1.social.interactionCooldown = 0;
    entity2.social.interactionCooldown = 0;

    // Give them each a unique sequence so teaching can happen
    entity1.knowledge.knownSequences.set("seq1", {
      sequenceId: "seq1", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    });

    system.tick(world, 1);

    // They should have paired up (approaching each other)
    expect(entity1.social.state).toBe("approaching");
    expect(entity2.social.state).toBe("approaching");
    expect(entity1.social.partner).toBe(entity2.id);
    expect(entity2.social.partner).toBe(entity1.id);
  });

  it("transitions wandering entity back to idle on arrival", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig();
    const system = new SocialSystem(config);

    entity.social.state = "wandering";
    entity.transform.speed = 0; // already arrived

    system.tick(world, 1);

    expect(entity.social.state).toBe("idle");
  });

  it("does not transition entities in passing state", () => {
    const world = createVillageWorld();
    const entity = makeEntity(world);
    const config = createDefaultConfig();
    const system = new SocialSystem(config);

    entity.social.state = "passing";

    system.tick(world, 1);

    expect(entity.social.state).toBe("passing");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/village/SocialSystem.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/features/village/engine/systems/SocialSystem.ts

import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";
import {
  IDLE_THRESHOLD_BASE, INTERACTION_COOLDOWN_BASE,
  INVENTION_BASE_PROBABILITY,
} from "../../domain/village-constants";

const SEEK_RADIUS = 5; // world units — how far to look for partners

export class SocialSystem {
  constructor(private config: VillageConfig) {}

  tick(world: World<VillageEntity>, currentTick: number): void {
    for (const entity of world.entities) {
      if (entity.social.state === "passing") continue;

      // Decrement cooldown
      if (entity.social.interactionCooldown > 0) {
        entity.social.interactionCooldown--;
      }

      switch (entity.social.state) {
        case "idle":
          this.handleIdle(entity, world, currentTick);
          break;
        case "wandering":
          this.handleWandering(entity);
          break;
        case "seeking":
          this.handleSeeking(entity, world);
          break;
        case "approaching":
          this.handleApproaching(entity, world);
          break;
        case "socializing":
          this.handleSocializing(entity);
          break;
        case "practicing":
          this.handlePracticing(entity);
          break;
        case "performing":
          this.handlePerforming(entity);
          break;
        // teaching, learning, inventing handled by their own systems
      }
    }
  }

  private handleIdle(entity: VillageEntity, world: World<VillageEntity>, currentTick: number): void {
    entity.social.idleTimer++;

    const threshold = IDLE_THRESHOLD_BASE * (1 - entity.personality.sociability * 0.5);
    if (entity.social.idleTimer < threshold) return;
    if (entity.social.interactionCooldown > 0) return;

    entity.social.idleTimer = 0;

    // Decision: seek, wander, perform, or invent
    const roll = Math.random();
    const hasSequences = entity.knowledge.knownSequences.size > 0;
    const canInvent = entity.knowledge.knownSequences.size >= 2;

    if (canInvent && roll < entity.personality.creativity * INVENTION_BASE_PROBABILITY * 10) {
      entity.social.state = "inventing";
    } else if (hasSequences && roll < 0.2) {
      entity.social.state = "performing";
      entity.social.idleTimer = 0;
    } else if (roll < 0.6 + entity.personality.sociability * 0.3) {
      entity.social.state = "seeking";
    } else {
      this.startWandering(entity);
    }
  }

  private handleWandering(entity: VillageEntity): void {
    if (entity.transform.speed === 0) {
      entity.social.state = "idle";
      entity.social.idleTimer = 0;
    }
  }

  private handleSeeking(entity: VillageEntity, world: World<VillageEntity>): void {
    const candidates = world.entities.filter((other) =>
      other.id !== entity.id &&
      other.social.state === "seeking" &&
      other.social.interactionCooldown === 0 &&
      this.distance(entity, other) < SEEK_RADIUS
    );

    if (candidates.length === 0) {
      // Nobody around — wander instead
      this.startWandering(entity);
      return;
    }

    // Pick the closest candidate with the most novel knowledge
    const partner = candidates.reduce((best, candidate) => {
      const novelty = this.countNovelSequences(entity, candidate) +
                      this.countNovelSequences(candidate, entity);
      const bestNovelty = this.countNovelSequences(entity, best) +
                          this.countNovelSequences(best, entity);
      if (novelty > bestNovelty) return candidate;
      if (novelty === bestNovelty && this.distance(entity, candidate) < this.distance(entity, best)) return candidate;
      return best;
    });

    // Pair them
    entity.social.state = "approaching";
    entity.social.partner = partner.id;
    entity.transform.targetX = partner.transform.x;
    entity.transform.targetZ = partner.transform.z;
    entity.transform.speed = 1;

    partner.social.state = "approaching";
    partner.social.partner = entity.id;
    partner.transform.targetX = entity.transform.x;
    partner.transform.targetZ = entity.transform.z;
    partner.transform.speed = 1;
  }

  private handleApproaching(entity: VillageEntity, world: World<VillageEntity>): void {
    if (entity.transform.speed > 0) return; // still moving

    const partner = world.entities.find((e) => e.id === entity.social.partner);
    if (!partner || partner.social.state === "passing") {
      entity.social.state = "idle";
      entity.social.partner = null;
      return;
    }

    // Both arrived? Negotiate roles
    if (partner.transform.speed > 0) return; // wait for partner

    const entityCanTeach = this.countNovelSequences(partner, entity) > 0;
    const partnerCanTeach = this.countNovelSequences(entity, partner) > 0;

    if (entityCanTeach || partnerCanTeach) {
      // Whoever has more to offer teaches first
      const teacher = entityCanTeach && (!partnerCanTeach ||
        entity.knowledge.knownSequences.size >= partner.knowledge.knownSequences.size)
        ? entity : partner;
      const learner = teacher === entity ? partner : entity;

      // Pick a sequence the learner doesn't know
      const novelSequenceId = this.findNovelSequenceId(learner, teacher);
      if (novelSequenceId) {
        teacher.social.state = "teaching";
        learner.social.state = "learning";
        teacher.social.sequenceBeingTransferred = novelSequenceId;
        learner.social.sequenceBeingTransferred = novelSequenceId;
        teacher.social.teachingProgress = 0;
        learner.social.teachingProgress = 0;
        learner.social.currentBeatIndex = 0;
        learner.social.frustrationLevel = 0;

        // Face each other
        teacher.transform.facingAngle = Math.atan2(
          learner.transform.z - teacher.transform.z,
          learner.transform.x - teacher.transform.x
        );
        learner.transform.facingAngle = Math.atan2(
          teacher.transform.z - learner.transform.z,
          teacher.transform.x - learner.transform.x
        );
        return;
      }
    }

    // Nothing to teach — socialize
    entity.social.state = "socializing";
    partner.social.state = "socializing";
    entity.social.idleTimer = 0;
    partner.social.idleTimer = 0;
  }

  private handleSocializing(entity: VillageEntity): void {
    entity.social.idleTimer++;
    if (entity.social.idleTimer > 15) {
      entity.social.state = "idle";
      entity.social.partner = null;
      entity.social.idleTimer = 0;
      entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
    }
  }

  private handlePracticing(entity: VillageEntity): void {
    entity.social.idleTimer++;
    if (entity.social.idleTimer > 20) {
      entity.social.state = "idle";
      entity.social.idleTimer = 0;
      entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
    }
  }

  private handlePerforming(entity: VillageEntity): void {
    entity.social.idleTimer++;
    const maxDuration = entity.lifecycle.phase === "elder" ? 40 : 25;
    if (entity.social.idleTimer > maxDuration) {
      entity.social.state = "idle";
      entity.social.idleTimer = 0;
    }
  }

  private startWandering(entity: VillageEntity): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.config.arenaRadius * 0.6;
    entity.transform.targetX = Math.cos(angle) * dist;
    entity.transform.targetZ = Math.sin(angle) * dist;
    entity.transform.speed = 1;
    entity.social.state = "wandering";
  }

  private distance(a: VillageEntity, b: VillageEntity): number {
    const dx = a.transform.x - b.transform.x;
    const dz = a.transform.z - b.transform.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private countNovelSequences(learner: VillageEntity, teacher: VillageEntity): number {
    let count = 0;
    for (const id of teacher.knowledge.knownSequences.keys()) {
      if (!learner.knowledge.knownSequences.has(id)) count++;
    }
    return count;
  }

  private findNovelSequenceId(learner: VillageEntity, teacher: VillageEntity): string | null {
    for (const id of teacher.knowledge.knownSequences.keys()) {
      if (!learner.knowledge.knownSequences.has(id)) return id;
    }
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/village/SocialSystem.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/engine/systems/SocialSystem.ts tests/unit/village/SocialSystem.test.ts
git commit -m "feat(village): add SocialSystem behavioral state machine"
```

---

### Task 8: TeachingSystem

**Files:**
- Create: `src/lib/features/village/engine/systems/TeachingSystem.ts`
- Create: `tests/unit/village/TeachingSystem.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/village/TeachingSystem.test.ts

import { describe, it, expect } from "vitest";
import { TeachingSystem } from "$lib/features/village/engine/systems/TeachingSystem";
import { createVillageWorld, createAvatarEntity } from "$lib/features/village/engine/VillageWorld";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";
import { createDefaultConfig } from "$lib/features/village/engine/VillageConfig";
import type { VillageEventMap, LearnedSequence } from "$lib/features/village/domain/village-types";

function makeTeacherLearnerPair(world: ReturnType<typeof createVillageWorld>) {
  const gen = new PersonalityGenerator();
  const opts = {
    generation: 1, currentTick: 0, lifespanTicks: 600, arenaRadius: 8,
    personalityGenerator: gen, traitMean: 0.5, traitStdDev: 0.15,
  };

  const teacher = createAvatarEntity(world, { ...opts, name: "Teacher" });
  const learner = createAvatarEntity(world, { ...opts, name: "Learner" });

  // Give teacher a sequence
  const learned: LearnedSequence = {
    sequenceId: "seq1", proficiency: 1, source: "seed",
    learnedAt: 0, learnedFrom: null, lineage: [],
  };
  teacher.knowledge.knownSequences.set("seq1", learned);

  // Set up teaching state
  teacher.social.state = "teaching";
  learner.social.state = "learning";
  teacher.social.partner = learner.id;
  learner.social.partner = teacher.id;
  teacher.social.sequenceBeingTransferred = "seq1";
  learner.social.sequenceBeingTransferred = "seq1";
  learner.social.teachingProgress = 0;
  learner.social.currentBeatIndex = 0;
  learner.social.frustrationLevel = 0;

  // Force high learnSpeed and patience for predictable tests
  learner.personality.learnSpeed = 0.9;
  teacher.personality.patience = 0.9;

  return { teacher, learner };
}

function makeEmitter(): { emitter: any; events: Record<string, any[]> } {
  const events: Record<string, any[]> = {};
  return {
    events,
    emitter: {
      emit<K extends keyof VillageEventMap>(event: K, ...args: Parameters<VillageEventMap[K]>) {
        if (!events[event]) events[event] = [];
        events[event].push(args);
      },
    },
  };
}

describe("TeachingSystem", () => {
  it("advances teaching progress each tick", () => {
    const world = createVillageWorld();
    const { learner } = makeTeacherLearnerPair(world);
    const config = createDefaultConfig();
    const { emitter } = makeEmitter();
    const system = new TeachingSystem(config, emitter);

    system.tick(world, 1);

    expect(learner.social.teachingProgress).toBeGreaterThan(0);
  });

  it("completes teaching when proficiency reaches threshold", () => {
    const world = createVillageWorld();
    const { teacher, learner } = makeTeacherLearnerPair(world);
    const config = createDefaultConfig();
    const { emitter, events } = makeEmitter();
    const system = new TeachingSystem(config, emitter);

    // Force high progress
    learner.social.teachingProgress = 0.69;
    learner.personality.learnSpeed = 1;
    teacher.personality.patience = 1;

    // Tick until teaching completes (should happen quickly with max traits)
    for (let i = 0; i < 50; i++) {
      system.tick(world, i);
      if (learner.social.state !== "learning") break;
    }

    expect(learner.knowledge.knownSequences.has("seq1")).toBe(true);
    expect(learner.social.state).not.toBe("learning");
  });

  it("emits teaching:completed event", () => {
    const world = createVillageWorld();
    const { teacher, learner } = makeTeacherLearnerPair(world);
    const config = createDefaultConfig();
    const { emitter, events } = makeEmitter();
    const system = new TeachingSystem(config, emitter);

    learner.social.teachingProgress = 0.69;
    learner.personality.learnSpeed = 1;
    teacher.personality.patience = 1;

    for (let i = 0; i < 50; i++) {
      system.tick(world, i);
      if (learner.social.state !== "learning") break;
    }

    expect(events["teaching:completed"]?.length).toBeGreaterThan(0);
  });

  it("records lineage when sequence is learned", () => {
    const world = createVillageWorld();
    const { teacher, learner } = makeTeacherLearnerPair(world);
    const config = createDefaultConfig();
    const { emitter } = makeEmitter();
    const system = new TeachingSystem(config, emitter);

    learner.social.teachingProgress = 0.69;
    learner.personality.learnSpeed = 1;
    teacher.personality.patience = 1;

    for (let i = 0; i < 50; i++) {
      system.tick(world, i);
      if (learner.social.state !== "learning") break;
    }

    const learned = learner.knowledge.knownSequences.get("seq1");
    expect(learned?.learnedFrom).toBe(teacher.id);
    expect(learned?.source).toBe("taught");
    expect(learned?.lineage).toContain(teacher.id);
  });

  it("handles partner disappearing mid-teaching", () => {
    const world = createVillageWorld();
    const { teacher, learner } = makeTeacherLearnerPair(world);
    const config = createDefaultConfig();
    const { emitter } = makeEmitter();
    const system = new TeachingSystem(config, emitter);

    // Remove teacher from world
    world.remove(teacher);

    system.tick(world, 1);

    expect(learner.social.state).toBe("idle");
    expect(learner.social.partner).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/village/TeachingSystem.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/features/village/engine/systems/TeachingSystem.ts

import type { World } from "miniplex";
import type { VillageEntity, VillageEventMap, LearnedSequence } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";
import {
  TEACHING_SPEED_TICKS_PER_BEAT, PROFICIENCY_THRESHOLD,
  FUMBLE_BASE_PROBABILITY, FRUSTRATION_DECAY_RATE,
  FRUSTRATION_GIVE_UP_THRESHOLD, INTERACTION_COOLDOWN_BASE,
} from "../../domain/village-constants";

export interface VillageEventEmitter {
  emit<K extends keyof VillageEventMap>(event: K, ...args: Parameters<VillageEventMap[K]>): void;
}

export class TeachingSystem {
  constructor(
    private config: VillageConfig,
    private emitter: VillageEventEmitter
  ) {}

  tick(world: World<VillageEntity>, currentTick: number): void {
    // Process all learners (teachers are passive — their state is driven by the learner's progress)
    for (const learner of world.entities) {
      if (learner.social.state !== "learning") continue;

      const teacher = world.entities.find((e) => e.id === learner.social.partner);
      if (!teacher || teacher.social.state !== "teaching") {
        this.resetToIdle(learner);
        continue;
      }

      // Advance teaching progress
      const progressIncrement =
        (learner.personality.learnSpeed * teacher.personality.patience) /
        TEACHING_SPEED_TICKS_PER_BEAT *
        (0.5 + Math.random());

      // Fumble check
      const fumbleChance = (1 - learner.social.teachingProgress) * FUMBLE_BASE_PROBABILITY;
      if (Math.random() < fumbleChance) {
        learner.social.frustrationLevel = Math.min(1,
          learner.social.frustrationLevel + 0.15);
        this.emitter.emit("teaching:fumble", learner, learner.social.currentBeatIndex);

        // Chance to give up
        if (learner.social.frustrationLevel > FRUSTRATION_GIVE_UP_THRESHOLD &&
            Math.random() < (1 - teacher.personality.patience) * 0.3) {
          this.resetToIdle(learner);
          this.resetToIdle(teacher);
          continue;
        }
      } else {
        learner.social.teachingProgress += progressIncrement;
        learner.social.frustrationLevel = Math.max(0,
          learner.social.frustrationLevel - FRUSTRATION_DECAY_RATE);
      }

      // Teaching complete?
      if (learner.social.teachingProgress >= PROFICIENCY_THRESHOLD) {
        this.completeTeaching(teacher, learner, currentTick);
      }
    }
  }

  private completeTeaching(
    teacher: VillageEntity,
    learner: VillageEntity,
    currentTick: number
  ): void {
    const sequenceId = learner.social.sequenceBeingTransferred!;
    const teacherKnowledge = teacher.knowledge.knownSequences.get(sequenceId);
    if (!teacherKnowledge) {
      this.resetToIdle(learner);
      this.resetToIdle(teacher);
      return;
    }

    const learned: LearnedSequence = {
      sequenceId,
      proficiency: learner.social.teachingProgress,
      source: "taught",
      learnedAt: currentTick,
      learnedFrom: teacher.id,
      lineage: [...teacherKnowledge.lineage, teacher.id],
    };

    learner.knowledge.knownSequences.set(sequenceId, learned);
    this.emitter.emit("teaching:completed", teacher, learner, sequenceId);

    // Learner goes to practicing, teacher goes idle
    learner.social.state = "practicing";
    learner.social.idleTimer = 0;
    learner.social.partner = null;
    learner.social.sequenceBeingTransferred = null;

    teacher.social.state = "idle";
    teacher.social.idleTimer = 0;
    teacher.social.partner = null;
    teacher.social.sequenceBeingTransferred = null;
    teacher.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
  }

  private resetToIdle(entity: VillageEntity): void {
    entity.social.state = "idle";
    entity.social.partner = null;
    entity.social.teachingProgress = 0;
    entity.social.sequenceBeingTransferred = null;
    entity.social.frustrationLevel = 0;
    entity.social.currentBeatIndex = 0;
    entity.social.idleTimer = 0;
    entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/village/TeachingSystem.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/engine/systems/TeachingSystem.ts tests/unit/village/TeachingSystem.test.ts
git commit -m "feat(village): add TeachingSystem with proficiency, fumbles, and lineage"
```

---

### Task 9: RecombinationSystem

**Files:**
- Create: `src/lib/features/village/services/contracts/ISequenceMutator.ts`
- Create: `src/lib/features/village/services/implementations/SequenceMutator.ts`
- Create: `src/lib/features/village/engine/systems/RecombinationSystem.ts`
- Create: `tests/unit/village/RecombinationSystem.test.ts`

- [ ] **Step 1: Write ISequenceMutator interface**

```typescript
// src/lib/features/village/services/contracts/ISequenceMutator.ts

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export type MutationType = "mirror" | "flip" | "rotate" | "swap" | "invert" | "rewind";

export interface MutationResult {
  success: boolean;
  sequence: null; // Phase 1: no real sequence data, just IDs
  mutationType: MutationType;
  inventedId: string;
}

export interface ISequenceMutator {
  /**
   * Phase 1: synchronous, operates on sequence IDs only.
   * Phase 2+ will accept full SequenceData and wire to ISequenceTransformer.
   */
  tryInventFrom(sourceSequenceId: string): MutationResult;
}
```

- [ ] **Step 2: Write SequenceMutator implementation**

```typescript
// src/lib/features/village/services/implementations/SequenceMutator.ts

import type { ISequenceMutator, MutationType, MutationResult } from "../contracts/ISequenceMutator";

const MUTATION_TYPES: MutationType[] = ["mirror", "flip", "rotate", "swap", "invert", "rewind"];

/**
 * Phase 1: Lightweight synchronous mutator that generates novel sequence IDs.
 * Phase 2+ will wire to ISequenceTransformer for real structural transforms.
 */
export class SequenceMutator implements ISequenceMutator {
  tryInventFrom(sourceSequenceId: string): MutationResult {
    const type = MUTATION_TYPES[Math.floor(Math.random() * MUTATION_TYPES.length)];
    // Generate a deterministic-ish ID from source + transform type
    const newId = `${sourceSequenceId}:${type}`;
    return { success: true, sequence: null, mutationType: type, inventedId: newId };
  }
}
```

- [ ] **Step 3: Write RecombinationSystem and tests**

```typescript
// tests/unit/village/RecombinationSystem.test.ts

import { describe, it, expect, vi } from "vitest";
import { RecombinationSystem } from "$lib/features/village/engine/systems/RecombinationSystem";
import { createVillageWorld, createAvatarEntity } from "$lib/features/village/engine/VillageWorld";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";
import { createDefaultConfig } from "$lib/features/village/engine/VillageConfig";
import type { ISequenceMutator } from "$lib/features/village/services/contracts/ISequenceMutator";
import type { LearnedSequence } from "$lib/features/village/domain/village-types";

function makeMockMutator(): ISequenceMutator {
  return {
    tryInventFrom: vi.fn().mockReturnValue({
      success: true, sequence: null, mutationType: "mirror",
      inventedId: `invented-${Math.random().toString(36).slice(2, 6)}`,
    }),
  };
}

function makeEmitter() {
  const events: Record<string, any[]> = {};
  return {
    events,
    emitter: {
      emit(event: string, ...args: any[]) {
        if (!events[event]) events[event] = [];
        events[event].push(args);
      },
    },
  };
}

describe("RecombinationSystem", () => {
  it("processes entities in inventing state", () => {
    const world = createVillageWorld();
    const gen = new PersonalityGenerator();
    const entity = createAvatarEntity(world, {
      name: "Inventor",
      generation: 1,
      currentTick: 0,
      lifespanTicks: 600,
      arenaRadius: 8,
      personalityGenerator: gen,
      traitMean: 0.5,
      traitStdDev: 0.15,
    });

    // Give 2 sequences (minimum for invention)
    entity.knowledge.knownSequences.set("seq1", {
      sequenceId: "seq1", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    } as LearnedSequence);
    entity.knowledge.knownSequences.set("seq2", {
      sequenceId: "seq2", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    } as LearnedSequence);

    entity.social.state = "inventing";

    const mutator = makeMockMutator();
    const { emitter, events } = makeEmitter();
    const config = createDefaultConfig();
    const system = new RecombinationSystem(config, mutator, emitter as any);

    system.tick(world, 10);

    expect(mutator.tryInventFrom).toHaveBeenCalled();
  });

  it("adds invented sequence to knowledge", () => {
    const world = createVillageWorld();
    const gen = new PersonalityGenerator();
    const entity = createAvatarEntity(world, {
      name: "Inventor",
      generation: 1,
      currentTick: 0,
      lifespanTicks: 600,
      arenaRadius: 8,
      personalityGenerator: gen,
      traitMean: 0.5,
      traitStdDev: 0.15,
    });

    entity.knowledge.knownSequences.set("seq1", {
      sequenceId: "seq1", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    } as LearnedSequence);
    entity.knowledge.knownSequences.set("seq2", {
      sequenceId: "seq2", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    } as LearnedSequence);

    entity.social.state = "inventing";

    const mutator = makeMockMutator();
    const { emitter, events } = makeEmitter();
    const config = createDefaultConfig();
    const system = new RecombinationSystem(config, mutator, emitter as any);

    system.tick(world, 10);

    // Should have 3 sequences now (2 original + 1 invented)
    expect(entity.knowledge.knownSequences.size).toBe(3);
    expect(events["sequence:invented"]?.length).toBe(1);
  });

  it("transitions to idle after inventing", () => {
    const world = createVillageWorld();
    const gen = new PersonalityGenerator();
    const entity = createAvatarEntity(world, {
      name: "Inventor",
      generation: 1,
      currentTick: 0,
      lifespanTicks: 600,
      arenaRadius: 8,
      personalityGenerator: gen,
      traitMean: 0.5,
      traitStdDev: 0.15,
    });

    entity.knowledge.knownSequences.set("seq1", {
      sequenceId: "seq1", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    } as LearnedSequence);
    entity.knowledge.knownSequences.set("seq2", {
      sequenceId: "seq2", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    } as LearnedSequence);

    entity.social.state = "inventing";

    const mutator = makeMockMutator();
    const { emitter } = makeEmitter();
    const config = createDefaultConfig();
    const system = new RecombinationSystem(config, mutator, emitter as any);

    system.tick(world, 10);

    expect(entity.social.state).toBe("idle");
  });

  it("skips if mutation fails", () => {
    const world = createVillageWorld();
    const gen = new PersonalityGenerator();
    const entity = createAvatarEntity(world, {
      name: "Inventor",
      generation: 1,
      currentTick: 0,
      lifespanTicks: 600,
      arenaRadius: 8,
      personalityGenerator: gen,
      traitMean: 0.5,
      traitStdDev: 0.15,
    });

    entity.knowledge.knownSequences.set("seq1", {
      sequenceId: "seq1", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    } as LearnedSequence);
    entity.knowledge.knownSequences.set("seq2", {
      sequenceId: "seq2", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    } as LearnedSequence);

    entity.social.state = "inventing";

    const mutator: ISequenceMutator = {
      tryInventFrom: vi.fn().mockReturnValue({
        success: false, sequence: null, mutationType: "mirror", inventedId: "",
      }),
    };
    const { emitter, events } = makeEmitter();
    const config = createDefaultConfig();
    const system = new RecombinationSystem(config, mutator, emitter as any);

    system.tick(world, 10);

    // Still only 2 sequences
    expect(entity.knowledge.knownSequences.size).toBe(2);
    expect(events["sequence:invented"]).toBeUndefined();
    expect(entity.social.state).toBe("idle");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/unit/village/RecombinationSystem.test.ts`
Expected: FAIL

- [ ] **Step 5: Write RecombinationSystem implementation**

```typescript
// src/lib/features/village/engine/systems/RecombinationSystem.ts

import type { World } from "miniplex";
import type { VillageEntity, LearnedSequence } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";
import type { ISequenceMutator } from "../../services/contracts/ISequenceMutator";
import type { VillageEventEmitter } from "./TeachingSystem";
import { INTERACTION_COOLDOWN_BASE } from "../../domain/village-constants";

export class RecombinationSystem {
  constructor(
    private config: VillageConfig,
    private mutator: ISequenceMutator,
    private emitter: VillageEventEmitter
  ) {}

  tick(world: World<VillageEntity>, currentTick: number): void {
    // Synchronous — Phase 1 mutator operates on IDs only
    for (const entity of world.entities) {
      if (entity.social.state !== "inventing") continue;

      const sequences = Array.from(entity.knowledge.knownSequences.values());
      if (sequences.length < 2) {
        entity.social.state = "idle";
        continue;
      }

      // Pick a random sequence to mutate
      const source = sequences[Math.floor(Math.random() * sequences.length)];

      const result = this.mutator.tryInventFrom(source.sequenceId);

      if (result.success) {
        const newId = result.inventedId;

        // Check novelty (avatar doesn't already know this exact mutation)
        if (!entity.knowledge.knownSequences.has(newId) &&
            entity.knowledge.knownSequences.size < entity.knowledge.maxCapacity) {
          const learned: LearnedSequence = {
            sequenceId: newId,
            proficiency: 0.5, // invented, not fully polished
            source: "invented",
            learnedAt: currentTick,
            learnedFrom: null,
            lineage: [],
          };
          entity.knowledge.knownSequences.set(newId, learned);
          this.emitter.emit("sequence:invented", entity, newId);
        }
      }

      entity.social.state = "idle";
      entity.social.idleTimer = 0;
      entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
    }
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/village/RecombinationSystem.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/village/services/ src/lib/features/village/engine/systems/RecombinationSystem.ts tests/unit/village/RecombinationSystem.test.ts
git commit -m "feat(village): add RecombinationSystem + SequenceMutator for LOOP-transform invention"
```

---

### Task 10: PopulationSystem

**Files:**
- Create: `src/lib/features/village/engine/systems/PopulationSystem.ts`
- Create: `src/lib/features/village/services/contracts/ILineageTracker.ts`
- Create: `src/lib/features/village/services/implementations/LineageTracker.ts`
- Create: `tests/unit/village/PopulationSystem.test.ts`

- [ ] **Step 1: Write LineageTracker**

```typescript
// src/lib/features/village/services/contracts/ILineageTracker.ts

import type { PopulationStats, VillageEntity } from "../../domain/village-types";

export interface ILineageTracker {
  recordBirth(entity: VillageEntity): void;
  recordDeath(entity: VillageEntity): void;
  recordSequenceLearned(entityId: string, sequenceId: string): void;
  recordSequenceInvented(entityId: string, sequenceId: string): void;
  getStats(entities: VillageEntity[], generation: number): PopulationStats;
  getSequenceLineage(sequenceId: string): string[]; // entity ids in transmission order
  getAllKnownSequenceIds(): Set<string>;
}
```

```typescript
// src/lib/features/village/services/implementations/LineageTracker.ts

import type { ILineageTracker } from "../contracts/ILineageTracker";
import type { PopulationStats, VillageEntity } from "../../domain/village-types";

export class LineageTracker implements ILineageTracker {
  private everKnownSequences = new Set<string>();
  private sequenceTransmissions = new Map<string, string[]>(); // sequenceId → [entityIds]
  private totalBirths = 0;
  private totalDeaths = 0;

  recordBirth(entity: VillageEntity): void {
    this.totalBirths++;
    for (const id of entity.knowledge.knownSequences.keys()) {
      this.everKnownSequences.add(id);
    }
  }

  recordDeath(entity: VillageEntity): void {
    this.totalDeaths++;
  }

  recordSequenceLearned(entityId: string, sequenceId: string): void {
    this.everKnownSequences.add(sequenceId);
    const chain = this.sequenceTransmissions.get(sequenceId) ?? [];
    chain.push(entityId);
    this.sequenceTransmissions.set(sequenceId, chain);
  }

  recordSequenceInvented(entityId: string, sequenceId: string): void {
    this.everKnownSequences.add(sequenceId);
    this.sequenceTransmissions.set(sequenceId, [entityId]);
  }

  getStats(entities: VillageEntity[], generation: number): PopulationStats {
    const alive = entities.length;
    const totalAge = entities.reduce((sum, e) => sum + e.lifecycle.currentAge, 0);
    const currentlyKnown = new Set<string>();
    let totalKnowledge = 0;

    for (const entity of entities) {
      totalKnowledge += entity.knowledge.knownSequences.size;
      for (const id of entity.knowledge.knownSequences.keys()) {
        currentlyKnown.add(id);
      }
    }

    // Extinct = was known at some point, no longer known by anyone alive
    let extinctionCount = 0;
    for (const id of this.everKnownSequences) {
      if (!currentlyKnown.has(id)) extinctionCount++;
    }

    return {
      alive,
      averageAge: alive > 0 ? totalAge / alive : 0,
      totalKnowledge,
      uniqueSequences: currentlyKnown.size,
      extinctionCount,
      currentGeneration: generation,
    };
  }

  getSequenceLineage(sequenceId: string): string[] {
    return this.sequenceTransmissions.get(sequenceId) ?? [];
  }

  getAllKnownSequenceIds(): Set<string> {
    return new Set(this.everKnownSequences);
  }
}
```

- [ ] **Step 2: Write PopulationSystem and tests**

```typescript
// tests/unit/village/PopulationSystem.test.ts

import { describe, it, expect } from "vitest";
import { PopulationSystem } from "$lib/features/village/engine/systems/PopulationSystem";
import { createVillageWorld, createAvatarEntity } from "$lib/features/village/engine/VillageWorld";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";
import { LineageTracker } from "$lib/features/village/services/implementations/LineageTracker";
import { createDefaultConfig } from "$lib/features/village/engine/VillageConfig";
import { PASSING_DURATION_TICKS } from "$lib/features/village/domain/village-constants";

function makeEmitter() {
  const events: Record<string, any[]> = {};
  return {
    events,
    emitter: {
      emit(event: string, ...args: any[]) {
        if (!events[event]) events[event] = [];
        events[event].push(args);
      },
    },
  };
}

describe("PopulationSystem", () => {
  it("removes entities that have finished passing", () => {
    const world = createVillageWorld();
    const gen = new PersonalityGenerator();
    const entity = createAvatarEntity(world, {
      name: "Dying",
      generation: 1,
      currentTick: 0,
      lifespanTicks: 600,
      arenaRadius: 8,
      personalityGenerator: gen,
      traitMean: 0.5,
      traitStdDev: 0.15,
    });

    entity.social.state = "passing";
    entity.social.idleTimer = PASSING_DURATION_TICKS + 1;

    const config = createDefaultConfig({ targetPopulation: 1 });
    const tracker = new LineageTracker();
    const { emitter, events } = makeEmitter();
    const system = new PopulationSystem(config, gen, tracker, emitter as any);

    system.tick(world, 100);

    // Old entity should be removed, new one spawned
    expect(events["entity:died"]?.length).toBe(1);
    expect(events["entity:born"]?.length).toBe(1);
    expect(world.entities.length).toBe(1);
    // The entity in world should be the new one, not the old
    expect(world.entities[0].id).not.toBe(entity.id);
  });

  it("spawns new entities to maintain target population", () => {
    const world = createVillageWorld();
    const gen = new PersonalityGenerator();
    const config = createDefaultConfig({ targetPopulation: 4 });
    const tracker = new LineageTracker();
    const { emitter } = makeEmitter();
    const system = new PopulationSystem(config, gen, tracker, emitter as any);

    // Start with 0, should spawn up to target
    system.tick(world, 0);

    expect(world.entities.length).toBe(4);
  });

  it("increments passing timer for passing entities", () => {
    const world = createVillageWorld();
    const gen = new PersonalityGenerator();
    const entity = createAvatarEntity(world, {
      name: "Dying",
      generation: 1,
      currentTick: 0,
      lifespanTicks: 600,
      arenaRadius: 8,
      personalityGenerator: gen,
      traitMean: 0.5,
      traitStdDev: 0.15,
    });

    entity.social.state = "passing";
    entity.social.idleTimer = 0;

    const config = createDefaultConfig({ targetPopulation: 1 });
    const tracker = new LineageTracker();
    const { emitter } = makeEmitter();
    const system = new PopulationSystem(config, gen, tracker, emitter as any);

    system.tick(world, 1);

    expect(entity.social.idleTimer).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/village/PopulationSystem.test.ts`
Expected: FAIL

- [ ] **Step 4: Write PopulationSystem implementation**

```typescript
// src/lib/features/village/engine/systems/PopulationSystem.ts

import type { World } from "miniplex";
import type { VillageEntity } from "../../domain/village-types";
import type { VillageConfig } from "../VillageConfig";
import type { IPersonalityGenerator } from "../../services/contracts/IPersonalityGenerator";
import type { ILineageTracker } from "../../services/contracts/ILineageTracker";
import type { VillageEventEmitter } from "./TeachingSystem";
import { createAvatarEntity } from "../VillageWorld";
import { AVATAR_NAMES, PASSING_DURATION_TICKS } from "../../domain/village-constants";

export class PopulationSystem {
  private generation = 1;
  private nameIndex = 0;

  constructor(
    private config: VillageConfig,
    private personalityGenerator: IPersonalityGenerator,
    private lineageTracker: ILineageTracker,
    private emitter: VillageEventEmitter
  ) {}

  get currentGeneration(): number {
    return this.generation;
  }

  tick(world: World<VillageEntity>, currentTick: number): void {
    // Process passing entities
    const toRemove: VillageEntity[] = [];
    for (const entity of world.entities) {
      if (entity.social.state === "passing") {
        entity.social.idleTimer++;
        if (entity.social.idleTimer > PASSING_DURATION_TICKS) {
          toRemove.push(entity);
        }
      }
    }

    // Remove dead entities
    for (const entity of toRemove) {
      this.lineageTracker.recordDeath(entity);
      this.emitter.emit("entity:died", entity);
      world.remove(entity);
    }

    // Spawn new entities to maintain population
    while (world.entities.length < this.config.targetPopulation) {
      const name = AVATAR_NAMES[this.nameIndex % AVATAR_NAMES.length];
      this.nameIndex++;

      const newEntity = createAvatarEntity(world, {
        name,
        generation: this.generation,
        currentTick,
        lifespanTicks: this.config.lifespanTicks,
        arenaRadius: this.config.arenaRadius,
        personalityGenerator: this.personalityGenerator,
        traitMean: this.config.traitDistribution.mean,
        traitStdDev: this.config.traitDistribution.stdDev,
      });

      this.lineageTracker.recordBirth(newEntity);
      this.emitter.emit("entity:born", newEntity);

      // Check if this represents a new generation
      const maxGen = Math.max(...world.entities.map((e) => e.identity.generation));
      if (maxGen > this.generation) {
        this.generation = maxGen;
        this.emitter.emit("generation:changed", this.generation);
      }
    }
  }

  incrementGeneration(): void {
    this.generation++;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/village/PopulationSystem.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/village/services/ src/lib/features/village/engine/systems/PopulationSystem.ts tests/unit/village/PopulationSystem.test.ts
git commit -m "feat(village): add PopulationSystem + LineageTracker for generational management"
```

---

### Task 11: VillageOrchestrator (Integration)

**Files:**
- Create: `src/lib/features/village/engine/VillageOrchestrator.ts`
- Create: `tests/unit/village/VillageOrchestrator.test.ts`

- [ ] **Step 1: Write failing integration tests**

```typescript
// tests/unit/village/VillageOrchestrator.test.ts

import { describe, it, expect, vi } from "vitest";
import { VillageOrchestrator } from "$lib/features/village/engine/VillageOrchestrator";
import { createDefaultConfig } from "$lib/features/village/engine/VillageConfig";
import type { ISequenceMutator } from "$lib/features/village/services/contracts/ISequenceMutator";

function makeMockMutator(): ISequenceMutator {
  return {
    tryInventFrom: vi.fn().mockReturnValue({
      success: true, sequence: null, mutationType: "mirror",
      inventedId: `invented-${Math.random().toString(36).slice(2, 6)}`,
    }),
  };
}

describe("VillageOrchestrator", () => {
  it("initializes with target population", () => {
    const config = createDefaultConfig({ targetPopulation: 6 });
    const orchestrator = new VillageOrchestrator(config, makeMockMutator());
    orchestrator.initialize();

    expect(orchestrator.entities.length).toBe(6);
  });

  it("advances time on tick", () => {
    const config = createDefaultConfig({ targetPopulation: 4 });
    const orchestrator = new VillageOrchestrator(config, makeMockMutator());
    orchestrator.initialize();

    orchestrator.tick();

    expect(orchestrator.currentTick).toBe(1);
  });

  it("maintains population over many ticks", () => {
    const config = createDefaultConfig({
      targetPopulation: 4,
      lifespanTicks: 50,
    });
    const orchestrator = new VillageOrchestrator(config, makeMockMutator());
    orchestrator.initialize();

    // Run enough ticks for entities to die and be replaced
    for (let i = 0; i < 100; i++) {
      orchestrator.tick();
    }

    expect(orchestrator.entities.length).toBe(4);
  });

  it("emits events that can be subscribed to", () => {
    const config = createDefaultConfig({ targetPopulation: 2 });
    const orchestrator = new VillageOrchestrator(config, makeMockMutator());
    const births: any[] = [];
    orchestrator.on("entity:born", (entity) => births.push(entity));

    orchestrator.initialize();

    expect(births.length).toBe(2);
  });

  it("produces population stats", () => {
    const config = createDefaultConfig({ targetPopulation: 4 });
    const orchestrator = new VillageOrchestrator(config, makeMockMutator());
    orchestrator.initialize();

    const stats = orchestrator.populationStats;
    expect(stats.alive).toBe(4);
    expect(stats.averageAge).toBeGreaterThanOrEqual(0);
  });

  it("cleans up on destroy", () => {
    const config = createDefaultConfig({ targetPopulation: 4 });
    const orchestrator = new VillageOrchestrator(config, makeMockMutator());
    orchestrator.initialize();
    orchestrator.run(10);

    orchestrator.destroy();

    // Ticking after destroy should not throw
    expect(() => orchestrator.tick()).not.toThrow();
  });

  it("runs multi-generation simulation with knowledge spread", () => {
    const config = createDefaultConfig({
      targetPopulation: 6,
      lifespanTicks: 80,
    });
    const orchestrator = new VillageOrchestrator(config, makeMockMutator());
    orchestrator.initialize();

    // Seed some sequences
    const entities = orchestrator.entities;
    entities[0].knowledge.knownSequences.set("seed1", {
      sequenceId: "seed1", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    });
    entities[1].knowledge.knownSequences.set("seed2", {
      sequenceId: "seed2", proficiency: 1, source: "seed",
      learnedAt: 0, learnedFrom: null, lineage: [],
    });

    // Run 500 ticks (several lifetimes)
    for (let i = 0; i < 500; i++) {
      orchestrator.tick();
    }

    const stats = orchestrator.populationStats;
    // Knowledge should have spread — at least some avatars should know sequences
    expect(stats.totalKnowledge).toBeGreaterThan(0);
    expect(stats.alive).toBe(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/village/VillageOrchestrator.test.ts`
Expected: FAIL

- [ ] **Step 3: Write VillageOrchestrator implementation**

```typescript
// src/lib/features/village/engine/VillageOrchestrator.ts

import type { World } from "miniplex";
import type {
  VillageEntity, VillageEventMap, VillageEventKey, PopulationStats,
} from "../domain/village-types";
import type { VillageConfig } from "./VillageConfig";
import type { ISequenceMutator } from "../services/contracts/ISequenceMutator";
import type { VillageEventEmitter } from "./systems/TeachingSystem";
import { createVillageWorld } from "./VillageWorld";
import { PersonalityGenerator } from "../services/implementations/PersonalityGenerator";
import { LineageTracker } from "../services/implementations/LineageTracker";
import { LifecycleSystem } from "./systems/LifecycleSystem";
import { MovementSystem } from "./systems/MovementSystem";
import { SocialSystem } from "./systems/SocialSystem";
import { TeachingSystem } from "./systems/TeachingSystem";
import { RecombinationSystem } from "./systems/RecombinationSystem";
import { PopulationSystem } from "./systems/PopulationSystem";

type Listener<K extends VillageEventKey> = VillageEventMap[K];

export class VillageOrchestrator implements VillageEventEmitter {
  private world: World<VillageEntity>;
  private lifecycleSystem: LifecycleSystem;
  private movementSystem: MovementSystem;
  private socialSystem: SocialSystem;
  private teachingSystem: TeachingSystem;
  private recombinationSystem: RecombinationSystem;
  private populationSystem: PopulationSystem;
  private lineageTracker: LineageTracker;
  private personalityGenerator: PersonalityGenerator;

  private listeners = new Map<string, Set<Function>>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private _currentTick = 0;
  private destroyed = false;

  constructor(
    private config: VillageConfig,
    private mutator: ISequenceMutator
  ) {
    this.world = createVillageWorld();
    this.personalityGenerator = new PersonalityGenerator();
    this.lineageTracker = new LineageTracker();

    this.lifecycleSystem = new LifecycleSystem(config);
    this.movementSystem = new MovementSystem(config);
    this.socialSystem = new SocialSystem(config);
    this.teachingSystem = new TeachingSystem(config, this);
    this.recombinationSystem = new RecombinationSystem(config, mutator, this);
    this.populationSystem = new PopulationSystem(
      config, this.personalityGenerator, this.lineageTracker, this
    );
  }

  initialize(): void {
    this.populationSystem.tick(this.world, 0);
  }

  tick(): void {
    if (this.destroyed) return;
    this._currentTick++;

    this.lifecycleSystem.tick(this.world, this._currentTick);
    this.socialSystem.tick(this.world, this._currentTick);
    this.teachingSystem.tick(this.world, this._currentTick);
    this.recombinationSystem.tick(this.world, this._currentTick);
    this.movementSystem.tick(this.world);
    this.populationSystem.tick(this.world, this._currentTick);
  }

  run(ticksPerSecond: number): void {
    this.pause();
    const interval = Math.round(1000 / ticksPerSecond);
    this.intervalId = setInterval(() => this.tick(), interval);
  }

  pause(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset(): void {
    this.pause();
    this._currentTick = 0;
    // Clear world
    for (const entity of [...this.world.entities]) {
      this.world.remove(entity);
    }
    this.lineageTracker = new LineageTracker();
    this.populationSystem = new PopulationSystem(
      this.config, this.personalityGenerator, this.lineageTracker, this
    );
    this.initialize();
  }

  destroy(): void {
    this.pause();
    this.destroyed = true;
    this.listeners.clear();
    for (const entity of [...this.world.entities]) {
      this.world.remove(entity);
    }
  }

  // Event emitter
  emit<K extends VillageEventKey>(event: K, ...args: Parameters<VillageEventMap[K]>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        (handler as Function)(...args);
      }
    }
  }

  on<K extends VillageEventKey>(event: K, handler: VillageEventMap[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Function);
  }

  off<K extends VillageEventKey>(event: K, handler: VillageEventMap[K]): void {
    this.listeners.get(event)?.delete(handler as Function);
  }

  // Getters
  get currentTick(): number { return this._currentTick; }
  get currentGeneration(): number { return this.populationSystem.currentGeneration; }
  get entities(): VillageEntity[] { return this.world.entities; }
  get populationStats(): PopulationStats {
    return this.lineageTracker.getStats(this.world.entities, this.currentGeneration);
  }

  // God mode
  inspectAvatar(entityId: string): VillageEntity | null {
    return this.world.entities.find((e) => e.id === entityId) ?? null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/village/VillageOrchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/engine/VillageOrchestrator.ts tests/unit/village/VillageOrchestrator.test.ts
git commit -m "feat(village): add VillageOrchestrator integrating all systems"
```

---

### Task 12: Lab Tab Registration

**Files:**
- Modify: `src/lib/features/lab/LabModule.svelte:17-41`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts:931`
- Create: `src/lib/features/village/VillageLabTab.svelte` (placeholder)

- [ ] **Step 1: Create placeholder VillageLabTab**

```svelte
<!-- src/lib/features/village/VillageLabTab.svelte -->
<script lang="ts">
  // Placeholder — Phase 2+ will add the Threlte scene and controls
</script>

<div class="village-lab">
  <p>TKA Village — engine built, renderer coming soon</p>
</div>

<style>
  .village-lab {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
  }
</style>
```

- [ ] **Step 2: Add tab import to LabModule.svelte**

Add after `"mandala-drawing"` entry (line 38):

```typescript
village: () => import("$lib/features/village/VillageLabTab.svelte"),
```

- [ ] **Step 3: Add tab definition to tab-definitions.ts**

Add before the closing `];` of LAB_TABS (after the "vtg" entry, line 931):

```typescript
{
  id: "village",
  label: "Village",
  icon: '<i class="fas fa-users" style="color: #e8a87c;" aria-hidden="true"></i>',
  description: "Generational cultural simulation",
  color: "#e8a87c",
  gradient: "linear-gradient(135deg, #e8a87c 0%, #d4886a 100%)",
},
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/VillageLabTab.svelte src/lib/features/lab/LabModule.svelte src/lib/shared/navigation/config/tab-definitions.ts
git commit -m "feat(village): register Village lab tab with placeholder component"
```

---

### Task 13: Run Full Test Suite

- [ ] **Step 1: Run all village tests**

Run: `npx vitest run tests/unit/village/`
Expected: All tests pass

- [ ] **Step 2: Run full project tests to check for regressions**

Run: `npx vitest run`
Expected: No regressions

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors
