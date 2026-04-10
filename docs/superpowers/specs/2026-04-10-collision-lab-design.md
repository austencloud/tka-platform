# Collision Lab — Design

**Date:** 2026-04-10
**Status:** Approved for implementation
**Related work:**
- `2026-04-01-position-aware-pole-vectors-design.md` (ElbowPoleComputer)
- `2026-04-10-backward-reachability-design.md` (CSP pattern this extends)

---

## Problem

The 3D avatar's IK solver places hands at target grid points without any awareness of self-collision. The production CollisionDetector confirms the problem is real and frequent: forearms penetrating the face (up to 5.2cm deep), props punching through the torso (up to 6.3cm deep), arms-through-arms. These collisions make the 3D preview look broken and undermine the avatar's usefulness as a performance reference.

The collision detector tells us *what* is wrong. It does not tell us *what a safe pose looks like* or *how to get there from a different safe pose*. Without that knowledge, there is no principled fix — only hand-tuned pole vector hacks that paper over individual cases.

## Goal

Build a lab tab that lets a human reviewer systematically catalog every diamond-mode, in/out-orientation pose (192 total across 3 planes) as safe, unsafe, or unreachable. The output is a labeled JSON catalog that the animation system can eventually consume to pick avatar realizations that don't collide with themselves.

This is the first phase of a larger system: static pose labeling now; transition graph and CSP-based stance selection later.

## Scope

**In scope:**
- Enumeration of 192 two-hand poses: 3 planes × (4 cardinal positions × 2 orientations)²
- A sequential scrubber UI for walking through poses
- Live collision readout wired to the existing CollisionDetector
- Four labeling statuses (clear / needs-adjustment / unreachable / skip)
- Four stance variants (foot placement + body rotation) the reviewer can switch between per pose
- Local-storage working copy and canonical JSON export
- Schema fields reserved for future elbow-routing overrides

**Out of scope (future work):**
- Box mode (cardinals are on angular planes — separate catalog)
- Non-cardinal grid positions (NE/SE/SW/NW)
- Clockwise/counter-clockwise (in-plane rotation) orientations
- Cross-plane poses (blue on one plane, red on another)
- Elbow-over/under routing overrides (schema reserves the field; implementation later)
- Transition graph between poses
- Automatic CSP-based stance selection during sequence playback

## Design

### Architecture

The lab is a new tab in the existing lab module. It consumes the 3D rendering infrastructure (Avatar3D, CollisionDetector, IKSolver, Grid3D) but owns its own state and services.

```
src/lib/features/lab/tabs/collision-lab/
├── CollisionLab.svelte                    ← root, sets context, attaches hotkeys
├── components/
│   ├── PoseViewport.svelte                ← 3D scene
│   ├── PoseScrubber.svelte                ← bottom stepper + filter chips + progress
│   ├── CollisionReadout.svelte            ← severity + zone breakdown panel
│   ├── LabelControls.svelte               ← four status buttons + hotkey hints
│   └── StanceVariantPicker.svelte         ← variant 0–3 selector
├── state/
│   └── collision-lab-state.svelte.ts      ← factory
├── context/
│   └── collision-lab-context.ts
└── services/
    ├── contracts/
    │   ├── IPoseEnumerator.ts
    │   ├── IPoseLabelRepository.ts
    │   └── IStanceVariantProvider.ts
    └── implementations/
        ├── DiamondPoseEnumerator.ts
        ├── LocalPoseLabelRepository.ts
        └── DefaultStanceVariantProvider.ts

src/lib/shared/3d/data/pose-catalog/
├── diamond-in-out-catalog.json             ← 192 pose definitions (generated, committed)
└── diamond-in-out-labels.json              ← human-authored labels (committed as they grow)

src/lib/shared/di/containers/
└── collision-lab-container.ts              ← ITI wiring, added to composition root
```

Services follow the project's naming convention (no `Service` suffix) and state follows the factory + context pattern per `.claude/rules/state-management.md`.

### Data Schema

**Pose definition** — the 192 enumerated poses:

`in` / `out` map to TKA's radial / antiradial orientations: with a double staff, the thumb-reference end points *toward* the grid center (in = radial) or *away* from center (out = antiradial). These are the two orientations the per-hand learning model calls Layer 1.

