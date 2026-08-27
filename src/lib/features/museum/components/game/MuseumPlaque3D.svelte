<script module lang="ts">
  import { BoxGeometry, CanvasTexture, MeshStandardMaterial } from "three";

  // Keyed by size string; only 3 possible sizes so at most 3 entries.
  const geoCache = new Map<string, { plaqueGeo: BoxGeometry; frameGeo: BoxGeometry }>();

  // Keyed by isWhiteboard boolean; only 2 possible values.
  const frameMatCache = new Map<boolean, MeshStandardMaterial>();

  const FRAME_PAD = 0.05;
  const FRAME_DEPTH = 0.04;

  const PLAQUE_DIMS_MODULE: Record<string, { w: number; h: number; d: number }> = {
    standard: { w: 0.9, h: 1.2, d: 0.05 },
    large: { w: 1.4, h: 1.2, d: 0.05 },
    "dev-whiteboard": { w: 2.5, h: 2.0, d: 0.04 },
  };

  function getOrCreateGeos(size: string): { plaqueGeo: BoxGeometry; frameGeo: BoxGeometry } {
    let entry = geoCache.get(size);
    if (!entry) {
      const dims = PLAQUE_DIMS_MODULE[size] ?? PLAQUE_DIMS_MODULE.standard!;
      entry = {
        plaqueGeo: new BoxGeometry(dims.w, dims.h, dims.d),
        frameGeo: new BoxGeometry(dims.w + FRAME_PAD * 2, dims.h + FRAME_PAD * 2, FRAME_DEPTH),
      };
      geoCache.set(size, entry);
    }
    return entry;
  }

  function getOrCreateFrameMat(isWhiteboard: boolean): MeshStandardMaterial {
    let mat = frameMatCache.get(isWhiteboard);
    if (!mat) {
      mat = new MeshStandardMaterial({
        color: isWhiteboard ? "#ccccbb" : "#8a7040",
        metalness: isWhiteboard ? 0.1 : 0.6,
        roughness: isWhiteboard ? 0.6 : 0.4,
      });
      frameMatCache.set(isWhiteboard, mat);
    }
    return mat;
  }
</script>

<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import type { PlaqueContent, PlaqueSize } from "../../services/types";

  interface Props {
    worldX: number;
    worldZ: number;
    yaw: number;
    wallOffsetX: number;
    wallOffsetZ: number;
    content: PlaqueContent;
    size: PlaqueSize;
    refId: string;
    generator: (content: PlaqueContent, size: PlaqueSize, cacheKey?: string) => OffscreenCanvas;
  }

  const props: Props = $props();

  // Resolve from props (plain consts - initial values for Three.js objects, not reactive)
  const worldX = props.worldX;
  const worldZ = props.worldZ;
  const yaw = props.yaw;
  const wallOffsetX = props.wallOffsetX;
  const wallOffsetZ = props.wallOffsetZ;
  const content = props.content;
  const size = props.size;
  const refId = props.refId;
  const generator = props.generator;

  // ── Size dimensions (world units) ──
  const PLAQUE_DIMS: Record<PlaqueSize, { w: number; h: number; d: number }> = {
    standard: { w: 0.9, h: 1.2, d: 0.05 },
    large: { w: 1.4, h: 1.2, d: 0.05 },
    "dev-whiteboard": { w: 2.5, h: 2.0, d: 0.04 },
  };

  const PLAQUE_Y = 1.2; // eye level

  const { plaqueGeo, frameGeo } = getOrCreateGeos(size);
  const isWhiteboard = size === "dev-whiteboard";
  const frameMat = getOrCreateFrameMat(isWhiteboard);

  // ── Generate texture from content (per-instance - unique canvas per plaque) ──
  const canvas = generator(content, size, refId);
  const texture = new CanvasTexture(canvas as unknown as HTMLCanvasElement);
  texture.needsUpdate = true;

  // ── Per-instance material - cannot be shared because it owns a unique texture ──
  const plaqueMat = new MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    metalness: 0.0,
    emissive: isWhiteboard ? "#807a6a" : "#c8a860",
    emissiveIntensity: isWhiteboard ? 0.22 : 0.25,
    emissiveMap: texture,
  });

  // The wallOffset from parent positions the plaque center on the tile.
  // Add an extra nudge so the plaque back face touches the wall surface.
  const dims = PLAQUE_DIMS[size];
  const wallNudge = dims.d / 2 + 0.01; // half plaque depth + tiny gap
  const nudgeX = wallOffsetX !== 0 ? Math.sign(wallOffsetX) * wallNudge : 0;
  const nudgeZ = wallOffsetZ !== 0 ? Math.sign(wallOffsetZ) * wallNudge : 0;

  // Frame sits directly behind the plaque face. Since the group is rotated
  // by yaw, "behind" in local space is simply -Z.
  const frameBehindDist = dims.d / 2 + FRAME_DEPTH / 2;

  onDestroy(() => {
    // Only dispose per-instance resources.
    // plaqueGeo, frameGeo, and frameMat are shared via module cache - do NOT dispose them here.
    plaqueMat.dispose();
    texture.dispose();
  });
</script>

<!-- Root group positioned at the plaque's world location - gizmo attaches here -->
<T.Group
  name={`plaque-${refId}`}
  position.x={worldX + wallOffsetX + nudgeX}
  position.y={PLAQUE_Y}
  position.z={worldZ + wallOffsetZ + nudgeZ}
  rotation.y={yaw}
>
  <!-- Plaque face - local (0,0,0) within the group -->
  <T.Mesh
    geometry={plaqueGeo}
    material={plaqueMat}
  />

  <!-- Frame behind the plaque - local -Z offset -->
  <T.Mesh
    geometry={frameGeo}
    material={frameMat}
    position.z={-frameBehindDist}
  />
</T.Group>
