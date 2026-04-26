# Yoga Sequence Builder App - Design Spec

## Overview

A practitioner-focused yoga sequence composition tool. Sister app to TKA Composer, sharing the same tech stack and architectural patterns but living in its own repository with its own visual identity.

The app lets you browse a comprehensive pose database, compose flows from poses, organize flows into phased sessions, and (eventually) practice those sessions with guided playback. Think "TKA Construct for yoga" -- the same analytical, compositional mindset applied to asana sequencing.

## Motivation

- No existing yoga app serves the practitioner-architect: someone who wants to understand the combinatorial space of poses and build their own sequences with analytical precision
- Every existing builder treats poses as opaque units dragged from a list. This app models poses with rich metadata (muscle groups, contraindications, Sanskrit nomenclature, variations, transitions) to enable intelligent composition
- Yoga sequences are not copyrightable (Bikram v. Evolation, 9th Circuit, 2015). The sequences themselves are free knowledge. Only the specific creative expression (video, prose, spoken cues) is protected.
- Future option: a composable movement algebra where poses are assembled from body-state primitives (Option C, deferred). Research shows this is genuinely uncharted territory. See `memory/reference_yoga_movement_algebra.md` for academic foundations (EWMN, SMPL, Movemes).

## Tech Stack

- SvelteKit + TypeScript (strict)
- ITI (Isomorphic Type-safe IoC) for dependency injection
- Firebase for persistence and auth (deferred, not in prototype)
- Svelte 5 runes ($state, $derived, $effect)
- pnpm
- Consumes shared packages from npm (@austencloud/drawer, @austencloud/theme, etc.)

## Repository

Separate repo from TKA Composer. Same patterns (DI, state factories, contracts/implementations, scoped CSS), clean-room implementation. No code forked from TKA.

Placeholder repo name: TBD (naming research complete, decision deferred).

## Data Model

Five hierarchical levels:

### Pose (the atom)

```typescript
interface Pose {
  id: string;
  sanskritName: string;          // "Adho Mukha Svanasana"
  englishName: string;           // "Downward-Facing Dog"
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  muscleGroups: string[];        // ["hamstrings", "shoulders", "calves"]
  bodyRegion: string[];          // ["upper body", "posterior chain"]
  category: PoseCategory;       // "standing" | "seated" | "supine" | "prone" | "inverted" | "arm-balance" | "kneeling"
  styles: YogaStyle[];          // ["vinyasa", "hatha", "yin"]
  contraindications: string[];  // ["wrist injury", "high blood pressure"]
  sides: "bilateral" | "unilateral" | "neutral";
  defaultHoldBreaths: number;
  defaultHoldSeconds: number;
}
```

### Variation (references a parent pose)

```typescript
interface Variation {
  id: string;
  parentPoseId: string;
  name: string;                  // "Up Dog on toes"
  modification: string;         // What's different from the parent
  difficultyOffset: number;     // -2 to +2 relative to parent
}
```

### Transition (connection between two poses)

```typescript
// Transitions are directed (A->B). Many are reversible -- store both directions as separate entries.
// Lookup should support querying by either fromPoseId or toPoseId.
interface Transition {
  fromPoseId: string;
  toPoseId: string;
  breathCue: "inhale" | "exhale" | "hold";
  bridgePoses: string[];        // Intermediate poses needed (like vinyasa between flows)
  smoothness: 1 | 2 | 3 | 4 | 5;
}
```

### Flow (a linked sequence of poses)

```typescript
interface Flow {
  id: string;
  name: string;                  // "Sun Salutation A"
  steps: FlowStep[];
  tags: string[];
  source?: {
    teacher: string;
    url: string;
    attribution: string;
  };
}

interface FlowStep {
  poseId: string;
  variationId?: string;         // Must reference a Variation whose parentPoseId matches this step's poseId
  holdBreaths: number;          // Breath-based hold (primary for vinyasa/hatha). Both fields are always set.
  holdSeconds: number;          // Time-based hold (primary for yin/restorative). UI can show either based on style.
  side?: "left" | "right";
}
```

### Phase (a chunk of a session with a purpose)

```typescript
interface Phase {
  id: string;
  name: string;                  // "Warm-up", "Standing Series", "Hip Openers"
  purpose: string;
  flows: FlowReference[];
  repeatWithOtherSide: boolean;
}

interface FlowReference {
  flowId: string;
  repetitions: number;
}
```

### Session (the full practice)

```typescript
interface Session {
  id: string;
  name: string;
  description: string;
  totalDurationMinutes: number;
  phases: Phase[];
  style: YogaStyle;
  difficulty: 1 | 2 | 3 | 4 | 5;
  createdBy: string;
}
```

### Supporting Types

```typescript
type PoseCategory = "standing" | "seated" | "supine" | "prone" | "inverted" | "arm-balance" | "kneeling";

type YogaStyle = "vinyasa" | "hatha" | "yin" | "ashtanga" | "iyengar" | "kundalini" |
                 "restorative" | "power" | "bikram" | "hot" | "aerial" | "prenatal" |
                 "chair" | "forrest" | "jivamukti" | "anusara" | "viniyoga" | "sivananda";
```

