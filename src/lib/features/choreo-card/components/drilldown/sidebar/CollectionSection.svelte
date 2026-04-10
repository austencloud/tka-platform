<script lang="ts">
  import type { DrillPath } from '../../../state/deck-drilldown-types';
  import DrillPill from '../DrillPill.svelte';
  import SidebarFilterSection from './SidebarFilterSection.svelte';

  interface Props {
    selectedPath: DrillPath | null;
    accentColor: string;
    onSelectPath: (path: DrillPath) => void;
  }

  let { selectedPath, accentColor, onSelectPath }: Props = $props();

  const paths: DrillPath[] = ['LOOPs', 'VTG'];
</script>

<SidebarFilterSection
  label="Collection"
  state="active"
  {accentColor}
>
  <div class="pill-row">
    {#each paths as path}
      <DrillPill
        label={path}
        selected={selectedPath === path}
        onClick={() => onSelectPath(path)}
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
