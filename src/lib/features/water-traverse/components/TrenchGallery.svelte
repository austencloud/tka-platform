<script lang="ts">
  /**
   * The composed trench reef: 513 instances of 37 researched assets, spread
   * across the whole 98 m middle leg.
   *
   * This replaces the single baked ocean reef GLB the trench used to borrow.
   * That asset is composed for the ocean stage — a theatre arranged around a
   * proscenium and a hero camera — so dropping it here produced a 40 m island
   * in a 98 m room with bare sand either side of it.
   *
   * The composition is authored offline and baked, per
   * .claude/rules/blender-first-3d-scenes.md:
   *
   *   scripts/water-traverse-reef-layout.json   the art layer
   *   scripts/generate-traverse-reef.py         -> water-traverse-reef.json
   *   scripts/build-traverse-reef.py            -> trench-reef_raw.glb
   *   scripts/optimize-ocean-glb.mjs <in> <out> -> trench-reef.glb
   *
   * Placements carry ABSOLUTE route z, so this group sits at z = 0 and only
   * the seabed elevation is applied. Do not centre it on the trench.
   *
   * Design: docs/superpowers/specs/active/2026-08-09-trench-gallery-composition-design.md
   */
  import { T } from "@threlte/core";
  import { useDraco, useKtx2, useMeshopt } from "@threlte/extras";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import type { Group } from "three";
  import { R2_CDN } from "$lib/shared/3d/constants/r2-cdn";

  interface Props {
    /** Seabed elevation. Placement y is measured from it. */
    floorY: number;
    onProgress?: (fraction: number) => void;
    onReady?: (root: Group) => void;
  }

  const { floorY, onProgress, onReady }: Props = $props();

  // Same large-asset split as the ocean flora scene: anything over Cloudflare
  // Pages' 25 MiB per-file limit is stripped from the deploy by
  // trim-deploy-assets.js and has to come from R2 in production. Dev serves it
  // out of static/ so iterating on the composition costs no round trip.
  const GLB_URL = import.meta.env.DEV
    ? "/models/water-traverse/trench-reef.glb"
    : `${R2_CDN}/models/water-traverse/trench-reef.glb`;

  let root = $state.raw<Group | null>(null);

  const loader = new GLTFLoader();
  loader.setDRACOLoader(useDraco("/draco/"));
  loader.setMeshoptDecoder(useMeshopt());
  loader.setKTX2Loader(useKtx2("/basis/"));

  loader.load(
    GLB_URL,
    (gltf) => {
      root = gltf.scene as Group;
      onProgress?.(1);
      onReady?.(root);
    },
    (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    },
    (error) => {
      console.error("[TrenchGallery] failed to load", GLB_URL, error);
      // Report ready anyway: the walk must not sit on a loading gate forever
      // because its scenery is missing. A trench with no reef is a worse scene,
      // not a broken one.
      onProgress?.(1);
    }
  );
</script>

{#if root}
  <T.Group position={[0, floorY, 0]}>
    <T is={root} />
  </T.Group>
{/if}
