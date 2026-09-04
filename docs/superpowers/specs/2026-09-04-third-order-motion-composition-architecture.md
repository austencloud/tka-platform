# Third Order motion composition architecture

Status: approved direction; implementation contract for parity work

Supersedes the data and timing limits of
`2026-09-04-third-order-toy-design.md`. The existing Toy remains the product
home while this architecture is proven. Third Order remains outside the
Kinetic Alphabet notation model: it composes complete motions; it does not add
letters.

## Outcome

Flow Arts Composer will represent a moving animation as a coordinate node that
can itself move inside another coordinate node. A node may carry one prop,
several synchronized props, or more child nodes. All authored local timing and
relationships survive when the node is wrapped, duplicated, nested, saved,
shared, rendered, or exported.

The same normalized composition must support:

- the current two-grid Third Order Toy;
- a single sequence wrapped as one rigid motion unit;
- paired child units with independent higher-order TnD;
- Kyle's 18-staff v11 SpiroAnim reference;
- SpiroAnim's separate v12 Warp/Strength hand-path channel;
- more than three orders without redesigning the model;
- world-space and camera-projected Mandala artwork.

## Evidence baseline

The golden source is
`docs/research/spiroanim/fixtures/kyle-v11-third-order.json`. Its complete
decode is documented in
`docs/research/spiroanim/kyle-v11-third-order-decode.md`.

Required parity facts:

- 18 Staff prop streams;
- 16 independent Motion tracks in six authored cohorts plus two static props;
- 37 beats of local Animation;
- 48 beats of outer Motion;
- 45 beats of authored camera;
- final-pose hold when a shorter track ends;
- 32 moving staff-tip world trajectories;
- exact v11 query round-trip through SpiroAnim's codec.

These facts are acceptance inputs, not defaults for the FAC editor.

## Concepts and language

| FAC term             | Meaning                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Motion composition   | A versioned scene of coordinate nodes, clips, prop streams, relationships, and camera tracks   |
| Coordinate node      | A local frame with a parent, transform track, clock mapping, and children                      |
| Clip                 | Reusable local animation content; either a native FAC sequence or normalized spatial keyframes |
| Prop stream          | One visible prop actor attached to a coordinate node and driven by a clip channel              |
| Rigid unit           | Several streams or nodes moved by one shared parent transform                                  |
| Relational siblings  | Separate child nodes whose paths form a defined pair at the same parent order                  |
| Carrier track        | A coordinate node's position/orientation/scale path relative to its parent                     |
| Auxiliary hand path  | A v12-style second local path vector blended into a prop's canonical hand path                 |
| World trajectory     | Sampled physical endpoint positions after all parent transforms                                |
| Projected trajectory | A world trajectory transformed through an explicit fixed or authored camera                    |

“Order” is a view of depth in the coordinate tree. It is not stored as a
special third-order enum. The current Toy happens to expose a parent and one
child order; the model remains recursive.

## Canonical persisted model

The production owner is a separate `MotionComposition`, not `SequenceData`.
Sequences remain reusable immutable clips.

```ts
interface MotionCompositionV3 {
  version: 3;
  id: string;
  name: string;
  bpm: number;
  rootNodeId: string;
  clips: Record<string, MotionClip>;
  nodes: Record<string, CoordinateNode>;
  streams: Record<string, PropStream>;
  relationships: MotionRelationship[];
  camera?: SpatialCameraTrack;
  loop: CompositionLoopPolicy;
  provenance?: ImportProvenance;
}

type MotionClip =
  | { kind: "fac-sequence"; sequence: SequenceData }
  | { kind: "spatial-keyframes"; channels: SpatialPropChannel[] };

interface CoordinateNode {
  id: string;
  parentId: string | null;
  childNodeIds: string[];
  streamIds: string[];
  transform: SpatialTransformTrack;
  time: TimeMapping;
  orientationMode: "position-only" | "rigid" | "world" | "radial" | "tangent";
}

interface PropStream {
  id: string;
  nodeId: string;
  clipId: string;
  channelId: string;
  time: TimeMapping;
  style: PropStreamStyle;
}

interface TimeMapping {
  offsetBeats: number;
  rate: number;
  completion: "hold" | "loop" | "stretch";
  stretchToBeats?: number;
}
```

The exact interfaces may be split across files during implementation, but the
semantic fields and boundaries above are fixed by this contract.

### Transform tracks

`SpatialTransformTrack` is source-neutral and discriminated:

- `motion-segments`: chained local-frame Linear, Arc, or Circle segments with
  duration, distance, plane, arc, bend axis, and completion amount;
