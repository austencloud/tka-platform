---
status: backlog
value: 4
effort: M
score: 12
remaining: "E-key interaction + overlay in 3D mode"
last_triaged: 2026-04-26
---
# Unified Museum Mode Design

## Goal

Replace the separate 2D play mode and 3D proof mode with a single unified experience. The player walks around the museum from a top-down 3D view (the "2D mode"), and can press Q at any time to flip into first-person 3D. Both modes share the same player position, physics, and interaction system. Pressing E on exhibits shows plaque text and rendered TKA sequences in a floating overlay.

## Current State

The museum module has 4 modes: picker, play, edit, proof. The **play** mode is a CSS-rendered 2D tile game with a split-screen detail panel. The **proof** mode is a Three.js 3D renderer with a dimension-flip camera transition. They share the same grid data but have completely separate rendering, input, and interaction systems.

**Problem:** The user is working in the 3D proof mode. The 2D play mode is abandoned. The exhibit interaction system (E key, detail panel, plaque + pictograph rendering) only exists in the 2D play mode. The 3D proof has no interaction at all.

## Architecture

### Unified Mode = Enhanced DimensionFlipProof

The DimensionFlipProof component becomes the primary museum experience. It gains:

1. **Top-down WASD movement** — player walks around the museum from above, camera follows
2. **E-key interaction** — detects nearby exhibits based on player position and facing
3. **Floating overlay panel** — shows plaque + pictograph strip over the 3D canvas
4. **Wing detection** — tracks which room the player is in for contextual UI
5. **Interaction prompt** — "E Examine" indicator when facing an exhibit

The existing flip animation and FPS mode (UCC) remain unchanged.

### State Architecture

A new `MuseumGameState` replaces the need for the old `museum-2d-state.svelte.ts` in this context. It's simpler because movement is continuous (not tile-locked), handled by the physics provider.

```
DimensionFlipProof (outer wrapper)
  ├── MuseumGameState (movement, interaction, wing detection)
  ├── MuseumOverlayPanel (floating detail panel)
  ├── InteractionPrompt (E key hint)
  └── Canvas
      └── Museum3DScene (3D rendering + camera)
          └── UnifiedCameraController (FPS mode only)
```

**State fields:**
- `playerWorldX/Z` — continuous world position (from physics provider)
- `playerTileX/Y` — derived tile position (Math.round(worldX / TILE_SIZE))
- `playerFacing` — derived from yaw angle (8-direction)
- `focusedExhibitId` — currently examined exhibit
- `currentWing` — which room the player is in
- `isInFPS` — whether currently in first-person mode
- `showPanel` — whether the overlay panel is visible

### Movement in Top-Down Mode

When `fpsActive` is false and the flip animation is not playing:
- WASD keys move the player via the existing `MuseumPhysicsProvider` (wall collision works identically)
- The top-down camera follows the player position (centered above them) instead of being fixed at the grid center
- Movement speed: 3 units/sec (same as FPS mode for consistency)
- Camera smoothing: exponential lerp so the camera trails slightly behind movement

**Implementation:** Museum3DScene already has the physics provider and avatarState. In the `useTask` loop, when `!fpsActive && !animating`, read held keys and apply movement through the physics provider. Update `TOP_DOWN.position.x/z` to follow the player.

**Key handling:** DimensionFlipProof already listens for Q. Extend it to also track WASD keys and pass held-key state to Museum3DScene as a prop. Museum3DScene reads held keys in its game loop.

### Camera Behavior

