# TKA Village — Design Specification

**Date:** 2026-04-05
**Status:** Draft
**Location:** Lab module tab ("village")

## Overview

TKA Village is a generational cultural simulation where autonomous avatars teach each other TKA sequences, age, and pass knowledge across lifetimes. Sequences are the unit of culture — they spread, mutate via LOOP transformations, and evolve across generations. The simulation runs headless at any speed, with a renderer that subscribes to entity state.

## Context

### What exists today

- **Miniplex ECS** in `src/lib/features/realm/core/ecs-world.ts` — TransformComponent, VelocityComponent, MeshComponent, archetypes, factory functions
- **Avatar pipeline** — SequenceConverter → PropStateInterpolator → Avatar3D (IK-driven)
- **PerformerManager** — multi-avatar orchestration with formation transitions
- **AvatarInstanceState** — per-avatar sequence playback, locomotion, facing angle
- **LOOP transforms** — `ISequenceTransformer` service (DI-registered) with 6 transforms (mirror, rotate, swap, flip, invert, rewind) in `SequenceTransformer.ts`
- **AnimationStateMachine** — multi-state blending with transitions
- **Lab module** — dynamic tab loader with 17 existing tabs

### What we're building

A simulation engine with four new ECS component types and six systems, rendered as a lab tab with a Threlte 3D scene. The engine is context-agnostic — the lab tab is one surface, but the same engine can drive a museum room, standalone screensaver, or game embed.

**Critical constraint:** The `engine/` directory has zero Svelte imports. All engine code is pure TypeScript, testable in Node.js without a browser. The renderer layer bridges ECS state into Svelte/Threlte reactivity.

## Architecture

### Component Model

Each avatar is a Miniplex entity with these components:

```typescript
// Identity & appearance
interface IdentityComponent {
  name: string;                    // generated name
  visualTraits: AvatarVisualTraits; // skin, hair color, body proportions
  generation: number;              // which generation this avatar belongs to
}

// What they know
interface KnowledgeComponent {
  knownSequences: Map<string, LearnedSequence>; // id → sequence + proficiency
  maxCapacity: number;             // how many sequences they can hold (trait-influenced)
}

interface LearnedSequence {
  sequence: SequenceData;
  proficiency: number;             // 0-1, affects teaching quality
  source: 'seed' | 'taught' | 'invented';
  learnedAt: number;              // simulation tick
  learnedFrom: string | null;     // entity id of teacher
  lineage: string[];              // chain of entity ids back to origin
}

// Personality traits
interface PersonalityComponent {
  learnSpeed: number;       // 0-1, how fast they pick up sequences
  sociability: number;      // 0-1, how often they seek interaction
  creativity: number;       // 0-1, probability of recombination vs faithful teaching
  patience: number;         // 0-1, teaching effectiveness (slow = clear)
  curiosity: number;        // 0-1, preference for learning from diverse teachers
}

// Lifecycle
interface LifecycleComponent {
  birthTick: number;
  currentAge: number;       // normalized 0-1 (0=youth, 1=elder)
  lifespan: number;         // ticks until death (varies per avatar)
  phase: 'youth' | 'adult' | 'elder';
  knowledgeGlow: number;    // 0-1, derived from knowledge breadth (visual)
}

// Social / behavioral state machine
interface SocialComponent {
  state: AvatarBehaviorState;
  partner: string | null;            // entity id
  teachingProgress: number;          // 0-1 during teach/learn
  sequenceBeingTransferred: string | null;
  frustrationLevel: number;          // 0-1 during learning
  idleTimer: number;                 // ticks since last interaction
  interactionCooldown: number;       // ticks before seeking next partner
}

type AvatarBehaviorState =
  | 'idle'           // standing, looking around
  | 'wandering'      // walking to a new spot
  | 'seeking'        // looking for a partner
  | 'approaching'    // walking toward chosen partner
  | 'teaching'       // actively demonstrating
  | 'learning'       // actively mirroring
  | 'practicing'     // solo practice after learning
  | 'performing'     // solo performance of a known sequence
  | 'socializing'    // hanging out, no sequence transfer
  | 'inventing'      // recombining known sequences
  | 'passing'        // death animation/transition
  ;
```

