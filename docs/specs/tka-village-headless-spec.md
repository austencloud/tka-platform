# TKA Village: Headless ECS Simulation Spec

> **Scope:** All entity components, systems, events, and tick-loop ordering for the cultural evolution simulator. No rendering, no UI, no Three.js. Pure logic. Every feature below should be testable with unit tests against the Miniplex world.

---

## Phase 0: Foundation Fields

These fields are required by multiple downstream systems. Add them first.

### SocialComponent Additions

```typescript
// Add to SocialComponent in village-types.ts
performingSequenceId: string | null;  // which sequence is active during "performing" state
inJam: boolean;                        // suppresses auto-expire timer in SocialSystem
```

**Wire `performingSequenceId`:** In `SocialSystem.handleIdle()`, when transitioning to `"performing"`, pick the highest-proficiency sequence:

```typescript
case "performing":
  const bestSeq = [...entity.knowledge.knownSequences.entries()]
    .sort((a, b) => b[1].proficiency - a[1].proficiency)[0];
  entity.social.performingSequenceId = bestSeq?.[0] ?? null;
  entity.social.idleTimer = 0;
  break;
```

**Guard auto-expire:** In `SocialSystem.handlePerforming()`:

```typescript
private handlePerforming(entity: VillageEntity): void {
  if (entity.social.inJam) return; // jam system manages duration
  entity.social.idleTimer++;
  const maxDuration = entity.lifecycle.phase === "elder" ? 40 : 25;
  if (entity.social.idleTimer > maxDuration) {
    entity.social.state = "idle";
    entity.social.performingSequenceId = null;
    entity.social.idleTimer = 0;
  }
}
```

### LearnedSequence Additions

```typescript
// Add to LearnedSequence in village-types.ts
lastUsedTick: number;  // updated on teaching, performing, practicing
```

Initialize to `learnedAt` value at creation time. Update in TeachingSystem (both teacher and learner on completion) and when entering performing state.

### AvatarBehaviorState Additions

Extend the union across all phases:

```typescript
export type AvatarBehaviorState =
  | "idle" | "wandering" | "seeking" | "approaching"
  | "teaching" | "learning" | "practicing"
  | "performing" | "socializing" | "inventing" | "passing"
  // Phase 0+
  | "watching" | "jamming" | "mourning" | "pilgrim";
```

### LearnedSequence Source Union

```typescript
source: "seed" | "taught" | "invented" | "fragmented" | "gifted" | "echo";
```

### VillageEventMap Additions

```typescript
// Add to VillageEventMap in village-types.ts
"sequence:forgotten": (entity: VillageEntity, sequenceId: string) => void;
"sequence:resurrected": (entity: VillageEntity, sequenceId: string) => void;
"jam:formed": (performers: VillageEntity[], location: { x: number; z: number }) => void;
"jam:dissolved": (location: { x: number; z: number }) => void;
"funeral:started": (deceased: VillageEntity, mourners: VillageEntity[]) => void;
"monument:placed": (sequenceId: string, x: number, z: number) => void;
"monument:dimmed": (sequenceId: string) => void;
"monument:relit": (sequenceId: string) => void;
"reincarnation:detected": (newEntity: VillageEntity, sourceEntityId: string) => void;
```

### New SocialSystem Switch Cases

Add no-op or minimal cases for new states so the switch doesn't silently skip them:

```typescript
case "watching":
  this.handleWatching(entity);
  break;
case "jamming":
  this.handleJamming(entity);
  break;
case "mourning":
  this.handleMourning(entity);
  break;
case "pilgrim":
  // PilgrimageSystem handles movement; SocialSystem just skips
  break;
```

---

## System 1: DecaySystem

**Tick order:** After TeachingSystem, before RecombinationSystem

