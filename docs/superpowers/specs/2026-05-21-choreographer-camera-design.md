# Choreographer Camera — Design Spec

**Date:** 2026-05-21

## Overview

Two camera behaviors that reinforce the "you are the choreographer" framing of the 3D sequence viewer:

1. **Welcome Animation** — on first 3D entry per session, camera sweeps from front to choreographer position (behind performers, looking out at the audience)
2. **Behind-Performer Snap** — selecting a performer via the rail snaps camera behind their head, seeing what they see

## Feature 1: Welcome Animation ("Choreographer Reveal")

### Trigger

First `enter3D()` call per browser session. Tracked by `_hasPlayedWelcome` flag (not persisted — resets on page reload). Subsequent 2D↔3D flips restore persisted camera position as today.

### Sequence

1. Camera spawns at Front position (audience view, existing default)
2. After 200ms delay (WebGL setup), `setLookAt()` transitions to Choreographer Position
3. camera-controls handles smooth interpolation (~400ms built-in damping)

### Choreographer Position

Coordinate system: performers face +Z by default (facingAngle=0). Front preset = camera at +Z. So choreographer = camera at -Z, looking through performers toward +Z.

- **Camera eye:** `(0, stageGroundOffset + 1.6, gridCenter.z - 2.5)` — 1.6m eye height, 2.5m behind grid center
- **LookAt target:** `(0, stageGroundOffset + 0.3, gridCenter.z + 3.5)` — slightly below eye level, 3.5m ahead toward audience
- **Result:** elevated behind-the-shoulder view, looking past performers at the stage

### Why not reuse the "Back" preset

Back preset looks AT the performer from behind. Choreographer POV looks THROUGH performers toward the audience — lookAt target is beyond the performer, not at them.

## Feature 2: Behind-Performer Snap

### Trigger

`selectPerformerScope(index)` called with non-null index. Deselecting (null / "All") snaps to choreographer position for the group.

### Position Math

For performer at `(px, pz)` with `facingAngle = fa`:

```
camera.x = px - sin(fa) * 1.5      // 1.5m behind
camera.y = stageGroundOffset + 1.6  // eye height
camera.z = pz - cos(fa) * 1.5

lookAt.x = px + sin(fa) * 3.0      // 3m ahead in facing direction
lookAt.y = stageGroundOffset + 0.3  // slightly below eye level (watching hands)
lookAt.z = pz + cos(fa) * 3.0
```

### Deselect Behavior

When returning to "All" (null index), snap to choreographer position computed from group center (same math as welcome animation, using group center instead of single performer).

## Implementation Plan

### New helper functions in `shots.ts`

- `computeChoreographerShot(performers, stageGroundOffset, gridCenterZ)` — group-level choreographer position
- `computeBehindPerformerShot(performer, stageGroundOffset)` — individual behind-the-head position

### Modified files

1. **`shots.ts`** — add two new shot computation functions
2. **`viewer-3d-state.svelte.ts`** — add `_hasPlayedWelcome` flag, modify `enter3D()` to trigger welcome animation, modify `selectPerformerScope()` to trigger behind-performer snap
3. **No changes to `Viewer3DCamera.svelte`** — `snapCameraTo()` already wired and working

### Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| CHOREOGRAPHER_BEHIND_DIST | 2.5m | Close enough for intimacy, far enough to frame stage |
| CHOREOGRAPHER_LOOK_AHEAD | 3.5m | Past performers toward audience |
| CHOREOGRAPHER_EYE_HEIGHT | 1.6m | Standing eye level |
| CHOREOGRAPHER_LOOK_HEIGHT | 0.3m | Slightly below eye — watching hands/props |
| PERFORMER_BEHIND_DIST | 1.5m | Tight behind-the-head shot |
| PERFORMER_LOOK_AHEAD | 3.0m | What performer sees ahead |
| WELCOME_DELAY_MS | 200 | Let WebGL settle before animating |
