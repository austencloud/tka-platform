<!--
PositionFilterChip.svelte - Opens the PositionOptionsSheet drawer.
Displays when position filters are active.
-->
<script lang="ts">
  import FilterChipBase from "../FilterChipBase.svelte";

  interface Props {
    hasActivePositions: boolean;
    onOpenSheet: () => void;
  }

  let { hasActivePositions, onOpenSheet }: Props = $props();

  const label = $derived(hasActivePositions ? "Positions" : "Position");
</script>

<FilterChipBase
  {label}
  icon="fas fa-crosshairs"
  active={hasActivePositions}
  chipColor="#06b6d4"
  mode="dropdown"
  onclick={onOpenSheet}
/>
