# TKA Village Expansion Spec: Flow Arts Sims

> **Target:** Transform the existing ECS cultural simulation into a fully alive, absurdly rich flow arts micro-civilization. Each feature below hooks into existing infrastructure (Miniplex ECS, VillageOrchestrator, PerformerRig, animation-engine effects, effort-lab, PropType enum).

---

## Features Ranked by Impact

| Rank | Feature | Impact | Effort | Why |
|------|---------|--------|--------|-----|
| 1 | Effect Affinities & Culture Circles | Very High | **High** | Visually transforms the village instantly, but requires VillageAvatar migration to PerformerRig first |
| 2 | Prop Identity & Inheritance | Very High | Medium | Creates emotional attachment, maps to physical card gifting mechanic |
| 3 | Performance Circles & Jam Sessions | High | **Medium** | Emergent social clustering; requires performingSequenceId field and SocialSystem conflict resolution |
| 4 | Visual Aging (Youth/Adult/Elder) | High | **Low** | Lifecycle phases exist, no model swap needed, just scale/speed/glow |
| 5 | Sequence Decay & Practice Pressure | High | Low | 10-line system, fundamentally changes knowledge dynamics |
| 6 | Monuments & Spatial History | High | **Medium** | Needs independent generational tracking (PopulationSystem.generation is unreliable) |
| 7 | Funerals & Knowledge Panic | Medium-High | Low | Deepens emotional resonance, drives invention through loss |
| 8 | Style Schools & Lineage Drift | Medium-High | Medium | Emergent factions, requires proficiency variance tracking |
| 9 | Youth Proximity Learning | Medium | Low | Replaces formal teaching for youth phase, spatially meaningful |
| 10 | Ego & Social Hierarchy | Medium | Low | One float + behavior gate, creates emergent drama |
| 11 | Gifts (Fast Transfer) | Medium | Low | Maps directly to physical QR card mechanic |
| 12 | Pilgrimage & Trade Routes | Medium | Medium | Requires spatial clustering detection |
| 13 | Prop Maker Role | Medium | Medium | New entity archetype, interesting social graph node |
| 14 | Seasons & Environmental Shifts | Medium | Low | Parameter modulation on a timer |
| 15 | Prop Wear & Maintenance | Low-Medium | Medium | Adds economic pressure, lots of new state |

---

## Existing Infrastructure (What We're Hooking Into)

### ECS Core
- **World:** Miniplex `World<VillageEntity>` in `VillageWorld.ts`
- **Orchestrator:** `VillageOrchestrator.ts` runs tick loop: Lifecycle > Social > Teaching > Recombination > Movement > Population
- **Event Emitter:** Typed `VillageEventMap` with entity:born, entity:died, teaching:started/completed/fumble, sequence:invented/extinct, generation:changed

### Entity Components (village-types.ts)
- `IdentityComponent`: name, visualTraits (skinTone, hairColor, heightScale), generation, avatarModelId
- `PersonalityComponent`: learnSpeed, sociability, creativity, patience, curiosity
- `KnowledgeComponent`: knownSequences Map<string, LearnedSequence>, maxCapacity
- `LifecycleComponent`: birthTick, currentAge (0-1), lifespan, phase (youth/adult/elder), knowledgeGlow
- `SocialComponent`: state (idle/wandering/seeking/approaching/teaching/learning/practicing/performing/socializing/inventing/passing), partner, teachingProgress, frustrationLevel, interactionCooldown. **NOTE:** No field tracks which sequence a performing entity is currently performing. `sequenceBeingTransferred` is only set during teaching/learning. Multiple features below require adding `performingSequenceId: string | null`
- `VillageTransformComponent`: x, z, facingAngle, targetX, targetZ, speed

### 3D Rendering
- **PerformerRig:** Unified transform hierarchy (Avatar3D + Grid3D + Prop3D + EffectOrchestrator3D)
- **Avatar3D:** 16 Mixamo GLB models (x-bot, y-bot, remy, ch26, ch01, ch07, ch10, ch12, ch18, ch21, ch22, ch24, ch34, ch41, ch42, ch44), IK-driven arms, walk/idle animations
- **VillageAvatar:** Currently renders Avatar3D directly (NOT PerformerRig). Has no tipEffectMap or effect support. Migration to PerformerRig is a prerequisite for effect features
- **Prop3D:** Full PropType enum with 30+ prop variants
- **EffectOrchestrator3D:** Fire, LED, charcoal, trail effect rendering on prop tips
- **TipPositionBridge3D:** Reads tip positions from scene graph for effect placement

### Animation Engine
- **Effect Presets:** fire-presets.ts, led-presets.ts, charcoal-presets.ts, trail-presets.ts
- **Effort Lab:** 8 unified Laban effort presets with easing curves (effort-easing-unified.ts)
- **Phrase Effort Lab:** Per-beat effort interpolation (PhraseInterpolator)