### System Model

Six systems process entities each tick. The simulation tick rate is decoupled from rendering — headless mode can run thousands of ticks per second.

#### 1. LifecycleSystem

Advances age for all living entities. Transitions between youth/adult/elder phases. When an entity reaches end-of-life, transitions to `passing` state. After the passing animation window, removes the entity and spawns a replacement youth. Manages population target (spawns/removes to maintain configured count).

**Aging curve:** Non-linear. Youth is short (10% of lifespan), adult is long (70%), elder is medium (20%). Phase transitions trigger visual changes (posture, movement speed, glow intensity).

**Generation tracking:** Each new spawn increments the global generation counter. The simulation tracks which generation is active.

#### 2. SocialSystem

Drives the behavioral state machine. Each tick, evaluates the current state and transitions:

- `idle` → after `idleTimer` exceeds threshold (influenced by sociability), transition to `seeking` or `wandering` or `performing`
- `wandering` → pick a random point in the arena, walk there. On arrival, go `idle`
- `seeking` → scan nearby entities for compatible partners. Prefer: entities not in cooldown, entities with different knowledge, entities with high reputation. On finding a partner, both transition to `approaching`
- `approaching` → walk toward partner. On arrival, negotiate roles: the one with more unknown sequences to share becomes teacher. If neither has anything to share, go to `socializing`
- `teaching` / `learning` → paired states. Teacher demonstrates beat by beat. See TeachingSystem for choreography. On completion, learner gains sequence. Both enter cooldown
- `practicing` → solo playback of just-learned sequence. Builds proficiency. Short duration
- `performing` → solo playback of a random known sequence. Duration varies. Elders perform more often
- `socializing` → face each other, idle animations. Short duration, then return to `idle`
- `inventing` → triggered probabilistically by creativity trait when an avatar has 2+ sequences. Applies a random LOOP transform to a known sequence. If the result is novel (not already known by this avatar), it's added to knowledge. Otherwise discarded

#### 3. TeachingSystem

Manages the beat-by-beat teaching choreography for paired teacher/learner entities:

1. Engine sets `social.sequenceBeingTransferred` and `social.state = 'teaching'` on the teacher entity
2. Renderer bridge detects the state change, loads the sequence into the teacher's `AvatarInstanceState` at `speed = 0.5` (configurable), and loads the same sequence into the learner's `AvatarInstanceState` with the learner facing the teacher (mirrored facing angle)
3. For each beat: teacher's playback advances, then learner's playback attempts to follow
4. Learner's proficiency starts at 0. Each beat attempt: `proficiency += learnSpeed * patience_of_teacher * random(0.5, 1.5)`
5. If random roll < `(1 - proficiency) * 0.3`, learner "fumbles" — frustration animation triggers, beat retries
6. When proficiency crosses 0.7, sequence is learned. Celebration micro-animation
7. Teaching duration scales with sequence length and learner's learnSpeed

**Frustration mechanic:** Frustration accumulates on fumbles, decays between beats. At frustration > 0.8, there's a chance the learner gives up (rare, influenced by patience of teacher). This produces realistic-looking struggle. The engine emits a `teaching:fumble` event; the renderer subscribes and triggers a frustration animation (arms drop, brief head shake — a new animation state added to the AnimationStateMachine for village avatars).

**Fumble/celebration animations:** These don't exist in the current animation system and must be added as new AnimationStateMachine states. Fumble = arms drop briefly + optional head shake. Celebration = brief arm raise. These are simple pose blends, not full motion-captured animations — the IK system can drive them by temporarily overriding hand targets.

**Lossy transmission:** When teaching completes, there's a `(1 - patience) * 0.1` chance per beat of a micro-mutation (orientation drift, location shift by one cardinal position). This is the "telephone game" effect.

