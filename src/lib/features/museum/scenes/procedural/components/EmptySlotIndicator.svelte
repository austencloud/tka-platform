<script lang="ts">
  import { T } from "@threlte/core";
  import { Color } from "three";
  import type { ExhibitSlot } from "../domain/museum-types";

  interface Props {
    slot: ExhibitSlot;
    isNearby: boolean;
  }

  let { slot, isNearby }: Props = $props();

  const inactiveColor = new Color(0x444444);
  const activeColor = new Color(0xa78bfa);
</script>

<T.Group
  position.x={slot.position.x}
  position.y={slot.position.y}
  position.z={slot.position.z}
  rotation.y={slot.rotationY}
>
  <!-- Horizontal bar of + -->
  <T.Mesh>
    <T.BoxGeometry args={[0.4, 0.06, 0.02]} />
    <T.MeshStandardMaterial
      color={isNearby ? activeColor : inactiveColor}
      emissive={isNearby ? activeColor : inactiveColor}
      emissiveIntensity={isNearby ? 0.5 : 0.1}
    />
  </T.Mesh>

  <!-- Vertical bar of + -->
  <T.Mesh>
    <T.BoxGeometry args={[0.06, 0.4, 0.02]} />
    <T.MeshStandardMaterial
      color={isNearby ? activeColor : inactiveColor}
      emissive={isNearby ? activeColor : inactiveColor}
      emissiveIntensity={isNearby ? 0.5 : 0.1}
    />
  </T.Mesh>
</T.Group>
