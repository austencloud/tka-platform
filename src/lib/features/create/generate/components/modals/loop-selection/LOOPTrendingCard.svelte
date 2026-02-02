<!--
LOOPTrendingCard.svelte - Card showing a trending LOOP type with usage stats

Displays:
- LOOP type name (formatted)
- Usage count
- Usage percentage
- Visual indicator (LOOPIconStrip)
-->
<script lang="ts">
  import type { LOOPPopularityData } from "../../../shared/domain/models/loop-selection-types";
  import type { LOOPType } from "../../../circular/domain/models/circular-models";
  import { loopTypeResolver } from "../../../shared/services/implementations/LOOPTypeResolver";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";

  interface Props {
    data: LOOPPopularityData;
    onSelect?: (data: LOOPPopularityData) => void;
  }

  let { data, onSelect }: Props = $props();

  // Parse components from loop type string (cast since Firebase stores as string)
  const components = $derived(loopTypeResolver.parseComponents(data.loopType as LOOPType));

  // Format the loop type for display
  const formattedName = $derived(loopTypeResolver.formatForDisplay(data.loopType as LOOPType));
</script>

<button class="trending-card" onclick={() => onSelect?.(data)}>
  <div class="card-left">
    <LOOPIconStrip activeComponents={components} size={20} darkMode={true} showFreeformWhenEmpty={false} />
  </div>

  <div class="card-center">
    <span class="card-name">{formattedName}</span>
    <span class="card-stats">
      {data.usageCount.toLocaleString()} sequences · {data.usagePercent}%
    </span>
  </div>

  <div class="card-right">
    <i class="fas fa-chevron-right"></i>
  </div>
</button>

<style>
  .trending-card {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    text-align: left;
  }

  .trending-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .trending-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .card-left {
    flex-shrink: 0;
  }

  .card-center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text, white);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-stats {
    font-size: var(--font-size-xs);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .card-right {
    flex-shrink: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-xs);
  }

  .trending-card:hover .card-right {
    color: var(--theme-text, white);
  }
</style>