### Services
- `ISequenceMutator` / `SequenceMutator`: tryInventFrom() for sequence mutation
- `PersonalityGenerator`: Gaussian trait distribution
- `LineageTracker`: Full lineage chain tracking, PopulationStats

---

## Feature 1: Effect Affinities & Culture Circles

### Concept
Each entity has a preferred visual effect (fire, LED, charcoal, trails, none). Effect preference is heritable through teaching lineage but can mutate. Entities with the same effect affinity cluster into "circles" that become visible social attractors.

### New Components

```typescript
// Add to VillageEntity
interface EffectComponent {
  affinity: EffectAffinity;           // primary effect preference
  affinityStrength: number;           // 0-1, how strongly they prefer it
  exposureHistory: Map<EffectAffinity, number>; // accumulated exposure to each type
}

type EffectAffinity = "fire" | "led" | "charcoal" | "trails" | "pure";
```

### Behavior Rules
- **Inheritance:** When an entity learns from a teacher, they absorb the teacher's effect affinity with `affinityStrength * 0.6`. If their existing affinity is different, the stronger one wins (or they become "hybrid" if within 0.1)
- **Circle Formation:** When 3+ entities with the same affinity are performing within `CIRCLE_RADIUS` (4 units), a circle forms. A ground-level ring appears in the effect's color (warm orange for fire, cool blue for LED, grey for charcoal, rainbow for trails)
- **Circle Bonuses:**
  - Fire circles: +0.2 creativity boost, +0.1 recklessness (higher fumble chance when learning)
  - LED circles: attract watchers from 2x normal distance (visually louder)
  - Charcoal circles: +0.15 patience to all participants
  - Trail circles: +0.1 invention probability
  - Pure circles (no effects): teaching fidelity +0.2 (less lossy transmission)
- **Cross-pollination:** Entities visiting a foreign circle gain temporary exposure. If cumulative exposure exceeds a threshold, their affinity can shift

### Prerequisite: VillageAvatar PerformerRig Migration

VillageAvatar currently renders Avatar3D directly with no effect support. Avatar3D does not accept `tipEffectMap`. Before this feature can work, VillageAvatar must either:

**Option A (recommended):** Migrate VillageAvatar to render via PerformerRig instead of Avatar3D directly. PerformerRig already accepts `tipEffectMap`, `showAvatar`, `showProps`, `showEffects`, `showGrid`, `bluePropType`, `redPropType`, and handles the full transform hierarchy. This also unlocks Features 2 and 3 automatically.

**Option B:** Add EffectOrchestrator3D as a sibling component inside VillageAvatar.svelte manually, reading tip positions from Avatar3D's scene graph. More surgical but creates a parallel code path.

### Rendering
- Each avatar's PerformerRig (post-migration) gets `tipEffectMap` bound to their affinity, using existing presets from `fire-presets.ts`, `led-presets.ts`, etc.
- Circle ground rings: simple `T.Mesh` with `RingGeometry` and emissive material in the effect's color
- Ambient light source at circle center tinted to effect color

### Files to Modify/Create
| File | Action |
|------|--------|
| `village-types.ts` | Add `EffectComponent` to `VillageEntity` |
| `village-constants.ts` | Add circle radius, bonus values, exposure thresholds |
| `engine/systems/CircleSystem.ts` | CREATE: detect clusters, manage circle state, apply bonuses |
| `components/VillageCircle.svelte` | CREATE: ground ring visual + ambient glow |
| `components/VillageAvatar.svelte` | **REWRITE:** Migrate from Avatar3D to PerformerRig, wire effect affinity to `tipEffectMap` |
| `PersonalityGenerator.ts` | Seed initial effect affinity with weighted distribution |
| `TeachingSystem.ts` | Transfer effect affinity during teaching |

---

## Feature 2: Prop Identity & Inheritance

### Concept
Props are individual artifacts with unique identity, ownership history, and visual wear. When an entity dies, their prop drops to the ground. Other entities can pick it up, inheriting its history. A prop wall displays retired props.

### New Types

```typescript
interface PropArtifact {
  id: string;
  propType: PropType;
  createdAtTick: number;
  createdBy: string;                  // entity id of original owner or prop maker
  ownershipChain: string[];           // entity ids in order
  totalBeatsPerformed: number;        // accumulates over all owners
  wear: number;                       // 0-1, increases with use
  favoriteSequenceId: string | null;  // most-performed sequence with this prop
  customHue: number;                  // 0-360, subtle color shift for uniqueness
  broken: boolean;                    // LED burnout, staff crack, etc.
}

interface PropComponent {
  heldProp: PropArtifact | null;
  propPreference: PropType;           // what they gravitate toward
}
```