**Speed control:** The existing `AvatarInstanceState` supports a `speed` property that scales playback rate. Teaching uses `speed = 0.5` by default (half-speed demonstration). The engine controls pacing by advancing the teaching beat counter; the renderer syncs playback position accordingly.

#### 4. RecombinationSystem

When an avatar enters `inventing` state:

1. Pick two known sequences
2. Select a LOOP transform: mirror, rotate, swap, flip, invert, or rewind
3. Apply the transform to one sequence
4. Validate the result (must be a valid sequence — start positions connect, etc.)
5. If valid and novel (not known by this avatar), add to knowledge with source='invented'
6. If invalid, discard — the avatar "tried something that didn't work"

Uses `ISequenceTransformer` from the DI container — the production transform service, not the simplified help-modal examples in `transform-functions.ts`. The `SequenceMutator` wraps `ISequenceTransformer` with validation (checking that the transformed result is a valid connectable sequence).

**Creative avatars** (high creativity trait) enter inventing state more often and try more exotic transforms (compound transforms: mirror + swap, rotate + invert). Low-creativity avatars mostly teach faithfully.

#### 5. MovementSystem

Handles spatial positioning. Avatars move within a bounded arena:

- Walking speed decreases with age (youth: 1.0x, adult: 0.8x, elder: 0.5x)
- Posture changes with age (slight forward lean for elders — applied as facing angle offset)
- Pathfinding is simple: direct walk toward target with collision avoidance (steer away from nearby entities)
- Avatars cluster naturally because seeking behavior targets nearby entities

The engine stores raw position, velocity, and facing angle in a `TransformComponent` (plain TypeScript, no Svelte). The renderer layer creates `AvatarInstanceState` wrappers that sync from ECS entity data each frame — the engine never imports Svelte code.

#### 6. PopulationSystem

Manages births and deaths to maintain target population:

- When an entity completes `passing`, remove it from the world
- Spawn a new youth entity at the arena edge
- Seed the new entity with 0-1 random sequences from the global seed pool (simulates "innate knowledge" or "heard something before arriving")
- Track population statistics: total alive, average age, total sequences known, unique sequences in population, extinction events (a sequence known by 0 entities)

### ECS World: Separate Instance

The Village creates its own `World<VillageEntity>` — not reusing the realm's world. The realm ECS has realm-specific components (physics, chunks, LOD) with a fixed `Entity` type. The Village defines its own `VillageEntity` interface with village-specific components. This keeps the engine self-contained and portable.

```typescript
interface VillageEntity {
  id: string;
  identity: IdentityComponent;
  knowledge: KnowledgeComponent;
  personality: PersonalityComponent;
  lifecycle: LifecycleComponent;
  social: SocialComponent;
  transform: VillageTransformComponent; // position, velocity, facingAngle — plain TS, no Svelte
}

interface VillageTransformComponent {
  x: number;
  z: number;
  facingAngle: number;
  targetX: number;
  targetZ: number;
  speed: number;
}
```

### Simulation Orchestrator

A non-ECS orchestrator that owns the world and systems:

```typescript
interface IVillageOrchestrator {
  // Lifecycle
  initialize(config: VillageConfig): void;
  tick(): void;                        // advance one simulation step
  run(ticksPerSecond: number): void;   // start continuous simulation
  pause(): void;
  reset(): void;
  destroy(): void;

  // Time control
  speed: number;                       // multiplier (1x = real-time, 100x = fast-forward)
  currentTick: number;
  currentGeneration: number;

  // Population
  entities: VillageEntity[];
  populationStats: PopulationStats;

  // God mode interventions
  injectSequence(sequence: SequenceData): void;   // add to seed pool, teach to random avatar
  inspectAvatar(entityId: string): AvatarInspection; // full state dump

  // Typed events (for renderer subscription)
  on<K extends keyof VillageEventMap>(event: K, handler: VillageEventMap[K]): void;
  off<K extends keyof VillageEventMap>(event: K, handler: VillageEventMap[K]): void;
}

interface VillageEventMap {
  'entity:born': (entity: VillageEntity) => void;
  'entity:died': (entity: VillageEntity) => void;
  'teaching:started': (teacher: VillageEntity, learner: VillageEntity, sequenceId: string) => void;
  'teaching:completed': (teacher: VillageEntity, learner: VillageEntity, sequenceId: string) => void;
  'teaching:fumble': (learner: VillageEntity, beatIndex: number) => void;
  'sequence:invented': (inventor: VillageEntity, sequenceId: string) => void;
  'sequence:extinct': (sequenceId: string) => void;
  'generation:changed': (generation: number) => void;
}
```

