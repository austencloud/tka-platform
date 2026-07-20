---
name: tile-layout
description: Use when building or modifying 2D tile-based room layouts. Guarantees room connectivity, prevents overlaps, validates walkability. REQUIRED before writing any tile placement code.
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# 2D Tile Layout Engineering

Rules and algorithms for building correct 2D tile-based room layouts. Loaded on-demand when creating or debugging tile grids.

## When NOT to Use

- 3D room geometry (use IndoorScene / RoomGeometryBuilder)
- Single-room content edits that don't change room size, position, or connectivity
- Non-tile UI layouts (CSS grid, flexbox)

## Core Rules

### 1. Never Hand-Type Absolute Coordinates

Every coordinate MUST be computed from a room graph and grid configuration. Hand-typed coordinates produce disconnected layouts.

### 2. Connectivity by Construction

Two valid approaches:
- **Graph-First** (designed layouts): Define abstract graph (rooms = nodes, connections = edges) → place on coarse grid → route corridors → flood-fill validate
- **Growth-Based** (procedural): Each new room placed adjacent to an existing room, extending the connected component

NEVER place rooms at arbitrary positions and then try to connect them with corridors.

### 3. Structural Overlap Prevention

Each room occupies exclusive grid cells. No two rooms share a cell. Run overlap detection before writing tiles.

### 4. Flood-Fill Validation Required

After building any grid, flood-fill from spawn. Every room MUST contain at least one visited tile. If any room is unreachable, the layout is broken.

### 5. Carve-Then-Wall: Corridors NEVER Stamp Walls

**This is the most important rendering rule.** Every major roguelike (TCOD, Brogue, Diablo 1, Nystrom's Rooms and Mazes) follows the same pattern:

1. Initialize grid as SOLID (void)
2. Carve rooms as FLOOR only (no walls)
3. Carve corridors as FLOOR only (no walls)
4. Post-process: any SOLID tile adjacent to FLOOR becomes WALL

**Carving is monotonic** — a tile can go SOLID→FLOOR but NEVER FLOOR→WALL during carving. Floor always wins. This makes elbows, T-junctions, and crossroads work automatically.

NEVER stamp corridor walls during the carving phase. Walls are DERIVED from adjacency after all carving is complete.

### 6. Corridors Connect Rooms, Not Coordinates

A corridor connects two rooms by their doors. Route between door positions, not arbitrary points.

### 7. All Content Placement Is Room-Relative

Exhibits, performers, torches — position as wall fraction (0.0–1.0) or center offset, NEVER absolute tile coordinates.

## Validation Checklist (Exit Criteria)

Before declaring any layout complete, ALL must pass:

| Check | Catches |
|-------|---------|
| Flood-fill from spawn | Disconnected rooms, broken corridors |
| Room overlap detection | Rooms stamped on top of each other |
| Spawn on walkable tile | Player stuck in wall |
| Doors land on wall tiles | Doors in void or floor |
| Corridor width ≥ 3 | Walls eat both sides, player can't pass |
| No room smaller than 6×6 | No interior space for content |

## Reference Files

**`algorithm-reference.md`** — Graph-first algorithm, carve-then-wall rendering, data structures, corridor routing, content placement, anti-patterns, file structure.

**`movement-reference.md`** — Smooth tile movement: rAF game loop, sub-tile lerp interpolation, input buffering, easing curves, wall sliding, camera smoothing. Read this before modifying player movement code.
