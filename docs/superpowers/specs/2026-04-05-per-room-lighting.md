# Per-Room Lighting System

**Date:** 2026-04-05
**Status:** Draft
**Scope:** Replace the global ambient light with per-room local lights so each room has its own atmosphere

---

## Problem

The museum has one global `AmbientLight` whose color and intensity change as the player crosses room boundaries. This means the **entire museum** shifts color when you walk into a new room. A cave room's warm amber tint bleeds into the adjacent gallery's cool purple, and vice versa. The transition is lerped over time, but it's still one light affecting everything.

Real museums don't work this way. The cave should always feel warm. The gallery should always feel cool. Walking between them should feel like crossing a threshold, not like the whole world changing color.

---

## Current Architecture

**Museum3DScene.svelte** (lines ~205-238, ~555-580):

```
Global AmbientLight (1 instance)
  └─ color/intensity updated per-frame based on currentWingTheme
  └─ WING_AMBIENT lookup table maps theme → { color, intensity }

Global HemisphereLight (1 instance)
  └─ Static color, never changes

Global FogExp2 (1 instance)
  └─ color/density lerped toward current room's values

Per-room: torches, spotlights, ceiling lights (already local)
```

The fog lerp is fine — fog is camera-relative, so it naturally affects nearby geometry more than distant geometry. The problem is specifically the `AmbientLight` and how it paints everything uniformly.

---

## Design: Per-Room Ambient Lights

### Concept

Replace the single global `AmbientLight` with one **PointLight per room** positioned at the room's ceiling center. Each light uses the room's ambient color and has a `distance` that confines it roughly to the room bounds.

```
Before:  1 AmbientLight (global, changes with player position)
After:   N PointLights (one per room, static, confined by distance)
         + 1 dim AmbientLight (global baseline so corridors aren't pitch black)
```

### Light Placement

For each wing in `grid.wings`:

```typescript
{
  position: [centerX, WALL_HEIGHT - 0.5, centerZ],  // just below ceiling
  color: WING_AMBIENT[wing.theme].color,
  intensity: WING_AMBIENT[wing.theme].intensity * ROOM_LIGHT_SCALE,
  distance: Math.max(wing.bounds.width, wing.bounds.height) * TILE_SIZE * 1.2,
  decay: 2,  // physically correct inverse-square falloff
}
```

The `distance` parameter ensures the light reaches the room's corners but falls off before reaching adjacent rooms. The 1.2x multiplier provides slight overflow so corners aren't dark.

### Global Baseline

```svelte
<T.AmbientLight intensity={0.15} color="#c8b890" />
<T.HemisphereLight intensity={0.3} color="#fff8e0" groundColor="#2a2015" />
```

Reduced from the current intensity (0.4-2.0 ambient, 0.6 hemisphere) to a dim baseline. Corridors, doors, and transitional spaces get just enough light to navigate. The room-specific PointLights provide the real illumination.

### Large Rooms

Rooms wider than ~20 tiles need multiple lights to avoid dark corners. Split into a 2x2 or 3x3 grid of lights within the room, each at proportionally reduced intensity:

```typescript
const lightsPerAxis = Math.ceil(Math.max(width, height) / 15);
const totalLights = lightsPerAxis * lightsPerAxis;
const perLightIntensity = baseIntensity / totalLights;
```

### WebGL Texture Budget

Each PointLight with `castShadow=true` uses 6 texture units (cube map). We're already at the 16-unit limit. These room ambient lights must have `castShadow={false}`. They're fill lights, not shadow casters. Shadows come from torches and spotlights.

### Performance Budget

The full museum has ~31 wings. Large rooms might need 2-4 lights. Budget: ~50-80 PointLights total. Three.js handles this fine — the per-object lighting calculation uses `distance` to skip lights that can't reach the object. This is much cheaper than shadow-casting lights.

Compare to current: already have ~32 torch PointLights + ceiling lights in institutional wings. Adding ~50 room ambient lights is within the same order of magnitude.

---

## Implementation

### Data: Room Light Positions

Add to `MuseumGeometryBuilder.ts` output:

```typescript
export interface RoomLight {
  wingId: string;
  theme: WingTheme;
  positions: { x: number; z: number }[];  // 1-9 positions depending on room size
  color: string;
  intensity: number;
  distance: number;
}
```

Computed during the geometry build (Phase 6, alongside ceiling lights).

### Rendering: Museum3DScene.svelte

```svelte
<!-- Per-room ambient fill lights — each room has its own color/intensity -->
{#each roomLights as light}
  {#each light.positions as pos}
    <T.PointLight
      position={[pos.x, WALL_HEIGHT - 0.5, pos.z]}
      color={light.color}
      intensity={light.intensity}
      distance={light.distance}
      decay={2}
    />
  {/each}
{/each}

<!-- Global baseline — dim enough that rooms define their own character -->
<T.AmbientLight intensity={0.15} color="#c8b890" />
<T.HemisphereLight intensity={0.3} color="#fff8e0" groundColor="#2a2015" />
```

### Fog: Keep As-Is

The fog system (FogExp2 with per-wing density/color lerp) works well because fog is camera-relative. It creates atmosphere in the player's immediate vicinity without affecting distant rooms. No changes needed.

### Remove: Global Ambient Lerp

Delete the `updateAtmosphere()` ambient light branch. The fog branch stays. The per-frame ambient color/intensity update is no longer needed because each room has its own static light.

```typescript
function updateAtmosphere(tileX: number, tileZ: number, delta: number): void {
  // Only fog transitions — ambient is now per-room static lights
  const theme = getWingThemeAt(tileX, tileZ);
  if (theme && theme !== currentWingTheme) {
    currentWingTheme = theme;
    fogColorTarget.set(WING_FOG[theme].color);
    fogDensityTarget = WING_FOG[theme].density;
  }
  if (fpsActive) {
    fogColorCurrent.lerp(fogColorTarget, FOG_LERP_SPEED * delta);
    sceneFog.color.copy(fogColorCurrent);
    sceneFog.density += (fogDensityTarget - sceneFog.density) * FOG_LERP_SPEED * delta;
  } else {
    sceneFog.density += (0 - sceneFog.density) * FOG_LERP_SPEED * delta;
  }
}
```

---

## Visual Result

| Location | Before | After |
|---|---|---|
| Cave room | Warm amber (correct, but global) | Warm amber (local, stays even when adjacent room visited) |
| Gallery room | Cool purple-black (correct, but global) | Cool purple-black (local, confined) |
| Institutional room | Bright fluorescent (correct, but global) | Bright fluorescent (local, doesn't bleed) |
| Corridor between rooms | Whichever room you last visited | Dim neutral baseline + light spill from both rooms |
| Standing in a doorway | Abrupt color shift | Gradient blend from two room lights overlapping |

The doorway case is the biggest win. Instead of the entire scene snapping to a new color, you see a natural gradient where two rooms' lights overlap.

---

## Files to Modify

| File | Change |
|---|---|
| `MuseumGeometryBuilder.ts` | Add `roomLights: RoomLight[]` to output, compute in Phase 6 |
| `Museum3DScene.svelte` | Render per-room PointLights, reduce global ambient, simplify `updateAtmosphere` |
| `WING_AMBIENT` table | Keep as data source for per-room light colors/intensities |

---

## Testing

- Visual: walk between cave and gallery, verify each room retains its character
- Performance: `npm run check` + FPS counter in Chrome DevTools
- Light count: log `roomLights.reduce((sum, r) => sum + r.positions.length, 0)` — should be under 80
