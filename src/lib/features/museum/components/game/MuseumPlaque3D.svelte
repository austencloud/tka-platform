<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { CanvasTexture, BoxGeometry, MeshStandardMaterial } from "three";
  import type { PlaqueContent, PlaqueSize } from "../../services/contracts/IPlaqueTextureGenerator";
  import type { PlaqueTextureGenerator } from "../../services/implementations/PlaqueTextureGenerator";

  interface Props {
    worldX: number;
    worldZ: number;
    yaw: number;
    wallOffsetX: number;
    wallOffsetZ: number;
    content: PlaqueContent;
    size: PlaqueSize;
    refId: string;
    generator: PlaqueTextureGenerator;
  }

  let {
    worldX, worldZ, yaw, wallOffsetX, wallOffsetZ,
    content, size, refId, generator,
  }: Props = $props();

  // ── Size dimensions (world units) ──
  const PLAQUE_DIMS: Record<PlaqueSize, { w: number; h: number; d: number }> = {
    standard: { w: 0.9, h: 1.2, d: 0.05 },
    large: { w: 1.4, h: 1.2, d: 0.05 },
    "dev-whiteboard": { w: 2.5, h: 2.0, d: 0.04 },
  };

  // Frame is slightly larger than the plaque in every dimension
  const FRAME_PAD = 0.05;
  const FRAME_DEPTH = 0.04;
  const PLAQUE_Y = 1.2; // eye level

  // ── Generate texture from content ──
  const canvas = generator.generateCanvas(content, size, refId);
  const texture = new CanvasTexture(canvas as unknown as HTMLCanvasElement);
  texture.needsUpdate = true;

  // ── Geometries ──
  const dims = PLAQUE_DIMS[size];
  const plaqueGeo = new BoxGeometry(dims.w, dims.h, dims.d);
  const frameGeo = new BoxGeometry(
    dims.w + FRAME_PAD * 2,
    dims.h + FRAME_PAD * 2,
    FRAME_DEPTH,
  );

  // ── Materials ──
  const isWhiteboard = size === "dev-whiteboard";

  const plaqueMat = new MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    metalness: 0.0,
    emissive: isWhiteboard ? "#e0e0d8" : "#c8a860",
    emissiveIntensity: isWhiteboard ? 0.4 : 0.25,
    emissiveMap: texture,
  });

  const frameMat = new MeshStandardMaterial({
    color: isWhiteboard ? "#ccccbb" : "#8a7040",
    metalness: isWhiteboard ? 0.1 : 0.6,
    roughness: isWhiteboard ? 0.6 : 0.4,
  });

  // ── Push plaque flush against wall ──
  // The wallOffset from parent positions the plaque center on the tile.
  // Add an extra nudge so the plaque back face touches the wall surface.
  const wallNudge = dims.d / 2 + 0.01; // half plaque depth + tiny gap
  const nudgeX = wallOffsetX !== 0 ? Math.sign(wallOffsetX) * wallNudge : 0;
  const nudgeZ = wallOffsetZ !== 0 ? Math.sign(wallOffsetZ) * wallNudge : 0;

  // Frame sits directly behind the plaque face. Since the group is rotated
  // by yaw, "behind" in local space is simply -Z.
  const frameBehindDist = dims.d / 2 + FRAME_DEPTH / 2;

  onDestroy(() => {
    plaqueGeo.dispose();
    frameGeo.dispose();
    plaqueMat.dispose();
    frameMat.dispose();
    texture.dispose();
  });
</script>

<!-- Root group positioned at the plaque's world location — gizmo attaches here -->
<T.Group
  name={`plaque-${refId}`}
  position.x={worldX + wallOffsetX + nudgeX}
  position.y={PLAQUE_Y}
  position.z={worldZ + wallOffsetZ + nudgeZ}
  rotation.y={yaw}
>
  <!-- Plaque face — local (0,0,0) within the group -->
  <T.Mesh
    geometry={plaqueGeo}
    material={plaqueMat}
  />

  <!-- Frame behind the plaque — local -Z offset -->
  <T.Mesh
    geometry={frameGeo}
    material={frameMat}
    position.z={-frameBehindDist}
  />
</T.Group>
