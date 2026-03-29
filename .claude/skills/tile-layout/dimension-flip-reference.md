# Dimension Flip Reference (2D ↔ 3D)

How to implement a Paper Mario / Fez style dimension flip in a browser-based tile game with Svelte + Three.js/Threlte.

---

## How the Classics Actually Work

**Paper Mario:** The world is ALWAYS 3D. The "2D" view is an orthographic side camera. Flipping rotates the camera 90 degrees over ~0.75s. View-dependent collision layers enable/disable geometry per view. One world, one renderer.

**Fez:** Same approach — full 3D world with orthographic camera. Rotation orbits the camera around Y-axis. Depth is resolved by projection — platforms far apart in 3D appear adjacent in 2D projection. After rotation, player Z-position snaps to nearest surface.

**Key insight:** Both games maintain ONE world. The 2D view is a constrained camera angle, not a separate representation.

---

## Approaches Ranked (Simplest → Most Complex)

### A: Fade Transition (4-8 hours)
Fade to black in 2D. Hide DOM. Show Three.js canvas at equivalent position. Fade in. Two separate renderers. Works but feels cheap.

### B: Portal/Door Transition (8-16 hours) — RECOMMENDED FIRST STEP
Player walks to an exhibit/door in 2D, presses E. The tile zooms to fill screen (CSS transform), then 3D scene loads inside that frame. Thematically perfect for a museum ("step into the exhibit"). Two renderers, but transition feels intentional.

### C: Orthographic Camera Flip (2-4 days) — RECOMMENDED TARGET
Rebuild 2D view as Three.js scene with orthographic top-down camera. Flipping animates camera from top-down to first-person. ONE renderer, ONE world. The Paper Mario approach.

Camera math: animate `fov` from 1 (near-orthographic) to 75 (perspective) while rotating camera from top-down to eye-level. Small fov on a PerspectiveCamera approximates orthographic.

```
cameraY: lerp(20, 1.6, flipProgress)     // above → eye level
cameraAngleX: lerp(-PI/2, 0, flipProgress) // top-down → horizontal
fov: lerp(1, 75, flipProgress)            // flat → perspective
```

### D: CSS 3D Card Flip (1-2 days)
Keep both renderers. CSS 3D transform rotates the 2D DOM like a playing card, revealing Three.js behind it. Visually striking but fragile.

### E: Rising Geometry (1-2 weeks)
Tiles physically extrude into 3D walls during the flip. Most visually impressive. Enormous scope.

---

## Recommended Path

**Ship Approach B first** (portal/door transition). You already have both renderers and the coordinate mapping. A day of work gets a working dimension flip.

**Migrate to Approach C later** when ready to commit to a single Three.js renderer for both views. This eliminates all state sync bugs and gives the true Paper Mario experience.

---

## Browser Implementation Notes

- Three.js supports both OrthographicCamera and PerspectiveCamera natively
- Threlte's `useFrame()` hook for interpolating camera parameters during flip
- `svelte/motion` `tweened` or `spring` for the flip progress value
- InstancedMesh for rendering many tiles efficiently in Three.js (one draw call per tile type)
- `will-change: transform` on transitioning DOM elements
- Both a CSS Grid DOM and WebGL canvas can be active simultaneously — browsers handle this fine

---

## Implementation Phases for Approach B

1. **Shared dimension state** — `currentDimension: '2d' | '3d'`, `transitionActive`, `entryPoint`
2. **Portal interaction in 2D** — certain tiles marked as portals, E key triggers zoom transition
3. **Entry/exit in 3D** — spawn at mapped position, door mesh at spawn, E to return
4. **Polish** — sound effects, camera shake, keyboard hints

Sources: Super Paper Mario (camera rotation), Fez (Renaud Bedard technical talks), Crush PSP, Manifold Garden
