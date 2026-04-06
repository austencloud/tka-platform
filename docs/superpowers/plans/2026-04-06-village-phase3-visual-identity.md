# Village Phase 3: Visual Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visual aging (height/speed/glow), monument relight animation, and style schools with lineage drift to the TKA Village simulation.

**Architecture:** Three independent features that share the village ECS + renderer bridge. Visual Aging modifies VillageAvatar rendering. Monument relight adds an animation flash to VillageMonument. Style Schools adds a new `StyleSignature` type to `LearnedSequence`, a new `StyleDriftSystem` engine system, and visual school tints on avatars. All headless systems (MonumentSystem, etc.) are already built; this plan adds visual polish and the Style Schools subsystem.

**Tech Stack:** Svelte 5 + Threlte + Miniplex ECS, Vitest for tests

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `domain/village-types.ts` | MODIFY | Add `StyleSignature` to `LearnedSequence`, add `StyleSchool` interface |
| `domain/village-constants.ts` | MODIFY | Add style drift constants |
| `engine/systems/StyleDriftSystem.ts` | CREATE | Detect style clusters, assign school IDs, emit events |
| `engine/VillageOrchestrator.ts` | MODIFY | Add StyleDriftSystem to tick loop |
| `engine/systems/TeachingSystem.ts` | MODIFY | Apply style inheritance + mutation on teaching complete |
| `engine/systems/SocialSystem.ts` | MODIFY | Style compatibility check before teaching pair formation |
| `components/VillageAvatar.svelte` | MODIFY | Elder animation amplitude, youth wobble, school tint overlay |
| `components/VillageMonument.svelte` | MODIFY | Add relight flash animation |
| `state/village-visual-state.svelte.ts` | MODIFY | Add `showSchoolTints` toggle, `relightingMonuments` set |
| `tests/unit/village/StyleDriftSystem.test.ts` | CREATE | Style cluster detection, school assignment |
| `tests/unit/village/StyleInheritance.test.ts` | CREATE | Teaching applies style mutation, compatibility gates |

**Key paths (for reference):**
- Village root: `src/lib/features/village/`
- Tests: `tests/unit/village/`
- Types: `src/lib/features/village/domain/village-types.ts`
- Constants: `src/lib/features/village/domain/village-constants.ts`
- Orchestrator: `src/lib/features/village/engine/VillageOrchestrator.ts`

---

### Task 1: Add StyleSignature to LearnedSequence

**Files:**
- Modify: `src/lib/features/village/domain/village-types.ts`
- Modify: `src/lib/features/village/domain/village-constants.ts`

- [ ] **Step 1: Add StyleSignature type and extend LearnedSequence**

In `village-types.ts`, add the `StyleSignature` interface before `LearnedSequence`:

```typescript
export interface StyleSignature {
  amplitudeScale: number;  // 0.8-1.2, how big the movements are
  tempoOffset: number;     // -0.1 to 0.1, slightly faster/slower
}
```

Add `style: StyleSignature` to `LearnedSequence`:

```typescript
export interface LearnedSequence {
  // ... existing fields ...
  lastUsedTick: number;
  style: StyleSignature; // teaching lineage drift
}
```

Add `StyleSchool` interface:

```typescript
export interface StyleSchool {
  id: string;           // hash of founding teacher's entity id
  color: string;        // derived tint color
  memberIds: Set<string>; // entity ids in this school
}
```

Add new events to `VillageEventMap`:

```typescript
"school:formed": (school: StyleSchool) => void;
"school:dissolved": (schoolId: string) => void;
```

Import `StyleSchool` at the top of the event map section.

- [ ] **Step 2: Add style drift constants**

In `village-constants.ts`, add:

```typescript
// Style drift
export const STYLE_MUTATION_STDDEV = 0.02;
export const STYLE_SIMILARITY_THRESHOLD = 0.08;
export const STYLE_SCHOOL_MIN_MEMBERS = 3;
export const STYLE_INCOMPATIBILITY_REFUSE_CHANCE = 0.1;
export const STYLE_INCOMPATIBILITY_THRESHOLD = 0.3;
```

- [ ] **Step 3: Update all LearnedSequence creation sites**

Every place that creates a `LearnedSequence` literal needs a `style` field. Search for `source:` in these files and add `style: { amplitudeScale: 1.0, tempoOffset: 0 }` as the default.