```typescript
export class DecaySystem {
  constructor(private emitter: VillageEventEmitter) {}

  tick(world: World<VillageEntity>, currentTick: number): void {
    for (const entity of world.entities) {
      if (entity.social.state === "passing") continue;

      for (const [seqId, learned] of entity.knowledge.knownSequences) {
        const elapsed = currentTick - learned.lastUsedTick;
        if (elapsed <= DECAY_GRACE_PERIOD) continue;

        // Patient entities decay slower; structurally memorable sequences decay slower
        const patienceModifier = 1 - entity.personality.patience * 0.5;
        const structureBonus = this.getStructuralMemorability(seqId);
        const decayRate = DECAY_PER_TICK * patienceModifier * (1 - structureBonus);

        learned.proficiency = Math.max(0.05, learned.proficiency - decayRate);

        if (learned.proficiency < FORGET_THRESHOLD) {
          entity.knowledge.knownSequences.delete(seqId);
          this.emitter.emit("sequence:forgotten", entity, seqId);
        }
      }
    }
  }

  /**
   * Sequences with internal repetition (LOOPs, palindromes, mirrored structures)
   * are easier to mentally rehearse and decay slower.
   * Returns 0-0.5 bonus (higher = slower decay).
   */
  private getStructuralMemorability(sequenceId: string): number {
    // Heuristic: sequences created by "mirror", "invert", or "rewind" mutations
    // have structural repetition baked in from SequenceMutator
    const mutations = sequenceId.split(":");
    const structuralMutations = mutations.filter(
      m => m === "mirror" || m === "invert" || m === "rewind"
    );
    return Math.min(0.5, structuralMutations.length * 0.15);
  }
}
```

### Constants

```typescript
export const DECAY_GRACE_PERIOD = 200;
export const DECAY_PER_TICK = 0.001;
export const FORGET_THRESHOLD = 0.1;
```

---

## System 2: PerformanceSystem

**Tick order:** After SocialSystem, before TeachingSystem

Manages solo performances, watcher attraction, jam formation/dissolution.

