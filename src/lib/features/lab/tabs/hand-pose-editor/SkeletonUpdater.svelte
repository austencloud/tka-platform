<!--
  SkeletonUpdater.svelte — Runs inside Threlte Canvas context.
  Updates skeleton matrices every frame so bone changes are visible immediately.
  Optionally applies a clipping plane to isolate the hand.
-->
<script lang="ts">
  import { useTask, useThrelte } from "@threlte/core";
  import { Plane, Vector3 } from "three";
  import type { SkinnedMesh, Material } from "three";

  interface Props {
    meshes: SkinnedMesh[];
    clipEnabled?: boolean;
    clipNormal?: [number, number, number];
    clipConstant?: number;
  }

  let {
    meshes,
    clipEnabled = false,
    clipNormal = [1, 0, 0],
    clipConstant = 0,
  }: Props = $props();

  const { renderer } = useThrelte();

  const clipPlane = new Plane();
  const clipPlanes = [clipPlane];
  const noClip: never[] = [];

  let prevClipEnabled: boolean | null = null;
  let prevNX: number | null = null;
  let prevNY: number | null = null;
  let prevNZ: number | null = null;
  let prevC: number | null = null;

  useTask(() => {
    for (const mesh of meshes) {
      if (mesh.skeleton) {
        mesh.skeleton.update();
      }
    }

    const changed =
      clipEnabled !== prevClipEnabled ||
      clipNormal[0] !== prevNX ||
      clipNormal[1] !== prevNY ||
      clipNormal[2] !== prevNZ ||
      clipConstant !== prevC;

    if (changed) {
      renderer.current.localClippingEnabled = clipEnabled;
      clipPlane.normal.set(clipNormal[0], clipNormal[1], clipNormal[2]);
      clipPlane.constant = clipConstant;

      for (const mesh of meshes) {
        const mat = mesh.material as Material;
        mat.clippingPlanes = clipEnabled ? clipPlanes : noClip;
        mat.needsUpdate = true;
      }

      prevClipEnabled = clipEnabled;
      prevNX = clipNormal[0];
      prevNY = clipNormal[1];
      prevNZ = clipNormal[2];
      prevC = clipConstant;
    }
  });
</script>
