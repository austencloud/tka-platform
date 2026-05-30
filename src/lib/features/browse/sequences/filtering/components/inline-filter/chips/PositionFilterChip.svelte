<!--
PositionFilterChip.svelte - Opens the PositionOptionsSheet drawer.
Displays when position filters are active.
-->
<script lang="ts">
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    hasActivePositions: boolean;
    onOpenSheet: () => void;
  }

  let { hasActivePositions, onOpenSheet }: Props = $props();

  const label = $derived(hasActivePositions ? t('browse_chip_positions') : t('browse_chip_position'));
</script>

<FilterChipBase
  {label}
  icon="fas fa-crosshairs"
  active={hasActivePositions}
  chipColor="#06b6d4"
  mode="dropdown"
  onclick={onOpenSheet}
/>
