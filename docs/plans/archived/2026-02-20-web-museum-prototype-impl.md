# Web Museum Prototype Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build walkable museum pavilions in the Realm terrain where users curate sequences as framed exhibits with avatar performers.

**Architecture:** New `museum` feature integrates with the existing Realm. Procedural Three.js geometry creates roofless pavilion structures on a terrain clearing. Framed pictographs on walls, avatar performers on platforms, in-world interaction for curation, Firebase persistence per user.

**Tech Stack:** Svelte 5, Three.js via Threlte, Rapier physics, ITI DI, Firebase Realtime Database

**Design doc:** `docs/plans/2026-02-20-web-museum-prototype-design.md`

---

## Phase 1: Static Museum (walkable empty pavilions)

### Task 1: Domain types and pavilion templates

**Files:**
- Create: `src/lib/features/museum/domain/museum-types.ts`
- Create: `src/lib/features/museum/domain/pavilion-templates.ts`

**Step 1: Create museum-types.ts**

```typescript
// src/lib/features/museum/domain/museum-types.ts

export interface MuseumExhibit {
  slotId: string;
  sequenceId: string;
  assignedAt: number; // timestamp
}

export interface ExhibitSlot {
  id: string;
  pavilionId: string;
  position: { x: number; y: number; z: number }; // world position
  normal: { x: number; y: number; z: number };    // wall-facing direction
  rotationY: number; // radians, faces outward from wall
  type: "wall" | "performer";
}

export interface PavilionLayout {
  id: string;
  template: PavilionTemplate;
  position: { x: number; z: number }; // world XZ position
  rotationY: number; // radians
  walls: WallSegment[];
  slots: ExhibitSlot[];
}

export interface WallSegment {
  start: { x: number; z: number }; // local coordinates
  end: { x: number; z: number };
  height: number;
  thickness: number;
}

export type PavilionTemplate = "alcove" | "corridor" | "courtyard" | "quad";

export interface MuseumGroundsLayout {
  clearingCenter: { x: number; z: number };
  clearingRadius: number;
  pavilions: PavilionLayout[];
}

export interface MuseumConfig {
  wallHeight: number;
  wallThickness: number;
  slotHeight: number;      // center Y of frames on walls
  slotSpacing: number;     // horizontal space between slots
  platformRadius: number;  // performer platform radius
  platformHeight: number;  // performer platform height above ground
  platformOffset: number;  // distance from wall to platform center
}

export const MUSEUM_DEFAULTS: MuseumConfig = {
  wallHeight: 4.0,
  wallThickness: 0.3,
  slotHeight: 1.6,       // eye level
  slotSpacing: 2.5,      // 2.5m between frame centers
  platformRadius: 1.0,
  platformHeight: 0.3,
  platformOffset: 2.0,   // 2m in front of wall
};
```

**Step 2: Create pavilion-templates.ts**

```typescript
// src/lib/features/museum/domain/pavilion-templates.ts
import type { WallSegment, PavilionTemplate } from "./museum-types";
import { MUSEUM_DEFAULTS } from "./museum-types";

const H = MUSEUM_DEFAULTS.wallHeight;
const T = MUSEUM_DEFAULTS.wallThickness;

// Wall segments in LOCAL coordinates (relative to pavilion center)
// Convention: walls extend along one axis, slots face inward

export interface TemplateDefinition {
  id: PavilionTemplate;
  walls: WallSegment[];
  maxSlots: number; // how many wall-mounted exhibit slots fit
}

// L-shape: two walls meeting at a corner, open on two sides
export const ALCOVE_TEMPLATE: TemplateDefinition = {
  id: "alcove",
  walls: [
    { start: { x: -4, z: 0 }, end: { x: 4, z: 0 }, height: H, thickness: T },     // back wall (8m)
    { start: { x: -4, z: 0 }, end: { x: -4, z: 6 }, height: H, thickness: T },     // left wall (6m)
  ],
  maxSlots: 4,
};

// Two parallel walls forming a corridor, open at both ends
export const CORRIDOR_TEMPLATE: TemplateDefinition = {
  id: "corridor",
  walls: [
    { start: { x: -3, z: -5 }, end: { x: -3, z: 5 }, height: H, thickness: T },   // left wall (10m)
    { start: { x: 3, z: -5 }, end: { x: 3, z: 5 }, height: H, thickness: T },     // right wall (10m)
  ],
  maxSlots: 6,
};

// U-shape: three walls, open on one side
export const COURTYARD_TEMPLATE: TemplateDefinition = {
  id: "courtyard",
  walls: [
    { start: { x: -5, z: -4 }, end: { x: 5, z: -4 }, height: H, thickness: T },   // back wall (10m)
    { start: { x: -5, z: -4 }, end: { x: -5, z: 4 }, height: H, thickness: T },   // left wall (8m)
    { start: { x: 5, z: -4 }, end: { x: 5, z: 4 }, height: H, thickness: T },     // right wall (8m)
  ],
  maxSlots: 8,
};

// Square with one open entry
export const QUAD_TEMPLATE: TemplateDefinition = {
  id: "quad",
  walls: [
    { start: { x: -5, z: -5 }, end: { x: 5, z: -5 }, height: H, thickness: T },   // back wall (10m)
    { start: { x: -5, z: -5 }, end: { x: -5, z: 5 }, height: H, thickness: T },   // left wall (10m)
    { start: { x: 5, z: -5 }, end: { x: 5, z: 5 }, height: H, thickness: T },     // right wall (10m)
    { start: { x: -2, z: 5 }, end: { x: -5, z: 5 }, height: H, thickness: T },    // front-left (3m)
    { start: { x: 2, z: 5 }, end: { x: 5, z: 5 }, height: H, thickness: T },      // front-right (3m)
    // 4m gap in front wall = entry
  ],
  maxSlots: 12,
};

export const TEMPLATES: Record<PavilionTemplate, TemplateDefinition> = {
  alcove: ALCOVE_TEMPLATE,
  corridor: CORRIDOR_TEMPLATE,
  courtyard: COURTYARD_TEMPLATE,
  quad: QUAD_TEMPLATE,
};
```