Files to update:
- `engine/systems/TeachingSystem.ts` line 89 (completeTeaching)
- `engine/systems/SocialSystem.ts` line 274 (gift creation)
- `engine/systems/ProximityLearningSystem.ts` (absorption completion)
- `engine/systems/PopulationSystem.ts` (seed sequences, reincarnation echo)
- `engine/systems/FuneralSystem.ts` (fragmented memory)
- All test files that create `LearnedSequence` literals (MonumentSystem.test.ts, DecaySystem.test.ts, etc.)

For each, add:

```typescript
style: { amplitudeScale: 1.0, tempoOffset: 0 },
```

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `npm test -- --run`
Expected: All existing tests pass (the new field is additive).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/domain/village-types.ts src/lib/features/village/domain/village-constants.ts src/lib/features/village/engine/systems/TeachingSystem.ts src/lib/features/village/engine/systems/SocialSystem.ts src/lib/features/village/engine/systems/ProximityLearningSystem.ts src/lib/features/village/engine/systems/PopulationSystem.ts src/lib/features/village/engine/systems/FuneralSystem.ts tests/unit/village/
git commit -m "feat(village): add StyleSignature type to LearnedSequence for lineage drift"
```

---

### Task 2: Style Inheritance in TeachingSystem

**Files:**
- Modify: `src/lib/features/village/engine/systems/TeachingSystem.ts`
- Test: `tests/unit/village/StyleInheritance.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/village/StyleInheritance.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TeachingSystem } from "$lib/features/village/engine/systems/TeachingSystem";
import {
  createVillageWorld,
  createAvatarEntity,
} from "$lib/features/village/engine/VillageWorld";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";
import { STYLE_MUTATION_STDDEV } from "$lib/features/village/domain/village-constants";
import type {
  VillageEventMap,
  VillageEventKey,
} from "$lib/features/village/domain/village-types";

type EventHandler = (...args: unknown[]) => void;

