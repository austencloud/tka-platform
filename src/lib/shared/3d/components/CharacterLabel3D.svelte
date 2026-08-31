<script lang="ts">
  import { T } from "@threlte/core";
  import { HTML } from "@threlte/extras";

  interface Props {
    label: string;
    x: number;
    z: number;
    isActive?: boolean;
  }

  let { label, x, z, isActive = false }: Props = $props();

  const labelY = 2.1;
</script>

<T.Group position={[x, labelY, z]}>
  <HTML center sprite>
    <span
      class="character-label-3d"
      class:active={isActive}
    >
      {label}
    </span>
  </HTML>
</T.Group>

<style>
  .character-label-3d {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    text-shadow:
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
  }
  .character-label-3d.active {
    color: #60a5fa;
    text-shadow:
      -1px -1px 0 #1d4ed8,
      1px -1px 0 #1d4ed8,
      -1px 1px 0 #1d4ed8,
      1px 1px 0 #1d4ed8;
  }
</style>