**Step 3: Commit**

```bash
git add src/lib/features/museum/domain/
git commit -m "feat(museum): add domain types and pavilion templates"
```

---

### Task 2: Layout calculator

**Files:**
- Create: `src/lib/features/museum/domain/layout-calculator.ts`
- Create: `tests/unit/museum/layout-calculator.test.ts`

**Step 1: Write failing test**

```typescript
// tests/unit/museum/layout-calculator.test.ts
import { describe, it, expect } from "vitest";
import { calculateMuseumLayout } from "../../../src/lib/features/museum/domain/layout-calculator";

describe("calculateMuseumLayout", () => {
  it("returns 1 alcove for 1-4 exhibits", () => {
    const layout = calculateMuseumLayout(3);
    expect(layout.pavilions).toHaveLength(1);
    expect(layout.pavilions[0].template).toBe("alcove");
  });

  it("returns alcove + corridor for 5-10 exhibits", () => {
    const layout = calculateMuseumLayout(7);
    expect(layout.pavilions).toHaveLength(2);
    expect(layout.pavilions[0].template).toBe("alcove");
    expect(layout.pavilions[1].template).toBe("corridor");
  });

  it("returns 3 pavilions for 11-20 exhibits", () => {
    const layout = calculateMuseumLayout(15);
    expect(layout.pavilions).toHaveLength(3);
  });

  it("generates slots on walls for each pavilion", () => {
    const layout = calculateMuseumLayout(3);
    const pavilion = layout.pavilions[0];
    expect(pavilion.slots.length).toBeGreaterThanOrEqual(3);
    pavilion.slots.forEach((slot) => {
      expect(slot.position).toBeDefined();
      expect(slot.rotationY).toBeDefined();
    });
  });

  it("positions pavilions within clearing radius", () => {
    const layout = calculateMuseumLayout(15);
    const R = layout.clearingRadius;
    layout.pavilions.forEach((p) => {
      const dist = Math.sqrt(p.position.x ** 2 + p.position.z ** 2);
      expect(dist).toBeLessThan(R);
    });
  });

  it("generates paired performer slots for each wall slot", () => {
    const layout = calculateMuseumLayout(3);
    const wallSlots = layout.pavilions[0].slots.filter((s) => s.type === "wall");
    const perfSlots = layout.pavilions[0].slots.filter((s) => s.type === "performer");
    expect(perfSlots).toHaveLength(wallSlots.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/museum/layout-calculator.test.ts`
Expected: FAIL — module not found

**Step 3: Implement layout-calculator.ts**

```typescript
// src/lib/features/museum/domain/layout-calculator.ts
import type {
  MuseumGroundsLayout,
  PavilionLayout,
  ExhibitSlot,
  PavilionTemplate,
  WallSegment,
} from "./museum-types";
import { MUSEUM_DEFAULTS } from "./museum-types";
import { TEMPLATES } from "./pavilion-templates";

/**
 * Calculates museum layout based on how many exhibits the user has curated.
 * Returns pavilion positions, wall geometry, and slot positions.
 */
export function calculateMuseumLayout(exhibitCount: number): MuseumGroundsLayout {
  const plan = selectPavilionPlan(Math.max(1, exhibitCount));
  const positions = positionPavilions(plan.length);
  const clearingRadius = Math.max(30, positions.length * 12);

  const pavilions: PavilionLayout[] = plan.map((templateId, i) => {
    const template = TEMPLATES[templateId];
    const pos = positions[i];
    const walls = template.walls;
    const slots = generateSlots(template.id, walls, pos, i);

    return {
      id: `pavilion_${i}`,
      template: templateId,
      position: pos,
      rotationY: 0,
      walls,
      slots,
    };
  });

  return {
    clearingCenter: { x: 0, z: 0 },
    clearingRadius,
    pavilions,
  };
}

function selectPavilionPlan(count: number): PavilionTemplate[] {
  if (count <= 4) return ["alcove"];
  if (count <= 10) return ["alcove", "corridor"];
  if (count <= 20) return ["alcove", "corridor", "courtyard"];

  // 20+: keep adding pavilions
  const base: PavilionTemplate[] = ["alcove", "corridor", "courtyard"];
  const remaining = count - 20;
  const extraPavilions = Math.ceil(remaining / 8);
  const extraTemplates: PavilionTemplate[] = Array.from(
    { length: extraPavilions },
    (_, i) => (i % 2 === 0 ? "quad" : "courtyard")
  );
  return [...base, ...extraTemplates];
}

function positionPavilions(count: number): Array<{ x: number; z: number }> {
  if (count === 1) return [{ x: 0, z: -8 }];

  // Arrange in a semicircle facing spawn point
  const radius = 12 + count * 3;
  const arcStart = -Math.PI * 0.4;
  const arcEnd = Math.PI * 0.4;

  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = arcStart + t * (arcEnd - arcStart);
    return {
      x: Math.sin(angle) * radius,
      z: -Math.cos(angle) * radius,
    };
  });
}

function generateSlots(
  _templateId: string,
  walls: WallSegment[],
  pavilionPos: { x: number; z: number },
  pavilionIndex: number
): ExhibitSlot[] {
  const slots: ExhibitSlot[] = [];
  const { slotHeight, slotSpacing, platformOffset } = MUSEUM_DEFAULTS;
  let slotIndex = 0;

  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const wallLength = Math.sqrt(dx * dx + dz * dz);
    const slotsOnWall = Math.max(1, Math.floor(wallLength / slotSpacing));

    // Wall direction unit vector
    const dirX = dx / wallLength;
    const dirZ = dz / wallLength;

    // Normal pointing inward (rotate direction 90 degrees CCW)
    const normalX = dirZ;
    const normalZ = -dirX;

    // Rotation: slot faces outward from wall (opposite normal)
    const rotationY = Math.atan2(-normalX, -normalZ);

    for (let i = 0; i < slotsOnWall; i++) {
      const t = (i + 0.5) / slotsOnWall;
      const localX = wall.start.x + dx * t;
      const localZ = wall.start.z + dz * t;

      const worldX = pavilionPos.x + localX;
      const worldZ = pavilionPos.z + localZ;

      const slotId = `p${pavilionIndex}_s${slotIndex}`;

      // Wall-mounted frame slot
      slots.push({
        id: `${slotId}_wall`,
        pavilionId: `pavilion_${pavilionIndex}`,
        position: { x: worldX, y: slotHeight, z: worldZ },
        normal: { x: normalX, y: 0, z: normalZ },
        rotationY,
        type: "wall",
      });

      // Performer platform in front of frame
      slots.push({
        id: `${slotId}_perf`,
        pavilionId: `pavilion_${pavilionIndex}`,
        position: {
          x: worldX + normalX * platformOffset,
          y: 0,
          z: worldZ + normalZ * platformOffset,
        },
        normal: { x: -normalX, y: 0, z: -normalZ }, // faces wall
        rotationY: rotationY + Math.PI, // faces back toward wall
        type: "performer",
      });

      slotIndex++;
    }
  }

  return slots;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/museum/layout-calculator.test.ts`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add src/lib/features/museum/domain/layout-calculator.ts tests/unit/museum/