```typescript
export class PerformanceSystem {
  private activeJams: JamCircle[] = [];

  constructor(
    private config: VillageConfig,
    private emitter: VillageEventEmitter,
  ) {}

  tick(world: World<VillageEntity>, currentTick: number): void {
    this.attractWatchers(world);
    this.escalateToJam(world, currentTick);
    this.dissolveJams(world);
    this.applyJamBonuses(world, currentTick);
  }

  private attractWatchers(world: World<VillageEntity>): void {
    for (const performer of world.entities) {
      if (performer.social.state !== "performing") continue;

      for (const candidate of world.entities) {
        if (candidate.id === performer.id) continue;
        if (candidate.social.state !== "idle") continue;
        if (candidate.personality.curiosity < 0.3) continue;

        const dist = this.distance(candidate, performer);
        if (dist > PERFORMANCE_ATTRACTION_RADIUS) continue;

        candidate.social.state = "watching";
        candidate.social.partner = performer.id;
        candidate.transform.targetX = candidate.transform.x; // stop moving
        candidate.transform.targetZ = candidate.transform.z;
        candidate.transform.speed = 0;
        // Face performer
        candidate.transform.facingAngle = Math.atan2(
          performer.transform.z - candidate.transform.z,
          performer.transform.x - candidate.transform.x,
        );
      }
    }
  }

  private escalateToJam(world: World<VillageEntity>, currentTick: number): void {
    // Find performers not already in a jam
    const soloPerformers = world.entities.filter(
      e => e.social.state === "performing" && !e.social.inJam
    );

    for (const performer of soloPerformers) {
      const watchers = world.entities.filter(
        e => e.social.state === "watching" && e.social.partner === performer.id
      );

      if (watchers.length >= JAM_WATCHER_THRESHOLD) {
        // Escalate: willing watchers join as performers
        const jam: JamCircle = {
          centerX: performer.transform.x,
          centerZ: performer.transform.z,
          formedAtTick: currentTick,
          performerIds: new Set([performer.id]),
        };

        performer.social.inJam = true;

        for (const watcher of watchers) {
          const creativityBoosted = watcher.personality.creativity + CREATIVITY_JAM_BOOST;
          if (creativityBoosted > 0.7 && watcher.knowledge.knownSequences.size > 0) {
            watcher.social.state = "performing";
            watcher.social.inJam = true;
            watcher.social.performingSequenceId = this.pickBestSequence(watcher);
            jam.performerIds.add(watcher.id);
          } else {
            watcher.social.state = "jamming"; // watching but in jam context
          }
        }

        this.activeJams.push(jam);
        this.emitter.emit("jam:formed", 
          world.entities.filter(e => jam.performerIds.has(e.id)),
          { x: jam.centerX, z: jam.centerZ }
        );
      }
    }
  }

  private dissolveJams(world: World<VillageEntity>): void {
    this.activeJams = this.activeJams.filter(jam => {
      const performers = world.entities.filter(
        e => jam.performerIds.has(e.id) && e.social.state === "performing"
      );
      const allParticipants = world.entities.filter(
        e => jam.performerIds.has(e.id) || 
             (e.social.state === "jamming" || e.social.state === "watching")
      );

      if (performers.length < 2 || allParticipants.length < 4) {
        // Dissolve
        for (const entity of world.entities) {
          if (entity.social.inJam) {
            entity.social.inJam = false;
            entity.social.state = "idle";
            entity.social.performingSequenceId = null;
            entity.social.idleTimer = 0;
            entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
          }
        }
        this.emitter.emit("jam:dissolved", { x: jam.centerX, z: jam.centerZ });
        return false;
      }
      return true;
    });
  }

  private applyJamBonuses(world: World<VillageEntity>, currentTick: number): void {
    for (const entity of world.entities) {
      if (!entity.social.inJam) continue;

      if (entity.social.state === "performing" && entity.social.performingSequenceId) {
        // Practice bonus
        const seq = entity.knowledge.knownSequences.get(entity.social.performingSequenceId);
        if (seq) {
          seq.proficiency = Math.min(1, seq.proficiency + 0.01);
          seq.lastUsedTick = currentTick;
        }
      }
    }
  }

  private pickBestSequence(entity: VillageEntity): string | null {
    let best: [string, number] | null = null;
    for (const [id, seq] of entity.knowledge.knownSequences) {
      if (!best || seq.proficiency > best[1]) best = [id, seq.proficiency];
    }
    return best?.[0] ?? null;
  }

  private distance(a: VillageEntity, b: VillageEntity): number {
    const dx = a.transform.x - b.transform.x;
    const dz = a.transform.z - b.transform.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}

interface JamCircle {
  centerX: number;
  centerZ: number;
  formedAtTick: number;
  performerIds: Set<string>;
}
```

### Constants

```typescript
export const PERFORMANCE_ATTRACTION_RADIUS = 6;
export const JAM_WATCHER_THRESHOLD = 3;
export const CREATIVITY_JAM_BOOST = 0.2;
```

---

## System 3: FuneralSystem

**Tick order:** After PopulationSystem emits `entity:died`, run as event listener (not tick-based)

