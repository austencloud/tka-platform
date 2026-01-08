<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";

  let hapticService: IHapticFeedback;

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const { onQuickAccess = () => {} } = $props<{
    onQuickAccess?: (data: { type: string; value: string }) => void;
  }>();

  // Quick access filter options matching desktop app
  const quickFilters = [
    {
      label: "⭐ My Favorites",
      type: "favorites",
      value: "favorites",
      color: "#FFD700",
      description: "Your starred sequences",
    },
    {
      label: "🔥 Recently Added",
      type: "recent",
      value: "recent",
      color: "#FF6B6B",
      description: "Recently added sequences",
    },
    {
      label: "📊 All Sequences",
      type: "all_sequences",
      value: "all",
      color: "#4ECDC4",
      description: "Browse all sequences",
    },
  ];

  function handleQuickAccess(filter: { type: string; value: string }) {
    hapticService?.trigger("selection");
    onQuickAccess({
      type: filter.type,
      value: filter.value,
    });
  }

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });
</script>

<div class="quick-access-section">
  {#each quickFilters as filter}
    <button
      class="quick-button"
      style="--accent-color: {filter.color}"
      onclick={() => handleQuickAccess(filter)}
      title={filter.description}
      type="button"
    >
      {filter.label}
    </button>
  {/each}
</div>

<style>
  .quick-access-section {
    display: flex;
    gap: 12px;
  }

  .quick-button {
    min-height: 60px;
    min-width: 180px;
    max-width: 400px;

    background: color-mix(in srgb, var(--theme-text, white) 12%, transparent);
    border: 2px solid
      color-mix(in srgb, var(--theme-text, white) 40%, transparent);
    border-radius: 14px;
    color: var(--theme-text, white);
    font-weight: bold;
    font-size: var(--font-size-base);
    padding: 18px 32px;
    text-align: center;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-family: inherit;
  }

  .quick-button:hover {
    background: color-mix(in srgb, var(--theme-text, white) 15%, transparent);
    border: 2px solid
      color-mix(in srgb, var(--theme-text, white) 50%, transparent);
  }

  .quick-button:active {
    background: color-mix(in srgb, var(--theme-text, white) 20%, transparent);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .quick-access-section {
      gap: 8px;
    }

    .quick-button {
      min-width: 140px;
      padding: 12px 20px;
      font-size: var(--font-size-sm);
    }
  }

  @media (max-width: 480px) {
    .quick-button {
      min-width: 100px;
      padding: 8px 12px;
      font-size: var(--font-size-compact);
    }
  }
</style>