### Behavior Rules
- **Birth:** New entities spawn with a fresh prop matching their `propPreference` (assigned by PersonalityGenerator)
- **Death Drop:** On entity death, `PropArtifact` is placed at their death location as a ground object
- **Pickup:** A propless entity (or one whose prop is broken) approaching a dropped prop picks it up. They adopt it even if it's a different PropType than their preference
- **Prop Preference Spread:** Teaching transfers prop preference with 30% probability. A fan spinner teaching a staff spinner might convince them to try fans
- **Multi-prop:** Entities can hold a second prop (low probability) if they pick up a dropped one while already holding one. They alternate which they perform with
- **Wear:** Each performance tick increments `totalBeatsPerformed`. Wear = totalBeatsPerformed / WEAR_LIFESPAN. At wear > 0.8, visual degradation starts. At wear > 1.0, prop breaks
- **Broken Props:** Broken props get placed on the prop wall automatically. Entity reverts to propless state and seeks a new prop

### Prop Wall
- Fixed location in the village (edge of arena)
- Array of `PropArtifact` objects with `broken: true`
- Rendered as small prop models mounted on a flat surface
- Hovering/clicking shows ownership chain and total beats performed
- Essentially a graveyard for props that tells the village's material history

### Visual Treatment
- `customHue` applies a subtle color shift via HSL rotation on the prop material
- Wear shows as reduced emissive intensity and slight texture darkening
- Dropped props on the ground have a subtle pulse/glow to attract attention
- Broken props on the wall are dimmed with a crack overlay

### Files to Modify/Create
| File | Action |
|------|--------|
| `village-types.ts` | Add `PropArtifact`, `PropComponent` to entity |
| `village-constants.ts` | WEAR_LIFESPAN, PROP_PREFERENCE_TRANSFER_CHANCE, etc. |
| `engine/systems/PropSystem.ts` | CREATE: wear accumulation, death drops, pickup logic, prop wall |
| `components/VillageDroppedProp.svelte` | CREATE: ground prop with pulse effect |
| `components/VillagePropWall.svelte` | CREATE: mounted broken props display |
| `components/VillageAvatar.svelte` | Bind entity's PropArtifact.propType to PerformerRig |
| `PersonalityGenerator.ts` | Assign initial propPreference |
| `LifecycleSystem.ts` | Trigger prop drop on death |
| `PopulationSystem.ts` | Create PropArtifact on entity birth |

---

## Feature 3: Performance Circles & Jam Sessions

### Concept
High-proficiency entities spontaneously start performing in place. Nearby idle entities gather to watch. If enough watchers accumulate, it escalates into a jam circle with elevated invention probability.

### Prerequisites

1. **Add `performingSequenceId: string | null` to `SocialComponent`.** Currently there is no field tracking which sequence a performing entity is performing. `sequenceBeingTransferred` is only populated during teaching/learning. This field is also required by Features 5 (Decay) and 9 (Youth Proximity Learning).

2. **Resolve SocialSystem performing timer conflict.** `SocialSystem.handlePerforming()` auto-expires performing state after 25-40 ticks and resets to idle. Jam circles require sustained performing. Fix: add `inJam: boolean` to `SocialComponent` and skip the auto-expire timer when `inJam` is true, OR move all performing logic out of SocialSystem into the new PerformanceSystem entirely.

### New Social States
Add to `AvatarBehaviorState`: `"watching"` and `"jamming"`

### Behavior Rules
- **Solo Performance Trigger:** An entity with proficiency > 0.8 on any sequence and social state `idle` for > PERFORMANCE_IDLE_THRESHOLD ticks has a `sociability * 0.02` chance per tick of entering `performing` state
- **Watcher Attraction:** Performing entities emit an attraction radius (PERFORMANCE_ATTRACTION_RADIUS = 6). Idle entities within range with curiosity > 0.3 enter `watching` state, face the performer, and stop moving
- **Jam Escalation:** When 3+ entities are watching a performer, all watchers gain a temporary creativity boost (+0.2 for CREATIVITY_BOOST_DURATION ticks). If a watcher's creativity + boost > 0.7 and they know a sequence, they can enter `performing` state too, turning it into a jam
- **Jam Circle Benefits:**
  - All participants: invention probability multiplied by 3x
  - Watchers: passive learning (like youth proximity learning but slower)
  - Performers: proficiency on performed sequence increases by 0.01/tick (practice effect)
- **Jam Dissolution:** Jam breaks up when performer count drops below 2 or total participants drop below 4

### Visual Treatment
- Performing entity plays their sequence animation on loop
- Watchers face the performer, play idle animation
- Jam circle gets a subtle ground glow (white/neutral, distinct from effect circles)
- Camera auto-pans toward active jams if no user input for 30s

