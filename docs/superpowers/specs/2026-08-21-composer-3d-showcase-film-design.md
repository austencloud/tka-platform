# Composer 3D Showcase Film

**Date:** 2026-08-21  
**Status:** Draft for Austen's approval  
**Purpose:** Direct a cinematic Composer film without advertising controls or assets that do not exist

## The recommendation

Make one 55 to 60 second master film and cut an 18 to 24 second loop from it for
the Composer page.

The page loop starts without sound, reaches a striking change within its first
two seconds, and can expand into the full film. A nearby link opens the real 3D
Studio. The existing live demonstration stays compact. It proves that the scene
is real and responds to the visitor, but it does not try to fit the entire
Studio into a marketing page.

This gives each piece one job:

- the film shows range, scale, casting, atmosphere, formations, and camera work;
- the live demonstration proves that the 3D output is not a pre-rendered fiction;
- the Studio is where visitors make detailed choices themselves.

The film should feel like one escalating performance, not a feature reel with a
new caption every few seconds. It does not need to explain every control. It
needs to make someone want to open the Studio.

## What the embedded Composer scene needs

The scene buttons in the current mockup do not control the 3D environment. They
write to the old 2D background setting while the current 3D viewer owns a
separate environment value.

The correction is conceptually small: scene choices should address the 3D
viewer directly. The existing environment renderer already has a transition
veil, so the change can move through a brief cover and reveal instead of
flashing from one world to another. A second transition system should not be
invented for the marketing page.

The mockup should also stop borrowing or temporarily changing account-level
background settings. Its demonstration must be self-contained and must leave a
visitor's saved setup alone.

Using the real 2D backgrounds as part of the transition is worth testing only
as a temporary bridge while a 3D environment is loading. They should not sit
behind the world as a permanent duplicate. The 3D environment is the proof.

## Capability truth

The categories below describe what can be shown honestly in this film. A type
name in a registry is not enough. “Working” means there is a current render or
playback path that uses it.

| Film ingredient                                                                                           | Truth now                                                                                                        | How it may appear                                                                                    |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Forest, autumn, ocean, cosmic, winter, ember, blossom, rainbow, celestial, and void environments          | Working in the current 3D environment renderer                                                                   | Safe candidates after a visual check of the exact shot                                               |
| Up to eight performers                                                                                    | Working in the standalone viewer                                                                                 | Use eight only when the frame stays readable and the target machine holds up                         |
| Different current avatars for different performers                                                        | Working in the performer state and current deployed avatar set                                                   | Cast distinct foreground and background performers                                                   |
| Staffs, clubs, triads, swords, fans, double staffs, and several unusual props                             | Mixed. The broad prop catalogue is larger than the set proven in every 3D context                                | Start with staff, club, triad, and sword. Admit other props shot by shot after a rendered frame test |
| Fire, LED, trails, bubbles, electricity, and other current effects                                        | Working render paths exist, with some effect-specific limits                                                     | Fire, LED, trails, bubbles, and electricity are valid showcase candidates after stress testing       |
| Glide effort                                                                                              | Working                                                                                                          | May be part of the autumn shot                                                                       |
| Lines, circles, triangles, grids, diagonals, tunnel stacks, stage-left/right groups, and custom positions | Working formation or position paths exist                                                                        | Use preset or hand-arranged formations                                                               |
| Smooth movement between formations                                                                        | Working in the viewer                                                                                            | Useful inside a shot when the transition reads clearly                                               |
| Free camera and auto-orbit                                                                                | Public camera choices exist                                                                                      | Safe in the product demonstration                                                                    |
| Deterministic high-resolution 3D export                                                                   | Working internal export path                                                                                     | Use it to render final shots consistently                                                            |
| Per-performer props, avatars, effects, and sequences in one timed stage performance                       | Pieces work separately; the current Stage viewer does not expose the complete combination                        | Requires a private film-directing layer before it can be claimed as one user workflow                |
| A different beat offset for each of eight performers                                                      | Not connected to the current general viewer playback path                                                        | Add to the film timeline and later decide whether it belongs in the Studio                           |
| A directed camera path with several timed moves and cuts                                                  | Basic presets and camera recording exist; a multi-shot timeline does not                                         | Build as part of film production                                                                     |
| Crossfades between complete shots                                                                         | Environment transitions work inside one scene; edited shot-to-shot transitions are not a current product control | Render clean shots and join them in the film pipeline                                                |
| Raised performers or pedestals                                                                            | No current performer-elevation path was proven                                                                   | Omit from the first film or build and validate a real stage-elevation capability                     |
| Astronaut avatar                                                                                          | Unavailable in the deployed avatar set                                                                           | New rigged character asset, animation test, and art approval required                                |
| Zombie avatar or zombie movement type                                                                     | Unavailable as a current avatar, effort, or effect                                                               | Define what “zombie” means, then create and validate it before showing it                            |

