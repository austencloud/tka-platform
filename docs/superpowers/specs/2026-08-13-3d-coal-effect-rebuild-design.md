# 3D Coal Effect Rebuild

## Decision

Restore the original 2D Coal renderer unchanged and rebuild only the 3D Coal
renderer. The accidental 2D experiment is preserved as Git blob
`da628c7e052b035f8136f70b4eb8d5a61ea6d453`; it is not part of the active
effect.

The visual target is a real charcoal prop with an incandescent coal head, not
a generic magic trail. Every live tip stays visible at low speed and in wide
multi-performer cameras. Motion sheds discrete ember bodies and throws brief
directional sparks without drawing a ribbon behind the prop.

## Rendering Contract

The existing `CharcoalRenderer3D` remains the single behavior owner. It composes
two established rendering primitives:

1. `ParticleInstancePool3D` draws irregular dimensional coal heads and shed
   fragments with normal blending. Fragments retain a dark body, rotate, fall,
   cool through the authored palette, and disappear quickly.
2. One point-sprite pool draws screen-stable incandescent layers. The shader
   renders an irregular glow around each permanent coal head, an ember shell
   around every fragment, and narrow velocity-oriented sparks.

There are no independent Svelte particle components and no second Coal
implementation. Pool sizes remain fixed by quality tier and all frame-loop data
is mutated in place.

## Motion and Emission

- Every tracked tip renders a coal head regardless of speed. Screen-space size
  floors preserve it in the eight-performer camera and close-up caps prevent it
  from becoming an oversized blob.
- Movement emits discrete particles along the travelled segment rather than a
  continuous mesh or a single clump at the current frame's coordinate.
- Sustained high jerk can fire one burst, then must fall below the re-arm
  threshold or clear a short cooldown before firing again.
- Long seeks and loop resets clear tip history instead of drawing a line across
  the stage.
- Spark velocity inherits the prop direction but quickly separates under drag
  and gravity. Fragments are slower, heavier, and longer lived.
- A nearly stationary tip retains a substantial coal-bed glow and occasionally
  sheds a nearby ember instead of disappearing.

## Control Mapping

- `intensity` controls path emission density, burst count, and HDR strength.
- `spread` controls lateral spark ejection and fragment scatter.
- `glow` controls coal-head size, ember halo size, and cooling time.
- `particleLifetime`, `gravity`, and `sparkSizeJitter` are live renderer inputs,
  not dead translated fields.
- `coreColor`, `midColor`, and `coolColor` update both layers live.

## Performance

- High: 2,400 spark slots and 600 fragment instances.
- Medium: 1,200 spark slots and 300 fragment instances.
- Low: 480 spark slots and 120 fragment instances.
- Four persistent heads are reserved in both pools. Emission across a long
  segment is capped per frame.
- Particle updates and GPU attribute writes allocate no objects in the
  steady-state frame loop.

## Verification

- Unit tests prove distance-based emission, one-shot burst gating, live palette
  updates, reset/disposal, quality-tier capacity, and non-zero output.
- Run the focused 3D Coal tests, then the project type check once.
- Verify the live 3D effect on the production sequence route at 1920x1080,
  2560x1440, 3840x2160, 1440x900, 820x1180, 960x412, and 375x667. Review both
  motion and paused stills for continuity, silhouette, density, and UI overlap.
