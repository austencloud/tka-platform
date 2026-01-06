<!--
  LibraryViewPresets.svelte

  Quick filter presets for the Library module as compact chips.
  Allows one-tap switching between common view configurations.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import type {
    LibrarySortField,
    LibrarySortDirection,
  } from "../state/library-state.svelte";

  export type LibraryPreset = "all" | "favorites" | "recent" | "popular" | "forked";

  interface PresetConfig {
    id: LibraryPreset;
    label: string;
    icon: string;
    sortBy?: LibrarySortField;
    sortDirection?: LibrarySortDirection;
    source?: "created" | "forked" | "all";
    favoritesOnly?: boolean;
  }

  interface Props {
    currentPreset: LibraryPreset;
    onPresetChange: (preset: LibraryPreset, config: PresetConfig) => void;
    hasForkedSequences?: boolean;
  }

  let {
    currentPreset = "all",
    onPresetChange,
    hasForkedSequences = false,
  }: Props = $props();

  // Services
  let hapticService: IHapticFeedback | null = $state(null);

  onMount(async () => {
    hapticService = await resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Preset definitions - removed "My Creations" as Library IS your creations
  const presets: PresetConfig[] = [
    {
      id: "all",
      label: "All",
      icon: "fa-layer-group",
      sortBy: "updatedAt",
      sortDirection: "desc",
      source: "all",
    },
    {
      id: "favorites",
      label: "Favorites",
      icon: "fa-heart",
      favoritesOnly: true,
    },
    {
      id: "recent",
      label: "Recent",
      icon: "fa-clock",
      sortBy: "createdAt",
      sortDirection: "desc",
    },
    {
      id: "popular",
      label: "Popular",
      icon: "fa-fire",
      sortBy: "viewCount",
      sortDirection: "desc",
    },
    {
      id: "forked",
      label: "Forked",
      icon: "fa-code-branch",
      source: "forked",
    },
  ];

  // Filter presets based on what's relevant
  const visiblePresets = $derived(
    presets.filter((p) => {
      // Hide "Forked" if no forked sequences
      if (p.id === "forked" && !hasForkedSequences) return false;
      return true;
    })
  );

  function handlePresetClick(preset: PresetConfig) {
    hapticService?.trigger("selection");
    onPresetChange(preset.id, preset);
  }
</script>

<div class="view-presets">
  {#each visiblePresets as preset (preset.id)}
    <button
      class="preset-chip"
      class:active={currentPreset === preset.id}
      onclick={() => handlePresetClick(preset)}
      aria-pressed={currentPreset === preset.id}
    >
      <i class="fas {preset.icon}" aria-hidden="true"></i>
      <span>{preset.label}</span>
    </button>
  {/each}
</div>

<style>
  .view-presets {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 6px);
    padding: var(--spacing-sm) var(--spacing-md);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .view-presets::-webkit-scrollbar {
    display: none;
  }

  .preset-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--spacing-xs, 6px) var(--spacing-sm, 10px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: var(--min-touch-target);
  }

  .preset-chip:hover {
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    color: var(--theme-text);
  }

  .preset-chip.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    color: var(--theme-accent);
  }

  .preset-chip:active {
    transform: scale(0.96);
  }

  .preset-chip i {
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .preset-chip.active i {
    opacity: 1;
  }

  /* Special icon colors */
  .preset-chip.active i.fa-heart {
    color: #ef4444;
  }

  .preset-chip.active i.fa-fire {
    color: #f97316;
  }

  /* Mobile: smaller chips */
  @media (max-width: 480px) {
    .preset-chip {
      padding: var(--spacing-xs, 6px) var(--spacing-sm, 8px);
      font-size: var(--font-size-compact, 12px);
    }

    .preset-chip span {
      display: none;
    }

    .preset-chip i {
      font-size: 0.9rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .preset-chip {
      transition: none;
    }
  }
</style>
