# Contact Juggling Viewer Design

**Status:** Truth sprint implemented; practitioner review pending  
**Date:** 2026-08-14  
**Working name:** Contact Lab

## Decision

Contact juggling is a separate motion discipline, not another prop model for
the existing spinner stage.

Contact Lab will begin inside the Flow Arts Composer monorepo as a dedicated
viewer surface and feature boundary. It will reuse the sequence, playback,
library, sharing, and Kinetic Alphabet systems. It will not reuse the
full-body stage camera, world-sized grid, rigid hand-to-prop transform, or the
spinner prop picker.

This should not become a separately deployed application at the start. Doing
that would duplicate accounts, saved sequences, playback, sharing, and viewer
chrome before the contact interaction has been proven. A standalone product
can be reconsidered after the first usable contact curriculum exists.

## Phase 0 and truth-sprint implementation record

- The spinner picker now excludes the contact-ball family through
  `prop-motion-discipline.ts`.
- Selecting 3D with contact-ball sequence data mounts an intentional boundary
  state instead of the spinner stage.
- `/test/contact-lab` loads the canonical `tnd-quarter-opp-mpmp` catalog entry
  and translates its four real hand-path steps into one slow two-ball palmspin
  in each hand.
- The proof renders two articulated open palms, four tangent spheres,
  palm-local contact markers, eight palm positions, scrubbing, 30 BPM playback,
  and teaching/top/low camera presets.
- The translator rejects center points, disconnected paths, direction
  reversals, unsupported arcs, and open loops instead of substituting a
  decorative orbit.
- Ball support, pair tangency, source-step coverage, eight-position coverage,
  LOOP closure, and catalog binding have focused unit tests.
- The production navigation and sequence-to-contact translation remain Phase 2
  work. The test route exists to earn practitioner approval before that wiring.

## Truth Sprint 01: two-ball palmspin

### Why this move

Two-ball palmspin is the smallest move that tests the product thesis rather
than only the renderer. Practitioner instruction describes eight positions
around the hand, slow smooth travel, open fingers, and avoiding clicks between
the spheres. That supplies a recognizable external acceptance contract while
matching TKA's eight outer locations.

The proof relationship is deliberately narrow:

- TKA supplies the ordered hand path and step timing.
- The contact profile supplies the rolling technique, palm regions, cluster
  topology, and articulated hand poses.
- `MPMP` and `PMPM` produce different palmspin starts and directions because
  their catalog hand paths differ.
- A letter by itself does not claim to specify contact-juggling physics.

Practitioner references:

- https://www.homeofpoi.com/us/lessons/teach/Juggling/Contact-Ball-Juggling/2-Ball-Palmspin-1
- https://contactjuggling.org/wiki/index.php?title=Palm_Circle
- https://contactjuggling.org/?sj=1

### Engineering result

The approved one-move sprint is implemented without Phase 2 viewer-shell
integration or a standalone deployment. Focused verification covers the
silent failure modes: catalog drift, fake source independence, invalid path
acceptance, pair separation, declared support, seam closure, and location
coverage.

Visual inspection is required at top and teaching angles because mesh contact,
finger readability, and camera framing cannot be proven by unit tests. The
prototype labels its gate `External review pending` until a contact juggler
reviews the slow loop. Passing engineering checks prepares that review; it does
not replace it.

## Why the current viewer cannot be adapted with a camera preset

The current 3D viewer models a gripped prop as a rigid object attached to each
performer's hand. Its primary visual frame is a full body moving around a
world-sized grid. That contract is useful for staff, clubs, poi, and similar
spinning props.

Contact juggling depends on a different state:

- the sphere remains in contact with a changing part of the hand;
- wrist, palm, and finger articulation control the sphere;
- the contact patch can move across fingers, palm, back of hand, or between
  hands;
- the sphere may remain visually isolated while the hands move around it;
- multi-ball work adds ball ordering, cluster topology, and transfers.

