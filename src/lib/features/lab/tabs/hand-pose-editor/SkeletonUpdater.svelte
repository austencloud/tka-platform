<!--
  SkeletonUpdater.svelte — Runs inside Threlte Canvas context.
  Updates skeleton matrices every frame so bone changes are visible immediately.
-->
<script lang="ts">
  import { useTask } from "@threlte/core";
  import type { SkinnedMesh } from "three";

  interface Props {
    meshes: SkinnedMesh[];
  }

  let { meshes }: Props = $props();

  // useTask runs every Threlte frame — this ensures skeleton matrices
  // are recomputed and the renderer paints the new bone positions
  useTask(() => {
    for (const mesh of meshes) {
      if (mesh.skeleton) {
        mesh.skeleton.update();
      }
    }
  });
</script>