### Files to Modify/Create
| File | Action |
|------|--------|
| `village-types.ts` | Add `watching`, `jamming` to AvatarBehaviorState; add `performingSequenceId: string \| null` and `inJam: boolean` to SocialComponent |
| `village-constants.ts` | PERFORMANCE_IDLE_THRESHOLD, PERFORMANCE_ATTRACTION_RADIUS, JAM_THRESHOLD, CREATIVITY_BOOST |
| `engine/systems/PerformanceSystem.ts` | CREATE: solo performance trigger, watcher attraction, jam escalation/dissolution |
| `SocialSystem.ts` | Guard `handlePerforming` auto-expire with `inJam` check; add transition rules for watching/jamming states; set `performingSequenceId` when entering performing state |
| `components/VillageJamCircle.svelte` | CREATE: ground glow for active jams |

---

## Feature 4: Visual Aging (Youth/Adult/Elder)

### Concept
Entity appearance changes across lifecycle phases. Youth phase entities are smaller and move erratically. Elders move slowly with reduced animation amplitude. The LifecycleComponent already tracks phase.

### Implementation

```typescript
// Derive from existing LifecycleComponent.phase
const AGE_VISUAL_CONFIG: Record<LifecyclePhase, AgeVisualConfig> = {
  youth: {
    heightScale: 0.7,
    walkSpeedMultiplier: 1.25,
    animationAmplitude: 1.1,      // slightly exaggerated
    gripOffset: 0.05,             // prop held slightly off-center
    modelTier: "youth",           // indexes into avatar model pool
    emissiveGlow: 0,
  },
  adult: {
    heightScale: 1.0,
    walkSpeedMultiplier: 1.0,
    animationAmplitude: 1.0,
    gripOffset: 0,
    modelTier: "adult",
    emissiveGlow: 0,
  },
  elder: {
    heightScale: 0.95,
    walkSpeedMultiplier: 0.6,
    animationAmplitude: 0.7,      // quieter, more refined motion
    gripOffset: 0,
    modelTier: "elder",
    emissiveGlow: 0,              // overridden by knowledgeGlow
  },
};
```

### Model Assignment
- Each entity receives one avatar model at birth from the 16-model pool (existing dedup in VillageWorld.ts)
- That model is their identity for life. No model swaps on phase transition.
- Aging is conveyed through heightScale, walk speed, animation amplitude, and knowledge glow. Same person, different carriage.
- PropArtifact also stays the same across transitions (two threads of visual continuity: face and prop)

### Elder Knowledge Glow
- `LifecycleComponent.knowledgeGlow` already exists (0-1 derived from knowledge breadth)
- Render as a soft emissive halo on the avatar mesh, intensity = knowledgeGlow * 0.5
- A dying elder with 10 known sequences glows visibly, surrounded by students trying to absorb their last teachings

### Animation Amplitude
- Scale IK target positions toward body center by `(1 - animationAmplitude)` factor
- Same sequence, same grid positions, but the physical range contracts with age
- Anyone who's watched an experienced practitioner knows this quality: smaller but more precise

### Files to Modify/Create
| File | Action |
|------|--------|
| `village-constants.ts` | Add AGE_VISUAL_CONFIG |
| `components/VillageAvatar.svelte` | Read lifecycle.phase, apply heightScale, animation amplitude, bind knowledge glow |
| `MovementSystem.ts` | Multiply speed by phase walkSpeedMultiplier |

---

## Feature 5: Sequence Decay & Practice Pressure

### Concept
Sequences that aren't practiced lose proficiency over time. Creates pressure to either practice regularly or teach before you forget.

### Implementation
Add to `TeachingSystem.tick()` or create a new `DecaySystem`:

```typescript
// Run once per tick for all entities
for (const entity of world.entities) {
  for (const [seqId, learned] of entity.knowledge.knownSequences) {
    const ticksSinceUsed = currentTick - learned.lastUsedTick;
    if (ticksSinceUsed > DECAY_GRACE_PERIOD) {
      const decayRate = DECAY_PER_TICK * (1 - entity.personality.patience * 0.5);
      learned.proficiency = Math.max(0.05, learned.proficiency - decayRate);
    }
    if (learned.proficiency < FORGET_THRESHOLD) {
      entity.knowledge.knownSequences.delete(seqId);
      emitter.emit("sequence:forgotten", entity, seqId);
    }
  }
}
```

### Constants
```typescript
DECAY_GRACE_PERIOD = 200;     // ticks before decay starts
DECAY_PER_TICK = 0.001;       // base decay rate
FORGET_THRESHOLD = 0.1;       // below this, sequence is lost
```