The practitioner material describes rolls across the hand, fingertip and palm
paths, palm-up to palm-down rotations, and compensation by the wrist, elbow,
and fingers. A mechanics treatment reaches the same conclusion from another
direction: rolling contact requires the contact coordinates on both surfaces
plus their relative spin, not only the object's world transform.

References:

- https://contactjuggling.org/?sj=1
- https://contactjuggling.org/wiki/index.php/The_4_Basic_Isolations_-_A_Workshop/
- https://arxiv.org/abs/2102.10421
- https://developers.google.cn/edge/mediapipe/solutions/vision/hand_landmarker/index
- https://www.w3.org/TR/webxr-hand-input-1/

## Evidence from the current implementation

### The 2D renderer is useful proof, but not a contact simulation

`canvas-2d-animation-renderer.ts` recognizes the contact-ball family and draws
screen-shaded spheres. The Double Contact Ball layout is two tangent circles.
That layout is duplicated for blue and red prop transforms, so a Double Contact
Ball sequence currently means four rendered spheres, two rigidly attached to
each hand's prop transform.

This proves that TKA positions, orientations, timing, and color identity can
produce a readable contact-inspired diagram. It does not encode contact
points, finger articulation, rolling, slips, transfers, or cluster changes.

### The 3D picker has no motion-discipline boundary

`PerformerHubDetail.svelte` and `PropPopover.svelte` consume the global active
prop registry directly. Double Contact Ball was made an active standalone prop,
so it appears beside spinner props even though the stage has no contact model.
The other contact-ball variants are already globally deactivated.

Global deactivation is not the right correction. It would remove useful 2D
artwork and encoded sequence compatibility. The spinner viewer needs its own
capability predicate.

### TKA is the input grammar, not the contact physics

The Flow Arts domain source defines TKA's spatial grammar as nine grid
locations and eight center-relative orientations. It also states that contact
rolling is not part of the canonical static-prop parameter space. Contact Lab
therefore adapts TKA's spatial and temporal grammar through a contact-specific
translator. It must not claim that a TKA letter alone fully specifies a
physically valid contact roll.

## Product boundary

### Reuse

- sequence data and step timing;
- TKA locations, orientations, turns, colors, and hand identity;
- the canonical sequence-viewer shell and playback controller;
- timeline, scrubbing, looping, BPM, sharing, library, and URLs;
- the authored contact-ball GLB as sphere geometry and material reference;
- existing 2D pictographs as the notation view beside the contact view.

### Create

- a contact motion profile and TKA-to-contact translation layer;
- a palm-local coordinate system and compact grid;
- articulated hand and forearm rigs;
- ball, contact patch, support, and cluster state;
- contact-specific interpolation and legality checks;
- top-down and teaching cameras;
- contact controls and overlays;
- a Contact Lab feature module once the viewer slice is proven.

### Keep separate

- spinner-stage performer state;
- full-body avatar staging and environment scenes;
- spinner planes, effects, camera choreography, and prop-size controls;
- contact camera and hand framing;
- contact technique data and validation.

This keep-separate decision should be added to
`.claude/rules/canonical-capabilities.md` when implementation begins.

## Viewer experience

### Default frame

The camera looks down over both hands held in front of the performer. The
default view is a shallow orthographic teaching angle, close enough to read
individual fingers and the gap between touching spheres. A true top view and a
low three-quarter hand view are secondary presets.

The full avatar and scenic environment are absent. Forearms may enter from the
bottom of frame to preserve body orientation. The motion stays centered on the
hands rather than on a stage.

### Grid

The visible grid is palm-local and compact. It represents the TKA spatial
targets around a hand or hand pair, not meters of world space. It can move and
rotate with the active hand frame.

The first teaching view shows:

- a faint nine-position contact grid;
- the active sphere or cluster path;
- the current support region on the hand;
- an optional contact-point trace;
- the 2D TKA step beside the 3D hand view.

