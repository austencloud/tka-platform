<script lang="ts">
  import { T } from "@threlte/core";
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
    standard: { w: 0.4, h: 1.5, d: 0.08 },
    large: { w: 0.75, h: 1.5, d: 0.08 },
    "dev-whiteboard": { w: 1.5, h: 2.5, d: 0.06 },
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
  const plaqueMat = new MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    metalness: 0.0,
  });

  const isWhiteboard = size === "dev-whiteboard";
  const frameMat = new MeshStandardMaterial({
    color: isWhiteboard ? "#ccccbb" : "#8a7040",
    metalness: isWhiteboard ? 0.1 : 0.6,
    roughness: isWhiteboard ? 0.6 : 0.4,
  });

  // ── Compute frame offset (slightly behind plaque, toward wall) ──
  // Frame sits half the plaque depth + half the frame depth behind the plaque face
  const frameBehindDist = dims.d / 2 + FRAME_DEPTH / 2;
  const frameOffsetX = -Math.sin(yaw) * frameBehindDist;
  const frameOffsetZ = -Math.cos(yaw) * frameBehindDist;
</script>

<!-- Plaque face — textured mesh at eye level, shifted against wall -->
<T.Mesh
  geometry={plaqueGeo}
  material={plaqueMat}
  position.x={worldX + wallOffsetX}
  position.y={PLAQUE_Y}
  position.z={worldZ + wallOffsetZ}
  rotation.y={yaw}
/>

<!-- Frame behind the plaque -->
<T.Mesh
  geometry={frameGeo}
  material={frameMat}
  position.x={worldX + wallOffsetX + frameOffsetX}
  position.y={PLAQUE_Y}
  position.z={worldZ + wallOffsetZ + frameOffsetZ}
  rotation.y={yaw}
/>