### Limits that matter on camera

The current effects system does not give every effect identical controls. Some
effects operate on the whole prop rig, and the goo path is not yet its own
finished 3D treatment. The film should not hide those differences behind a
claim that every effect can be tuned in every way.

The current general viewer advances its performers on the same beat. A ripple
of eight astronauts, each one beat behind the next, is an excellent shot idea.
It is also new playback behavior for this context. It belongs in the director
timeline work, not in the list of existing features.

## The 60-second treatment

This is a starting cut, not a locked storyboard. Each scene gets its own
approval before production moves to the next level of detail.

### Autumn fire circle, 0:00 to 0:12

We begin close enough to see one prop ignite. The camera pulls around an autumn
clearing and reveals a group arranged in a ring or inward-facing arc. Everyone
uses the same family of props, the same fire treatment, and glide effort. The
formation reads first. The effect follows.

The current system can support this shot without a zombie look. If a zombie
cast remains important, it becomes a later art pass after a compatible avatar
or motion treatment exists.

### Night forest trio, 0:11 to 0:25

A female-presenting lead stands forward with swords. Two visibly different
male-presenting performers sit deeper in frame with double staffs. The camera
starts low and wide, moves through the triangular spacing, and finishes near
the lead's face as the prop motion crosses the foreground.

This shot proves casting, prop variety, depth, and a deliberate camera move. A
forest-at-night grade must be established from a real render; the environment
name alone does not prove that the lighting will support faces and fire props.

### Ocean stage, 0:24 to 0:41

The cut opens far away, like a drone finding performers below the water. Two
triad performers and two club performers form most of a backward-facing arrow.
The water carries bubbles first. Electricity arrives on the props near the end
of the move. The camera banks around the formation so the arrow becomes legible
before the effects peak.

A raised back performer and an extra-large prop remain optional. The prop scale
can be tested now; elevation cannot be promised until a real path is added.
Distinct or mirrored sequences also require the film timeline to drive each
performer separately.

### Lunar tunnel, 0:40 to 0:55

Eight performers stand in a staggered tunnel receding into the cosmic or lunar
environment. The camera faces them head-on while the motion rolls backward one
performer at a time. It then travels to the side and reveals the full line.
Club trails shift through a restrained lunar palette rather than eight unrelated
colors.

The current cosmic environment, tunnel formation, clubs, and trails are usable.
The one-beat ripple needs director-timeline work. Astronauts need a new rigged
avatar and must pass movement, silhouette, lighting, and close-up tests before
they enter the film.

### Return to the tool, 0:54 to 1:00

The final motion resolves into the same sequence inside the actual Studio. The
film ends with a plain invitation to open it. No feature list and no recap.

## The landing-page cut

The short loop should not compress the whole master into a frantic montage. It
uses three clean movements:

1. The autumn fire reveal.
2. The ocean bank and electricity peak.
3. The lunar head-on to side transition.

The loop returns through an environment veil or a dark match frame so the seam
does not look like a reload. People who expand it see the full cast and slower
camera work.

At 375px and 960 x 412, the page may use the video poster and an explicit play
control when playback would compete with the opening or the device asks for
reduced motion. The film must never be the only way to understand Composer.

## Approval gates

Every shot passes the same five gates. Approval at one gate does not silently
approve the next.

### Gate 1: the shot card

One still sketch states the environment, cast, props, effect, formation,
sequence relationship, camera start, camera finish, and the single capability
the shot is meant to prove. This is where ideas are cheap to replace.

### Gate 2: the blocking frame

A real 3D frame shows performer spacing, silhouettes, prop scale, horizon,
lighting, and text-safe crop. Materials may still be plain. Austen approves the
composition before animation and effects add noise.

### Gate 3: the motion study

A four to eight second low-cost render proves the camera move, formation read,
sequence timing, and any per-performer offset. This gate catches camera nausea,
occlusion, collisions, and a formation that only looked good as a still.

### Gate 4: the finished shot

The approved movement receives final environment quality, avatars, props,
effects, color, and high-resolution rendering. Representative frames are
reviewed before the full clip is encoded.

### Gate 5: the edit

Approved clips are joined, timed, and tested on the Composer page. The landing
loop and full film receive separate approval because a good minute-long cut can
still make a poor silent loop.

## Production approach

Build a private 3D film director around the existing renderer. It should read a
shot description that names:

- the environment and its transition;
- every performer, avatar, prop, effect, effort, position, facing, sequence,
  and timing offset;
- the camera's timed positions and focal targets;
- the frame range, render quality, and transition into the next shot.

The director should stage the same scene owners the app already uses. It should
not copy the environment renderer, effect system, prop catalogue, formation
math, or export pipeline. The film-specific work is the timed coordination
between those owners.