```typescript
export class FuneralSystem {
  private mourningLocations: Map<string, { x: number; z: number; endTick: number }> = new Map();

  constructor(
    private emitter: VillageEventEmitter,
  ) {
    this.emitter.on("entity:died", (deceased) => this.onDeath(deceased));
  }

  onDeath(deceased: VillageEntity, world: World<VillageEntity>, currentTick: number): void {
    // Check for sequence extinction
    const extinctSequences: string[] = [];
    for (const seqId of deceased.knowledge.knownSequences.keys()) {
      const otherCarriers = world.entities.filter(
        e => e.id !== deceased.id && e.knowledge.knownSequences.has(seqId)
      );
      if (otherCarriers.length === 0) {
        extinctSequences.push(seqId);
      }
    }

    // Fragmented memory: mid-lesson learner retains partial knowledge
    if (deceased.social.state === "teaching" && deceased.social.partner) {
      const learner = world.entities.find(e => e.id === deceased.social.partner);
      if (learner && learner.social.sequenceBeingTransferred) {
        const seqId = learner.social.sequenceBeingTransferred;
        const teacherKnowledge = deceased.knowledge.knownSequences.get(seqId);
        if (teacherKnowledge && !learner.knowledge.knownSequences.has(seqId)) {
          learner.knowledge.knownSequences.set(seqId, {
            sequenceId: seqId,
            sequenceData: teacherKnowledge.sequenceData,
            proficiency: learner.social.teachingProgress,
            source: "fragmented",
            learnedAt: currentTick,
            learnedFrom: deceased.id,
            lineage: [...teacherKnowledge.lineage, deceased.id],
            lastUsedTick: currentTick,
          });
        }
        learner.social.state = "idle";
        learner.social.partner = null;
        learner.social.sequenceBeingTransferred = null;
      }
    }

    // Gather mourners
    const mourners: VillageEntity[] = [];
    for (const entity of world.entities) {
      if (entity.id === deceased.id) continue;
      if (entity.social.state === "passing") continue;
      const dist = Math.sqrt(
        (entity.transform.x - deceased.transform.x) ** 2 +
        (entity.transform.z - deceased.transform.z) ** 2
      );
      if (dist <= FUNERAL_RADIUS) {
        entity.social.state = "mourning";
        entity.social.partner = null;
        entity.social.idleTimer = 0;
        entity.transform.speed = 0;
        entity.transform.facingAngle = Math.atan2(
          deceased.transform.z - entity.transform.z,
          deceased.transform.x - entity.transform.x,
        );
        mourners.push(entity);
      }
    }

    if (mourners.length > 0) {
      this.emitter.emit("funeral:started", deceased, mourners);
    }

    // Knowledge panic: if extinction happened, nearby curious entities seek aggressively
    if (extinctSequences.length > 0) {
      for (const entity of world.entities) {
        if (entity.social.state === "mourning") continue;
        if (entity.personality.curiosity < 0.5) continue;
        const dist = Math.sqrt(
          (entity.transform.x - deceased.transform.x) ** 2 +
          (entity.transform.z - deceased.transform.z) ** 2
        );
        if (dist <= FUNERAL_RADIUS * 2) {
          entity.social.state = "seeking";
          entity.social.interactionCooldown = 0; // urgent
        }
      }
    }
  }

  tickMourning(world: World<VillageEntity>): void {
    for (const entity of world.entities) {
      if (entity.social.state !== "mourning") continue;
      entity.social.idleTimer++;
      if (entity.social.idleTimer > MOURNING_DURATION) {
        entity.social.state = "idle";
        entity.social.idleTimer = 0;
        entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
      }
    }
  }
}
```

### Constants

```typescript
export const FUNERAL_RADIUS = 5;
export const MOURNING_DURATION = 30;
```

---

## System 4: MonumentSystem

**Tick order:** End of tick loop (after PopulationSystem)