### Renderer Bridge

The engine is pure TypeScript. The Svelte rendering layer bridges ECS state into reactivity via `village-state.svelte.ts`:

```typescript
// village-state.svelte.ts — the ONLY file that imports both engine and Svelte
function createVillageState(orchestrator: IVillageOrchestrator, deps: RendererDeps) {
  // Reactive entity list — updated each render frame
  let avatarStates = $state<Map<string, AvatarInstanceState>>(new Map());
  let stats = $state<PopulationStats>(orchestrator.populationStats);
  let selectedAvatarId = $state<string | null>(null);

  // Per-frame sync: called from Threlte's useFrame or requestAnimationFrame
  function syncFromEngine() {
    stats = orchestrator.populationStats;

    for (const entity of orchestrator.entities) {
      let avatarState = avatarStates.get(entity.id);

      if (!avatarState) {
        // New entity — create AvatarInstanceState wrapper
        avatarState = createAvatarInstanceState(
          { id: entity.id, positionX: entity.transform.x, positionZ: entity.transform.z },
          { propInterpolator: deps.propInterpolator, sequenceConverter: deps.sequenceConverter }
        );
        avatarStates.set(entity.id, avatarState);
      }

      // Sync ECS transform → avatar instance
      avatarState.position.x = entity.transform.x;
      avatarState.position.z = entity.transform.z;
      avatarState.setFacingAngle(entity.transform.facingAngle);

      // Sync teaching state → sequence playback
      // (TeachingSystem sets sequenceBeingTransferred on the entity,
      //  renderer loads it into the AvatarInstanceState for animation)
    }

    // Remove AvatarInstanceStates for dead entities
    for (const [id] of avatarStates) {
      if (!orchestrator.entities.find(e => e.id === id)) {
        avatarStates.delete(id);
      }
    }
  }

  return { avatarStates, stats, selectedAvatarId, syncFromEngine, /* ... */ };
}
```

**Key principle:** The engine writes to plain ECS components. The renderer reads those components each frame and pushes values into `AvatarInstanceState` wrappers that drive the existing Avatar3D → IK pipeline. The engine never knows about Svelte, Three.js, or Threlte.

**Event-driven updates:** For discrete events (birth, death, teaching start/complete, fumble), the state factory subscribes to the orchestrator's typed event emitter and triggers Svelte-side effects (spawn particles, play sounds, show inspector updates). Continuous state (position, age, glow) syncs every frame via `syncFromEngine()`.
```

### Configuration

```typescript
interface VillageConfig {
  // Population
  targetPopulation: number;     // 4-50
  initialSeedSequences: SequenceData[]; // starting culture

  // Timing
  lifespanTicks: number;        // ticks per avatar lifetime
  ticksPerSecond: number;       // simulation speed (decoupled from render)

  // Personality distribution
  traitDistribution: {
    mean: number;               // 0.5 default
    stdDev: number;             // 0.15 default — produces normal distribution
  };

  // Mutation rates
  lossyTransmissionRate: number;  // 0-1, probability of micro-mutation per beat during teaching
  inventionRate: number;          // base probability per idle tick of entering 'inventing' state

  // Arena
  arenaRadius: number;           // world units