git commit -m "feat(museum): add layout calculator with tests"
```

---

### Task 3: Museum state

**Files:**
- Create: `src/lib/features/museum/state/museum-state.svelte.ts`

**Step 1: Create museum state factory**

```typescript
// src/lib/features/museum/state/museum-state.svelte.ts
import type {
  MuseumExhibit,
  MuseumGroundsLayout,
  ExhibitSlot,
} from "../domain/museum-types";

export function createMuseumState() {
  let layout = $state<MuseumGroundsLayout | null>(null);
  let exhibits = $state<Map<string, MuseumExhibit>>(new Map());
  let isOwner = $state(true);
  let selectedSlotId = $state<string | null>(null);
  let isOverlayOpen = $state(false);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  const totalSlots = $derived(
    layout?.pavilions.reduce(
      (sum, p) => sum + p.slots.filter((s) => s.type === "wall").length,
      0
    ) ?? 0
  );

  const populatedCount = $derived(exhibits.size);

  return {
    get layout() { return layout; },
    get exhibits() { return exhibits; },
    get isOwner() { return isOwner; },
    get selectedSlotId() { return selectedSlotId; },
    get isOverlayOpen() { return isOverlayOpen; },
    get isLoading() { return isLoading; },
    get error() { return error; },
    get totalSlots() { return totalSlots; },
    get populatedCount() { return populatedCount; },

    setLayout(newLayout: MuseumGroundsLayout) { layout = newLayout; },
    setIsOwner(owner: boolean) { isOwner = owner; },
    setLoading(loading: boolean) { isLoading = loading; },
    setError(err: string | null) { error = err; },

    selectSlot(slotId: string | null) { selectedSlotId = slotId; },
    openOverlay() { isOverlayOpen = true; },
    closeOverlay() { isOverlayOpen = false; },

    assignExhibit(slotId: string, sequenceId: string) {
      const updated = new Map(exhibits);
      updated.set(slotId, {
        slotId,
        sequenceId,
        assignedAt: Date.now(),
      });
      exhibits = updated;
    },

    removeExhibit(slotId: string) {
      const updated = new Map(exhibits);
      updated.delete(slotId);
      exhibits = updated;
    },

    getExhibitForSlot(slotId: string): MuseumExhibit | undefined {
      return exhibits.get(slotId);
    },

    getSlotById(slotId: string): ExhibitSlot | undefined {
      if (!layout) return undefined;
      for (const pavilion of layout.pavilions) {
        const slot = pavilion.slots.find((s) => s.id === slotId);
        if (slot) return slot;
      }
      return undefined;
    },

    reset() {
      layout = null;
      exhibits = new Map();
      isOwner = true;
      selectedSlotId = null;
      isOverlayOpen = false;
      isLoading = true;
      error = null;
    },
  };
}

export type MuseumState = ReturnType<typeof createMuseumState>;
```

**Step 2: Commit**

```bash
git add src/lib/features/museum/state/
git commit -m "feat(museum): add museum state management"
```

---

### Task 4: Realm config for museum

**Files:**
- Modify: `src/lib/features/realm/core/realm-config.ts` — extend `SpawnClearingConfig` or add museum-specific clearing type
- Modify: `src/lib/features/realm/core/realm-definitions.ts` — add `MUSEUM_GROUNDS_CONFIG`

**Step 1: Add museum realm config**

Add to the end of `realm-definitions.ts`:

```typescript
export const MUSEUM_GROUNDS_CONFIG: RealmConfig = {
  id: "museum-grounds",
  name: "Museum Grounds",
  description: "Open-air museum with pavilion structures in natural terrain",

  terrain: {
    type: "procedural",
    seed: 314,  // different seed from campground
    waterLevel: 5,
  },

  chunks: {
    size: 32,
    viewDistance: 256,
    lodDistances: [],
  },

  features: {
    objectPlacement: false,
    boundaryEditing: false,
    satelliteImagery: false,
  },

  spawn: {
    position: [0, 50, 0],
    yaw: Math.PI, // face toward pavilions (they're at negative Z)
  },

  physics: {
    walkSpeed: 3.5,
    runSpeed: 7,
    flySpeed: 50,
    gravity: 9.81,
    jumpForce: 5,
    playerHeight: 1.7,
  },

  spawnClearing: {
    enabled: true,
    center: { x: 0, z: 0 },
    radius: 40,       // larger clearing for museum grounds
    blendWidth: 20,
    campground: {
      enabled: false,  // no campground objects — pavilions replace them
      firePit: false,
      tent: false,
      seatingLogs: 0,
      torches: 0,
    },
  },
};
```

Also add it to the `REALM_CONFIGS` record in the same file.

**Step 2: Commit**

```bash
git add src/lib/features/realm/core/realm-definitions.ts
git commit -m "feat(museum): add museum grounds realm config"
```

---

### Task 5: Pavilion renderer component

**Files:**
- Create: `src/lib/features/museum/components/Pavilion.svelte`

**Step 1: Create Pavilion component**

This renders the Three.js geometry for one pavilion: walls as BoxGeometry, floor as PlaneGeometry, Rapier colliders for walls.

```svelte
<!-- src/lib/features/museum/components/Pavilion.svelte -->
<script lang="ts">
  import { T } from "@threlte/core";
  import * as THREE from "three";
  import type { PavilionLayout, ExhibitSlot } from "../domain/museum-types";
  import { MUSEUM_DEFAULTS } from "../domain/museum-types";

  interface Props {
    pavilion: PavilionLayout;
    groundY: number;
  }

  let { pavilion, groundY }: Props = $props();

  const wallColor = new THREE.Color(0xd4c5a9); // warm sandstone
  const floorColor = new THREE.Color(0x8b7d6b); // flagstone