```typescript
interface Monument {
  sequenceId: string;
  worldX: number;
  worldZ: number;
  createdAtTick: number;
  inventedByName: string;
  inventedByGeneration: number;
  cohortsSurvived: Set<number>;  // distinct entity.identity.generation values
  extinctAtTick: number | null;
}

export class MonumentSystem {
  monuments: Monument[] = [];
  private sequenceOrigins = new Map<string, { x: number; z: number; name: string; generation: number }>();

  constructor(private emitter: VillageEventEmitter) {
    this.emitter.on("sequence:invented", (inventor, seqId) => {
      this.sequenceOrigins.set(seqId, {
        x: inventor.transform.x,
        z: inventor.transform.z,
        name: inventor.identity.name,
        generation: inventor.identity.generation,
      });
    });
  }

  tick(world: World<VillageEntity>, currentTick: number): void {
    // Collect which cohorts carry each sequence
    const sequenceCohorts = new Map<string, Set<number>>();
    for (const entity of world.entities) {
      if (entity.social.state === "passing") continue;
      for (const seqId of entity.knowledge.knownSequences.keys()) {
        if (!sequenceCohorts.has(seqId)) sequenceCohorts.set(seqId, new Set());
        sequenceCohorts.get(seqId)!.add(entity.identity.generation);
      }
    }

    // Check for new monuments
    for (const [seqId, cohorts] of sequenceCohorts) {
      const existing = this.monuments.find(m => m.sequenceId === seqId);
      if (existing) {
        // Update survival
        for (const c of cohorts) existing.cohortsSurvived.add(c);
        // Relight if previously extinct
        if (existing.extinctAtTick !== null) {
          existing.extinctAtTick = null;
          this.emitter.emit("monument:relit", seqId);
        }
      } else if (cohorts.size >= MONUMENT_GENERATION_THRESHOLD) {
        const origin = this.sequenceOrigins.get(seqId);
        if (origin) {
          const monument: Monument = {
            sequenceId: seqId,
            worldX: origin.x,
            worldZ: origin.z,
            createdAtTick: currentTick,
            inventedByName: origin.name,
            inventedByGeneration: origin.generation,
            cohortsSurvived: new Set(cohorts),
            extinctAtTick: null,
          };
          this.monuments.push(monument);
          this.emitter.emit("monument:placed", seqId, origin.x, origin.z);
        }
      }
    }

    // Check for extinctions on existing monuments
    for (const monument of this.monuments) {
      if (monument.extinctAtTick !== null) continue;
      if (!sequenceCohorts.has(monument.sequenceId)) {
        monument.extinctAtTick = currentTick;
        this.emitter.emit("monument:dimmed", monument.sequenceId);
      }
    }
  }
}
```

### Constants

```typescript
export const MONUMENT_GENERATION_THRESHOLD = 3;
```

---

## System 5: EgoSystem (inline, not separate)

No separate system needed. Add `ego: number` to PersonalityComponent (initialized to 0) and modify existing systems:

**TeachingSystem:** On successful teach:
```typescript
teacher.personality.ego = Math.min(1, teacher.personality.ego + 0.05);
```

**SocialSystem.handleApproaching:** Before forming a teaching pair:
```typescript
if (teacher.personality.ego > 0.9) continue; // diva: never teaches
if (teacher.personality.ego > 0.7 &&
    learner.knowledge.knownSequences.size >= teacher.knowledge.knownSequences.size) {
  continue; // ego demands hierarchy
}
```

**Natural decay:** In LifecycleSystem:
```typescript
entity.personality.ego = Math.max(0, entity.personality.ego - 0.002);
```

---

## System 6: GiftSystem (inline in SocialSystem)

In `SocialSystem.handleSocializing()`, before the existing timeout check:

```typescript
private handleSocializing(entity: VillageEntity, world: World<VillageEntity>, currentTick: number): void {
  entity.social.idleTimer++;

  // Gift check
  if (entity.personality.sociability > 0.8 && entity.social.partner) {
    const partner = world.entities.find(e => e.id === entity.social.partner);
    if (partner && Math.random() < entity.personality.sociability * 0.03) {
      const giftable = this.findGiftableSequence(entity, partner);
      if (giftable) {
        partner.knowledge.knownSequences.set(giftable.sequenceId, {
          ...giftable,
          proficiency: giftable.proficiency * 0.4,
          source: "gifted",
          learnedFrom: entity.id,
          learnedAt: currentTick,
          lineage: [...giftable.lineage, entity.id],
          lastUsedTick: currentTick,
        });
        this.emitter.emit("teaching:completed", entity, partner, giftable.sequenceId);
      }
    }
  }

  if (entity.social.idleTimer > 15) {
    entity.social.state = "idle";
    entity.social.partner = null;
    entity.social.idleTimer = 0;
    entity.social.interactionCooldown = INTERACTION_COOLDOWN_BASE;
  }
}

private findGiftableSequence(gifter: VillageEntity, receiver: VillageEntity): LearnedSequence | null {
  for (const [id, seq] of gifter.knowledge.knownSequences) {
    if (!receiver.knowledge.knownSequences.has(id)) return seq;
  }
  return null;
}
```

