# Film Director Research Canon

Last verified: 2026-09-02

This document turns animation-architecture research into TKA engineering
decisions for the Film Director. It is the required starting point for work on
the camera model, keyframe representation, curve editing, procedural camera
behavior, layered animation, editorial timelines, and language-driven camera
generation.

It is not a claim that every cited method is implemented. Each entry separates
what the source establishes from the decision TKA has made and the code owner
that would carry it. Search `docs/architecture/canonical-capabilities.md` and the
design at
`docs/superpowers/specs/active/2026-09-02-film-director-channel-architecture-design.md`
before changing the camera or animation representation.

The sources here were gathered on 2026-09-02 in response to a direct question
from Austen: whether the Film Director's camera model is granular enough, or
whether it is "trying to make something dynamic out of legos without having
legos that are detailed enough." The answer, and the evidence for it, is below.

**Re-verified 2026-09-02, 23:11**, on a direct challenge from Austen about
whether this reflects the actual state of the art tonight. Three targeted
searches were run: a three.js camera behavior system, Theatre.js's public
status, and fresh text-to-trajectory work. **No decision in the design
changed.** Two papers were added (CinemaTraj, ShotVerse), one library entry was
added (NYT `three-story-controls`, the closest published prior art to decision
D1), and the Theatre.js status held with a weaker evidence caveat. The
calibration worth keeping: the architectural layers held exactly as predicted,
and the generative-research section was the part that had moved, which is why
the design deliberately depends on none of it.

## Status and evidence vocabulary

Decision status:

- **Shipped**: verified in `main` at the date above.
- **Adopted**: the architecture direction is accepted, implementation incomplete.
- **Evaluate**: promising, no adoption decision yet.
- **Reference only**: useful evidence that does not define TKA behavior.
- **Rejected**: an approach or dependency TKA must not adopt as an owner.
- **Verified negative**: checked at the source and found unusable. Recorded so
  the next agent does not spend the same tokens rediscovering it.

Evidence provenance. This distinction is load-bearing, because most of these
were gathered through web search rather than read end to end:

- **Read at source**: the primary page was fetched and read in the gathering
  session.
- **Search summary**: the claim comes from a search-result summary of the
  primary source. Directionally reliable, but verify the exact API, version, or
  wording at the source before writing code against it.

## The convergent finding

Four independent production animation systems, built by different organizations
for different media, agree on the same three-layer separation. TKA's Film
Director collapses all three into one representation, and every limitation
Austen identified follows from that collapse.

| Layer | What it owns | Who does it this way |
| --- | --- | --- |
| **Value** | One independently time-sampled stream per animatable property | OpenUSD time-sampled attributes; Blender channel bags; Theatre.js props |
| **Behavior** | Procedural motion evaluated at sample time and combined with stored values, never baked into them | Cinemachine raw values plus correction channels |
| **Editorial** | What plays when: clips, tracks, transitions, retiming | OpenTimelineIO; Blender NLA strips |

TKA today has one representation, `ResolvedDirectorCameraKeyframe`, doing all
three jobs. It is a fused nine-value tuple carrying `position`, `target`,
`fovDeg`, optional `rollDeg`, one `interpolation`, and one `easing`.

Three consequences, all observed in the current code rather than predicted:

1. **No channel is independently addressable.** Because one keyframe carries
   every value, a key exists for all channels or for none.
2. **Easing is welded across channels.** `sampleDirectorCameraTrack` in
   `src/routes/test/film-director/_lib/director-camera-track.ts` finds a single
   straddling keyframe pair and applies `start.easing` to position, target, and
   field of view together. A shot cannot ease the lens on a different curve
   from the dolly.
3. **Yaw, pitch, and pan are not variables at all.** The model stores a
   `position` and a look-at `target`; orientation is emergent from the vector
   between them. An authored `pan` is compiled into target coordinates and then
   ceases to exist, which is why it cannot be selected, edited, or shown.