## App Modules

### Library (prototype scope)

Browse and search the pose database.

- Grid/list view of poses
- Filter by: body region, difficulty, style, category, muscle group
- Search by Sanskrit or English name
- Pose detail view: full metadata, variations, related poses
- No images in prototype -- text-based pose cards with name, difficulty, muscle groups, category

### Compose (prototype scope -- vertical slice)

Build flows from poses, using the TKA Construct two-pane pattern.

- **Workspace** (left): the flow strip showing poses in order as they're added
- **Tool panel** (right): pose browser/picker with filters
- Two-phase picker: pick starting pose, then pick next poses
- Per-step controls: hold duration, breath cue, side selection
- Undo/redo
- Save flow (local storage in prototype, Firebase later)

### Practice (future, not in prototype)

Guided playback with timer, voice cues, music. Deferred entirely.

## Project Structure

```
src/
├── lib/
│   ├── features/
│   │   ├── library/
│   │   │   ├── components/
│   │   │   ├── state/
│   │   │   ├── context/
│   │   │   └── services/
│   │   │       ├── contracts/
│   │   │       └── implementations/
│   │   └── compose/
│   │       ├── components/
│   │       ├── state/
│   │       ├── context/
│   │       └── services/
│   │           ├── contracts/
│   │           └── implementations/
│   ├── shared/
│   │   ├── di/                    (ITI containers, composition root)
│   │   │   ├── containers/
│   │   │   ├── container-types.ts
│   │   │   └── index.ts
│   │   ├── domain/                (type definitions)
│   │   │   ├── types/
│   │   │   └── enums/
│   │   ├── data/                  (seed data, ingestion output)
│   │   │   └── poses/
│   │   ├── navigation/
│   │   │   └── config/
│   │   ├── components/            (shared UI primitives)
│   │   └── persistence/
│   ├── app.css
│   └── app.html
├── routes/
├── scripts/
│   └── ingest/                    (API data ingestion scripts)
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tsconfig.json
```

## Architectural Conventions

All carried over from TKA Composer:

- **DI with ITI**: services registered in containers, consumed via composition root
- **Contracts/implementations**: every service has an interface in `contracts/` and an implementation in `implementations/`
- **State factory + context**: reactive state created in factory functions, distributed via Svelte context. No singletons, no global refs.
- **No barrel exports**: direct imports from source files only
- **No utils/helpers directories**: logic lives in named service classes
- **Service naming**: `PoseLoader`, `FlowComposer`, `TransitionResolver` -- never "Service" suffix
- **Component-scoped CSS**: design tokens via CSS custom properties, no global utility classes
- **Earned tests**: tests only for silent-failure algorithms, not UI or glue code

## Seed Data Strategy

### Phase 1: API Ingest

Pull from open yoga APIs and merge into unified Pose schema:
- `alexcumplido/yoga-api` -- Sanskrit names, English names, descriptions, benefits
- `LunaticPrakash/yoga-api` -- adds contraindications per pose

Dedup by Sanskrit name. Store as JSON in `shared/data/poses/`.

### Phase 2: AI Enrichment

Use Claude to fill gaps in the merged data:
- Muscle groups and body regions
- Category classification
- Difficulty ratings
- Default hold times
- Bilateral vs unilateral
- Common variations

User reviews and corrects all AI-generated metadata before it becomes source of truth.

### Phase 3: Transition Mapping (ongoing)

- Start with hand-curated known transitions (Sun Salutation A, basic vinyasa bridge)
- Expand from YouTube transcript mining and personal practice
- Each transition gets smoothness rating and breath cue

## Prototype Scope (24-hour target)

The minimum that validates the architecture end-to-end:

1. **Seed pose database** populated from API ingest + AI enrichment (~200 poses)
2. **Library module** with browse, search, and filter
3. **Compose module** with the two-pane builder: pick poses, see flow grow, set hold times
4. **Pose detail view** showing full metadata
5. **Local storage** for saving composed flows

No images, no Firebase, no playback, no voice, no timer, no music. Just the data model and composition experience working end-to-end.

## Future Roadmap (not in scope, noted for context)

- Visual references for poses (stick figures, illustrations, or 3D models)
- Practice module with guided playback, timer, breath cues, voice
- Firebase persistence, user accounts, shared flows
- YouTube transcript mining for sequence data and teacher attribution
- Transition intelligence (smoothness scoring, bridge pose suggestions)
- Body part targeting analysis (ensure balanced stretching)
- Voice control for hands-free practice
- Session generation from constraints ("hip openers + core, 30 minutes, intermediate")
- Music integration
- Print-friendly output
- Movement algebra (Option C) -- composable pose primitives if the variation system proves insufficient

## Legal Position

- Yoga sequences are not copyrightable (Bikram v. Evolation Yoga, 9th Cir., 2015; US Copyright Office confirmation)
- Extracting pose sequences from videos is legal; copying exact spoken cues or video footage is not
- Attribution to source teachers/videos is included in the data model as best practice, not legal requirement
- Community data approach: if a teacher requests removal of a specific attributed sequence, remove it