</script>

<!-- Floor plane under the pavilion -->
<T.Mesh
  position.x={pavilion.position.x}
  position.y={groundY + 0.01}
  position.z={pavilion.position.z}
  rotation.x={-Math.PI / 2}
  receiveShadow
>
  <T.PlaneGeometry args={[20, 20]} />
  <T.MeshStandardMaterial color={floorColor} roughness={0.9} />
</T.Mesh>

<!-- Walls -->
{#each pavilion.walls as wall}
  {@const dx = wall.end.x - wall.start.x}
  {@const dz = wall.end.z - wall.start.z}
  {@const length = Math.sqrt(dx * dx + dz * dz)}
  {@const centerX = pavilion.position.x + (wall.start.x + wall.end.x) / 2}
  {@const centerZ = pavilion.position.z + (wall.start.z + wall.end.z) / 2}
  {@const angle = Math.atan2(dx, dz)}

  <T.Mesh
    position.x={centerX}
    position.y={groundY + wall.height / 2}
    position.z={centerZ}
    rotation.y={angle}
    castShadow
    receiveShadow
  >
    <T.BoxGeometry args={[wall.thickness, wall.height, length]} />
    <T.MeshStandardMaterial color={wallColor} roughness={0.8} />
  </T.Mesh>
{/each}
```

**Step 2: Commit**

```bash
git add src/lib/features/museum/components/Pavilion.svelte
git commit -m "feat(museum): add Pavilion renderer component"
```

---

### Task 6: MuseumGrounds orchestrator component

**Files:**
- Create: `src/lib/features/museum/components/MuseumGrounds.svelte`

**Step 1: Create MuseumGrounds**

Orchestrates pavilion rendering inside the Threlte scene. Takes exhibit count, calculates layout, renders all pavilions.

```svelte
<!-- src/lib/features/museum/components/MuseumGrounds.svelte -->
<script lang="ts">
  import { calculateMuseumLayout } from "../domain/layout-calculator";
  import Pavilion from "./Pavilion.svelte";
  import type { MuseumState } from "../state/museum-state.svelte";

  interface Props {
    museumState: MuseumState;
    groundY: number;
  }

  let { museumState, groundY }: Props = $props();

  // Recalculate layout when exhibit count changes
  const layout = $derived.by(() => {
    const count = Math.max(1, museumState.populatedCount);
    return calculateMuseumLayout(count);
  });

  // Push layout to state whenever it recalculates
  $effect(() => {
    museumState.setLayout(layout);
  });
</script>

{#each layout.pavilions as pavilion (pavilion.id)}
  <Pavilion {pavilion} {groundY} />
{/each}
```

**Step 2: Commit**

```bash
git add src/lib/features/museum/components/MuseumGrounds.svelte
git commit -m "feat(museum): add MuseumGrounds orchestrator"
```

---

### Task 7: Museum destination and registration

**Files:**
- Create: `src/lib/features/museum/MuseumDestination.svelte`
- Modify: `src/lib/shared/3d-core/destinations/definitions.ts` — add museum destination entry

**Step 1: Create MuseumDestination.svelte**

```svelte
<!-- src/lib/features/museum/MuseumDestination.svelte -->
<script lang="ts">
  import WorldScene from "$lib/features/realm/components/scene/WorldScene.svelte";
  import { MUSEUM_GROUNDS_CONFIG } from "$lib/features/realm/core/realm-definitions";
</script>

<WorldScene realmConfig={MUSEUM_GROUNDS_CONFIG} />
```

Note: MuseumGrounds integration into WorldScene comes in the next step. This gets the destination registered and walkable.

**Step 2: Add destination entry**

In `src/lib/shared/3d-core/destinations/definitions.ts`, add to the `DESTINATIONS` array:

```typescript
{
  id: "museum",
  name: "Museum",
  description: "Curate your own open-air museum of sequences",
  icon: "fa-building-columns",
  color: "#a78bfa",
  supportsMultiplayer: false,
  supportsPhysics: true,
  defaultCameraMode: CameraMode.FIRST_PERSON,
  category: "social",
  tags: ["museum", "gallery", "curation", "exhibits"],
  component: () => import("../../../features/museum/MuseumDestination.svelte"),
  enabled: true,
},
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds. Museum destination appears in the destination picker.

**Step 4: Commit**

```bash
git add src/lib/features/museum/MuseumDestination.svelte src/lib/shared/3d-core/destinations/definitions.ts
git commit -m "feat(museum): register museum destination in realm picker"
```

---

### Task 8: Integrate MuseumGrounds into WorldScene

**Files:**
- Modify: `src/lib/features/realm/components/scene/WorldSceneContent.svelte` — conditionally render MuseumGrounds when museum config is active

**Step 1: Add museum grounds rendering**

In `WorldSceneContent.svelte`, add a conditional block that renders `MuseumGrounds` when the active config is the museum. Find where campground objects are loaded (around line 587) and add a parallel path:

```typescript
// At the top, add import:
import MuseumGrounds from "$lib/features/museum/components/MuseumGrounds.svelte";
import { createMuseumState } from "$lib/features/museum/state/museum-state.svelte";

// Near the campground loading logic, add:
const isMuseumConfig = $derived(activeConfig.id === "museum-grounds");
const museumState = createMuseumState();
```

In the template section, alongside the campground objects rendering, add:

```svelte
{#if isMuseumConfig}
  <MuseumGrounds {museumState} groundY={waterLevel + 3} />
{/if}
```

The `waterLevel + 3` follows the existing convention — the spawn clearing is 3m above water level.

**Step 2: Verify — walk around**

Run: `npm run build`
Expected: Build succeeds. When loading the Museum destination, you should see the terrain with a large flat clearing and pavilion wall structures.

**Step 3: Commit**

```bash
git add src/lib/features/realm/components/scene/WorldSceneContent.svelte
git commit -m "feat(museum): render pavilions in WorldScene when museum config active"
```

---

## Phase 2: Exhibits on Walls

### Task 9: Adapted FramedSequence component

**Files:**
- Create: `src/lib/features/museum/components/FramedSequence.svelte`

**Step 1: Create FramedSequence**

Adapted from the gallery version. Renders a gold frame mesh with thumbnail texture at a slot position.

```svelte
<!-- src/lib/features/museum/components/FramedSequence.svelte -->
<script lang="ts">
  import { T } from "@threlte/core";
  import { useTexture } from "@threlte/extras";
  import * as THREE from "three";
  import type { ExhibitSlot } from "../domain/museum-types";

  interface Props {
    slot: ExhibitSlot;
    thumbnailUrl: string;
    title?: string;
  }

  let { slot, thumbnailUrl, title = "" }: Props = $props();

  const FRAME_WIDTH = 1.2;
  const FRAME_HEIGHT = 1.2;
  const FRAME_BORDER = 0.08;
  const FRAME_DEPTH = 0.05;

  const goldColor = new THREE.Color(0xc9a227);
  const goldBright = new THREE.Color(0xe8d589);
  const darkBg = new THREE.Color(0x1a1a2e);

  // Load thumbnail texture
  let texture = $state<THREE.Texture | null>(null);
  let loadError = $state(false);

  $effect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      thumbnailUrl,
      (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        texture = tex;
      },
      undefined,
      () => { loadError = true; }
    );
  });
</script>

<T.Group
  position.x={slot.position.x}
  position.y={slot.position.y}
  position.z={slot.position.z}
  rotation.y={slot.rotationY}
>
  <!-- Outer frame -->
  <T.Mesh castShadow>
    <T.BoxGeometry args={[FRAME_WIDTH + FRAME_BORDER * 2, FRAME_HEIGHT + FRAME_BORDER * 2, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={goldColor} metalness={0.6} roughness={0.3} />
  </T.Mesh>

  <!-- Inner frame (brighter gold) -->
  <T.Mesh position.z={0.01}>
    <T.BoxGeometry args={[FRAME_WIDTH + FRAME_BORDER * 0.5, FRAME_HEIGHT + FRAME_BORDER * 0.5, FRAME_DEPTH]} />
    <T.MeshStandardMaterial color={goldBright} metalness={0.5} roughness={0.4} />
  </T.Mesh>

  <!-- Image plane or dark placeholder -->
  <T.Mesh position.z={FRAME_DEPTH / 2 + 0.001}>
    <T.PlaneGeometry args={[FRAME_WIDTH, FRAME_HEIGHT]} />
    {#if texture}
      <T.MeshBasicMaterial map={texture} />
    {:else}
      <T.MeshStandardMaterial color={loadError ? 0x4a1528 : darkBg} />
    {/if}
  </T.Mesh>
</T.Group>
```

**Step 2: Commit**

```bash
git add src/lib/features/museum/components/FramedSequence.svelte
git commit -m "feat(museum): add FramedSequence component for wall exhibits"
```

---

### Task 10: Empty slot indicator

**Files:**
- Create: `src/lib/features/museum/components/EmptySlotIndicator.svelte`

**Step 1: Create EmptySlotIndicator**

A subtle "+" indicator on the wall where an exhibit can be placed. Glows when player is nearby.

```svelte
<!-- src/lib/features/museum/components/EmptySlotIndicator.svelte -->
<script lang="ts">
  import { T } from "@threlte/core";
  import * as THREE from "three";
  import type { ExhibitSlot } from "../domain/museum-types";

  interface Props {
    slot: ExhibitSlot;
    isNearby: boolean;
  }

  let { slot, isNearby }: Props = $props();

  const inactiveColor = new THREE.Color(0x444444);
  const activeColor = new THREE.Color(0xa78bfa);
</script>

<T.Group
  position.x={slot.position.x}
  position.y={slot.position.y}
  position.z={slot.position.z}
  rotation.y={slot.rotationY}
>
  <!-- Horizontal bar of + -->
  <T.Mesh>
    <T.BoxGeometry args={[0.4, 0.06, 0.02]} />
    <T.MeshStandardMaterial
      color={isNearby ? activeColor : inactiveColor}
      emissive={isNearby ? activeColor : inactiveColor}
      emissiveIntensity={isNearby ? 0.5 : 0.1}
    />
  </T.Mesh>

  <!-- Vertical bar of + -->
  <T.Mesh>
    <T.BoxGeometry args={[0.06, 0.4, 0.02]} />
    <T.MeshStandardMaterial
      color={isNearby ? activeColor : inactiveColor}
      emissive={isNearby ? activeColor : inactiveColor}
      emissiveIntensity={isNearby ? 0.5 : 0.1}
    />
  </T.Mesh>
</T.Group>
```

**Step 2: Commit**

```bash
git add src/lib/features/museum/components/EmptySlotIndicator.svelte
git commit -m "feat(museum): add empty slot indicator component"
```

---

### Task 11: ExhibitSlot component (populated or empty)

**Files:**
- Create: `src/lib/features/museum/components/ExhibitSlot.svelte`

**Step 1: Create ExhibitSlot**

Renders either a FramedSequence (populated) or EmptySlotIndicator (empty). Handles proximity detection.

```svelte
<!-- src/lib/features/museum/components/ExhibitSlot.svelte -->
<script lang="ts">
  import type { ExhibitSlot as SlotType, MuseumExhibit } from "../domain/museum-types";
  import FramedSequence from "./FramedSequence.svelte";
  import EmptySlotIndicator from "./EmptySlotIndicator.svelte";

  interface Props {
    slot: SlotType;
    exhibit: MuseumExhibit | undefined;
    thumbnailUrl: string | undefined;
    playerPosition: { x: number; y: number; z: number };
    isOwner: boolean;
  }

  let { slot, exhibit, thumbnailUrl, playerPosition, isOwner }: Props = $props();

  const NEARBY_DISTANCE = 5; // meters

  const isNearby = $derived(() => {
    const dx = playerPosition.x - slot.position.x;
    const dz = playerPosition.z - slot.position.z;
    return Math.sqrt(dx * dx + dz * dz) < NEARBY_DISTANCE;
  });
</script>

{#if slot.type === "wall"}
  {#if exhibit && thumbnailUrl}
    <FramedSequence {slot} {thumbnailUrl} />
  {:else if isOwner}
    <EmptySlotIndicator {slot} isNearby={isNearby()} />
  {/if}
{/if}
```

**Step 2: Commit**

```bash
git add src/lib/features/museum/components/ExhibitSlot.svelte
git commit -m "feat(museum): add ExhibitSlot with populated/empty states"
```

---

### Task 12: Wire exhibits into MuseumGrounds

**Files:**
- Modify: `src/lib/features/museum/components/MuseumGrounds.svelte` — render ExhibitSlots per pavilion

**Step 1: Update MuseumGrounds to render slots**

Add ExhibitSlot rendering to MuseumGrounds. For now, use hardcoded test data (no Firebase yet).

```svelte
<!-- Updated MuseumGrounds.svelte -->
<script lang="ts">
  import { calculateMuseumLayout } from "../domain/layout-calculator";
  import Pavilion from "./Pavilion.svelte";
  import ExhibitSlot from "./ExhibitSlot.svelte";
  import type { MuseumState } from "../state/museum-state.svelte";

  interface Props {
    museumState: MuseumState;
    groundY: number;
    playerPosition: { x: number; y: number; z: number };
  }

  let { museumState, groundY, playerPosition }: Props = $props();

  const layout = $derived.by(() => {
    const count = Math.max(1, museumState.populatedCount);
    return calculateMuseumLayout(count);
  });

  $effect(() => {
    museumState.setLayout(layout);
  });
</script>

{#each layout.pavilions as pavilion (pavilion.id)}
  <Pavilion {pavilion} {groundY} />

  {#each pavilion.slots as slot (slot.id)}
    <ExhibitSlot
      {slot}
      exhibit={museumState.getExhibitForSlot(slot.id)}
      thumbnailUrl={undefined}
      {playerPosition}
      isOwner={museumState.isOwner}
    />
  {/each}
{/each}
```

Also update `WorldSceneContent.svelte` to pass `playerPosition` to `MuseumGrounds`.

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/features/museum/components/MuseumGrounds.svelte src/lib/features/realm/components/scene/WorldSceneContent.svelte
git commit -m "feat(museum): render exhibit slots on pavilion walls"
```

---

## Phase 3: Performers

### Task 13: PerformerPlatform component

**Files:**
- Create: `src/lib/features/museum/components/PerformerPlatform.svelte`

**Step 1: Create PerformerPlatform**

Renders a raised circular platform. When a sequence is assigned, spawns an Avatar3D performing it.

```svelte
<!-- src/lib/features/museum/components/PerformerPlatform.svelte -->
<script lang="ts">
  import { T } from "@threlte/core";
  import * as THREE from "three";
  import type { ExhibitSlot } from "../domain/museum-types";

  interface Props {
    slot: ExhibitSlot;
    isPopulated: boolean;
    playerPosition: { x: number; y: number; z: number };
  }

  let { slot, isPopulated, playerPosition }: Props = $props();

  const ACTIVATION_DISTANCE = 15; // meters — performers activate when player is within range
  const platformColor = new THREE.Color(0x6b5b4f); // dark stone

  const isActive = $derived(() => {
    const dx = playerPosition.x - slot.position.x;
    const dz = playerPosition.z - slot.position.z;
    return Math.sqrt(dx * dx + dz * dz) < ACTIVATION_DISTANCE;
  });
</script>

{#if slot.type === "performer"}
  <!-- Circular platform -->
  <T.Mesh
    position.x={slot.position.x}
    position.y={slot.position.y + 0.15}
    position.z={slot.position.z}
    receiveShadow
  >
    <T.CylinderGeometry args={[1.0, 1.1, 0.3, 32]} />
    <T.MeshStandardMaterial color={platformColor} roughness={0.85} />
  </T.Mesh>

  <!-- Avatar placeholder — full Avatar3D integration in next task -->
  {#if isPopulated && isActive()}
    <T.Mesh
      position.x={slot.position.x}
      position.y={slot.position.y + 1.2}
      position.z={slot.position.z}
    >
      <T.CapsuleGeometry args={[0.25, 0.9, 8, 16]} />
      <T.MeshStandardMaterial color={0xa78bfa} opacity={0.6} transparent />
    </T.Mesh>
  {/if}
{/if}
```

Note: Task 14 will replace the capsule placeholder with actual Avatar3D + IK animation.

**Step 2: Wire into MuseumGrounds**

Add `PerformerPlatform` rendering alongside `ExhibitSlot` in `MuseumGrounds.svelte`:

```svelte
{#each pavilion.slots as slot (slot.id)}
  {#if slot.type === "wall"}
    <ExhibitSlot ... />
  {:else if slot.type === "performer"}
    <PerformerPlatform
      {slot}
      isPopulated={!!museumState.getExhibitForSlot(slot.id.replace('_perf', '_wall'))}
      {playerPosition}
    />
  {/if}
{/each}
```

**Step 3: Commit**

```bash
git add src/lib/features/museum/components/PerformerPlatform.svelte src/lib/features/museum/components/MuseumGrounds.svelte
git commit -m "feat(museum): add performer platform with proximity activation"
```

---

### Task 14: Avatar performer integration

**Files:**
- Modify: `src/lib/features/museum/components/PerformerPlatform.svelte` — replace capsule with Avatar3D

**Step 1: Integrate Avatar3D**

Replace the placeholder capsule with the actual Avatar3D component from `$lib/shared/3d-animation/`. This requires:
- Import Avatar3D and Staff3D
- Use the SequenceConverter to convert sequence data to prop states
- Loop playback at 60 BPM

This task depends on understanding how `WorldSceneContent.svelte` already creates performer instances (around lines 400-500 for the `performerState` prop). Follow that exact pattern.

Read: `src/lib/shared/3d-animation/state/avatar-instance-state.svelte.ts` for how `createAvatarInstanceState()` works.
Read: `src/lib/shared/3d-animation/state/performer-manager.svelte.ts` for `createPerformerManager()`.
Read: How `WorldSceneContent.svelte` uses `performerState` to drive `Avatar3D` prop states.

The key integration point: each platform needs its own `AvatarInstanceState` with the sequence loaded, advancing steps on a timer.

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds. Performers render as avatars on platforms (if sequence data is available).

**Step 3: Commit**

```bash
git add src/lib/features/museum/components/PerformerPlatform.svelte
git commit -m "feat(museum): integrate Avatar3D performers on platforms"
```

---

## Phase 4: Interaction & Curation

### Task 15: Interaction detection service

**Files:**
- Create: `src/lib/features/museum/services/contracts/IInteractionDetector.ts`
- Create: `src/lib/features/museum/services/implementations/InteractionDetector.ts`

**Step 1: Create interface**

```typescript
// src/lib/features/museum/services/contracts/IInteractionDetector.ts
import type { ExhibitSlot } from "../../domain/museum-types";

export interface InteractionTarget {
  slot: ExhibitSlot;
  distance: number;
}

export interface IInteractionDetector {
  findInteractableSlot(
    playerPosition: { x: number; y: number; z: number },
    cameraDirection: { x: number; y: number; z: number },
    slots: ExhibitSlot[]
  ): InteractionTarget | null;
}
```

**Step 2: Create implementation**

```typescript
// src/lib/features/museum/services/implementations/InteractionDetector.ts
import type { ExhibitSlot } from "../../domain/museum-types";
import type { IInteractionDetector, InteractionTarget } from "../contracts/IInteractionDetector";

const INTERACTION_DISTANCE = 3.0; // meters
const INTERACTION_ANGLE = Math.PI / 4; // 45 degrees — must be looking roughly at the slot

export class InteractionDetector implements IInteractionDetector {
  findInteractableSlot(
    playerPosition: { x: number; y: number; z: number },
    cameraDirection: { x: number; y: number; z: number },
    slots: ExhibitSlot[]
  ): InteractionTarget | null {
    let closest: InteractionTarget | null = null;

    for (const slot of slots) {
      if (slot.type !== "wall") continue;

      const dx = slot.position.x - playerPosition.x;
      const dz = slot.position.z - playerPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > INTERACTION_DISTANCE) continue;

      // Check if player is looking at the slot
      const dirLength = Math.sqrt(cameraDirection.x ** 2 + cameraDirection.z ** 2);
      if (dirLength < 0.001) continue;

      const dotProduct = (dx * cameraDirection.x + dz * cameraDirection.z) / (distance * dirLength);
      const angle = Math.acos(Math.min(1, Math.max(-1, dotProduct)));

      if (angle > INTERACTION_ANGLE) continue;

      if (!closest || distance < closest.distance) {
        closest = { slot, distance };
      }
    }

    return closest;
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/features/museum/services/
git commit -m "feat(museum): add interaction detection service"
```

---

### Task 16: Interaction prompt UI

**Files:**
- Create: `src/lib/features/museum/components/InteractionPrompt.svelte`

**Step 1: Create InteractionPrompt**

2D overlay that shows "Press E to assign" or "Press E for details" when looking at a slot.

```svelte
<!-- src/lib/features/museum/components/InteractionPrompt.svelte -->
<script lang="ts">
  interface Props {
    isPopulated: boolean;
    isOwner: boolean;
    visible: boolean;
  }

  let { isPopulated, isOwner, visible }: Props = $props();

  const message = $derived(() => {
    if (!isOwner) return "Press E to view";
    return isPopulated ? "Press E for details" : "Press E to assign sequence";
  });
</script>

{#if visible}
  <div class="interaction-prompt">
    <span class="prompt-text">{message()}</span>
  </div>
{/if}

<style>
  .interaction-prompt {
    position: fixed;
    bottom: 30%;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 100;
  }

  .prompt-text {
    background: rgba(0, 0, 0, 0.7);
    color: #e0e0e0;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    border: 1px solid rgba(167, 139, 250, 0.4);
  }
</style>
```

**Step 2: Commit**

```bash
git add src/lib/features/museum/components/InteractionPrompt.svelte
git commit -m "feat(museum): add interaction prompt overlay"
```

---

### Task 17: Museum persistence service

**Files:**
- Create: `src/lib/features/museum/services/contracts/IMuseumPersister.ts`
- Create: `src/lib/features/museum/services/implementations/MuseumPersister.ts`

**Step 1: Create interface**

```typescript
// src/lib/features/museum/services/contracts/IMuseumPersister.ts
import type { MuseumExhibit } from "../../domain/museum-types";

export interface MuseumMetadata {
  name: string;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
}

export interface IMuseumPersister {
  loadMuseum(userId: string): Promise<{
    meta: MuseumMetadata;
    exhibits: Map<string, MuseumExhibit>;
  } | null>;

  saveExhibit(userId: string, slotId: string, sequenceId: string): Promise<void>;
  removeExhibit(userId: string, slotId: string): Promise<void>;
  updateMetadata(userId: string, meta: Partial<MuseumMetadata>): Promise<void>;
  createMuseum(userId: string, name: string): Promise<void>;
}
```

**Step 2: Create Firebase implementation**

```typescript
// src/lib/features/museum/services/implementations/MuseumPersister.ts
import {
  getDatabase,
  ref,
  get,
  set,
  remove,
  update,
  serverTimestamp,
} from "firebase/database";
import type { IMuseumPersister, MuseumMetadata } from "../contracts/IMuseumPersister";
import type { MuseumExhibit } from "../../domain/museum-types";

export class MuseumPersister implements IMuseumPersister {
  private get db() {
    return getDatabase();
  }

  async loadMuseum(userId: string) {
    const metaSnap = await get(ref(this.db, `museums/${userId}/meta`));
    if (!metaSnap.exists()) return null;

    const meta = metaSnap.val() as MuseumMetadata;

    const exhibitsSnap = await get(ref(this.db, `museums/${userId}/exhibits`));
    const exhibits = new Map<string, MuseumExhibit>();

    if (exhibitsSnap.exists()) {
      const data = exhibitsSnap.val() as Record<string, MuseumExhibit>;
      for (const [slotId, exhibit] of Object.entries(data)) {
        exhibits.set(slotId, { ...exhibit, slotId });
      }
    }

    return { meta, exhibits };
  }

  async saveExhibit(userId: string, slotId: string, sequenceId: string) {
    const exhibit: MuseumExhibit = {
      slotId,
      sequenceId,
      assignedAt: Date.now(),
    };
    await set(ref(this.db, `museums/${userId}/exhibits/${slotId}`), exhibit);
    await update(ref(this.db, `museums/${userId}/meta`), { updatedAt: Date.now() });
  }

  async removeExhibit(userId: string, slotId: string) {
    await remove(ref(this.db, `museums/${userId}/exhibits/${slotId}`));
    await update(ref(this.db, `museums/${userId}/meta`), { updatedAt: Date.now() });
  }

  async updateMetadata(userId: string, meta: Partial<MuseumMetadata>) {
    await update(ref(this.db, `museums/${userId}/meta`), meta);
  }

  async createMuseum(userId: string, name: string) {
    const meta: MuseumMetadata = {
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublic: true,
    };
    await set(ref(this.db, `museums/${userId}/meta`), meta);
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/features/museum/services/
git commit -m "feat(museum): add Firebase museum persistence service"
```

---

### Task 18: DI container for museum

**Files:**
- Create: `src/lib/shared/di/containers/museum-container.ts`
- Modify: `src/lib/shared/di/index.ts` — wire museum container

**Step 1: Create museum container**

```typescript
// src/lib/shared/di/containers/museum-container.ts
import { createContainer } from "iti";
import { MuseumPersister } from "$lib/features/museum/services/implementations/MuseumPersister";
import { InteractionDetector } from "$lib/features/museum/services/implementations/InteractionDetector";

export function createMuseumContainer() {
  return createContainer()
    .add({
      museumPersister: () => new MuseumPersister(),
      interactionDetector: () => new InteractionDetector(),
    });
}

export type MuseumContainer = ReturnType<typeof createMuseumContainer>;
```

**Step 2: Wire into composition root**

In `src/lib/shared/di/index.ts`:
1. Add import: `import { createMuseumContainer } from "./containers/museum-container";`
2. Add instantiation: `const museumContainer = typeof window !== 'undefined' ? createMuseumContainer() : null as any;`
3. Add to the container chain: `c = c.add(museumContainer.items);`

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/lib/shared/di/containers/museum-container.ts src/lib/shared/di/index.ts
git commit -m "feat(museum): register museum services in DI container"
```

---

### Task 19: Sequence browser overlay

**Files:**
- Create: `src/lib/features/museum/overlay/SequenceBrowserOverlay.svelte`

**Step 1: Create overlay**

Fullscreen overlay for browsing and selecting sequences. Opens when interacting with an empty slot. Shows a searchable grid of sequence thumbnails.

This component needs to:
1. Fetch sequences from the library (public + user)
2. Show a search bar + grid of thumbnails
3. On selection, call `museumState.assignExhibit()` and `museumPersister.saveExhibit()`
4. Release pointer lock on open, re-acquire on close

Reference existing patterns:
- `src/lib/features/browse/` for sequence browsing patterns
- `src/lib/features/gallery/multiplayer/components/SessionJoinDrawer.svelte` for overlay patterns

The implementation details depend on how the browse module fetches and displays sequences. Read the browse module's loader/filter pattern before implementing.

**Step 2: Commit**

```bash
git add src/lib/features/museum/overlay/
git commit -m "feat(museum): add sequence browser overlay for curation"
```

---

### Task 20: Wire interaction system into MuseumDestination

**Files:**
- Modify: `src/lib/features/museum/MuseumDestination.svelte` — add interaction handling
- Modify: `src/lib/features/museum/components/MuseumGrounds.svelte` — expose interaction state

**Step 1: Integration**

The MuseumDestination needs to:
1. Listen for `E` key press
2. Run `InteractionDetector` each frame to find the closest interactable slot
3. Show `InteractionPrompt` when a slot is targeted
4. Open `SequenceBrowserOverlay` on interaction
5. On mount, load museum data from Firebase via `MuseumPersister`
6. On exhibit assignment, persist to Firebase

This wires together all the pieces built in Tasks 15-19.

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/features/museum/
git commit -m "feat(museum): wire interaction system and curation flow"
```

---

## Phase 5: Visiting

### Task 21: Museum URL routing

**Files:**
- Modify: `src/lib/features/museum/MuseumDestination.svelte` — accept userId param for visiting

**Step 1: Add visiting support**

When the museum loads, check for a `userId` parameter:
- If no userId or userId === currentUser → load own museum (owner mode)
- If userId !== currentUser → load that user's museum (visitor mode, read-only)

URL scheme: `?destination=museum&userId=abc123`

The destination picker or a share button would generate this URL.

**Step 2: Read-only mode**

When visiting someone else's museum:
- `museumState.isOwner = false`
- Empty slot indicators are hidden
- Interaction prompt shows "Press E to view" instead of "assign"
- No edit/remove capabilities

**Step 3: Commit**

```bash
git add src/lib/features/museum/
git commit -m "feat(museum): add visiting mode for other users' museums"
```

---

## Post-Implementation Checklist

After all tasks are complete:

1. **TypeScript check:** `npm run check` — 0 errors
2. **Build:** `npm run build` — succeeds
3. **Tests:** `npx vitest run tests/unit/museum/` — all pass
4. **Manual test:** Load Museum destination, walk around pavilions, see empty slots, interact to assign
5. **Update destination registry:** Ensure museum is `enabled: true`
6. **Update museum tracker:** Record "web prototype" as parallel track to UE5 museum