```typescript
type DiamondPosition = "N" | "E" | "S" | "W";
type HandOrientation = "in" | "out";  // radial | antiradial

interface PoseDefinition {
  id: string;                      // "wall-Ni-Eo" — plane-bluePosBlueOri-redPosRedOri
  plane: Plane;                    // WALL | WHEEL | FLOOR
  blueHand: {
    position: DiamondPosition;
    orientation: HandOrientation;
  };
  redHand: {
    position: DiamondPosition;
    orientation: HandOrientation;
  };
}
```

**ID scheme:** `{plane}-{bluePos}{blueOriFirstLetter}-{redPos}{redOriFirstLetter}`.
Examples: `wall-Ni-Eo`, `wheel-Sn-Wi`, `floor-Eo-No`.

**Pose label** — what the reviewer produces:

```typescript
type LabelStatus = "unlabeled" | "clear" | "needs-adjustment" | "unreachable" | "skip";

type ArmRouting =
  | "auto"                // ElbowPoleComputer decides (today's behavior)
  | "left-under" | "left-over"
  | "right-under" | "right-over"
  | "both-under" | "both-over";

interface CollisionSnapshot {
  severity: "clear" | "graze" | "clip" | "penetrate";
  zones: Array<{
    type: "arm-through-face" | "prop-through-torso" | "prop-through-head" | "arms-through-each-other";
    depthCm: number;
    description: string;   // from CollisionEvent.description
  }>;
}

interface PoseLabel {
  poseId: string;
  status: LabelStatus;
  stanceVariantIndex: number;       // 0–3
  armRouting: ArmRouting;            // reserved for future; always "auto" in Phase 1
  collisionSnapshot: CollisionSnapshot | null;
  notes?: string;
  labeledAt?: number;                // epoch ms
}
```

**Labels file format:**

```json
{
  "version": 1,
  "mode": "diamond-in-out",
  "generatedAt": 1712712345678,
  "labels": {
    "wall-Ni-Eo": {
      "poseId": "wall-Ni-Eo",
      "status": "clear",
      "stanceVariantIndex": 0,
      "armRouting": "auto",
      "collisionSnapshot": null,
      "labeledAt": 1712712345678
    }
  }
}
```

### Pose Enumeration

`DiamondPoseEnumerator.enumerateDiamondInOut()` produces the 192 poses deterministically:

```typescript
for (const plane of [WALL, WHEEL, FLOOR]) {
  for (const bluePos of ["N","E","S","W"]) {
    for (const blueOri of ["in","out"]) {
      for (const redPos of ["N","E","S","W"]) {
        for (const redOri of ["in","out"]) {
          // 3 × 4 × 2 × 4 × 2 = 192
        }
      }
    }
  }
}
```

Output order is stable — critical so that "pose 47 of 192" means the same thing between sessions. The order matches the nesting above (plane slowest, red orientation fastest).

The catalog is generated once and committed as `diamond-in-out-catalog.json`. The enumerator loads from that file on startup; it regenerates and writes the file only if it's missing or its `version` field is outdated.

### Stance Variants

**Constraint:** Foot IK is disabled in the current avatar system (see `Avatar3D.svelte:676`). The two-bone solver was designed for arms; proper hinge-constrained knee IK was never implemented. Variants that require moving feet relative to the hips are not achievable in Phase 1.

**Phase 1 variants are upper-body orientation changes**, all of which are achievable today by manipulating root transform and spine bone rotations without touching legs. Feet stay at their default Mixamo idle positions.

| Index | Description         | Root yaw | Spine lean  | Effect                                        |
| ----- | ------------------- | -------- | ----------- | --------------------------------------------- |
| 0     | Neutral             | 0°       | 0°          | Default Mixamo idle stance                    |
| 1     | Leaned forward      | 0°       | +10° pitch  | Torso tilts forward; shoulders move forward   |
| 2     | Rotated left        | +15°     | 0°          | Whole upper body rotates left at hips         |
| 3     | Rotated right       | -15°     | 0°          | Whole upper body rotates right at hips        |

These variants move the shoulders, which is what actually matters for collision — the hands still IK to the same world target, but the elbow geometry and arm routing shift. This is an honest minimum: variants only change things we can actually change today, and the reviewer can flag poses whose collisions are not resolvable by any of the four as `needs-adjustment` with a note indicating what *would* fix them (e.g., "needs left foot back").