### New Fields
- Add `lastUsedTick: number` to `LearnedSequence`
- Update lastUsedTick when performing or teaching a sequence
- Add `"sequence:forgotten"` to `VillageEventMap` (typed event emitter requires this)
- **Dependency:** Updating lastUsedTick during performing requires `performingSequenceId` on SocialComponent (see Feature 3 prerequisites)

### Emergent Behavior
- Entities with high patience decay slower (patient people practice mentally)
- Teaching resets the decay timer for both teacher and learner
- Creates a "use it or teach it" dynamic: knowledge wants to move or it dies
- Elders with many sequences can't maintain them all, forcing prioritization

### Files to Modify/Create
| File | Action |
|------|--------|
| `engine/systems/DecaySystem.ts` | CREATE: proficiency decay and forgetting |
| `village-types.ts` | Add `lastUsedTick` to `LearnedSequence`, add `"sequence:forgotten"` to `VillageEventMap` |
| `village-constants.ts` | DECAY_GRACE_PERIOD, DECAY_PER_TICK, FORGET_THRESHOLD |
| `TeachingSystem.ts` | Update lastUsedTick on teaching completion (both teacher and learner) |
| `SocialSystem.ts` | Update lastUsedTick when entering performing state (requires `performingSequenceId`) |
| `VillageOrchestrator.ts` | Add DecaySystem to tick loop (after Teaching, before Recombination) |

---

## Feature 6: Monuments & Spatial History

### Concept
When a sequence survives past a generation threshold through unbroken lineage, a small marker appears at the location where it was first invented. The village accumulates visible history.

### New Types

```typescript
interface Monument {
  sequenceId: string;
  worldX: number;
  worldZ: number;
  createdAtTick: number;
  inventedBy: string;           // entity name
  generationsSurvived: number;  // updates each generation
  extinctAt: number | null;     // tick when sequence went extinct (dimmed monument)
}
```

### Behavior Rules
- **Placement Trigger:** When MonumentSystem detects a sequence has survived through MONUMENT_GENERATION_THRESHOLD (3) consecutive generations via teaching lineage, place a monument at the location where the original inventor stood when they invented it
- **Growth:** Monument gets slightly taller/brighter each generation it survives
- **Extinction:** When a sequence goes extinct (last carrier dies without teaching it), the monument dims but remains. A ghost of what was
- **Density = Creativity Map:** Over time, monument clusters reveal where the village's creative hotspots were. The spatial distribution tells a story

**Generation Counter Warning:** `PopulationSystem` increments `this.generation` on every death batch, not per actual generational turnover. If entities die on separate ticks, the counter inflates. MonumentSystem must NOT use `PopulationSystem.currentGeneration` directly for survival tracking. Instead, track generational survival independently: record which distinct "birth cohorts" have carried a sequence (via `entity.identity.generation` at time of learning), and count how many unique cohort numbers appear in the lineage chain. This is the real generational depth.

### Visual Treatment
- Small upright stone/pillar mesh (procedural CylinderGeometry, height 0.3-0.8 based on generations survived)
- Emissive glow in the effect affinity color of the original inventor
- Extinct monuments: grey, no glow, slight transparency
- Tooltip on hover: sequence name, inventor name, generations survived

### Files to Modify/Create
| File | Action |
|------|--------|
| `village-types.ts` | Add Monument type |
| `village-state.svelte.ts` | Add monuments array |
| `engine/systems/MonumentSystem.ts` | CREATE: check lineage survival, place/update/dim monuments |
| `components/VillageMonument.svelte` | CREATE: pillar mesh with glow |
| `LineageTracker.ts` | Add method to check generational survival of a sequence |

---

## Feature 7: Funerals & Knowledge Panic

### Concept
When an elder dies who was the sole carrier of a sequence, nearby entities react visibly. If a learner was mid-lesson when the teacher died, they retain a corrupted fragment.

### Behavior Rules
- **Death Detection:** On `entity:died`, check if any of their sequences are now extinct (no other living carrier)
- **Gathering:** Entities within FUNERAL_RADIUS (5 units) enter a `"mourning"` state for MOURNING_DURATION (30 ticks). They stop, face the death location, play idle animation
- **Fragmented Memory:** If the dead entity had an active teaching partner (social.partner !== null), the learner retains the sequence at their current teachingProgress (which is below PROFICIENCY_THRESHOLD). This "fragment" has a special source: `"fragmented"`. Fragmented sequences:
  - Cannot be taught (too incomplete)
  - Have higher mutation chance in RecombinationSystem
  - Might seed a new invention that is "inspired by" the lost sequence
- **Extinction Cascade:** If the last carrier of multiple sequences dies, it triggers a "knowledge panic" where nearby entities with high curiosity enter `seeking` state aggressively, trying to find anyone who knows *anything*