Note: `handleSocializing` signature changes to accept `world` and `currentTick`. Thread these through from `tick()`.

---

## System 7: ProximityLearningSystem

**Tick order:** After TeachingSystem

```typescript
export class ProximityLearningSystem {
  // Partial absorption progress for youth entities
  // Key: `${entityId}:${sequenceId}`
  private absorptionProgress = new Map<string, { progress: number; sourceId: string }>();

  tick(world: World<VillageEntity>, currentTick: number): void {
    for (const youth of world.entities) {
      if (youth.lifecycle.phase !== "youth") continue;
      if (youth.social.state === "passing") continue;

      for (const adult of world.entities) {
        if (adult.id === youth.id) continue;
        if (adult.social.state !== "performing" && adult.social.state !== "teaching") continue;

        const dx = youth.transform.x - adult.transform.x;
        const dz = youth.transform.z - adult.transform.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > PROXIMITY_LEARNING_RADIUS) continue;

        const activeSeqId = adult.social.sequenceBeingTransferred ?? adult.social.performingSequenceId;
        if (!activeSeqId) continue;
        if (youth.knowledge.knownSequences.has(activeSeqId)) continue;

        const key = `${youth.id}:${activeSeqId}`;
        const rate = (1 - dist / PROXIMITY_LEARNING_RADIUS) * YOUTH_ABSORPTION_RATE;
        const existing = this.absorptionProgress.get(key);
        const newProgress = (existing?.progress ?? 0) + rate;

        if (newProgress >= YOUTH_ABSORPTION_THRESHOLD) {
          const teacherKnowledge = adult.knowledge.knownSequences.get(activeSeqId);
          youth.knowledge.knownSequences.set(activeSeqId, {
            sequenceId: activeSeqId,
            sequenceData: teacherKnowledge?.sequenceData ?? null,
            proficiency: YOUTH_ABSORPTION_THRESHOLD,
            source: "taught",
            learnedAt: currentTick,
            learnedFrom: adult.id,
            lineage: teacherKnowledge ? [...teacherKnowledge.lineage, adult.id] : [adult.id],
            lastUsedTick: currentTick,
          });
          this.absorptionProgress.delete(key);
        } else {
          this.absorptionProgress.set(key, { progress: newProgress, sourceId: adult.id });
        }
      }
    }

    // Clean up progress for dead/aged-up entities
    for (const key of this.absorptionProgress.keys()) {
      const entityId = key.split(":")[0];
      const entity = world.entities.find(e => e.id === entityId);
      if (!entity || entity.lifecycle.phase !== "youth") {
        this.absorptionProgress.delete(key);
      }
    }
  }
}
```

### Constants

```typescript
export const PROXIMITY_LEARNING_RADIUS = 5;
export const YOUTH_ABSORPTION_RATE = 0.005;
export const YOUTH_ABSORPTION_THRESHOLD = 0.3;
```

---

## System 8: ReincarnationSystem (inline in PopulationSystem)

Add to `PopulationSystem`. Track recently deceased entities:

```typescript
private recentDeaths: VillageEntity[] = [];

// In the death processing block, before world.remove:
this.recentDeaths.push({ ...entity }); // shallow copy before removal
if (this.recentDeaths.length > 10) this.recentDeaths.shift();

// In the spawn block, after creating newEntity:
if (this.recentDeaths.length > 0 && Math.random() < REINCARNATION_PROBABILITY) {
  const source = this.recentDeaths[this.recentDeaths.length - 1]!;
  this.applyReincarnationEcho(newEntity, source);
  this.emitter.emit("reincarnation:detected", newEntity, source.id);
}
```

