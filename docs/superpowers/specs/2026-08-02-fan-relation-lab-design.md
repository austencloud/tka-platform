# Fan Relation Lab and Big Fan Reactivation

**Date:** 2026-08-02  
**Status:** Approved for implementation in this conversation

## Outcome

Restore Big Fan as a first-class prop variant and add a Fan Relation Lab inside
the existing Lab module. The lab lets a researcher place two fans at any of the
eight outer grid points or at center, aim each fan, change its physical plane,
and inspect the same state from the audience, stage right, or above.

The lab records geometry before it names theory. C, CC, I, S, X, O, and W are
manual working labels. It must not infer a relation from an incomplete rule set.

## Why the model has four axes

Fan relations cannot be represented by one overloaded `plane` value.

1. **Hand placement** records where each grip is on the body-relative grid.
2. **Local orientation** records the radial, tangential, interradial, or
   center-compass label used by the performer.
3. **Fan presentation plane** records the physical plane of the open fan.
4. **Viewpoint** records the camera projection used to inspect the state.

The fourth axis must never rewrite the first three. A floor-plane fan can point
upstage or downstage while both states collapse to the same edge-on silhouette
from the audience. Stage-right inspection reveals the difference without
changing the notation state.

## Current working observations

These are research inputs supplied by Austen, not an automatic classifier:

- Relation survives changes between together and extended placement when the
  fan size makes the geometry physically possible.
- O examples use opposite world-space headings at several placements.
- X examples face toward one another across alpha and may extend to tau.
- W reaches the same world-space heading through different interradial labels.
  The supplied example is left at NW with clock-out and right at NE with
  counter-out; both point north.
- I is recognized from an edge-on audience projection, but performer-relevant
  upstage/downstage orientation remains distinct in the underlying state.

The current project canon calls the compound orientation family Level 6
“interradial orientations.” Level 7 is conjoined grids. The lab uses that
mapping consistently.

## Existing primitives to reuse

- `PropPlacementGrid.svelte` already provides ordered placement, center support,
  keyboard control, drag aiming, haptics, undo, and responsive board sizing.
- `OrientationCycler.svelte` already owns orientation selection. Add an opt-in
  interradial palette without changing its default four-orientation behavior.
- `SegmentedControl.svelte` owns exactly-one-active controls.
- `Scene3D.svelte`, `Avatar3D`, and `Prop3D` own the spatial preview.
- The existing fan assets and 2D/3D renderers already support `bigfan`.

No new pictograph renderer, fan mesh, placement board, or segmented-button
primitive is permitted.

## Big Fan activation

Big Fan is already present in enums, assets, variant maps, classification,
serialization, animation dimensions, tip points, arrow placement, and 3D
rendering. Reactivation consists of making those existing paths reachable:

- remove `BIGFAN` from `DEACTIVATED_PROP_TYPES`;
- add Fan to the standard-to-big toggle map;
- add Big Fan to the flat picker’s Big section;
- add Big Fan to the unlockable variant pool so future prop locking cannot
  strand it.

## Lab surface

Add `fan-relations` to the existing Lab module and route it through the normal
app chrome at `/lab/fan-relations`.

The lab includes:

- a compact header explaining that relation labels are observational;
- the shared placement board with center enabled;
- Diamond, Box, and All 8 grid modes;
- standard and Big Fan sizes;
- per-hand orientation cyclers with interradials enabled;
- face-on wall, edge-on floor, and edge-on wheel presentation planes;
- audience, stage-right, and above viewpoints;
- a manual working-relation label;
- per-hand readouts for location, local orientation, and world heading;
- a projection warning when the selected view hides a dimension of the fan.

The default state is a complete E/W pair so the spatial preview is immediately
useful. Changing grid modes selects a valid pair for that grid instead of
leaving invisible placements behind.

## Responsive behavior

The workbench is dense and bounded on large screens. It does not scale every
control with viewport width. The placement board and spatial preview sit side by
side when the host has enough width and height, then stack on narrow or short
hosts. The content band remains centered and capped so a 4K display increases
workspace, not eye travel.

Touch targets remain at least the shared minimum. The board keeps its existing
container-query behavior. Motion respects reduced-motion preferences.

## Verification

Focused tests must prove:

- Big Fan is active, selectable, size-toggleable, and present in the future
  unlock pool;
- the eight-orientation cycle preserves the existing four-orientation default;
- the supplied W example resolves both local labels to the same north heading;
- center placement keeps an absolute compass orientation;
- presentation plane and camera viewpoint remain independent;
- no C/CC/I/S/X/O/W classifier is introduced.

Run focused Vitest tests and a scoped Svelte check. Then inspect the live lab at
1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, and 375×667.

## Sources checked

- The repository’s canonical placement, orientation, prop registry, and 3D
  transform services.
- Flow Arts Knowledge MCP entries for tau, the level system, and interradial
  orientations.
- Official Threlte Canvas documentation for parent-owned responsive sizing and
  official Three.js camera documentation for projection behavior.
