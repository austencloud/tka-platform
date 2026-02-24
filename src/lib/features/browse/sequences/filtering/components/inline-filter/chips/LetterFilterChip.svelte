<!--
LetterFilterChip.svelte - Opens the LetterSelectionSheet drawer.
Displays the active letter when filtering.
-->
<script lang="ts">
  import FilterChipBase from "../FilterChipBase.svelte";

  interface Props {
    activeLetter: string | null;
    onOpenSheet: () => void;
  }

  let { activeLetter, onOpenSheet }: Props = $props();

  const label = $derived(activeLetter ? `Letter ${activeLetter}` : "Letter");
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