The grid must be hideable. The hand and ball interaction remains understandable
without it.

### Hands

The hands are the primary performer models. The rig needs wrist, thumb, and all
finger joints, with a stable palm frame and named contact regions. A stock
full-body avatar hand with a single wrist rotation is not sufficient.

The first authored rig can use deterministic poses. Live hand capture is a
later input path, not an MVP dependency. MediaPipe currently exposes handedness
and 21 hand landmarks in image and world coordinates from video streams, while
WebXR exposes articulated joint poses on supported devices. Both are plausible
future recording inputs once the authored motion model is trustworthy.

## Motion model

The core state is contact-relative, then converted to world transforms for
rendering.

```ts
type ContactRegion =
  | "palm"
  | "back-of-hand"
  | "thumb"
  | "index"
  | "middle"
  | "ring"
  | "pinky"
  | "between-hands"
  | "unsupported";

interface ContactPatch {
  hand: "left" | "right";
  region: ContactRegion;
  surfaceUv: [number, number];
  normalOffset: number;
}

interface ContactBallState {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  contacts: ContactPatch[];
  supportMode: "rolling" | "carried" | "pinched" | "airborne";
}

interface ContactClusterState {
  balls: ContactBallState[];
  order: string[];
  topology: "single" | "pair" | "triangle" | "custom";
}
```

Each TKA step supplies hand-local target positions, orientation intent, timing,
and direction. The contact translator adds the missing physical interpretation:

1. choose the active support region and contact path;
2. choose hand poses that maintain the intended support;
3. solve the sphere or cluster transform from the contact state;
4. validate for separation, penetration, unreachable joints, and unsupported
   intervals;
5. interpolate through contact-safe key poses.

Invalid or ambiguous mappings must be visible. The viewer may label a step as
"unresolved contact" and show the TKA target without inventing a convincing but
false technique.

## Ball inventory and notation identity

The current Double Contact Ball artwork creates a pair for each TKA hand, four
balls total. That should be the first compatibility target because it preserves
existing blue and red notation identity.

The data model must not hard-code four balls. Contact jugglers also need one
ball, one two-ball cluster, asymmetric inventories, transfers, and higher-count
clusters. The first prototype should expose ball inventory explicitly so the
relationship between blue/red notation tracks and physical balls can be tested
instead of hidden.

## Integration shape

The first version is a new motion surface inside the canonical viewer shell,
tentatively named `contact-3d`. `ViewerMotionSurface.svelte` remains the owner
of motion-surface mounting and transitions. It should delegate the new mode to
a Contact Lab host rather than absorb contact state itself.

Proposed ownership:

```text
src/lib/features/contact-lab/
  components/
    ContactViewerCanvas.svelte
    ContactHandRig.svelte
    ContactTeachingOverlay.svelte
    ContactControls.svelte
  domain/
    contact-scene-state.ts
    contact-motion-profile.ts
    contact-prop-support.ts
  services/
    tka-contact-translator.ts
    contact-pose-solver.ts
    contact-legality.ts

src/lib/shared/sequence-viewer/
  services/viewer-modes.ts             # registers contact-3d presentation
  components/ViewerMotionSurface.svelte # mounts the feature surface

src/lib/shared/3d/domain/
  prop-motion-discipline.ts            # spinner/contact capability owner
```

The contact feature may import shared sequence and pictograph contracts. Shared
spinner 3D code must not import Contact Lab state.

## Phase 0: remove the false promise

Before the new viewer exists:

1. Add one pure `prop-motion-discipline.ts` owner that classifies contact-ball
   props as `contact` and current stage props as `spinner`.
2. Filter contact props out of both spinner-stage prop pickers.
3. When a contact prop is active and the user chooses the existing 3D mode, do
   not mount the full-body stage. Show a compact explanation that Contact 3D
   requires its dedicated viewer and keep 2D available.
4. Preserve the selected prop and sequence. Never silently substitute Staff.
5. Preserve the Double Contact Ball GLB and its tests for reuse in Contact Lab.

