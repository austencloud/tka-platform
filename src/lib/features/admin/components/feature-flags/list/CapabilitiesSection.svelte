<script lang="ts">
  import type { FeatureFlagConfig } from "$lib/shared/auth/domain/models/FeatureFlag";
  import CapabilityChip from "./CapabilityChip.svelte";

  interface Props {
    capabilities: FeatureFlagConfig[];
    selectedFlagId: string | null;
    onSelectFlag: (flag: FeatureFlagConfig) => void;
  }

  let { capabilities, selectedFlagId, onSelectFlag }: Props = $props();
</script>

{#if capabilities.length > 0}
  <div class="capabilities-card">
    <div class="section-header">
      <i class="fas fa-magic" aria-hidden="true"></i>
      <span>Capabilities</span>
    </div>
    <div class="capabilities-grid">
      {#each capabilities as capability}
        <CapabilityChip
          {capability}
          selected={selectedFlagId === capability.id}
          onSelect={() => onSelectFlag(capability)}
        />
      {/each}
    </div>
  </div>
{/if}

<style>
  .capabilities-card {
    grid-column: 1 / -1;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-header i {
    font-size: var(--font-size-sm, 14px);
    color: #f59e0b;
  }

  .capabilities-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