### New Social States
Add `"mourning"` to AvatarBehaviorState

### Files to Modify/Create
| File | Action |
|------|--------|
| `village-types.ts` | Add `"mourning"` to `AvatarBehaviorState`; extend `LearnedSequence.source` union with `"fragmented"` |
| `engine/systems/FuneralSystem.ts` | CREATE: death reaction, gathering, fragment preservation |
| `TeachingSystem.ts` | On teacher death mid-lesson, create fragmented LearnedSequence |
| `RecombinationSystem.ts` | Higher mutation chance for fragmented sequences |
| `SocialSystem.ts` | Add `case "mourning"` to switch statement (entity stays still, decrements timer, returns to idle) |
| `village-constants.ts` | FUNERAL_RADIUS, MOURNING_DURATION |

---

## Feature 8: Style Schools & Lineage Drift

### Concept
Teaching is lossy (LOSSY_TRANSMISSION_BASE already = 0.1). Let that lossiness accumulate as "style drift" that becomes visible. Entities taught by the same lineage share visual traits. Factions emerge.

### New Fields

```typescript
// Add to LearnedSequence
interface StyleSignature {
  amplitudeScale: number;       // 0.8-1.2, how big the movements are
  tempoOffset: number;          // -0.1 to 0.1, slightly faster/slower
  effortBias: EffortQuality;    // dominant Laban effort quality
}
```

### Behavior Rules
- **Style Inheritance:** When teaching completes, the learner's StyleSignature for that sequence is the teacher's signature plus a small random mutation (gaussian, stddev 0.02)
- **Visual Clustering:** Entities with similar StyleSignatures (euclidean distance < STYLE_SIMILARITY_THRESHOLD) develop matching tint overlays, creating visible "schools"
- **School Formation:** When 3+ living entities share a style cluster, they get a shared color tint derived from hashing the founding teacher's entity id
- **Refusal:** Entities with very different style signatures have a 10% chance of refusing to learn from each other ("that's not how we do it")

### Files to Modify/Create
| File | Action |
|------|--------|
| `village-types.ts` | Add StyleSignature to LearnedSequence |
| `engine/systems/StyleDriftSystem.ts` | CREATE: track clusters, assign school tints |
| `TeachingSystem.ts` | Apply style inheritance + mutation on teaching complete |
| `SocialSystem.ts` | Style compatibility check before teaching pair formation |
| `components/VillageAvatar.svelte` | Apply school tint overlay to avatar material |

---

## Feature 9: Youth Proximity Learning

### Concept
Youth-phase entities don't enter formal teaching pairs. They absorb from proximity. Whatever sequences are being performed near them get imprinted at low proficiency.

### Implementation
In a new `ProximityLearningSystem` or as a branch in `TeachingSystem`:

```typescript
for (const youth of world.entities) {
  if (youth.lifecycle.phase !== "youth") continue;
  
  for (const adult of world.entities) {
    if (adult.social.state !== "performing" && adult.social.state !== "teaching") continue;
    
    const dist = distance(youth.transform, adult.transform);
    if (dist > PROXIMITY_LEARNING_RADIUS) continue;
    
    const activeSeqId = adult.social.sequenceBeingTransferred 
      ?? getPerformingSequenceId(adult);
    if (!activeSeqId || youth.knowledge.knownSequences.has(activeSeqId)) continue;
    
    // Passive absorption: very slow, weighted by proximity
    const absorptionRate = (1 - dist / PROXIMITY_LEARNING_RADIUS) * YOUTH_ABSORPTION_RATE;
    // Track partial absorption in a separate map until threshold reached
    updateAbsorptionProgress(youth, activeSeqId, absorptionRate, adult.id, currentTick);
  }
}
```

### Constants
```typescript
PROXIMITY_LEARNING_RADIUS = 5;
YOUTH_ABSORPTION_RATE = 0.005;       // per tick, much slower than formal teaching
YOUTH_ABSORPTION_THRESHOLD = 0.3;    // proficiency at which it becomes a real LearnedSequence
```

**Dependency:** The `getPerformingSequenceId(adult)` call in the code above requires `performingSequenceId` on SocialComponent (see Feature 3 prerequisites). For teaching adults, `sequenceBeingTransferred` already provides this. For performing adults, the new field is required.

### Emergent Behavior
- Where a youth is born determines what they learn. Spatial layout shapes culture
- Youth near a jam circle absorb from multiple performers simultaneously
- Youth near the fire circle absorb fire-affinity sequences preferentially