**Top-down (default):**
- Camera positioned directly above the player at fixed height
- Height computed to show ~40 tiles of context (enough to see the room you're in)
- FOV narrower than the full-museum view (see more detail)
- Camera lerps to follow player position smoothly

**FPS (after Q flip):**
- Unchanged from current implementation — UCC takes over
- Camera position = player position + eye height offset

**Transition:**
- Q flip animates from top-down (above player) to FPS (at player eye level)
- `syncFpsToCamera()` captures exact camera state for seamless handoff
- Flip-back: camera rises from player position back to top-down above player

### Exhibit Interaction

**Detection (both modes):**
In top-down mode, the player has a facing direction derived from their last movement direction. In FPS mode, facing is derived from the camera yaw.

When E is pressed:
1. Compute the tile the player is facing (playerTile + direction offset)
2. Check if that tile is an exhibit-panel type
3. Look up the exhibit in `grid.exhibits` by tile position
4. Set `focusedExhibitId` to show the overlay panel

**Overlay Panel:**
A Svelte component rendered OUTSIDE the Canvas (HTML overlay on top of the 3D view). Contains:
- PlaqueView (reused from existing component)
- SequenceView (the pictograph strip, already built)
- Close button (or press E again / ESC to dismiss)

**Styling:** Semi-transparent dark panel, museum aesthetic, positioned at right side of screen. Same visual language as the old DetailPanel but as a floating overlay.

### Wing Detection

Convert world position to tile position, check against `grid.wings` bounds. Same logic as the old `findCurrentWing()` but operating on world coordinates divided by TILE_SIZE.

### Module Routing Changes

**Before:** picker → play (2D) | edit | proof (3D)
**After:** picker → museum (unified) | edit

The "museum" mode replaces both "play" and "proof". The mode bar simplifies to: Museum | Edit | Avatar. Tab toggles Museum ↔ Edit.

## Interaction Flow

1. Player enters museum (after avatar picker)
2. Sees top-down 3D view centered on spawn point
3. WASD moves player through corridors and rooms — camera follows from above
4. Wing name appears in corner when entering a new room
5. Walking near an exhibit shows "E Examine" prompt
6. Pressing E opens floating overlay with plaque text + pictograph strip
7. Pressing E again or ESC dismisses the panel
8. Pressing Q flips to FPS — player continues from same position
9. In FPS: WASD + mouse look, E still works for exhibits
10. Pressing Q or ESC flips back to top-down at current position

## Files

| File | Action | Purpose |
|------|--------|---------|
| `components/game/DimensionFlipProof.svelte` | Major rewrite | Becomes the unified museum wrapper — adds input handling, overlay panel, interaction prompt |
| `components/game/Museum3DScene.svelte` | Modify | Add top-down movement in useTask, accept held-keys prop |
| `components/overlay/MuseumOverlayPanel.svelte` | Create | Floating detail panel (plaque + sequence strip) |
| `components/overlay/MuseumInteractionPrompt.svelte` | Create | "E Examine" floating prompt |
| `components/overlay/MuseumWingLabel.svelte` | Create | Wing name display |
| `state/museum-game-state.svelte.ts` | Create | Unified game state (interaction, wing detection, facing) |
| `Museum2DModule.svelte` | Modify | Remove "proof" mode, make unified mode the default play experience |

## Non-Goals

- Removing the 2D play mode code (keep it for now, just don't route to it)
- Removing the editor (still accessible via Tab)
- Player avatar visible in top-down view (future — nice to have but not required)
- Minimap (future)
- 3D exhibit interaction via raycasting (E key works by tile position in both modes)

## Key Design Decisions

1. **Tile-based interaction, not raycasting.** E key checks the tile the player faces, same as 2D mode. Works identically in top-down and FPS because both modes track player position and facing direction in world/tile space. No need for mesh-level hit testing.

2. **Physics provider handles ALL movement.** Both top-down WASD and FPS UCC route through the same `MuseumPhysicsProvider`. Wall collision is consistent regardless of camera perspective.

3. **Overlay, not split-screen.** The detail panel floats over the 3D canvas. No layout changes needed when switching modes. Panel works in both top-down and FPS.

4. **Camera zoom for top-down.** Instead of seeing the entire museum from above (too zoomed out to be useful), the top-down camera zooms in to show the player's immediate surroundings — like a zoomed-in bird's-eye view that follows you.
