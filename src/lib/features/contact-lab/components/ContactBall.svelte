<script lang="ts">
  import { T } from "@threlte/core";
  import {
    CONTACT_BALL_RADIUS,
    type ContactBallPose,
  } from "../domain/contact-motion-profile";

  interface Props {
    pose: ContactBallPose;
  }

  let { pose }: Props = $props();
  const color = $derived(pose.hand === "left" ? "#3f86ff" : "#ff4057");
</script>

<T.Group position={pose.position} rotation={pose.rotation}>
  <T.Mesh>
    <T.SphereGeometry args={[CONTACT_BALL_RADIUS, 48, 32]} />
    <T.MeshPhysicalMaterial
      {color}
      roughness={0.28}
      metalness={0.04}
      clearcoat={0.42}
      clearcoatRoughness={0.34}
    />
  </T.Mesh>
</T.Group>
