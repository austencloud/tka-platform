<script lang="ts">
  import { T } from "@threlte/core";
  import {
    CONTACT_GRID_POINTS,
    CONTACT_PALM_X_OFFSET,
    CONTACT_PALM_Z_OFFSET,
    type ContactHandPose,
  } from "../domain/contact-motion-profile";

  interface Props {
    hand: ContactHandPose;
  }

  let { hand }: Props = $props();
  const tint = $derived(hand.id === "blue-left" ? "#6ea5ff" : "#ff7887");
</script>

<T.Group
  position={[
    hand.position[0] +
      (hand.id === "blue-left"
        ? -CONTACT_PALM_X_OFFSET
        : CONTACT_PALM_X_OFFSET),
    0.018,
    hand.position[2] + CONTACT_PALM_Z_OFFSET,
  ]}
>
  {#each CONTACT_GRID_POINTS as point, index}
    <T.Mesh
      position={[point[0], 0, point[1]]}
      rotation.x={Math.PI / 2}
      scale={index === hand.activeGridIndex ? 1.45 : 1}
      renderOrder={6}
    >
      <T.TorusGeometry
        args={[0.027, index === hand.activeGridIndex ? 0.009 : 0.005, 10, 24]}
      />
      <T.MeshBasicMaterial
        color={index === hand.activeGridIndex ? tint : "#a6b3cb"}
        transparent
        opacity={index === hand.activeGridIndex ? 0.96 : 0.34}
        depthWrite={false}
        depthTest={false}
      />
    </T.Mesh>
  {/each}
</T.Group>