Existing saved spinner scenes remain intact in storage. Opening one with a
contact prop hits the same explanatory state rather than spawning the wrong
stage or mutating the saved scene.

## First vertical slice

The first slice is intentionally narrow but real:

- one sequence and one hand-pair workspace;
- four balls, preserving the current blue/red double-ball interpretation;
- two articulated hands and forearms;
- overhead teaching camera plus one three-quarter preset;
- compact palm-local nine-position grid;
- deterministic ball and hand poses for one validated LOOP family;
- playback, pause, scrubbing, BPM, and continuous looping from the shared
  controller;
- side-by-side 2D notation and Contact 3D;
- an explicit unresolved state for unsupported letters or transitions.

This slice answers the highest-risk question: can TKA timing and spatial intent
drive contact motion that a practitioner recognizes as physically believable?
It does not start with live camera tracking, every contact trick, custom scenes,
effects, recording, or a standalone deployment.

## Delivery phases

### Phase 0: quarantine

Remove contact props from the spinner experience without removing them from 2D
or saved sequence data.

### Phase 1: motion proof

Build the hand-local coordinate system, authored hand poses, cluster state, and
one validated LOOP in a dedicated test route. Review it from top and teaching
angles at slow speed.

### Phase 2: canonical viewer integration

Add the Contact 3D mode to the shared viewer shell, wire playback and split
view, and route contact props to it.

### Phase 3: technique expansion

Add more contact regions, cluster topologies, transfers, and a growing table of
validated TKA-to-contact mappings. Each mapping requires practitioner review.

### Phase 4: capture and authoring

Evaluate camera-based hand capture and WebXR input. Captured motion should
produce editable contact state, not bypass the contact model with an opaque
animation clip.

### Phase 5: product split decision

Consider a standalone Contact Lab deployment only if its navigation,
curriculum, saved data, or audience has materially diverged from the Composer.

## Verification gates

### Domain and motion

- Every implemented mapping names its support region and contact path.
- Sphere-to-hand contact has no visible gaps or deep penetration.
- Unsupported transitions are labeled instead of fabricated.
- Slow playback makes the support transfer understandable frame by frame.
- The LOOP seam preserves hand pose and contact state.

### Visual

- Fingers, contact patches, and sphere separation are legible at 1920, 2560,
  3840, 1440, tablet, 960x412, and 375 widths.
- Top and three-quarter views agree on ball order and contact state.
- The compact grid reads as hand-local, never as a floor-sized spinner grid.
- The full-body stage and scenic environment never mount in Contact 3D.

### System

- 2D contact-ball rendering and encoded sequence URLs remain unchanged.
- Spinner props retain current 3D behavior.
- Contact props are absent from both spinner pickers.
- Saved scenes are not mutated by the discipline gate.
- Shared playback and viewer chrome have no duplicate implementation.

## Main risks

**False physical confidence.** A beautiful animation can still teach an
impossible roll. Mitigation: explicit contact state, legality checks, slow
motion review, and practitioner approval per mapping family.

**TKA ambiguity.** TKA supplies spatial intent but not enough information to
choose a unique contact technique. Mitigation: contact motion profiles and
visible unresolved states rather than hidden defaults.

**Four-ball assumption.** The current artwork couples Double Contact Ball to
four rendered spheres. Mitigation: make ball inventory explicit from the first
prototype.

**Hand-rig quality.** Contact work exposes poor finger deformation immediately.
Mitigation: prove the rig and contact poses before broad viewer integration.

**Premature product split.** A second deployment would increase product and
maintenance cost before the motion model is proven. Mitigation: isolate the
feature in code while retaining shared application infrastructure.

## Approval target

Approval of this design authorizes Phase 0 and Phase 1 only. Phase 1 ends with
a practitioner-reviewable prototype and evidence. Viewer-shell integration
begins only after that motion proof passes.