Variants are defined as constants in `DefaultStanceVariantProvider`. Applying a variant:
1. Sets the avatar root node's yaw rotation
2. Sets a spine pitch offset that the skeleton service applies to the spine1/spine2 bones before upper-body IK runs
3. Upper-body IK (shoulders → elbows → hands) then solves against the pose's hand targets with the shifted shoulder positions

Four variants is intentionally small — enough to cover Phase 1's accessible stance space, and narrow enough that the reviewer can cycle through all four in seconds. More can be added later without schema change since `stanceVariantIndex` is just an integer, and the variant library can expand when proper leg IK is implemented.

### State Management

State factory in `collision-lab-state.svelte.ts`. Receives all services as arguments per the state-management rule.

```typescript
export function createCollisionLabState(
  poseEnumerator: IPoseEnumerator,
  labelRepo: IPoseLabelRepository,
  stanceProvider: IStanceVariantProvider
) {
  const allPoses = poseEnumerator.enumerateDiamondInOut();
  let labels = $state<Record<string, PoseLabel>>(labelRepo.loadAll());

  // Filters
  let planeFilter = $state<Plane | "all">("all");
  let blueOrientationFilter = $state<HandOrientation | "all">("all");
  let redOrientationFilter = $state<HandOrientation | "all">("all");
  let statusFilter = $state<LabelStatus | "all" | "unlabeled-only">("all");

  // Cursor and variant
  let cursorIndex = $state(0);
  let currentVariantIndex = $state(0);
  let currentCollision = $state<CollisionSnapshot | null>(null);

  const filteredPoses = $derived(
    allPoses.filter(p =>
      (planeFilter === "all" || p.plane === planeFilter) &&
      (blueOrientationFilter === "all" || p.blueHand.orientation === blueOrientationFilter) &&
      (redOrientationFilter === "all" || p.redHand.orientation === redOrientationFilter) &&
      (statusFilter === "all" || matchesStatusFilter(labels[p.id], statusFilter))
    )
  );

  const currentPose = $derived(filteredPoses[cursorIndex] ?? allPoses[0]);
  const currentLabel = $derived(labels[currentPose.id]);
  const currentStanceVariant = $derived(stanceProvider.getVariant(currentVariantIndex));

  const progress = $derived({
    total: allPoses.length,
    labeled: countLabels(labels, s => s !== "unlabeled"),
    clear: countLabels(labels, s => s === "clear"),
    needsAdjustment: countLabels(labels, s => s === "needs-adjustment"),
    unreachable: countLabels(labels, s => s === "unreachable"),
  });

  return {
    get allPoses() { return allPoses; },
    get filteredPoses() { return filteredPoses; },
    get currentPose() { return currentPose; },
    get currentLabel() { return currentLabel; },
    get currentStanceVariant() { return currentStanceVariant; },
    get currentVariantIndex() { return currentVariantIndex; },
    get currentCollision() { return currentCollision; },
    get progress() { return progress; },
    get cursorIndex() { return cursorIndex; },
    get planeFilter() { return planeFilter; },
    get blueOrientationFilter() { return blueOrientationFilter; },
    get redOrientationFilter() { return redOrientationFilter; },
    get statusFilter() { return statusFilter; },

    stepForward() {
      cursorIndex = Math.min(cursorIndex + 1, filteredPoses.length - 1);
      currentVariantIndex = 0;
    },
    stepBackward() {
      cursorIndex = Math.max(cursorIndex - 1, 0);
      currentVariantIndex = 0;
    },
    jumpTo(index: number) {
      cursorIndex = Math.max(0, Math.min(index, filteredPoses.length - 1));
      currentVariantIndex = 0;
    },
    setVariant(index: number) { currentVariantIndex = index; },
    setPlaneFilter(p: Plane | "all") { planeFilter = p; cursorIndex = 0; },
    setBlueOrientationFilter(o: HandOrientation | "all") { blueOrientationFilter = o; cursorIndex = 0; },
    setRedOrientationFilter(o: HandOrientation | "all") { redOrientationFilter = o; cursorIndex = 0; },
    setStatusFilter(s: LabelStatus | "all" | "unlabeled-only") { statusFilter = s; cursorIndex = 0; },
    updateCollision(snapshot: CollisionSnapshot | null) { currentCollision = snapshot; },

    labelCurrent(status: LabelStatus) {
      const pose = currentPose;
      if (!pose) return;
      labels[pose.id] = {
        poseId: pose.id,
        status,
        stanceVariantIndex: currentVariantIndex,
        armRouting: "auto",
        collisionSnapshot: currentCollision,
        labeledAt: Date.now(),
      };
      labelRepo.save(labels);
      // Auto-advance when the reviewer commits to a terminal status
      if (status === "clear" || status === "unreachable") {
        cursorIndex = Math.min(cursorIndex + 1, filteredPoses.length - 1);
        currentVariantIndex = 0;
      }
    },

    exportLabelsJson(): string {
      return JSON.stringify({
        version: 1,
        mode: "diamond-in-out",
        generatedAt: Date.now(),
        labels,
      }, null, 2);
    },
  };
}
```

