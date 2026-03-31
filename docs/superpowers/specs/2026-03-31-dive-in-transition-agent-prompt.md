# Agent Prompt: Pictograph Dive-In Transition

**Copy everything below this line and paste it as the opening message to a new Claude Code agent window.**

---

## Your Task

Design and spec a "dive-in" transition that lets users viewing a 2D animated pictograph seamlessly transition into seeing the same sequence performed by a 3D avatar in Three.js space.

## Context You Need

This is a Svelte 5 + TypeScript + Three.js application (TKA Composer). It has two independent animation systems that both read the same sequence data:

### 2D Animation System
- `src/lib/shared/animation-engine/` — Canvas2D-based pictograph renderer
- `AnimationEngine.svelte.ts` — Orchestrates 23 canvas services, drives prop positions per frame
- `WebGLFireRenderer.ts` — Navier-Stokes fluid sim fire overlay (WebGL2 canvas, z-index 3)
- `WebGLLedRenderer.ts` — Addressable LED bloom overlay (WebGL2 canvas)
- Props animate on a 2D circular grid. Positions are angles + staff rotation angles.

### 3D Avatar System
- `src/lib/shared/3d/` — Three.js avatar with IK-driven arms holding 3D staff props
- `PropStateInterpolator.ts` — Converts TKA motion configs to 3D prop positions across wall/wheel/floor planes
- `Avatar3D.svelte` — GLTF avatar with arm IK, leg animation, prop tracking
- `Staff3D.svelte` — 3D staff model positioned by quaternion math
- `plane-transforms.ts` — Maps 2D grid angles to 3D world coordinates. Key insight: the same angle that positions a prop on the 2D canvas maps directly to a 3D position via `planeAngleToWorldPosition()`.

### Museum System (where this lives)
- `src/lib/features/museum-2d/` — Unified museum experience
- `DimensionFlipProof.svelte` — Current game wrapper. Has a Q-key flip between top-down and FPS 3D views.
- `Museum3DScene.svelte` — Full 3D museum with UnifiedCameraController (orbit/third-person/first-person modes)
- Exhibits display sequence data. Currently the detail panel shows a 2D pictograph strip (`SequenceView.svelte`).

### Camera System
- `UnifiedCameraController.svelte` — Three modes: ORBIT, THIRD_PERSON, FIRST_PERSON
- Already supports camera position/target tweening
- Already has front/side/top presets that align with wall/wheel/floor planes
- Uses perspective projection. No orthographic mode yet.

## The Vision

A user is in the museum, looking at an exhibit. They see a pictograph animating in the detail panel (2D canvas). They trigger "dive in" (button or gesture). The camera pulls back revealing depth, the 2D canvas fades out, and the 3D scene takes over showing an avatar performing the exact same sequence at the exact same beat position. The transition is seamless because both systems read the same prop state data.

The reverse ("pull out") collapses back to the flat 2D view.

## What You Should Do

1. **Read the codebase.** Start with the files listed above. Understand how both animation systems work, what data they share, and how the museum currently displays sequences.

2. **Brainstorm the design using the `/brainstorm` skill** (it will load automatically). Key questions to resolve:
   - How to synchronize playback state between AnimationEngine (2D) and the 3D avatar system so they're on the same beat during transition
   - Whether to use an orthographic camera snapped to a plane view (looks exactly like 2D) or overlay the 2D canvas on top and crossfade
   - How to handle the WebGL fire/LED overlays during transition (they're separate canvases from the main 2D canvas)
   - Where the "dive in" trigger lives in the UI (detail panel button? gesture? keyboard shortcut?)
   - Camera animation path from flat view to perspective 3D view

3. **Write a spec** to `docs/superpowers/specs/2026-03-31-pictograph-dive-in-transition-design.md`

## Key Constraints

- **All work on main branch.** Never create branches or worktrees.
- **Don't touch the finger grip system.** Another agent is building `FingerAnimator` and related grip animation. Stay out of `GripPose.ts`, `FingerAnimator.ts`, and `staff-grip-poses.ts`.
- **Don't modify PropState3D** beyond reading it. The grip agent may be modifying it.
- **Follow existing patterns.** Services have interfaces in `contracts/` and implementations in `implementations/`. Use DI container registration. No barrel exports. No utility files.
- **This is spec-only.** Write the design doc. Don't implement code yet. The spec will be handed off for implementation planning.

## Files to Read First

Start here, in this order:
1. `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`
2. `src/lib/shared/3d/services/implementations/PropStateInterpolator.ts`
3. `src/lib/shared/3d/domain/models/PropState3D.ts`
4. `src/lib/shared/3d/utils/plane-transforms.ts`
5. `src/lib/features/museum-2d/components/game/DimensionFlipProof.svelte`
6. `src/lib/features/museum-2d/components/game/Museum3DScene.svelte`
7. `src/lib/features/museum-2d/components/panel/SequenceView.svelte`
8. `src/lib/shared/3d/components/Avatar3D.svelte`
9. `src/lib/shared/3d/camera/UnifiedCameraController.svelte`

Then read `CLAUDE.md` and `.claude/rules/` for project conventions.