A fourth consequence is structural rather than numeric: the move compiler is
one-way. `findCapabilityUsage` in `_lib/director-capability-catalog.ts` has to
read camera moves out of the **authored** document specifically because the
resolved film no longer contains them.

## Value layer: per-property time samples

### OpenUSD time-sampled attributes

- Status: **Adopted** (as a data-model reference, not a dependency)
- Evidence: production documentation, **search summary**
- [Time and Animated Values](https://openusd.org/dev/user_guides/time_and_animated_values.html)
- [Transformations, Time-sampled Animation, and Layer Offsets](https://openusd.org/docs/567231471.html)

USD represents animation as time-sampled **attribute** values. An attribute
either resolves to a single static value or varies over time through its own
sample stream. The granularity is the attribute, not the object and not a
composite frame. USD's composition engine then resolves which layer's opinion
wins per attribute, which is the same problem TKA has when a hand edit and a
generated curve both want to write a channel.

TKA decision: adopt the per-attribute sample stream as the value model. Do not
adopt USD itself. TKA has no USD runtime on the web, three.js ships a USDZ
exporter rather than a general USD composition engine, and the schema, layering,
and payload machinery is far more than a browser film tool needs.

### Blender 4.4 Slotted Actions and Project Baklava

- Status: **Reference only** (strongest available precedent for layered channels)
- Evidence: production documentation, **search summary**
- [Slotted Actions release notes](https://developer.blender.org/docs/release_notes/4.4/upgrading/slotted_actions/)
- [Animation 2025: Progress and Planning](https://code.blender.org/2024/02/animation-2025-progress-planning/)
- [Slotted Actions planning issue #120406](https://projects.blender.org/blender/blender/issues/120406)
- [Blender Presents a New Layered Animation Framework (80.lv)](https://80.lv/articles/blender-presents-a-new-layered-animation-framework)

Baklava is Blender's layered animation project, built on two pillars: layers and
multi-datablock animation. Phase 1 shipped in 4.4 as Slotted Actions. The
relevant structure is the **channel bag**: keys live at
`action.layers[0].strips[0].channelbag(action.slots[0])`, so the containment
order is action, then layer, then strip, then slot, then channel bag, then
channels. The pre-4.4 flat API is deprecated and slated for removal in 5.0.

The design intent stated for layers is directly the problem TKA has: alternative
takes of the same animation are managed by muting and unmuting layers, rather
than by swapping whole actions.

TKA decision: adopt the layer-over-channels containment shape. Do not adopt
Blender's strip semantics wholesale; TKA's editorial needs are much simpler than
the NLA.

### Theatre.js

- Status: **Verified negative** as a dependency; **Reference only** as an
  interaction model
- Evidence: repository page, **read at source** (2026-09-02)
- [theatre-js/theatre](https://github.com/theatre-js/theatre)
- [Working with Sequences](https://www.theatrejs.com/docs/latest/manual/sequences)
- [Timeline Track Types with Keyframe Connections, issue #510](https://github.com/theatre-js/theatre/issues/510)

Theatre.js is the closest thing on the web to what the Film Director should
feel like: a JavaScript animation library plus an in-browser visual editor where
any object property, including three.js mesh position, material color, and light
intensity, becomes a keyframed track you scrub and shape on a timeline.

**Do not take the dependency right now.** The repository states that development
has been moved to a private repo so the team can iterate toward 1.0, with the
intent to push back to the public repo later. The public repository is therefore
not a reliable read on current behavior, and adopting a library whose source of
truth is not visible fails `.claude/rules/no-fabrication.md` and the
library-swap evidence rule. Revisit when 1.0 ships publicly.

Re-verified 2026-09-02 at 23:15: the private-repo notice is still on the public
README and still carries no date, and that fetch did not render release or
last-commit information, so the age of the notice remains unmeasured. Treat
"temporarily" with suspicion. The status has now been observed unchanged across
two checks and no public 1.0 has appeared.

Steal the interaction model: per-property tracks, a dopesheet over a curve
editor, and an editor that attaches to a running scene rather than replacing it.

### three-story-controls and the film-camera axis vocabulary

- Status: **Reference only** as a dependency; **Adopted** as the axis vocabulary
- Evidence: documentation site, **read at source** (2026-09-02)
- [three-story-controls](https://nytimes.github.io/three-story-controls/)
- [nytimes/three-story-controls](https://github.com/nytimes/three-story-controls)

The New York Times ships a three.js `CameraRig` that decomposes camera motion
into six independently named axes, with rotation stored separately from
translation:

| Action | Transform |
| --- | --- |
| Pan | rotate around Y |
| Tilt | rotate around X |
| Roll | rotate around Z |
| Pedestal | translate on Y |
| Truck | translate on X |
| Dolly | translate on Z |

This is the closest published prior art to decision D1, and it is a working npm
package rather than a paper. A production newsroom concluded that a camera worth
authoring is a rig with named rotational axes, not a position plus a look-at
target.

It is **not** a Cinemachine equivalent and must not be adopted as one. The docs
describe no layered or additive behavior, no corrections, and no independent
per-axis curves. A rig can be driven by a three.js `AnimationClip` along a
predefined rail, which is a single baked path, not a channel store.

TKA takeaway beyond D1: that table is the film vocabulary and TKA's move set does
not match it. TKA has `pan` but no `tilt`, uses `push-in` / `pull-back` where the
industry says `dolly`, and has no `pedestal` at all. `tilt` is the notable gap,
because D1 is exactly what makes it expressible.

## Behavior layer: procedural motion as correction, not as baked keys

### Unity Cinemachine 3

- Status: **Adopted** (architecture, reimplemented; no port exists)
- Evidence: production documentation, **search summary**
- [Procedural Motion](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/concept-procedural-motion.html)
- [About Cinemachine 3](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.0/manual/index.html)
- [CinemachineCamera](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.0/manual/CinemachineCamera.html)
- [See what's new with Cinemachine 3](https://unity.com/blog/engine-platform/see-whats-new-with-cinemachine-3)
- [Source mirror](https://github.com/Unity-Technologies/com.unity.cinemachine)

This is the single most valuable idea found in the gathering session.

Cinemachine separates **raw values**, which the camera behaviors generate, from
a **correction channel** holding perturbations to those raw values: noise,
smoothing, and obstacle-avoidance corrections. The final position and
orientation is the combination of the raw values and their corrections. Noise
specifically exists to simulate handheld and vehicle shake, and it is never
stored as animation data.

Blending is likewise a first-class evaluation-time concern: exactly one camera
is live at a time, except during a blend, when both are live and the result is
combined.

TKA relevance is exact. The Film Director's `handheld` and `tracking` are
attached to the resolved camera as optional fields precisely because there is no
correction layer to hold them, and both are documented in the resolved type as
absent-not-null so old snapshots stay byte-identical. That is a workaround for a
missing architectural layer, not a design.

TKA decision: adopt raw-plus-correction. Corrections are additive in the
channel's own unit, are never keyframed, and are evaluated after layer
composition. There is no Cinemachine port for three.js; a search on 2026-09-02
found nothing credible, so this is reimplemented, not imported. The C# is public
and readable if the exact damping or noise math is wanted.

## Editorial layer: what plays when

### OpenTimelineIO

- Status: **Evaluate** (adopt the model at phase 4; the library is Python and
  C++, not browser JavaScript)
- Evidence: production documentation, **search summary**
- [Architecture](https://github.com/PixarAnimationStudios/OpenTimelineIO/blob/master/docs/tutorials/architecture.md)
- [Documentation](https://opentimelineio.readthedocs.io/en/latest/)
- [OTIO schema proposal for OpenUSD (AOUSD forum)](https://forum.aousd.org/t/opentimelineio-schema-proposal/1419)

OTIO is an API and interchange format for editorial cut information: a modern
edit decision list with an API, supporting clips, timing, tracks, transitions,
markers, and metadata, plus plugin systems for translating to and from existing
editorial formats. A proposal to represent arbitrary time-series data as OTIO
inside OpenUSD was presented to an Alliance for OpenUSD working group, which is
a signal that the industry expects the editorial and scene layers to interlock
rather than merge.

TKA relevance: the Film Director's editorial model is a flat array of scenes.
`scene.extends` deep-merge exists because there is no instancing, and a scene
cannot appear twice at different times. Clips on tracks with in and out points
solve both.

TKA decision: adopt the clip-on-track model at phase 4. Do not take the
dependency; OTIO's runtime is not browser JavaScript and TKA needs a fraction of
the schema.

## Frame-function purity: the part TKA already got right

### Remotion and Motion Canvas

- Status: **Shipped** (TKA already satisfies this; do not regress it)
- Evidence: production documentation and comparison writeups, **search summary**
- [Remotion ThreeCanvas](https://www.remotion.dev/docs/three-canvas)
- [Procedural animation, remotion issue #7803](https://github.com/remotion-dev/remotion/issues/7803)
- [Remotion vs Motion Canvas vs Revideo, 2026](https://www.pkgpulse.com/blog/remotion-vs-motion-canvas-vs-revideo-programmatic-video-2026)

Remotion's model is that you describe what the frame at a given time should look
like and the player handles the rest; animation is written declaratively against
`useCurrentFrame` so the timeline can be scrubbed and paused. Motion Canvas
reaches the same determinism through TypeScript generator functions. Both render
deterministic frames from source held in version control.

TKA already has this. `sampleDirectorCameraTrack(keyframes, t)` is a pure
function of time, and the film resolves deterministically from an authored
document. A useful detail for anyone sizing the migration: `interpolateVector`
in that file already maps over the three axes and delegates to a per-axis
`interpolateScalar`. The scalar interpolation atom the channel model needs is
therefore already written and already covered by the snapshot suite; what is
missing is per-channel *keys*, not per-channel *math*. **The mistake is what lives inside the frame function, not the frame
function itself.** Any redesign must preserve purity, determinism, and
scrubbability, because the snapshot test suite depends on it and it is the
property that makes the whole migration provable.

## Language-driven camera generation

This is where the Film Director's directive language sits relative to published
research. The consistent finding is that cinematographic language is treated as
a **generator over an editable trajectory representation**, never as a compiler
that consumes and replaces one.

### Survey

- Status: **Reference only**
- Evidence: research preprint, **search summary**
- [Camera Trajectory Generation: A Comprehensive Survey of Methods, Metrics, and Future Directions](https://arxiv.org/pdf/2506.00974)

Starting point for anyone entering this area. Covers methods, metrics, and open
problems.

### E.T. (Exceptional Trajectories)

- Status: **Reference only**
- Evidence: peer-reviewed (ECCV 2024) plus preprint, **search summary**
- [arXiv](https://arxiv.org/pdf/2407.01516)
- [Springer chapter](https://link.springer.com/chapter/10.1007/978-3-031-73235-5_26)

Text-to-camera-trajectory generation with character awareness. Introduced a
dataset pairing camera trajectories with character information and textual
captions describing both, plus three diffusion-based architectures. Notable for
TKA because character-aware framing is exactly what the Director's framing
grammar does with subjects, and because the dataset shape suggests what an
eventual learned component would need.

### GenDoP

- Status: **Reference only**
- Evidence: peer-reviewed (ICCV 2025), **search summary**
- [arXiv](https://arxiv.org/html/2504.07083)
- [ICCV 2025 open access](https://openaccess.thecvf.com/content/ICCV2025/html/Zhang_GenDoP_Auto-regressive_Camera_Trajectory_Generation_as_a_Director_of_Photography_ICCV_2025_paper.html)

Auto-regressive camera trajectory generation framed as a director of
photography. Its stated contribution against prior diffusion work is directly
relevant: diffusion approaches often produced discontinuous and unstable
trajectories, and the auto-regressive formulation gives better controllability,
finer-grained adjustment, and higher motion stability.

TKA takeaway: continuity and stability are the hard part of generated camera
motion, and finer-grained adjustment is named as the win. That is an independent
argument for the per-channel representation.

### LensCraft, Auteur, LAMP, VERTIGO

- Status: **Evaluate**
- Evidence: research preprints, **search summary**. Peer-review state not
  verified here. Treat the arXiv identifiers as the citation of record.
- [Auteur: Language-Driven Cinematographic Framing for Human-Centric Video Generation](https://arxiv.org/html/2606.01900)
- [LAMP: Language-Assisted Motion Planning for Controllable Video Generation](https://arxiv.org/html/2512.03619)

LensCraft (Dehghanian et al., 2025) pairs a cinematographic language with a
dedicated simulation framework that generates balanced, controlled training
data. Auteur addresses language-driven cinematographic framing. VERTIGO (Li et
al., 2026) post-trains a camera generator against learned visual preferences.

TKA takeaway: a formal cinematographic language plus a simulator that can
generate labeled examples is a recognized pattern, and TKA already has both
halves in unusual quality. The directive language, its capability matrix, and
the Proving Grounds catalog are a controlled corpus. Nothing here should be
implemented now, but the Film Director is closer to this research than it looks,
and the per-channel trajectory representation is the interchange these methods
assume.

### CinemaTraj

- Status: **Evaluate**
- Evidence: preprint plus project page, **read at source** (2026-09-02)
- [arXiv 2607.26910](https://arxiv.org/abs/2607.26910v1), submitted 2026-07-29
- [Project page](https://cinematraj.github.io/)

The most direct external validation of the Film Director's architecture found so
far, published two months ago. An LLM agent decomposes a natural-language prompt
into a sequence of **atomic cinematographic movements** (dolly, orbit, crane,
pan, tilt, zoom, arc), each instantiated as a parametric trajectory that stays
optimizable afterward. A structured 3D scene graph grounds the agent's spatial
reasoning. Evaluated on real ScanNet++ environments.

That is the same shape as TKA's directive language: a named atomic move
vocabulary, composed by a language model, over a parametric representation
rather than a baked path. Two independent designs converging on a move
vocabulary is a real signal that the Director's verb set was the right
abstraction rather than an improvisation.

It supplies evidence for two decisions in the design. `tilt` is in its atomic
set and absent from TKA's, which is the gap D1 opens. And keeping each move
parametric and optimizable after instantiation is precisely D4's argument for
moves as persistent nodes rather than compile-time functions.

Where it differs is worth recording as a genuine alternative. Its collision
handling is a **Collision and Occlusion-Free Trajectory Optimizer that refines
the moves' free parameters by gradient descent on a signed distance field**,
reporting a 0.056 collision rate. That edits the move's own parameters. D3
instead models collision as an additive correction evaluated after composition.
Both are defensible and TKA has neither an SDF nor a collision requirement
today. See Open questions.

Code is listed as "coming soon" and is not released. Do not plan on importing
anything from it.

### ShotVerse

- Status: **Reference only**
- Evidence: preprint, **read at source** (2026-09-02)
- [arXiv 2603.11421](https://arxiv.org/abs/2603.11421), v1 2026-03-12, v2 2026-08-24

A "Plan-then-Control" framework splitting generation into a VLM-based Planner
that derives globally aligned trajectories from text and a Controller that
renders them through a camera adapter. Contributes an automated multi-shot
camera calibration pipeline that aligns disjoint single-shot trajectories into
one global coordinate system, plus the ShotVerse-Bench dataset.

Less applicable than CinemaTraj because its Controller drives a video generation
model, whereas TKA renders its own 3D scene and already has exact camera
control. The planner/controller split is nonetheless the same separation the
design draws between the directive layer and its evaluators. Release state not
confirmed.

## What TKA does today, and where it diverges

Current path:

```text
authored FilmDirectorInput (v4, Zod)
  -> resolveFilmDirectorSpec
  -> camera moves compiled by resolveDirectorCameraTrack
  -> ResolvedDirectorCameraKeyframe[]   <-- fused, one-way, lossy
  -> sampleDirectorCameraTrack(t)       <-- pure, correct, keep
  -> Threlte camera
```

Divergences from the convergent model, in priority order:

1. No value layer. Fused keyframes instead of per-channel sample streams.
2. No behavior layer. Moves bake at compile time; `handheld` and `tracking` are
   bolted to the resolved type as optional fields.
3. No editorial layer. A flat scene array with `extends` deep-merge standing in
   for instancing.
4. No manual authoring surface. The structured write path is four scene
   operations in `_lib/film-director-edit.ts` (`append-camera-move`,
   `remove-camera-move`, `formation`, `environment`) plus eight performer fields
   in `DIRECTIVE_PERFORMER_FIELDS`, against roughly 88 authored schema fields
   (counted by grepping `z.` field declarations, so treat it as an order of
   magnitude rather than an exact figure). Everything else requires hand-editing
   JSON in a textarea.
5. `FilmTimeline.svelte` is a scrubber. It builds one segment per scene through
   `buildTimelineSegments` and owns a playhead. It seeks; it cannot edit.

## Verified negatives

Recorded so the next agent does not repeat the search.

- **Theatre.js cannot be adopted as a dependency today.** Development moved to a
  private repository pending 1.0. Read at source, 2026-09-02.
- **There is no Cinemachine port for three.js.** Searched 2026-09-02, then
  re-searched the same evening with a package-oriented query. Nothing credible.
  The two libraries that surface are
  [camera-controls](https://github.com/yomotsu/camera-controls), an
  OrbitControls successor for interactive control rather than a behavior system,
  and NYT `three-story-controls`, a rig plus rail animation with no layering and
  no corrections. The architecture is reimplemented, not imported.
- **OpenUSD and OpenTimelineIO are not browser-runtime options.** Adopt their
  data models; do not plan on their runtimes in a SvelteKit client.

## Open questions

- Whether per-channel bezier tangents are needed, or whether the existing
  `step` / `linear` / `smooth` trio plus a fourth `bezier` mode is sufficient.
  The design assumes the latter.
- Whether the channel store should eventually be promoted out of
  `src/routes/test/film-director/_lib/` into `src/lib/shared/`. Deferred; do not
  create a shared owner speculatively per `.claude/rules/never-hand-roll.md`.
- Whether a learned trajectory component (the GenDoP or E.T. line of work) ever
  earns a slot here, or whether the authored directive language is permanently
  the better fit for a notation-driven product.
- Whether collision avoidance, if it is ever needed, belongs in D3's additive
  correction layer or in a CinemaTraj-style optimizer that refines a move's own
  free parameters against a signed distance field. TKA has no SDF and no
  collision requirement today, so this is cheap to leave open.
- Whether `tilt` and `pedestal` should join the move vocabulary once D1 makes
  aim a first-class channel. Both are standard film axes that TKA cannot
  currently say.

## Related

- `docs/superpowers/specs/active/2026-09-02-film-director-channel-architecture-design.md`
- `docs/reference/film-director-capability-matrix.md` — what the language can and
  cannot say today, including the named rejections
- `docs/architecture/locomotion-research-canon.md` — the format this file follows
- `docs/architecture/canonical-capabilities.md`, `.claude/rules/no-fabrication.md`