Context is set once in `CollisionLab.svelte` and consumed by any descendant via `getCollisionLabContext()`.

### Components

**`CollisionLab.svelte` (root)**
- Resolves services from `container.items`, creates state, sets context
- Layout: main area for `PoseViewport`; right sidebar for `CollisionReadout` + `LabelControls` + `StanceVariantPicker`; bottom bar for `PoseScrubber`
- Attaches window keydown listener on mount for hotkeys: `ArrowLeft`/`ArrowRight` (step), `1`/`2`/`3`/`4` (label), `q`/`w`/`e`/`r` (variant switch), `Shift+Enter` (export JSON to download)

**`PoseViewport.svelte`**
- Threlte `<Canvas>` with `Avatar3D`, two `Staff3D` props, `Grid3D`
- Reads `currentPose` and `currentStanceVariant` from context
- Computes world positions for both hands from `(plane, position)` using existing grid math
- Passes stance variant to avatar (foot IK targets + root position)
- Passes hand world positions to both props (which feed into the existing IK solver via `MotionData3D`)
- Registers a per-frame callback with CollisionDetector that pipes the detector's current severity + zone list into `state.updateCollision()`

**`PoseScrubber.svelte`**
- Filter chip groups (plane, blue ori, red ori, status)
- Stepper: `◄ Pose {cursorIndex+1} / {filteredPoses.length} ►` with numeric input
- Stacked progress bar: green (clear) + amber (needs-adjustment) + gray (unreachable) + slate (unlabeled)

**`CollisionReadout.svelte`**
- Large severity badge: CLEAR / GRAZE / CLIP / PENETRATE with color
- Zone list with depth (e.g., "R forearm → face · 5.2cm deep")
- Empty state when clear

**`LabelControls.svelte`**
- Four buttons: Clear (green) / Needs Adjustment (amber) / Unreachable (gray) / Skip (slate)
- Shows current label status prominently at top
- Hotkey hints on each button

**`StanceVariantPicker.svelte`**
- Four variant cards in a row, each showing index + description
- Highlighted when selected; click or hotkey to change
- Always visible (not hidden behind status), since the reviewer may want to try variants before deciding the label

### Persistence

**`LocalPoseLabelRepository` behavior:**

- `loadAll()`:
  1. Dynamically import the canonical `diamond-in-out-labels.json` if it exists
  2. Read localStorage key `tka:collision-lab:diamond-in-out-labels` if present
  3. Merge: localStorage wins when `labeledAt` is newer than the canonical entry
  4. Fill unlabeled poses with `{ status: "unlabeled", stanceVariantIndex: 0, armRouting: "auto", collisionSnapshot: null }`
- `save(labels)`:
  1. Write full labels map to localStorage (debounced 500ms)
- `exportJson()`:
  1. Serialize to the canonical file format
  2. Trigger a browser download (`diamond-in-out-labels.json`)
  3. Reviewer manually commits the downloaded file to the repo

This keeps Phase 1 simple: localStorage for working state, manual commit for canonical. A future phase can add a dev-only endpoint that writes the JSON directly to disk, or sync to Firebase.

### CollisionDetector Integration

**Current state:** `Avatar3D.svelte` instantiates its own `CollisionDetector` locally (line 155) and calls `detect()` each frame in its per-frame update (line 735). The returned `CollisionEvent[]` is consumed internally for throttled console logging but is not exposed to parent components.