### Files to Modify/Create
| File | Action |
|------|--------|
| `engine/systems/ProximityLearningSystem.ts` | CREATE |
| `village-types.ts` | Add absorptionProgress: Map<string, number> to youth state |
| `village-constants.ts` | PROXIMITY_LEARNING_RADIUS, YOUTH_ABSORPTION_RATE/THRESHOLD |
| `VillageOrchestrator.ts` | Add to tick loop after TeachingSystem |

---

## Feature 10: Ego & Social Hierarchy

### Concept
Entities develop pride from teaching and performing. High-pride entities become selective or stop teaching entirely.

### Implementation
Add `ego: number` (0-1) to `PersonalityComponent`.

```typescript
// In TeachingSystem, on successful teach:
teacher.personality.ego = Math.min(1, teacher.personality.ego + 0.05);

// In PerformanceSystem, when watchers gather:
performer.personality.ego = Math.min(1, performer.personality.ego + 0.01 * watcherCount);

// In SocialSystem, teaching pair formation gate:
if (teacher.personality.ego > 0.7) {
  // Only teach if learner knows fewer sequences (ego demands hierarchy)
  if (learner.knowledge.knownSequences.size >= teacher.knowledge.knownSequences.size) {
    continue; // "I have nothing to learn from you"
  }
}
if (teacher.personality.ego > 0.9) {
  // Diva mode: never teaches, only performs
  continue;
}

// Natural decay: ego -= 0.002/tick (humility through aging)
```

### Emergent Behavior
- Divas hoard knowledge and die with it. The village learns that ego is maladaptive
- High-ego entities attract more watchers (charisma) but transfer less knowledge
- Entities with high patience + low ego become the most effective teachers
- An ego epidemic can cause a knowledge extinction event

---

## Feature 11: Gifts (Fast Transfer)

### Concept
High-sociability entities can gift a sequence without the full teaching loop, but at reduced proficiency.

### Implementation
Add to SocialSystem: when two entities are `socializing` and the gifter's `sociability > 0.8`:

```typescript
const giftChance = gifter.personality.sociability * 0.03;
if (Math.random() < giftChance) {
  // Pick a random sequence the receiver doesn't know
  const giftable = findGiftableSequence(gifter, receiver);
  if (giftable) {
    const gifted: LearnedSequence = {
      ...giftable,
      proficiency: giftable.proficiency * 0.4,  // reduced
      source: "gifted",
      learnedFrom: gifter.id,
      learnedAt: currentTick,
      lineage: [...giftable.lineage, gifter.id],
    };
    receiver.knowledge.knownSequences.set(gifted.sequenceId, gifted);
    emitter.emit("teaching:completed", gifter, receiver, gifted.sequenceId);
  }
}
```

### Connection to Physical Cards
This directly models the QR code gifting mechanic for physical TKA sequence cards. The village demonstrates: sequences spread faster through gifting but at lower fidelity. Teaching is slow but thorough. Both are needed for cultural health.

### Files to Modify/Create
| File | Action |
|------|--------|
| `village-types.ts` | Extend `LearnedSequence.source` union with `"gifted"` |
| `SocialSystem.ts` | Add gifting logic to `handleSocializing` |

---

## Feature 12: Pilgrimage & Trade Routes

### Concept
Entities that have learned everything available locally start wandering farther, seeking new knowledge. Their trails form visible trade routes.

### Implementation
- Detect knowledge saturation: entity knows sequences from all nearby (within CLUSTER_RADIUS) entities
- Enter `"pilgrim"` state: targetX/targetZ set to opposite side of arena
- Pilgrim walk speed = WALK_SPEED_ADULT * 1.5 (urgency)
- When two pilgrims meet, teaching speed is doubled (mutual curiosity)
- Trail rendering: store last 100 positions, render as fading line (THREE.Line with opacity gradient)

### Files to Modify/Create
| File | Action |
|------|--------|
| `village-types.ts` | Add `"pilgrim"` to `AvatarBehaviorState` |
| `engine/systems/PilgrimageSystem.ts` | CREATE: saturation detection, long-range wandering |
| `SocialSystem.ts` | Add `case "pilgrim"` to switch statement (skip normal idle/wander logic) |
| `MovementSystem.ts` | Apply pilgrim speed multiplier |
| `components/VillageTrail.svelte` | CREATE: fading trail line renderer |

---

## Feature 13: Prop Maker Role

### Concept
A specialized entity that doesn't spin but crafts props. High patience, low sociability. Entities visit when their prop breaks or they want a new one.

### Implementation
- On village init, spawn 1 entity with `role: "maker"` (new field on IdentityComponent)
- Maker sits at arena edge, stationary, never enters teaching/performing states
- Broken-prop entities pathfind to maker, enter `"commissioning"` state
- After CRAFT_DURATION ticks, maker produces a new PropArtifact
- Maker's personality influences prop quality (patience = higher WEAR_LIFESPAN on crafted props)

