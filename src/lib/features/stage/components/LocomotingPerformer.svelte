<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import * as THREE from "three";
  import { LocomotionController } from "../locomotion/locomotion-controller";
  import type { InterpolatedPose } from "../state/formation-interpolator";

  interface Props {
    pose: InterpolatedPose;
    avatarPath: string;
    facing: number;
  }

  let { pose, avatarPath, facing }: Props = $props();

  const gltf = useGltf(avatarPath);
  let controller: LocomotionController | null = $state(null);
  let group = $state<THREE.Group | null>(null);

  $effect(() => {
    if (!$gltf) return;
    const scene = $gltf.scene.clone();
    const ctrl = new LocomotionController();
    ctrl.initialize(scene).then(() => {
      controller = ctrl;
    });
    return () => { ctrl.dispose(); };
  });

  useTask((delta) => {
    if (!controller) return;
    controller.setTarget(pose.x, pose.z, pose.facing);
    controller.update(delta, pose.speed);

    if (group) {
      group.position.set(pose.x, 0, pose.z);
      group.rotation.y = -pose.facing;
    }
  });
</script>

{#if $gltf}
  <T.Group bind:ref={group}>
    <T.Primitive object={$gltf.scene.clone()} />
  </T.Group>
{/if}