**Change required:** Add an optional `onCollisionEvents` callback prop to `Avatar3D.svelte`. When present, the per-frame update path invokes it with the current frame's `CollisionEvent[]` after `detect()` runs. The callback is the only change; logging behavior is untouched.

```typescript
// Avatar3D.svelte props
interface Props {
  // ... existing props
  onCollisionEvents?: (events: CollisionEvent[]) => void;
}

// In the per-frame update, after detect():
const events = collisionDetector.detect(bodySnapshot, bluePropPos, redPropPos, beat, progress);
onCollisionEvents?.(events);
```

The lab's `PoseViewport.svelte` passes a callback that pipes the events into state:

```typescript
function handleCollisionEvents(events: CollisionEvent[]) {
  if (events.length === 0) {
    state.updateCollision({ severity: "clear", zones: [] });
    return;
  }
  const worst = events.reduce((a, b) => severityRank(b.severity) > severityRank(a.severity) ? b : a);
  state.updateCollision({
    severity: worst.severity,
    zones: events.map(e => ({
      type: e.zone,
      depthCm: e.penetrationDepth * 100,
    })),
  });
}
```

This is a small additive prop on Avatar3D, not a refactor. Existing consumers of Avatar3D are unaffected because the prop is optional.

### DI Wiring

```typescript
// src/lib/shared/di/containers/collision-lab-container.ts
import { createContainer } from "iti";
import { DiamondPoseEnumerator } from "$lib/features/lab/tabs/collision-lab/services/implementations/DiamondPoseEnumerator";
import { LocalPoseLabelRepository } from "$lib/features/lab/tabs/collision-lab/services/implementations/LocalPoseLabelRepository";
import { DefaultStanceVariantProvider } from "$lib/features/lab/tabs/collision-lab/services/implementations/DefaultStanceVariantProvider";

export function createCollisionLabContainer() {
  return createContainer()
    .add({ poseEnumerator: () => new DiamondPoseEnumerator() })
    .add({ poseLabelRepository: () => new LocalPoseLabelRepository() })
    .add({ stanceVariantProvider: () => new DefaultStanceVariantProvider() });
}

export type CollisionLabContainer = ReturnType<typeof createCollisionLabContainer>;
```

Registered in `buildAppContainer()` and typed into `IAppContainerItems` per the new-module checklist.

### Lab Tab Registration

Add `collision-lab` to the lab tab list with label "Collision Lab" and a shield icon. The existing `LabModule.svelte` + lab tab registry handles everything else.

## Testing

Unit tests (`tests/unit/collision-lab/`):

- `DiamondPoseEnumerator` — enumerate returns exactly 192 poses with unique IDs; order is deterministic between runs; every plane/position/orientation combination appears exactly once
- `LocalPoseLabelRepository` — save and load round-trip; merge precedence when both canonical JSON and localStorage have entries (newer `labeledAt` wins); unlabeled fill works
- `collision-lab-state` — `labelCurrent` writes the correct label and auto-advances on "clear"/"unreachable" but not on "needs-adjustment"/"skip"; filter changes reset `cursorIndex`; cursor clamping at boundaries

No tests for component rendering or live collision wiring — those are visual and covered by manual review in the lab itself.

## Future Phases (noted for continuity)

1. **Cross-plane poses** — separate enumeration "diamond-in-out-cross-plane" (blue on one plane, red on another)
2. **Elbow routing overrides** — implement `armRouting` field handling in IK solver; expose override controls in lab UI
3. **Box mode catalog** — same pattern, separate catalog file, accounts for the angular-plane quirks
4. **Non-cardinal positions** — add NE/SE/SW/NW; grid already has the points
5. **Full orientation set** — clockwise/counter-clockwise in addition to in/out
6. **Transition graph** — edges between (pose, variant) nodes based on stance compatibility; feeds a CSP solver
7. **Sequence-time integration** — beam search during sequence generation picks stance variants that keep future beats reachable (mirrors the letter-level `PositionReachabilityAnalyzer`)

## Non-goals

- Solving the collision problem during sequence playback — that's a later phase that consumes this catalog
- Physically accurate weight transfer or walking animation — static poses only
- Automatic pose labeling — this is explicitly a human-in-the-loop tool