function makeEmitter() {
  const events: Record<string, unknown[][]> = {};
  const handlers: Record<string, EventHandler[]> = {};
  return {
    events,
    emitter: {
      emit<K extends VillageEventKey>(
        event: K,
        ...args: Parameters<VillageEventMap[K]>
      ) {
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

function makeEntity(
  world: ReturnType<typeof createVillageWorld>,
  name = "Test",
  generation = 1,
) {
  return createAvatarEntity(world, {
    name,
    generation,
    currentTick: 0,
    lifespanTicks: 600,
    arenaRadius: 8,
    personalityGenerator: new PersonalityGenerator(),
    traitMean: 0.5,
    traitStdDev: 0.15,
  });
}

const defaultConfig = {
  targetPopulation: 8,
  initialSeedSequences: [],
  lifespanTicks: 600,
  ticksPerSecond: 10,
  traitDistribution: { mean: 0.5, stdDev: 0.15 },
  lossyTransmissionRate: 0.1,
  inventionRate: 0.005,
  arenaRadius: 8,
  youthPhaseRatio: 0.1,
  adultPhaseRatio: 0.7,
  elderPhaseRatio: 0.2,
};

describe("Style Inheritance", () => {
  it("learner receives teacher's style with small mutation", () => {
    const world = createVillageWorld();
    const { emitter } = makeEmitter();
    const system = new TeachingSystem(defaultConfig, emitter);

    const teacher = makeEntity(world, "Teacher");
    const learner = makeEntity(world, "Learner");

    // Teacher knows a sequence with a distinctive style
    teacher.knowledge.knownSequences.set("seq-A", {
      sequenceId: "seq-A",
      sequenceData: null,
      proficiency: 0.9,
      source: "seed",
      learnedAt: 0,
      learnedFrom: null,
      lineage: [],
      lastUsedTick: 0,
      style: { amplitudeScale: 1.15, tempoOffset: 0.05 },
    });

    // Wire up teaching state
    teacher.social.state = "teaching";
    learner.social.state = "learning";
    teacher.social.partner = learner.id;
    learner.social.partner = teacher.id;
    teacher.social.sequenceBeingTransferred = "seq-A";
    learner.social.sequenceBeingTransferred = "seq-A";
    learner.social.teachingProgress = 0.69; // just below threshold

    // One tick should push progress past 0.7 and complete teaching
    // (learnSpeed * patience / ticksPerBeat * random is variable,
    //  so set learnSpeed and patience high to guarantee completion)
    learner.personality.learnSpeed = 1.0;
    teacher.personality.patience = 1.0;

    // Run many ticks to ensure completion
    for (let i = 0; i < 20; i++) {
      system.tick(world, i + 1);
      if (learner.knowledge.knownSequences.has("seq-A")) break;
    }

    const learned = learner.knowledge.knownSequences.get("seq-A");
    expect(learned).toBeDefined();
    expect(learned!.style).toBeDefined();

    // Style should be close to teacher's but not identical (mutation applied)
    const diff = Math.abs(learned!.style.amplitudeScale - 1.15);
    // With stddev 0.02, 99.7% of values are within 3*stddev = 0.06
    expect(diff).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/village/StyleInheritance.test.ts`
Expected: FAIL — the `style` field on learned sequence will be the default `{ amplitudeScale: 1.0, tempoOffset: 0 }`, not derived from teacher.

- [ ] **Step 3: Add style inheritance to TeachingSystem.completeTeaching**

In `src/lib/features/village/engine/systems/TeachingSystem.ts`, add this import at the top:

```typescript
import { STYLE_MUTATION_STDDEV } from "../../domain/village-constants";
```

Add a private method:

```typescript
private inheritStyle(teacherStyle: { amplitudeScale: number; tempoOffset: number }): { amplitudeScale: number; tempoOffset: number } {
  // Box-Muller transform for gaussian random
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

  return {
    amplitudeScale: Math.max(0.8, Math.min(1.2,
      teacherStyle.amplitudeScale + z0 * STYLE_MUTATION_STDDEV
    )),
    tempoOffset: Math.max(-0.1, Math.min(0.1,
      teacherStyle.tempoOffset + z1 * STYLE_MUTATION_STDDEV
    )),
  };
}
```

In `completeTeaching`, change the `learned` object creation to use inherited style:

```typescript
const learned: LearnedSequence = {
  sequenceId,
  sequenceData: teacherKnowledge.sequenceData,
  proficiency: learner.social.teachingProgress,
  source: "taught",
  learnedAt: currentTick,
  learnedFrom: teacher.id,
  lineage: [...teacherKnowledge.lineage, teacher.id],
  lastUsedTick: currentTick,
  style: this.inheritStyle(teacherKnowledge.style),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/village/StyleInheritance.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/village/engine/systems/TeachingSystem.ts tests/unit/village/StyleInheritance.test.ts
git commit -m "feat(village): style inheritance — learner receives teacher's StyleSignature with gaussian mutation"
```

---

### Task 3: Style Compatibility Gate in SocialSystem

**Files:**
- Modify: `src/lib/features/village/engine/systems/SocialSystem.ts`
- Modify: `tests/unit/village/StyleInheritance.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/village/StyleInheritance.test.ts`:

```typescript
import { SocialSystem } from "$lib/features/village/engine/systems/SocialSystem";
import { STYLE_INCOMPATIBILITY_THRESHOLD } from "$lib/features/village/domain/village-constants";

describe("Style Compatibility", () => {
  it("entities with very different styles sometimes refuse to form teaching pairs", () => {
    const world = createVillageWorld();
    const { emitter } = makeEmitter();
    const system = new SocialSystem(defaultConfig, emitter);

    const entityA = makeEntity(world, "StyleA");
    const entityB = makeEntity(world, "StyleB");

    // Give both entities a sequence so they can teach
    const sharedSeq = {
      sequenceId: "seq-shared",
      sequenceData: null,
      proficiency: 0.9,
      source: "seed" as const,
      learnedAt: 0,
      learnedFrom: null,
      lineage: [],
      lastUsedTick: 0,
      style: { amplitudeScale: 0.85, tempoOffset: -0.08 },
    };

    // A knows seq-shared, B does not — so A would normally teach B
    entityA.knowledge.knownSequences.set("seq-shared", sharedSeq);

    // But give both entities other sequences with VERY different styles
    // to establish their personal style signature
    entityA.knowledge.knownSequences.set("seq-A-own", {
      ...sharedSeq,
      sequenceId: "seq-A-own",
      style: { amplitudeScale: 0.8, tempoOffset: -0.1 },
    });
    entityB.knowledge.knownSequences.set("seq-B-own", {
      ...sharedSeq,
      sequenceId: "seq-B-own",
      style: { amplitudeScale: 1.2, tempoOffset: 0.1 },
    });

    // The style distance between these two is large:
    // amplitude diff: 0.4, tempo diff: 0.2, euclidean ~= 0.447
    // This exceeds STYLE_INCOMPATIBILITY_THRESHOLD (0.3)

    // Set up approaching state — this is where compatibility is checked
    entityA.social.state = "approaching";
    entityA.social.partner = entityB.id;
    entityA.transform.speed = 0;

    entityB.social.state = "approaching";
    entityB.social.partner = entityA.id;
    entityB.transform.speed = 0;

    // Run many ticks; with 10% refuse chance per tick on incompatible styles,
    // at least some should result in socializing instead of teaching
    let socializingCount = 0;
    let teachingCount = 0;

    for (let trial = 0; trial < 100; trial++) {
      // Reset states
      entityA.social.state = "approaching";
      entityA.social.partner = entityB.id;
      entityA.transform.speed = 0;
      entityB.social.state = "approaching";
      entityB.social.partner = entityA.id;
      entityB.transform.speed = 0;

      system.tick(world, trial);

      if (entityA.social.state === "socializing") socializingCount++;
      if (entityA.social.state === "teaching" || entityB.social.state === "teaching") teachingCount++;
    }

    // With 10% refuse chance, we expect roughly 10 refusals out of 100
    expect(socializingCount).toBeGreaterThan(0);
    expect(teachingCount).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/village/StyleInheritance.test.ts`
Expected: FAIL — style compatibility not yet checked, all pairs form teaching.

- [ ] **Step 3: Add style distance calculation and compatibility gate**

In `src/lib/features/village/engine/systems/SocialSystem.ts`, add imports:

```typescript
import {
  STYLE_INCOMPATIBILITY_REFUSE_CHANCE,
  STYLE_INCOMPATIBILITY_THRESHOLD,
} from "../../domain/village-constants";
```

Add a private method:

```typescript
private getAverageStyle(entity: VillageEntity): { amplitudeScale: number; tempoOffset: number } {
  const sequences = [...entity.knowledge.knownSequences.values()];
  if (sequences.length === 0) return { amplitudeScale: 1.0, tempoOffset: 0 };

  let ampSum = 0;
  let tempoSum = 0;
  for (const seq of sequences) {
    ampSum += seq.style.amplitudeScale;
    tempoSum += seq.style.tempoOffset;
  }
  return {
    amplitudeScale: ampSum / sequences.length,
    tempoOffset: tempoSum / sequences.length,
  };
}

private styleDistance(a: VillageEntity, b: VillageEntity): number {
  const styleA = this.getAverageStyle(a);
  const styleB = this.getAverageStyle(b);
  const dAmp = styleA.amplitudeScale - styleB.amplitudeScale;
  const dTempo = styleA.tempoOffset - styleB.tempoOffset;
  return Math.sqrt(dAmp * dAmp + dTempo * dTempo);
}
```

In `handleApproaching`, after the ego gates and before the `findNovelSequenceId` call (around line 232), add:

```typescript
// Style compatibility gate
const styleDist = this.styleDistance(teacher, learner);
if (
  styleDist > STYLE_INCOMPATIBILITY_THRESHOLD &&
  Math.random() < STYLE_INCOMPATIBILITY_REFUSE_CHANCE
) {
  entity.social.state = "socializing";
  partner.social.state = "socializing";
  entity.social.idleTimer = 0;
  partner.social.idleTimer = 0;
  return;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/village/StyleInheritance.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/village/engine/systems/SocialSystem.ts tests/unit/village/StyleInheritance.test.ts
git commit -m "feat(village): style compatibility gate — entities with divergent styles sometimes refuse teaching"
```

---

### Task 4: StyleDriftSystem — Cluster Detection

**Files:**
- Create: `src/lib/features/village/engine/systems/StyleDriftSystem.ts`
- Test: `tests/unit/village/StyleDriftSystem.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/village/StyleDriftSystem.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { StyleDriftSystem } from "$lib/features/village/engine/systems/StyleDriftSystem";
import {
  createVillageWorld,
  createAvatarEntity,
} from "$lib/features/village/engine/VillageWorld";
import { PersonalityGenerator } from "$lib/features/village/services/implementations/PersonalityGenerator";
import type {
  VillageEventMap,
  VillageEventKey,
  StyleSchool,
} from "$lib/features/village/domain/village-types";

type EventHandler = (...args: unknown[]) => void;

function makeEmitter() {
  const events: Record<string, unknown[][]> = {};
  const handlers: Record<string, EventHandler[]> = {};
  return {
    events,
    emitter: {
      emit<K extends VillageEventKey>(
        event: K,
        ...args: Parameters<VillageEventMap[K]>
      ) {
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

function makeEntity(
  world: ReturnType<typeof createVillageWorld>,
  name = "Test",
  generation = 1,
) {
  return createAvatarEntity(world, {
    name,
    generation,
    currentTick: 0,
    lifespanTicks: 600,
    arenaRadius: 8,
    personalityGenerator: new PersonalityGenerator(),
    traitMean: 0.5,
    traitStdDev: 0.15,
  });
}

describe("StyleDriftSystem", () => {
  it("forms a school when 3+ entities share similar styles", () => {
    const world = createVillageWorld();
    const { emitter, events } = makeEmitter();
    const system = new StyleDriftSystem(emitter);

    // Create 3 entities with nearly identical style signatures
    const similarStyle = { amplitudeScale: 1.1, tempoOffset: 0.05 };
    for (let i = 0; i < 3; i++) {
      const e = makeEntity(world, `Similar${i}`);
      e.knowledge.knownSequences.set("seq-A", {
        sequenceId: "seq-A",
        sequenceData: null,
        proficiency: 0.8,
        source: "taught",
        learnedAt: 0,
        learnedFrom: null,
        lineage: [],
        lastUsedTick: 0,
        style: {
          amplitudeScale: similarStyle.amplitudeScale + (i * 0.01),
          tempoOffset: similarStyle.tempoOffset,
        },
      });
    }

    // Create 1 entity with a very different style (should NOT join school)
    const outlier = makeEntity(world, "Outlier");
    outlier.knowledge.knownSequences.set("seq-B", {
      sequenceId: "seq-B",
      sequenceData: null,
      proficiency: 0.8,
      source: "seed",
      learnedAt: 0,
      learnedFrom: null,
      lineage: [],
      lastUsedTick: 0,
      style: { amplitudeScale: 0.82, tempoOffset: -0.09 },
    });

    system.tick(world, 1);

    expect(system.schools.length).toBe(1);
    expect(system.schools[0].memberIds.size).toBe(3);
    expect(system.schools[0].memberIds.has(outlier.id)).toBe(false);
  });

  it("dissolves a school when membership drops below 3", () => {
    const world = createVillageWorld();
    const { emitter, events } = makeEmitter();
    const system = new StyleDriftSystem(emitter);

    const style = { amplitudeScale: 1.1, tempoOffset: 0.05 };
    const entities = [];
    for (let i = 0; i < 3; i++) {
      const e = makeEntity(world, `Member${i}`);
      e.knowledge.knownSequences.set("seq-A", {
        sequenceId: "seq-A",
        sequenceData: null,
        proficiency: 0.8,
        source: "taught",
        learnedAt: 0,
        learnedFrom: null,
        lineage: [],
        lastUsedTick: 0,
        style: { amplitudeScale: style.amplitudeScale + (i * 0.01), tempoOffset: style.tempoOffset },
      });
      entities.push(e);
    }

    system.tick(world, 1);
    expect(system.schools.length).toBe(1);

    // Remove one entity from the world (simulating death)
    world.remove(entities[0]);

    system.tick(world, 2);
    expect(system.schools.length).toBe(0);
    expect(events["school:dissolved"]?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/village/StyleDriftSystem.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement StyleDriftSystem**

Create `src/lib/features/village/engine/systems/StyleDriftSystem.ts`:

```typescript
import type { World } from "miniplex";
import type { VillageEntity, StyleSchool } from "../../domain/village-types";
import type { VillageEventEmitter } from "../VillageEventEmitter";
import {
  STYLE_SIMILARITY_THRESHOLD,
  STYLE_SCHOOL_MIN_MEMBERS,
} from "../../domain/village-constants";

export class StyleDriftSystem {
  schools: StyleSchool[] = [];

  constructor(private emitter: VillageEventEmitter) {}

  tick(world: World<VillageEntity>, _currentTick: number): void {
    // Compute average style per entity
    const entityStyles = new Map<string, { amplitudeScale: number; tempoOffset: number }>();

    for (const entity of world.entities) {
      if (entity.social.state === "passing") continue;
      if (entity.knowledge.knownSequences.size === 0) continue;

      let ampSum = 0;
      let tempoSum = 0;
      let count = 0;
      for (const seq of entity.knowledge.knownSequences.values()) {
        ampSum += seq.style.amplitudeScale;
        tempoSum += seq.style.tempoOffset;
        count++;
      }
      entityStyles.set(entity.id, {
        amplitudeScale: ampSum / count,
        tempoOffset: tempoSum / count,
      });
    }

    // Simple clustering: greedy single-linkage
    const assigned = new Set<string>();
    const newSchools: StyleSchool[] = [];

    const entityIds = [...entityStyles.keys()];
    for (let i = 0; i < entityIds.length; i++) {
      if (assigned.has(entityIds[i])) continue;

      const cluster = new Set<string>([entityIds[i]]);
      const pivot = entityStyles.get(entityIds[i])!;

      for (let j = i + 1; j < entityIds.length; j++) {
        if (assigned.has(entityIds[j])) continue;
        const other = entityStyles.get(entityIds[j])!;
        const dAmp = pivot.amplitudeScale - other.amplitudeScale;
        const dTempo = pivot.tempoOffset - other.tempoOffset;
        const dist = Math.sqrt(dAmp * dAmp + dTempo * dTempo);
        if (dist < STYLE_SIMILARITY_THRESHOLD) {
          cluster.add(entityIds[j]);
        }
      }

      if (cluster.size >= STYLE_SCHOOL_MIN_MEMBERS) {
        for (const id of cluster) assigned.add(id);

        // Derive a stable color from the first member's id hash
        const colorHue = this.hashToHue(entityIds[i]);
        const school: StyleSchool = {
          id: entityIds[i],
          color: `hsl(${colorHue}, 60%, 50%)`,
          memberIds: cluster,
        };
        newSchools.push(school);
      }
    }

    // Emit events for changes
    const oldSchoolIds = new Set(this.schools.map((s) => s.id));
    const newSchoolIds = new Set(newSchools.map((s) => s.id));

    for (const school of newSchools) {
      if (!oldSchoolIds.has(school.id)) {
        this.emitter.emit("school:formed", school);
      }
    }
    for (const school of this.schools) {
      if (!newSchoolIds.has(school.id)) {
        this.emitter.emit("school:dissolved", school.id);
      }
    }

    this.schools = newSchools;
  }

  getSchoolForEntity(entityId: string): StyleSchool | null {
    return this.schools.find((s) => s.memberIds.has(entityId)) ?? null;
  }

  private hashToHue(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 360;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/village/StyleDriftSystem.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/engine/systems/StyleDriftSystem.ts tests/unit/village/StyleDriftSystem.test.ts
git commit -m "feat(village): StyleDriftSystem — detects style clusters and assigns schools"
```

---

### Task 5: Wire StyleDriftSystem into VillageOrchestrator

**Files:**
- Modify: `src/lib/features/village/engine/VillageOrchestrator.ts`

- [ ] **Step 1: Import and instantiate StyleDriftSystem**

In `VillageOrchestrator.ts`, add the import:

```typescript
import { StyleDriftSystem } from "./systems/StyleDriftSystem";
```

Add the field declaration alongside the other systems:

```typescript
styleDriftSystem: StyleDriftSystem;
```

In the constructor, after `this.proximityLearningSystem = new ProximityLearningSystem();`:

```typescript
this.styleDriftSystem = new StyleDriftSystem(this);
```

- [ ] **Step 2: Add to tick loop**

In the `tick()` method, add after `this.recombinationSystem.tick(...)` and before `this.movementSystem.tick(...)`:

```typescript
this.styleDriftSystem.tick(this.world, this._currentTick);
```

The tick order becomes:
1. lifecycleSystem
2. socialSystem
3. performanceSystem
4. teachingSystem
5. proximityLearningSystem
6. decaySystem
7. recombinationSystem
8. **styleDriftSystem** (NEW — after recombination so newly invented sequences have styles, before movement)
9. movementSystem
10. monumentSystem
11. populationSystem

- [ ] **Step 3: Add to reset()**

In `reset()`, add alongside the other system recreations:

```typescript
this.styleDriftSystem = new StyleDriftSystem(this);
```

- [ ] **Step 4: Expose schools getter**

Add a public getter:

```typescript
get schools() {
  return this.styleDriftSystem.schools;
}
```

- [ ] **Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/village/engine/VillageOrchestrator.ts
git commit -m "feat(village): wire StyleDriftSystem into orchestrator tick loop"
```

---

### Task 6: Monument Relight Flash Animation

**Files:**
- Modify: `src/lib/features/village/components/VillageMonument.svelte`
- Modify: `src/lib/features/village/state/village-visual-state.svelte.ts`

- [ ] **Step 1: Add relighting state to visual state**

In `village-visual-state.svelte.ts`, add to the interface:

```typescript
readonly relightingMonuments: Set<string>;
triggerRelight(sequenceId: string): void;
```

In `createVillageVisualState()`, add:

```typescript
let relightingMonuments = $state<Set<string>>(new Set());
```

Add to the returned object:

```typescript
get relightingMonuments() { return relightingMonuments; },

triggerRelight(sequenceId: string) {
  relightingMonuments = new Set([...relightingMonuments, sequenceId]);
  // Auto-clear after animation duration (1300ms)
  setTimeout(() => {
    relightingMonuments = new Set(
      [...relightingMonuments].filter((id) => id !== sequenceId),
    );
  }, 1300);
},
```

- [ ] **Step 2: Add showSchoolTints toggle**

In the interface, add:

```typescript
readonly showSchoolTints: boolean;
setShowSchoolTints(v: boolean): void;
```

In the factory:

```typescript
let showSchoolTints = $state(true);
```

Add to returned object:

```typescript
get showSchoolTints() { return showSchoolTints; },
setShowSchoolTints(v) { showSchoolTints = v; },
```

- [ ] **Step 3: Add relight animation to VillageMonument**

Replace `VillageMonument.svelte` with the following updated version that adds flash animation:

In the `<script>` tag, after the existing `$derived` declarations, add:

```typescript
import { getVillageVisualContext } from "../state/village-context";

const visualState = getVillageVisualContext();
const isRelighting = $derived(visualState.relightingMonuments.has(monument.sequenceId));
```

Update the `emissiveIntensity` derived to include the relight flash:

```typescript
const emissiveIntensity = $derived(
  isRelighting ? 2.0 :
  isExtinct ? 0.1 :
  0.5
);
```

This creates the visual spec's "resurrection flash" — emissiveIntensity spikes to 2.0 for 1300ms, then the `triggerRelight` timeout clears it back to 0.5.

- [ ] **Step 4: Wire monument:relit event to triggerRelight**

In `VillageLabTab.svelte` or wherever the orchestrator events are subscribed (check the event wiring), add:

```typescript
orchestrator.on("monument:relit", (sequenceId) => {
  visualState.triggerRelight(sequenceId);
});
```

This connects the headless event to the visual animation.

- [ ] **Step 5: Run build check**

Run: `npm run check`
Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/village/components/VillageMonument.svelte src/lib/features/village/state/village-visual-state.svelte.ts
git commit -m "feat(village): monument relight flash — emissive spike to 2.0 on resurrection"
```

---

### Task 7: Visual Aging — Animation Amplitude & Youth Wobble

**Files:**
- Modify: `src/lib/features/village/components/VillageAvatar.svelte`

VillageAvatar already has `heightScale` (youth: 0.7, elder: 0.95), phase indicators, and elder knowledge glow. What's missing from the visual spec:

1. **Youth wobble**: slight random sine oscillation on facing angle (2-3 degrees at 0.5Hz)
2. **Elder animation amplitude**: IK targets lerped 30% toward body center (this is an Avatar3D concern — we can approximate by scaling the outer group)

- [ ] **Step 1: Add youth wobble**

In `VillageAvatar.svelte`, inside the `useTask` callback (after `facingAngle = inst.facingAngle;`), add youth wobble:

```typescript
// Youth wobble: slight facing angle oscillation for youthful energy
if (renderState.entity.lifecycle.phase === "youth") {
  const wobbleAngle = Math.sin(performance.now() * 0.001 * Math.PI) * 0.05; // ~2.8 degrees
  facingAngle += wobbleAngle;
}
```

- [ ] **Step 2: Add school tint overlay**

Add these derived values after the existing `nameTint` derived:

```typescript
import { getVillageVisualContext } from "../state/village-context";

const visualState = getVillageVisualContext();

// School tint: if entity belongs to a style school, tint their label border
const schoolColor = $derived(() => {
  if (!visualState.showSchoolTints) return null;
  const orchestrator = /* get from context */ null;
  // Schools are read from orchestrator in the scene; pass as prop instead
  return null;
});
```

Actually, the school color needs to come from the orchestrator. Add a new optional prop to VillageAvatar:

```typescript
interface Props {
  renderState: AvatarRenderState;
  isSelected?: boolean;
  schoolColor?: string | null;
}

const { renderState, isSelected = false, schoolColor = null }: Props = $props();
```

Then in the name label, add a bottom border when school color is present:

```svelte
<div
  class="name-label"
  style="color: {nameTint}; opacity: {labelOpacity * deathOpacity}{schoolColor ? `; border-bottom: 2px solid ${schoolColor}` : ''}"
>
```

- [ ] **Step 3: Pass schoolColor from VillageScene**

In `VillageScene.svelte`, derive the school color per avatar:

```typescript
const schools = $derived(villageState.orchestrator.schools ?? []);

function getSchoolColor(entityId: string): string | null {
  for (const school of schools) {
    if (school.memberIds.has(entityId)) return school.color;
  }
  return null;
}
```

Update the VillageAvatar usage:

```svelte
<VillageAvatar
  {renderState}
  isSelected={villageState.selectedAvatarId === renderState.entityId}
  schoolColor={getSchoolColor(renderState.entityId)}
/>
```

- [ ] **Step 4: Run build check**

Run: `npm run check`
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/components/VillageAvatar.svelte src/lib/features/village/components/VillageScene.svelte
git commit -m "feat(village): youth wobble, school tint labels, visual aging polish"
```

---

### Task 8: VillageControls — School Stats & Toggles

**Files:**
- Modify: `src/lib/features/village/components/VillageControls.svelte`

- [ ] **Step 1: Read VillageControls to understand current structure**

Read: `src/lib/features/village/components/VillageControls.svelte`

- [ ] **Step 2: Add school stats to Population section**

In the stats area, add:

```svelte
<div class="stat-row">
  <span class="stat-label">Schools:</span>
  <span class="stat-value">{villageState.orchestrator.schools?.length ?? 0}</span>
</div>
```

- [ ] **Step 3: Add showSchoolTints toggle to Toggles section**

Add alongside existing toggles:

```svelte
<label class="toggle-row">
  <input
    type="checkbox"
    checked={visualState.showSchoolTints}
    onchange={(e) => visualState.setShowSchoolTints(e.currentTarget.checked)}
  />
  Show school tints
</label>
```

- [ ] **Step 4: Add style info to Avatar Inspector**

When an avatar is selected, show their average style and school membership:

```svelte
{#if selectedEntity}
  <!-- ... existing inspector fields ... -->
  {#if selectedEntity.knowledge.knownSequences.size > 0}
    {@const avgStyle = getAverageStyle(selectedEntity)}
    <div class="stat-row">
      <span class="stat-label">Style Amp:</span>
      <span class="stat-value">{avgStyle.amplitudeScale.toFixed(2)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Style Tempo:</span>
      <span class="stat-value">{avgStyle.tempoOffset.toFixed(3)}</span>
    </div>
  {/if}
{/if}
```

Add the helper function in the script:

```typescript
function getAverageStyle(entity: VillageEntity): { amplitudeScale: number; tempoOffset: number } {
  const sequences = [...entity.knowledge.knownSequences.values()];
  if (sequences.length === 0) return { amplitudeScale: 1.0, tempoOffset: 0 };
  let ampSum = 0;
  let tempoSum = 0;
  for (const seq of sequences) {
    ampSum += seq.style.amplitudeScale;
    tempoSum += seq.style.tempoOffset;
  }
  return {
    amplitudeScale: ampSum / sequences.length,
    tempoOffset: tempoSum / sequences.length,
  };
}
```

- [ ] **Step 5: Run build check**

Run: `npm run check`
Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/village/components/VillageControls.svelte
git commit -m "feat(village): controls panel — school stats, school tint toggle, style inspector"
```

---

### Task 9: Final Integration Test & Wire Event Toasts

**Files:**
- Modify: `src/lib/features/village/VillageLabTab.svelte`

- [ ] **Step 1: Read VillageLabTab to understand event wiring**

Read: `src/lib/features/village/VillageLabTab.svelte`

- [ ] **Step 2: Wire school and relight events to toasts**

In the event subscription block, add:

```typescript
orchestrator.on("monument:relit", (sequenceId) => {
  visualState.triggerRelight(sequenceId);
  visualState.pushToast("Knowledge resurrected", "#f8fafc", 0, 0, 3000);
});

orchestrator.on("school:formed", (school) => {
  visualState.pushToast(
    `A style school formed (${school.memberIds.size} members)`,
    school.color,
    0, 0, 3000
  );
});

orchestrator.on("school:dissolved", (_schoolId) => {
  visualState.pushToast("A style school dissolved", "#6b7280", 0, 0, 2000);
});
```

- [ ] **Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/village/VillageLabTab.svelte
git commit -m "feat(village): wire school/relight events to toasts and visual state"
```

---

## Summary

| Task | Feature | What It Does |
|------|---------|-------------|
| 1 | Style Schools | Add `StyleSignature` type, constants, update all creation sites |
| 2 | Style Schools | Teaching inherits style with gaussian mutation |
| 3 | Style Schools | Incompatible styles sometimes refuse teaching |
| 4 | Style Schools | StyleDriftSystem detects clusters, assigns schools |
| 5 | Style Schools | Wire system into orchestrator tick loop |
| 6 | Monuments | Relight flash animation (emissive spike on resurrection) |
| 7 | Visual Aging | Youth wobble, school tint labels on avatars |
| 8 | Controls | School stats, toggle, style inspector in controls panel |
| 9 | Integration | Wire events to toasts, final verification |