```typescript
private applyReincarnationEcho(newEntity: VillageEntity, source: VillageEntity): void {
  // Bias personality 20% toward source
  const blend = 0.2;
  const p = newEntity.personality;
  const s = source.personality;
  p.learnSpeed = p.learnSpeed * (1 - blend) + s.learnSpeed * blend;
  p.sociability = p.sociability * (1 - blend) + s.sociability * blend;
  p.creativity = p.creativity * (1 - blend) + s.creativity * blend;
  p.patience = p.patience * (1 - blend) + s.patience * blend;
  p.curiosity = p.curiosity * (1 - blend) + s.curiosity * blend;

  // Echo one sequence at fragment-level proficiency
  const sourceSequences = [...source.knowledge.knownSequences.entries()];
  if (sourceSequences.length > 0) {
    const [seqId, seqData] = sourceSequences[Math.floor(Math.random() * sourceSequences.length)]!;
    newEntity.knowledge.knownSequences.set(seqId, {
      sequenceId: seqId,
      sequenceData: seqData.sequenceData,
      proficiency: 0.15,
      source: "echo",
      learnedAt: 0,
      learnedFrom: source.id,
      lineage: [...seqData.lineage, source.id],
      lastUsedTick: 0,
    });
  }

  // Store echo metadata for rendering layer
  (newEntity as any)._reincarnationEcho = {
    sourceEntityId: source.id,
    sourceName: source.identity.name,
  };
}
```

### Constants

```typescript
export const REINCARNATION_PROBABILITY = 0.3;
export const REINCARNATION_AFFINITY_BOOST = 3.0; // learn speed multiplier for echo sequences
```

The affinity boost is applied in TeachingSystem: if the learner has an echo for the sequence being taught, multiply progressIncrement by REINCARNATION_AFFINITY_BOOST.

---

## Updated Tick Loop Order

```typescript
tick(): void {
  if (this.destroyed) return;
  this._currentTick++;

  this.lifecycleSystem.tick(this.world, this._currentTick);
  this.socialSystem.tick(this.world, this._currentTick);
  this.performanceSystem.tick(this.world, this._currentTick);       // NEW
  this.teachingSystem.tick(this.world, this._currentTick);
  this.proximityLearningSystem.tick(this.world, this._currentTick); // NEW
  this.decaySystem.tick(this.world, this._currentTick);             // NEW
  this.recombinationSystem.tick(this.world, this._currentTick);
  this.movementSystem.tick(this.world);
  this.funeralSystem.tickMourning(this.world);                      // NEW
  this.monumentSystem.tick(this.world, this._currentTick);          // NEW
  this.populationSystem.tick(this.world, this._currentTick);
}
```

---

## Test Coverage Required

Each system should have a dedicated test file in `tests/unit/village/`:

| Test File | Key Assertions |
|-----------|---------------|
| `DecaySystem.test.ts` | Proficiency decreases after grace period; patience slows decay; forgotten sequences are removed; structural memorability bonus works |
| `PerformanceSystem.test.ts` | Idle entities become watchers near performer; jams form at threshold; jams dissolve when participants leave; practice bonus applies |
| `FuneralSystem.test.ts` | Mourning state triggered on nearby death; fragmented memory preserved mid-lesson; knowledge panic on extinction |
| `MonumentSystem.test.ts` | Monument placed after N cohorts; monument dims on extinction; monument relights on reincarnation recovery |
| `ProximityLearningSystem.test.ts` | Youth absorbs from nearby performer; absorption rate scales with distance; progress cleans up on age-up |
| `ReincarnationSystem.test.ts` | Personality blending within tolerance; echo sequence present at low proficiency; affinity boost accelerates relearning |
| `EgoIntegration.test.ts` | Ego grows on teaching; diva refuses to teach; ego decays naturally |
| `GiftIntegration.test.ts` | High-sociability entity gifts during socializing; gifted sequence has reduced proficiency; source is "gifted" |