- `flower`: the existing QfT-backed ratio, anti/pro direction, strength, phase,
  and relationship parameters;
- `sequence-hand`: one hand path sampled from a native FAC sequence;
- `keyframes`: explicit translation, rotation, and scale transforms.

This union preserves the authored parametric representation. It does not store
sampled world points. A source adapter may attach opaque provenance for
diagnostics, but the runtime never branches on Spiro query keys.

`position-only` is the exact Spiro v11 import behavior: outer Motion translates
the prop without rotating or scaling its local frame. Rigid, radial, tangent,
and world modes are explicit FAC capabilities and must never be inferred as
source behavior.

### Relationships and TnD

TnD belongs to a defined sibling pair at one coordinate order. A relationship
record references exactly two node IDs and stores:

- the authored Timing category: Together, Split, or Quarter;
- the authored hand-path Direction relation: Same or Opposite;
- phase and direction parameters from which the paths are generated;
- a status indicating whether the label is authored, derived, or no longer
  matches after freeform edits.

Changing an outer relationship must not rewrite either child clip. A group of
three or more children may coexist, but there is no invented many-way TnD
label. Multiple pair records may reference the same node when the author makes
those relationships explicit.

Identical imported Motion tracks are grouping candidates, not automatic proof
of one rigid authored container. The importer preserves one stream/node per
source prop first. The UI may offer “Link as rigid unit” only after full-track
sample equality succeeds.

## Deterministic time model

All tracks are evaluated against one composition beat. Sampling is a pure
operation:

```ts
sampleAt(composition, beat) -> MotionCompositionFrame
```

The result must not depend on earlier samples, playback direction, mutable
orchestrator state, or RAF history.

For a local track of duration `D`:

- `hold`: `local = clamp((beat - offset) * rate, 0, D)`;
- `loop`: `local = positiveModulo((beat - offset) * rate, D)`;
- `stretch`: maps the declared `stretchToBeats` interval linearly onto `D` and
  then holds at the end.

The current Toy's “Fit” becomes `stretch`, “Counts” becomes `loop` at rate 1,
and “Independent rate” becomes `loop` with an authored rate. A new Hold option
is required because Kyle's 37/48/45 timing cannot be represented today.

Composition duration is the maximum end time of every hold/stretch track and
the declared loop closure. For closed rational loops, closure is the least
common multiple of reduced beat periods. The editor must display the resulting
duration rather than silently truncating it. Irrational/freeform paths require
an explicit loop span.

Camera is sampled on the same beat and uses its own completion policy. Kyle's
camera therefore holds from beat 45 to 48.

## Transform composition and endpoint truth

Every coordinate node resolves a local 4×4 transform. World transforms are
composed from the root:

```text
nodeWorld = parentWorld × nodeLocal
propWorld = nodeWorld × localHandTransform × localPropTransform
tipWorld  = propWorld × localTipPoint
```

The sampler returns, for every visible stream:

- world-space prop center;
- world-space orientation;
- every canonical prop endpoint from FAC's trail-point registry;
- the node and clip-local states used to derive them.

FAC's native sequence channel must use a completed pure sampling boundary on
`SequenceAnimationOrchestrator`, not repeated mutation through
`calculateState`. The same beat must always yield the same endpoint numbers.

No CSS transform owns motion truth. CSS may position UI chrome and labels, but
props, grids, trails, hit targets, and export geometry all consume the sampled
world frame. The present nested `AnimatorCanvas` CSS transforms are migrated
behind one scene renderer before parity is claimed.

## SpiroAnim import boundary

FAC will not hand-roll SpiroAnim's packed codec. Until an upstream decoder
package or readable interchange format exists, fixture generation and import
research run against a pinned SpiroAnim checkout. A production paste-URL
feature requires one of those supported boundaries.

After decode, the adapter performs this lossless normalization:

| Spiro source                       | FAC target                                                    |
| ---------------------------------- | ------------------------------------------------------------- |
| `pN` + `xN` + `rN` local Animation | one normalized spatial clip channel and prop stream           |
| `mN` Motion                        | one `motion-segments` coordinate node in `position-only` mode |
| absent `mN`                        | identity coordinate node                                      |
| `c` orbit + center tracks          | spatial camera position and target track                      |
| sparse inherited values            | resolved authored frames plus sparse-origin provenance        |
| root/prop display flags            | stream style and guide visibility                             |

One-frame static spacing Motion is not classified as Third Order. A Motion
track must change translation over time or contain multiple meaningful frames.

### v12 Warp and Strength