  // Generation timing
  youthPhaseRatio: number;       // 0.1 default
  adultPhaseRatio: number;       // 0.7 default
  elderPhaseRatio: number;       // 0.2 default
}
```

## Lab Tab: Village Tab

### Registration

Add to `LabModule.svelte` tabComponents:
```typescript
village: () => import("$lib/features/village/VillageLabTab.svelte"),
```

Add to `tab-definitions.ts` LAB_TABS:
```typescript
{
  id: "village",
  label: "Village",
  icon: '<i class="fas fa-users" style="color: #e8a87c;" aria-hidden="true"></i>',
  description: "Generational cultural simulation",
  color: "#e8a87c",
  gradient: "linear-gradient(135deg, #e8a87c 0%, #d4886a 100%)",
}
```

### UI Layout

The lab tab has two regions:

1. **3D Viewport** (80% of space) — Threlte scene showing the village arena. Camera defaults to elevated isometric view. Scroll to zoom, drag to orbit.

2. **Control Panel** (20%, collapsible sidebar) containing:
   - **Time controls:** Play/pause, speed slider (1x to 100x), generation counter, population count
   - **Population stats:** Alive count, average age, unique sequences, total knowledge, extinction count
   - **Sequence map:** Visual showing which sequences exist in the population, their prevalence, and lineage connections
   - **Avatar inspector:** Click an avatar in the viewport to see their name, age, personality traits, known sequences, and interaction history
   - **God mode tools:** "Inject Sequence" button (opens sequence picker), "Highlight Lineage" toggle

### 3D Scene

- Circular arena with subtle ground plane
- Avatars rendered via existing Avatar3D + Prop3D pipeline
- Age visualization: posture lerp, movement speed scaling, hair color shift toward gray
- Knowledge glow: subtle emissive outline that intensifies with sequence count
- Teaching pairs: when two avatars are in teaching/learning state, a subtle connection line or shared ground highlight
- Passing animation: avatar slows, glow intensifies briefly, then fades out. A brief particle burst of the sequences they knew (colored dots representing each sequence, drifting upward)
- Birth animation: avatar materializes at arena edge, walks inward

### Interaction Modes

**God mode (default):** Observe + optional intervention via control panel. Click avatars to inspect. Camera is free-orbit.

**Participant mode:** Your avatar enters the arena. You can walk up to NPCs and initiate teaching (you teach them a sequence from your library) or learning (they teach you one of theirs). This mode uses the existing player avatar and locomotion controls. Requires the sequence library to be available.

Participant mode is a stretch goal — not in the initial build.

### Tab Lifecycle & Cleanup

Lab tabs are dynamically loaded and unloaded when the user switches tabs. The Village tab must handle this cleanly:

- **On mount:** Create `VillageOrchestrator`, initialize with default config, start simulation loop
- **On unmount:** Call `orchestrator.destroy()` which stops the simulation loop (`clearInterval`), removes all event listeners, and clears the ECS world. The Threlte scene disposes Three.js resources automatically via Svelte component lifecycle
- **Simulation does NOT survive tab switches.** Each mount starts a fresh simulation. Persistence is a future feature (see Open Questions)
- **HMR:** The state factory exports `getHMRData()`/`restoreHMRData()` following the existing pattern (see loop-labeler-state.svelte.ts). During dev, hot reloads preserve the current simulation state rather than restarting

## File Structure

```
src/lib/features/village/
├── VillageLabTab.svelte              // Lab tab root — mounts scene + control panel
├── components/
│   ├── VillageScene.svelte           // Threlte 3D scene
│   ├── VillageAvatar.svelte          // Per-avatar wrapper (Avatar3D + age effects)
│   ├── VillageControls.svelte        // Control panel sidebar
│   ├── AvatarInspector.svelte        // Click-to-inspect panel
│   ├── SequenceMap.svelte            // Population sequence visualization
│   └── TimeControls.svelte           // Play/pause/speed
├── engine/
│   ├── VillageOrchestrator.ts        // Orchestrator (owns world + systems, pure TS)
│   ├── VillageWorld.ts               // Miniplex World<VillageEntity> setup
│   ├── VillageConfig.ts              // Configuration types + defaults
│   └── systems/
│       ├── LifecycleSystem.ts
│       ├── SocialSystem.ts
│       ├── TeachingSystem.ts
│       ├── RecombinationSystem.ts
│       ├── MovementSystem.ts
│       └── PopulationSystem.ts
├── domain/
│   ├── village-types.ts              // All component interfaces + event types
│   └── village-constants.ts          // Default config values, name lists
├── state/
│   ├── village-state.svelte.ts       // Reactive UI state (wraps simulation for Svelte)
│   └── village-context.ts            // Context provider for descendant components
└── services/
    ├── contracts/
    │   ├── ISequenceMutator.ts       // Applies LOOP transforms for recombination
    │   ├── ILineageTracker.ts        // Tracks sequence transmission history
    │   └── IPersonalityGenerator.ts  // Normal distribution trait generation
    └── implementations/
        ├── SequenceMutator.ts        // Wraps ISequenceTransformer with validation
        ├── LineageTracker.ts
        └── PersonalityGenerator.ts
