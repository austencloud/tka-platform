<!--
LetterFilterChip.svelte - Opens the LetterSelectionSheet drawer.
Displays the active letter when filtering.
-->
<script lang="ts">
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    activeLetter: string | null;
    onOpenSheet: () => void;
  }

  let { activeLetter, onOpenSheet }: Props = $props();

  const label = $derived(activeLetter ? t('browse_filter_letter', { letter: activeLetter }) : t('browse_chip_letter'));
  const isActive = $derived(activeLetter !== null);
</script>

<FilterChipBase
  {label}
  icon="fas fa-font"
  active={isActive}
  chipColor="#10b981"
  mode="dropdown"
  onclick={onOpenSheet}
/>