Render shots separately at first. This gives each shot a stable asset budget
and makes revisions inexpensive. Crossfades can be applied in the final edit.
A live two-scene transition can be considered later if the edit reveals a real
need for it.

Preload the exact avatars, props, environment textures, and effects needed by a
shot. Precompile its materials before the first captured frame. Three.js
provides asynchronous material compilation specifically to avoid first-use
shader stalls. The current Threlte task system also supports ordered frame work,
which suits deterministic staging before capture.

Camera motion should be stored as positions plus focal targets, not as a chain
of mouse gestures. The existing camera-controls package can interpolate between
those states, while the current offline exporter can continue sampling the
approved path at fixed frame times.

Sources: [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html),
[Three.js scene-transition example](https://threejs.org/examples/webgl_postprocessing_transition.html),
[Threlte task scheduling](https://threlte.xyz/docs/learn/basics/scheduling-tasks),
and [camera-controls](https://github.com/yomotsu/camera-controls).

## Proposed scope after approval

The first implementation phase should be additive. Exact filenames may adjust
after the current 3D work in the shared checkout settles.

- A new internal showcase-film area under `src/lib/features/` owns shot
  descriptions, film timing, and shot validation.
- A private test route under `src/routes/test/` provides the director controls,
  frame inspection, and approval renders.
- The current `Viewer3DScene`, performer state, environment renderer, effect
  system, formation paths, camera controls, and offline exporter remain the
  canonical engines.
- The Composer presentation gains a delivered video surface and full-film
  expansion only after the film has an approved cut.
- The deployed avatar and prop packages change only when an approved shot needs
  a genuinely new asset such as the astronaut.

No change to the public Composer page, shared launchpad, site header, or site
footer is authorized by this draft.

## Risks

**The film outruns the product.** Production-only timing or camera work can make
the Studio look as though it already exposes those controls. The page copy and
final Studio shot must show only real controls. Any capability sold as editable
by the visitor needs to ship first.

**Eight performers exhaust the frame budget.** Effects, transparent water,
trails, lighting, and high-detail avatars can multiply rendering cost. Each
finished shot needs a measured budget and a lower-cost draft mode.

**Assets appear late.** A model or shader entering after capture starts ruins a
deterministic render. Each shot needs an explicit readiness barrier and a failed
load must stop the render.

**Camera work hides the choreography.** A beautiful orbit can turn props into a
blur or stack performers on top of each other. Blocking and motion gates come
before polish for this reason.

**A new character does not fit the rig.** Astronaut clothing, helmet geometry,
and prop clearance may break the current animations. The astronaut gets a
separate close-up, silhouette, deformation, and prop-collision approval.

**The page becomes a video wall.** The short loop needs a poster, reduced-motion
behavior, responsive crop, captions if speech is added, and a size budget. It
cannot push the working Composer demonstration below several screens of video.

## Verification

Before a shot can be called finished:

- capture the same named frame twice and compare camera, performer, prop, and
  effect placement;
- inspect the first frames for shader pop-in, missing textures, or a loading
  flash;
- inspect the transition seam at normal speed and frame by frame;
- verify formation clearance and prop collision through the whole move;
- record render time and failure state with one, three, four, and eight
  performers as relevant;
- review representative frames at phone crop, 960 x 412, tablet, 1440, 1920,
  2560, and 3840 widths;
- test reduced motion, paused playback, keyboard play/expand, and video failure;
- confirm every visible prop, effect, avatar, formation, and environment against
  its working render path rather than its registry entry;
- finish with Austen's visual approval of the blocking frame, motion study,
  finished shot, landing loop, and full edit.

## Repository evidence behind this draft

- `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` owns the viewer's current
  environment and formation changes.
- `src/lib/shared/3d/environments/components/Environment3D.svelte` owns the
  existing environment cover-and-reveal transition.
- `src/lib/shared/3d/state/performer-manager.svelte.ts` sets the standalone
  viewer's eight-performer limit.
- `src/lib/shared/3d/state/avatar-instance-state.svelte.ts` exposes current
  per-performer avatar, prop, effect, effort, sequence, position, and facing
  changes.
- `src/lib/shared/3d/components/Viewer3DScene.svelte` currently advances the
  general viewer's performers from the same playback step.
- `src/lib/features/stage/components/StageViewer.svelte` proves timed marks and
  per-performer clips while also showing the present limitation: default
  avatars, staff props, and effects disabled in that viewer.
- `src/lib/shared/sequence-viewer/camera-choreography/` contains the current
  camera presets and shot helpers.
- `src/lib/shared/3d/services/offline-3d-exporter.ts` owns deterministic
  frame-by-frame 3D capture and camera interpolation.
- `src/lib/shared/effects/domain/effects-config.ts` and the 3D effects renderer
  define the current effect paths and their individual limits.
- `src/lib/shared/effort/domain/effort-types.ts` defines the current effort
  choices. Glide exists; zombie does not.