### Emergent Behavior
- Maker is a quiet critical node: everyone depends on them, they never perform
- If maker dies, prop supply crisis until a new one spawns
- Maker accumulates prop-crafting lineage (this staff was made by the 3rd generation maker)

---

## Feature 14: Seasons & Environmental Shifts

### Concept
Periodic parameter modulation creates rhythmic variation in village behavior.

### Implementation
```typescript
type Season = "festival" | "winter" | "migration" | "normal";

const SEASON_DURATION = 300; // ticks per season
const SEASON_CYCLE: Season[] = ["normal", "festival", "normal", "winter", "normal", "migration"];

const SEASON_MODIFIERS: Record<Season, Partial<VillageConfig>> = {
  normal: {},
  festival: { inventionRate: 0.015, /* 3x normal */ },
  winter: { /* reduce speeds, reduce interaction radius */ },
  migration: { /* teleport half population to opposite side */ },
};
```

- **Festival:** Sociability bonuses, jam circles form spontaneously, invention rate spikes
- **Winter:** Movement slows, interaction radius shrinks, entities cluster for warmth
- **Migration:** Half the population relocates randomly, forcing network rebuilds

---

## Feature 15: Prop Wear & Maintenance

### Concept
LED burnout, staff cracks, poi tangles. Each prop type has a unique failure mode.

### Prop-Specific Wear

```typescript
const PROP_WEAR_PROFILES: Partial<Record<PropType, WearProfile>> = {
  [PropType.STAFF]: { wearRate: 0.0005, failureMode: "crack", repairTicks: 20 },
  [PropType.FAN]: { wearRate: 0.0008, failureMode: "fabric-tear", repairTicks: 30 },
  [PropType.POI]: { wearRate: 0.0003, failureMode: "tangle", repairTicks: 5 },
  [PropType.TORCH]: { wearRate: 0.001, failureMode: "fuel-depleted", repairTicks: 10 },
  [PropType.CLUB]: { wearRate: 0.0004, failureMode: "grip-worn", repairTicks: 15 },
};
```

- Poi tangles are quick to fix (low repairTicks) but happen during performance (embarrassing)
- Torches deplete fast but refuel quickly at a fuel station (spatial gathering point)
- Staff cracks are rare but terminal (goes to prop wall)

---

## Implementation Order (Recommended)

### Phase 0: Foundation (1 session, unlocks everything downstream)
0. **Add `performingSequenceId` to SocialComponent** -- Required by Features 3, 5, 9. Set it in SocialSystem when entering performing state (pick highest-proficiency sequence). Tiny change, massive unlock.
0. **Add `inJam: boolean` to SocialComponent** -- Required by Feature 3. Guard `handlePerforming` auto-expire.

### Phase 1: Visual Life (1-2 sessions)
1. **Feature 5: Sequence Decay** -- genuinely 10 lines, fundamentally changes dynamics
2. **Feature 7: Funerals & Knowledge Panic** -- low effort, high emotional payoff, pairs naturally with decay
3. **Feature 10: Ego** -- one float + behavior gate, maximum drama

### Phase 2: Social Emergence (2-3 sessions)
4. **Feature 3: Performance Circles** -- emergent jams (depends on Phase 0)
5. **Feature 11: Gifts** -- mirrors physical card mechanic, tiny implementation
6. **Feature 9: Youth Proximity Learning** -- spatial culture shaping (depends on Phase 0)

### Phase 3: Visual Identity (2-3 sessions)
7. **Feature 4: Visual Aging** -- scale, speed, glow, no model swap needed
8. **Feature 6: Monuments** -- needs independent generational tracking in MonumentSystem
9. **Feature 8: Style Schools** -- lineage drift, visible factions

### Phase 4: Material Culture (2-3 sessions)
10. **Feature 2: Prop Identity** -- artifact system, prop wall, death drops
11. **Feature 13: Prop Maker** -- new archetype
12. **Feature 15: Prop Wear** -- economic pressure (depends on Feature 2)

### Phase 5: PerformerRig Migration + Effects (2-3 sessions)
13. **VillageAvatar PerformerRig migration** -- prerequisite for Feature 1, rewrite VillageAvatar.svelte
14. **Feature 1: Effect Affinities** -- fire/LED/charcoal circles (depends on migration)
15. **Feature 14: Seasons** -- parameter modulation on a timer

### Phase 6: World Systems (1-2 sessions)
16. **Feature 12: Pilgrimage** -- trade routes, trail rendering

---

## Success Metric

When someone watches the village for 5 minutes and says "wait, did that just happen organically?" -- you're done. The goal is emergent storytelling. Every feature above is designed to create moments that look authored but aren't. The notation system isn't just being demonstrated; it's being *lived in*.
