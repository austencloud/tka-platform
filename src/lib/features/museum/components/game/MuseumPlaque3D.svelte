<script module lang="ts">
  import { BoxGeometry, CanvasTexture, MeshStandardMaterial } from "three";
  import type { PlaqueStyle } from "../../services/types";

  // Keyed by size string; only 3 possible sizes so at most 3 entries.
  const geoCache = new Map<string, { plaqueGeo: BoxGeometry; frameGeo: BoxGeometry }>();

  /** The frame is the object the surface is mounted in; one material per family. */
  type FrameKind = PlaqueStyle | "whiteboard";
  const frameMatCache = new Map<FrameKind, MeshStandardMaterial>();

  const FRAME_PAD = 0.05;
  const FRAME_DEPTH = 0.04;

  const PLAQUE_DIMS_MODULE: Record<string, { w: number; h: number; d: number }> = {
    standard: { w: 0.9, h: 1.2, d: 0.05 },
    large: { w: 1.4, h: 1.2, d: 0.05 },
    "dev-whiteboard": { w: 2.5, h: 2.0, d: 0.04 },
  };

  const FRAME_LOOK: Record<FrameKind, { color: string; metalness: number; roughness: number }> = {
    plaque: { color: "#8a7040", metalness: 0.6, roughness: 0.4 },
    whiteboard: { color: "#ccccbb", metalness: 0.1, roughness: 0.6 },
    // A card in a black institutional holder.
    order: { color: "#3b3b3b", metalness: 0.2, roughness: 0.7 },
    // Plywood: K nailed it up.
    "k-sign": { color: "#8a6d45", metalness: 0.0, roughness: 0.95 },
    // Paper under glass in a dark archival frame.
    document: { color: "#2b2b2b", metalness: 0.15, roughness: 0.6 },
    // A terminal bezel.
    console: { color: "#1a1f1c", metalness: 0.35, roughness: 0.5 },
    // A shelf-edge tag holder.
    shelf: { color: "#d9d5c8", metalness: 0.05, roughness: 0.8 },
  };

  const EMISSIVE_LOOK: Record<FrameKind, { color: string; intensity: number }> = {
    plaque: { color: "#c8a860", intensity: 0.25 },
    whiteboard: { color: "#807a6a", intensity: 0.22 },
    order: { color: "#8a857a", intensity: 0.22 },
    "k-sign": { color: "#8a857a", intensity: 0.2 },
    document: { color: "#8a857a", intensity: 0.22 },
    console: { color: "#3dff7a", intensity: 0.35 },
    shelf: { color: "#8a857a", intensity: 0.22 },
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

  function getOrCreateFrameMat(kind: FrameKind): MeshStandardMaterial {
    let mat = frameMatCache.get(kind);
    if (!mat) {
      mat = new MeshStandardMaterial(FRAME_LOOK[kind]);
      frameMatCache.set(kind, mat);
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
  const frameKind: FrameKind =
    size === "dev-whiteboard" ? "whiteboard" : (content.style ?? "plaque");
  const frameMat = getOrCreateFrameMat(frameKind);
  const emissive = EMISSIVE_LOOK[frameKind];

  // ── Generate texture from content (per-instance - unique canvas per plaque) ──
  const canvas = generator(content, size, refId);
  const texture = new CanvasTexture(canvas as unknown as HTMLCanvasElement);
  texture.needsUpdate = true;

  // ── Per-instance material - cannot be shared because it owns a unique texture ──
  const plaqueMat = new MeshStandardMaterial({
    map: texture,
    roughness: frameKind === "console" ? 0.35 : 0.85,
    metalness: 0.0,
    emissive: emissive.color,
    emissiveIntensity: emissive.intensity,
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

  // K's sign hangs a little crooked. Deterministic per refId so it never jitters.
  const roll =
    frameKind === "k-sign"
      ? ((refId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 7) - 3) * 0.012
      : 0;

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
  rotation.z={roll}
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
