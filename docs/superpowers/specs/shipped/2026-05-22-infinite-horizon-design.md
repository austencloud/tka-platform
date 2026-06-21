# Infinite Horizon — Ocean Scene Design Spec

## Goal

Eliminate the visible hard edge where the seabed meets the sky backdrop, making the underwater environment feel like it extends infinitely in all directions.

## Problem

The blue backdrop currently cuts off abruptly — a flat-earth simulation. The seabed geometry ends at 50 units, distance fade stops at 35 units, and the sky gradient bottom color doesn't match the fog terminal color. Three separate color systems (fog, sky, seabed fade) converge to different blues, creating visible seams.

## Approach: Color Convergence + Extended Geometry

All three color systems share a single terminal color. The seabed extends far enough that fog obscures its edge. No skybox replacement, no infinite plane — just proper color math and enough geometry.

## Changes

### 1. Extend Seabed Geometry

**File:** `scene-configs.ts` — ocean ground config

- `ground.size`: 50 → 120 units
- Geometry covers 2.4x the current area. Fog obscures the edge well before it's visible.

### 2. Increase Geometry Resolution

**File:** `ProceduralSeabed.svelte` — SEGMENTS constant

- `SEGMENTS`: 128 → 192
- Maintains vertex density. At 120 units / 192 segments = 0.625 units per quad (vs current 50/128 = 0.39). Acceptable — distant terrain doesn't need fine detail.

### 3. Extend Distance Fade

**File:** `ProceduralSeabed.svelte` — fragment shader, opaque_fragment section

- Current: `smoothstep(20.0, 35.0, dist)` 
- New: `smoothstep(30.0, 55.0, dist)`
- Fade starts later, ends further out. Combined with stronger fog, the seabed dissolves into the water color before any geometry edge is visible.

### 4. Increase Fog Density

**File:** `scene-configs.ts` — ocean fog config

- `fog.density`: 0.022 → 0.035
- Stronger exponential fog means objects beyond ~40 units are fully fogged. The seabed edge at 60 units (half of 120) is invisible.

### 5. Converge Terminal Colors

**File:** `scene-configs.ts` — ocean fog + sky config

All three systems must resolve to the same deep-water blue:

| System | Config Key | Current Value | New Value |
|--------|-----------|---------------|-----------|
| Fog | `fog.color` | `#1a5580` | Single shared color |
| Sky gradient | `sky.bottomColor` | `#0a3d5c` | Same shared color |
| Seabed fade | hardcoded in shader | `#1a5580` | Read from fog color uniform |

The seabed shader's distance fade target currently hardcodes a blue. It must read the fog color uniform instead, so all three systems automatically stay in sync when the color is tuned.

**Shared terminal color:** `#1a5580` (current fog color) as starting point — may need slight adjustment once all three systems converge. The exact hex is tuned visually after implementation.

## What This Doesn't Change

- SkyGradient component structure (inverted sphere, 3-stop gradient) — unchanged
- Per-channel RGB absorption math in the seabed shader — unchanged
- Terrain displacement, dune shapes, detail features — unchanged
- Platform, rocks, coral, fish — unchanged
- Caustics, sparkle, grain normals — unchanged

## Performance

- Vertex count: 192^2 = 36,864 (up from 128^2 = 16,384). +20k vertices is negligible for a single ground plane on any GPU from the last decade.
- Fragment cost: identical shader, just more pixels covered by geometry (most are fogged anyway — early depth rejection handles distant fragments).
- No new draw calls, no new textures, no new render passes.

## Success Criteria

- No visible seam between seabed and sky at any camera angle
- Underwater environment feels like open water, not a bounded room
- Color transitions are smooth — no banding, no abrupt stops
- Performance: no measurable frame time increase on target hardware

## Dependencies

None. This is a config + shader tuning pass. No new components, no new imports.
