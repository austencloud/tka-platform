<script lang="ts">
  /**
   * AvatarLabel3D Component
   *
   * Renders a 3D text label above an avatar.
   * Uses Threlte's Text component (troika-three-text) for crisp 3D text.
   */

  import { T } from "@threlte/core";
  import { Text } from "@threlte/extras";

  interface Props {
    /** Label text to display */
    label: string;
    /** X position (avatar's X position) */
    x: number;
    /** Z position (avatar's Z position) */
    z: number;
    /** Whether this avatar is currently active/selected */
    isActive?: boolean;
  }

  let { label, x, z, isActive = false }: Props = $props();

  // Position label above the avatar's head (in meters: 1.7m avatar + 0.4m padding)
  const labelY = 2.1;

  // Colors based on active state
  const textColor = $derived(isActive ? "#60a5fa" : "#ffffff");
  const outlineColor = $derived(isActive ? "#1d4ed8" : "#000000");
</script>

<!-- Billboard group that always faces camera would be ideal, but Text handles it -->
<T.Group position={[x, labelY, z]}>
  <Text
    text={label}
    fontSize={0.15}
    color={textColor}
    anchorX="center"
    anchorY="middle"
    outlineWidth={0.012}
    {outlineColor}
  />
</T.Group>