```

## Build Order

### Phase 1: Headless Engine (no rendering)

Build the simulation engine (`engine/` directory) with all six systems. **Zero Svelte imports** — all engine code is pure TypeScript, testable in Node.js via `npm test`. Write tests that verify:
- Avatars age and die on schedule
- Teaching transfers sequences between entities
- Recombination produces valid novel sequences via LOOP transforms
- Population maintains target count
- Sequences spread through the population over many generations
- Some sequences go extinct, others dominate
- Personality traits measurably affect behavior (high creativity → more inventions, high sociability → more interactions)

Run 1000 generations headlessly and log statistics. Tune parameters until the cultural dynamics are interesting — not converging to monoculture, not fragmenting into noise.

### Phase 2: Single Teaching Interaction

Wire one teacher + one learner to Avatar3D rendering. Prove the beat-by-beat teaching choreography works: teacher demonstrates, learner mirrors, fumbles happen, frustration shows, success triggers.

### Phase 3: Small Village

4-6 avatars in the Threlte scene. Full lifecycle: birth, wander, seek, teach, learn, age, die, spawn. One generation cycle visible. Control panel with basic time controls and avatar inspector.

### Phase 4: Full Simulation

Scale to configurable population. Add time-lapse (100x speed). Add god mode tools (inject sequence, highlight lineage). Add sequence map visualization. Polish age visuals (glow, posture, passing animation).

### Phase 5: Participant Mode (Stretch)

Player avatar enters the arena. Can teach/learn with NPCs. Requires hooking into existing sequence library and player locomotion.

## Dependencies

### Existing (no changes needed)
- `ISequenceConverter` — sequence → motion configs
- `IPropStateInterpolator` — motion → prop state per frame
- `Avatar3D.svelte` — IK-driven avatar rendering
- `AvatarInstanceState` — per-avatar playback + locomotion (renderer layer only)
- `ISequenceTransformer` — production LOOP transforms for recombination
- `AnimationStateMachine` — animation blending

### New services to register in DI
- `SequenceMutator` — wraps `ISequenceTransformer` with validation for recombination
- `LineageTracker` — records transmission history for visualization
- `PersonalityGenerator` — normal distribution trait generation

### Lab module changes
- Add tab definition to `tab-definitions.ts`
- Add dynamic import to `LabModule.svelte`

## Open Questions

1. **Seed sequences:** Pull from the user's library, use hardcoded starter sequences, or generate via MCP? Recommendation: hardcode 3-5 simple sequences for the initial build, add library integration later.

2. **Avatar models:** Use one model with color/proportion variation, or multiple GLTF models? Recommendation: one model with trait-driven variation (skin tone, hair color, height) to start.

3. **Sound:** Any audio for teaching interactions, passing, birth? Recommendation: skip for initial build, add as polish.

4. **Persistence:** Save/load simulation state? Recommendation: not initially. Each session starts fresh. Interesting for later (resume a village, share a seed).

5. **Performance ceiling:** At 50 avatars, each with IK solving + prop interpolation per frame, what's the frame budget? May need LOD — full IK for nearby avatars, simplified animation for distant ones. The existing distance culling pattern from PerformerPlatform (15m radius) applies.