Warp/Strength is not translated into an outer coordinate node. It remains an
auxiliary hand-path channel inside the spatial prop clip:

```text
renderedHand = scale × lerp(canonicalHandVector, auxiliaryHandVector, strength)
```

Warp controls the auxiliary vector's relative angular progression. Strength
controls its contribution. FAC's existing flower carrier and QfT math provide
useful ratio language, but imported values remain exact numeric channels.

The normalized model supports v11 Motion and v12 auxiliary paths
simultaneously.

### Round trip and provenance

An untouched imported composition retains:

- source application and codec version;
- pinned decoder commit;
- original URL or payload hash;
- decoded sparse source records.

FAC save/share uses the normalized composition. “Open original in SpiroAnim”
may reuse the preserved original URL while the composition is untouched.
Editing the FAC composition does not promise a new Spiro URL until SpiroAnim
publishes a supported encoder boundary. The UI must state this honestly.

## Unified live renderer

The stage renders one sampled scene rather than separate transformed canvases.
It must support:

- arbitrary stream count;
- optional grid guides per node;
- stable stream selection and hit testing;
- 2D front projection for native TKA work;
- 3D view and camera projection for spatial imports;
- endpoint trails sampled in world space;
- a selected-node focus view with parent/child ghosts;
- reduced-motion-aware UI transitions without disabling requested playback.

Existing prop models, tip registries, 3D endpoint bridge, and 3D trail renderer
remain canonical. The new owner composes coordinate frames and feeds those
owners; it does not create alternate prop geometry.

The persisted model has no arbitrary prop-count or nesting-depth limit. The
first renderer acceptance budget is 32 prop streams, 64 active endpoints, and
four visible nested coordinate depths at 60 FPS on the reference desktop.
Larger saved scenes remain valid and may progressively reduce guides, path
resolution, or live effects. They must not be silently deleted or flattened.

## Mandala architecture upgrade

The existing `MandalaPaths { left, right, purple }` contract has 42 consumers
and remains unchanged. A parallel source-neutral pipeline is added:

```ts
interface WorldTrajectorySet3D {
  durationBeats: number;
  layers: Array<{
    streamId: string;
    tipId: string;
    color: string;
    samples: Array<{ beat: number; x: number; y: number; z: number }>;
  }>;
}

interface ProjectedTrajectorySet {
  projection: ProjectionSpec;
  layers: Array<{
    streamId: string;
    tipId: string;
    color: string;
    points: Array<{ x: number; y: number }>;
  }>;
}
```

The trajectory baker repeatedly calls the deterministic composition sampler
over the complete closure and stores raw world samples. Projection is a
separate pure step with an explicit mode:

- world-front;
- world-top;
- fixed-camera;
- authored-camera.

A moving-camera screen trace is a different artifact from a world trace. The
selection is saved in the Mandala render specification and named in the UI.

A generalized layer renderer consumes `ProjectedTrajectorySet`. A compatibility
adapter turns classic left/right paths into two trajectory layers so shared
render infrastructure can converge later without changing classic output.

The current automatic purple overlap remains only for the legacy pair. An
18-stream artwork does not receive an arbitrary N-way “purple” blend. New
overlap policies are explicit: none, selected pair, additive color, or authored
layer order.

Raw trajectory points are canonical for a baked artifact. SVG `d`, Path2D,
overlap masks, thumbnails, and posters are derived and may be regenerated.

## Persistence, collection, share, and export

Mandala collection schema v2 uses a discriminated source:

```ts
type MandalaSource =
  | { kind: "sequence" /* existing v1 fields */ }
  | {
      kind: "motion-composition";
      composition: MotionCompositionV3;
      trace: ProjectionSpec;
    };
```

Existing v1 records migrate to `kind: "sequence"` without geometry changes.
Revision digests for motion compositions cover normalized composition,
projection, trace duration/sampling policy, palette, and render options.

PNG/SVG export runs the trajectory baker and generalized renderer. Video export
samples composition and camera at exact frame timestamps, then reuses the
existing worker and encoding orchestration. It does not substitute the current
decorative 20-second Mandala breathing loop for choreography playback.

Share payloads store the normalized source or an immutable composition
revision reference. They never depend on a local Spiro checkout.

## FAC-native editor experience

Third Order remains an artifact-first Toy while the model matures. Its editor
uses existing FAC workspace primitives and theme surfaces.

Required interaction model:

- a coordinate breadcrumb such as `World › Outer pair › Blue grid`;
- a layer/tree rail listing coordinate nodes and contained props;
- “Wrap as motion unit” from any loaded one- or multi-prop sequence;
- “Enter contents” and “Up one level” without losing the parent context;
- sibling selection for higher-order TnD controls;
- independent Inner motion and Carrier motion sections;
- a timeline that shows local Animation, carrier Motion, and camera durations
  on aligned beat rulers;
- a Mandala mode choosing trace space and visible streams;
- import provenance and an honest link back to the unchanged Spiro source.

The stage remains dominant. Controls stay near the selected node. Stream color
belongs to the prop/path artifact, not a decorative panel edge. Desktop uses
an authored canvas plus rail; narrow screens retain all capability in the
existing drawer pattern.

## Migration from the current Toy

Current version-2 Toy drafts migrate as follows:

1. create a root coordinate node;
2. convert the carrier path into either `flower` or `sequence-hand`;
3. create one child node for each current child array entry;
4. attach the child `SequenceData` as a native clip;
5. translate World/Radial/Tangent/Carrier to the new orientation modes;
6. translate timing modes to the explicit time mappings;
7. preserve the existing two sibling lanes as a relationship pair.

The visual implementation then replaces CSS-owned child transforms with the
world sampler one feature slice at a time. Existing source pickers and transport
controls can remain during that migration.

## Delivery sequence

1. **Golden evidence — complete in this spec change.** Preserve the exact Kyle
   decode, compiled motion/camera reference, and sampled world trajectories.
2. **Pure sampler foundation.** Complete deterministic native sequence sampling;
   add version-3 composition types, migration, transform composition, and
   hold/loop/stretch tests.
3. **Trajectory and Mandala foundation.** Add world trajectory baking,
   projections, arbitrary-layer rendering, and the legacy adapter.
4. **Unified Toy scene.** Move the existing two grids from CSS transforms into
   one sampled renderer and expose Hold plus Mandala trace-space controls.
5. **Many-stream proof.** Load the normalized Kyle fixture, render 18 staffs,
   compare numeric endpoint samples, and prove 37/48/45 timing.
6. **Supported Spiro import.** Ship paste/import only after a published decoder
   or readable interchange boundary exists; add v11 and v12 adapters.
7. **Persistence and export.** Version composition and Mandala collection
   schemas; add save, reload, share, PNG/SVG, and deterministic video.
8. **Recursive authoring.** Ship wrap/enter/breadcrumb interactions, arbitrary
   child lists, higher-order TnD pairing, and runtime budget feedback.

Each slice must leave the umbrella feedback item open until end-to-end author,
play, save, share, export, and import requirements are all satisfied.

## Verification contract

### Numerical and serialization

- exact Spiro v11 decode/re-encode for Kyle's URL;
- preserve 18 props, 16 Motion tracks, six moving cohorts, static pair, and
  camera;
- exact 37/48/45 hold behavior;
- `sampleAt(t)` equality across forward, backward, repeated, and random seek
  order;
- analytic nested matrix tests for position-only, rigid, radial, and tangent;
- endpoint parity against the 32 golden world trajectories at selected beats;
- full-loop seam distance below the declared renderer epsilon;
- current Toy v2 → composition v3 migration round-trip;
- Mandala collection v1 → v2 migration and digest stability.

### Domain behavior

- one prop on a closed outer Circle;
- one rigid two-prop clip preserving internal distance and phase;
- all 6 × 6 inner/outer TnD pairings;
- unaligned local and carrier frame boundaries;
- least-common-period closure;
- at least three sibling nodes;
- depth-four recursive nesting;
- v12 auxiliary hand path combined with an outer Motion track.

### Visual and performance

- numerical world geometry and camera-projected reference frames are scored
  separately from FAC-native visual styling;
- world and authored-camera Mandalas visibly differ where the camera moves;
- classic two-hand Mandala snapshots remain unchanged;
- 375×667 through 3840×2160 plus 200% zoom retain the editor hierarchy;
- keyboard and screen-reader navigation exposes layer, pair, and selected-node
  state;
- reduced motion collapses interface transitions but preserves user-started
  choreography;
- the 18-staff fixture stays within the accepted frame and memory budgets.

## Non-negotiable exclusions

- no new Kinetic Alphabet letters or levels;
- no packed Spiro codec reimplementation inside FAC;
- no silent flattening to sampled points at persistence time;
- no automatic grouping solely because two encoded tracks look alike;
- no CSS transform as the source of prop, hit-test, or trail geometry;
- no in-place widening of the legacy pair-shaped Mandala contract;
- no implicit N-way purple overlap;
- no claim of Spiro round-trip after FAC edits without a supported encoder.
