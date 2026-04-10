<script lang="ts">
  import DrillPill from '../DrillPill.svelte';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    availableCounts: number[];
    selectedCount: number | null;
    accentColor: string;
    onSelectCount: (count: number) => void;
  }

  let { availableCounts, selectedCount, accentColor, onSelectCount }: Props = $props();

  const sectionState = $derived(availableCounts.length > 0 ? 'active' as const : 'disabled' as const);
</script>

<SidebarFilterSection
  label="Steps"
  state={sectionState}
  {accentColor}
  disabledMessage="Select shape first..."
>
  <div class="pill-row">
    {#each availableCounts as count}
      <DrillPill
        label={String(count)}
        selected={selectedCount === count}
        onClick={() => onSelectCount(count)}
      />
    {/each}
  </div>
</SidebarFilterSection>

<style>
  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
</style>
