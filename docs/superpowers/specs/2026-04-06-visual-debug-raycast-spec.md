# Visual Debug Raycast — Spec

**Date:** 2026-04-06
**Status:** Draft
**Problem:** When mysterious objects appear in the 3D museum scene, Claude has to guess what they are by reading source code. This wastes time and leads to wrong fixes. The user wants Claude to look at the scene directly and identify objects on demand.

---

## The Workflow

1. **User positions camera** facing the mystery object (FPS or orbit mode)
2. **User says** "look at that" / "what is that" / "what am I looking at"
3. **Claude casts a ray** from the camera using `game_raycast`
4. **Claude reads the hit result** — mesh name, geometry, material, world position, parent chain
5. **Claude identifies the object** and explains what code creates it, whether it belongs there, and how to fix it if it doesn't

---

## Game Controller MCP Tools Used

### Primary: `game_raycast`

Cast a ray from camera forward direction. Returns hit info about the first object intersected.

```
game_raycast({ from: "camera" })
```

- `from`: `"camera"` (default) or `"player"`
- `direction`: optional override `{x, y, z}` — defaults to camera forward
- `maxDistance`: default 100

**Expected return:** The hit object's name, type, geometry type, material info, world position, and ancestor chain. This is the core identification tool.

### Supporting: `game_get_state`

Get current player/camera position and rotation before raycasting.

```
game_get_state({ compact: true })
```

Useful for: knowing where we're casting from, logging position for reproducibility.

### Supporting: `game_get_scene`

Get nearby objects within a radius.

```
game_get_scene({ radius: 10 })
```

Useful for: surveying an area when we don't know exactly where the object is. Returns interactables, performers, props in range.

### Supporting: `game_look_at`

Orient camera to face specific world coordinates.

```
game_look_at({ x: 5.5, y: 0, z: 12.3 })
```

Useful for: Claude can aim the camera at a known tile position before raycasting, removing the need for the user to manually aim.

### Supporting: `game_teleport`

Move player to exact coordinates.

```
game_teleport({ x: 5, y: 1, z: 12, snapToGround: true })
```

Useful for: getting close to a suspect area before scanning.

---

## Implementation Requirements

### 1. Raycast Response Enrichment (game-controller bridge)

The `game_raycast` handler in the bridge must return rich object info. Current unknowns:
- What data does the bridge currently return on hit?
- Does it traverse the parent chain?
- Does it include material/color info?

**Minimum required hit data:**

```typescript
interface RaycastHit {
  // What we hit
  objectName: string;          // mesh.name or "unnamed"
  objectType: string;          // "Mesh", "InstancedMesh", "BatchedMesh", etc.
  geometryType: string;        // "BoxGeometry", "CylinderGeometry", etc.

  // Material
  materialType: string;        // "MeshStandardMaterial", etc.
  materialColor: string;       // hex string "#3a3530"
  materialMap: string | null;  // texture name if any

  // Where
  hitPoint: { x: number; y: number; z: number };  // world-space intersection
  objectPosition: { x: number; y: number; z: number }; // mesh local position
  distance: number;            // ray distance to hit

  // Context
  ancestors: string[];         // parent chain names, up to 5 levels
  userData: Record<string, unknown>; // any attached metadata
  instanceId?: number;         // for InstancedMesh/BatchedMesh — which instance
  batchId?: number;            // for BatchedMesh

  // Tile identification (museum-specific)
  nearestTile?: { x: number; y: number; type: string }; // if within TILE_SIZE of a known tile
}
```

### 2. Multi-Hit Mode

Sometimes the first hit is a transparent plane or the floor. Support returning multiple hits:

```
game_raycast({ from: "camera", maxHits: 5 })
```

Returns an array of hits sorted by distance. Claude can inspect the stack to find the relevant object.

### 3. Sweep Raycast (Nice-to-Have)

Cast a grid of rays to scan an area:

```
game_raycast({ from: "camera", sweep: { width: 3, height: 3, spacing: 0.5 } })
```

Returns a grid of hit results. Useful for: "what's different about this patch of floor vs the surrounding area?"

### 4. Bridge-Side Handler

The game-controller MCP bridge needs a handler that:

1. Receives the raycast request
2. Creates a `THREE.Raycaster` with the camera's position and direction
3. Calls `raycaster.intersectObjects(scene.children, true)` (recursive)
4. For each hit, extracts the rich data described above
5. For `InstancedMesh`/`BatchedMesh`, includes the `instanceId`/`batchId`
6. Walks the parent chain up to 5 levels for ancestor names
7. Returns the enriched result

```typescript
// In the bridge's raycast handler
function enrichHit(intersection: THREE.Intersection): RaycastHit {
  const obj = intersection.object;
  const ancestors: string[] = [];
  let p = obj.parent;
  while (p && ancestors.length < 5) {
    ancestors.push(p.name || p.type);
    p = p.parent;
  }

  return {
    objectName: obj.name || "unnamed",
    objectType: obj.type,
    geometryType: (obj as any).geometry?.type ?? "none",
    materialType: (obj as any).material?.type ?? "none",
    materialColor: (obj as any).material?.color?.getHexString?.() ?? "n/a",
    materialMap: (obj as any).material?.map?.name ?? null,
    hitPoint: {
      x: intersection.point.x,
      y: intersection.point.y,
      z: intersection.point.z,
    },
    objectPosition: {
      x: obj.position.x,
      y: obj.position.y,
      z: obj.position.z,
    },
    distance: intersection.distance,
    ancestors,
    userData: obj.userData,
    instanceId: intersection.instanceId,
    batchId: (intersection as any).batchId,
  };
}
```

---

## Usage Patterns

### "What is that black square?"

```
User: [positions camera facing the object]
User: "What is that?"

Claude:
  1. game_get_state() → get camera position/direction
  2. game_raycast({ from: "camera" }) → hit result
  3. Read hit: objectName, geometry, material color, ancestors
  4. Cross-reference with code: "That's a floor tile using stone material (#3a3530)
     while the surrounding Egyptian wing uses sandstone (#4a3e2a).
     It's created at MuseumGeometryBuilder.ts:325."
```

### "Compare these two floor tiles"

```
User: "Look at this tile, then that tile — why are they different?"

Claude:
  1. game_raycast() → first tile hit (color, material, texture)
  2. User moves camera
  3. game_raycast() → second tile hit
  4. Compare: "Tile A is stone (#3a3530), Tile B is sandstone (#4a3e2a).
     The performer-station tile hardcodes stone instead of using the wing material."
```

### "Survey this room for anomalies"

```
Claude:
  1. game_get_scene({ radius: 20 }) → list all objects
  2. Identify anything unexpected (unnamed meshes, wrong materials, orphaned geometry)
  3. game_look_at() + game_raycast() to inspect each suspect
```

---

## What This Replaces

Before this system, debugging visual artifacts required:
1. User describes what they see in screenshots
2. Claude guesses from source code what might create that shape/color
3. Claude makes a fix based on the guess
4. User reloads and checks — often the guess was wrong
5. Repeat 3-5 times

With this system:
1. User faces the object
2. Claude raycasts — instant identification
3. Claude makes the correct fix on the first try

---

## Files to Modify

1. **`mcp-game-controller/src/handlers/raycast.ts`** (or equivalent) — enrich the raycast response with full mesh data
2. **`mcp-game-controller/src/bridge.ts`** (or equivalent) — wire up the enriched handler
3. **Museum3DScene.svelte** — ensure all meshes have meaningful `name` properties set (many are currently unnamed, which makes raycast results less useful)

### Mesh Naming Convention

All meshes added to the museum scene should have descriptive names:

```typescript
// In MuseumGeometryBuilder.ts
floorMesh.name = `floor-${wingId}-${material}`;
wallMesh.name = `wall-${wingId}`;
pedestalMesh.name = `pedestal-${wingId}`;

// In Museum3DScene.svelte (imperative adds)
mesh.name = `room-${roomId}-floor`;
```

This makes raycast results immediately interpretable without needing to cross-reference positions.

---

## Priority

**High.** This is a force multiplier for all future 3D debugging. Every visual bug in the museum will be faster to identify and fix. The current guesswork approach has wasted hours across multiple sessions.
