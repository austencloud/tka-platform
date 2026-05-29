<!--
  DurationRhythmSheet.svelte - Drawer-based rhythm preset picker for generator toolbar

  Allows users to select a duration template before generating.
  Follows the StartEndSheet.svelte pattern: right drawer on desktop, bottom sheet on mobile.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { portal } from "./portal";
  import SheetDragHandle from "$lib/shared/foundation/ui/SheetDragHandle.svelte";
  import PatternItemCard from "$lib/features/create/shared/components/sequence-actions/PatternItemCard.svelte";
  import {
    getTemplatesByCategory,
    getCategoryInfo,
    type DurationCategory,
    type DurationTemplateDefinition,
  } from "$lib/features/create/shared/domain/templates/duration-templates";
  import { layoutState } from "$lib/shared/layout/layout-state.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

  let {
    isOpen,
    selectedTemplateId,
    stepCount,
    onSelect,
    onClose,
  }: {
    isOpen: boolean;
    selectedTemplateId: string | null;
    stepCount: number;
    onSelect: (templateId: string | null) => void;
    onClose: () => void;
  } = $props();

  let haptic: HapticFeedback | null = null;

  onMount(() => {
    try {
      haptic = getHapticFeedback();
    } catch {
      // Optional service
    }
  });

  const isMobile = $derived(!layoutState.isSideBySideLayout);

  const CATEGORIES: Array<DurationCategory | "all"> = ["all", "accent", "meter", "feel", "world"];
  let categoryFilter = $state<DurationCategory | "all">("accent");

  // Reset to "accent" on mobile, "all" on desktop when sheet opens
  $effect(() => {
    if (isOpen) {
      categoryFilter = isMobile ? "accent" : "all";
    }
  });

  let filteredTemplates = $derived(
    getTemplatesByCategory(stepCount, categoryFilter)
  );

  // Group templates by category for "all" mode
  let groupedTemplates = $derived.by(() => {
    if (categoryFilter !== "all") return null;
    const groups = new Map<DurationCategory, DurationTemplateDefinition[]>();
    for (const t of filteredTemplates) {
      const existing = groups.get(t.category) ?? [];
      existing.push(t);
      groups.set(t.category, existing);
    }
    return groups;
  });

  function handleTemplateSelect(templateId: string) {
    haptic?.trigger("selection");
    if (templateId === selectedTemplateId) {
      // Deselect
      onSelect(null);
    } else {
      onSelect(templateId);
    }
  }

  function handleClearSelection() {
    haptic?.trigger("selection");
    onSelect(null);
  }
</script>

<!-- Portal to document.body to escape container-type:size containment -->
<div use:portal>
  <Drawer
    isOpen={isOpen}
    placement="right"
    respectLayoutMode={true}
    showHandle={true}
    ariaLabel="Duration rhythm presets"
    onclose={onClose}
  >
    <div class="rhythm-sheet">
      <!-- Header -->
      <div class="sheet-header">
        <SheetDragHandle />
        <div class="sheet-title-row">
          <h2 class="sheet-title">Rhythm</h2>
          <button class="close-btn" onclick={onClose} aria-label="Close rhythm picker">
            <i class="fas fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <!-- Category filter -->
      <div class="category-filter" role="tablist" aria-label="Rhythm categories">
        {#each CATEGORIES as cat}
          {@const info = cat === "all" ? { label: "All", color: "#94a3b8" } : getCategoryInfo(cat)}
          <button
            class="category-chip"
            class:active={categoryFilter === cat}
            style:--cat-color={info.color}
            onclick={() => { categoryFilter = cat; }}
            role="tab"
            aria-selected={categoryFilter === cat}
          >
            {info.label}
          </button>
        {/each}
      </div>

      <!-- Template list -->
      <div class="template-list themed-scrollbar">
        <!-- "None" card at top -->
        <PatternItemCard
          name="None"
          description="No rhythm applied"
          selected={selectedTemplateId === null}
          glassColor="#94a3b8"
          isTemplate
          onclick={handleClearSelection}
        />

        {#if categoryFilter === "all" && groupedTemplates}
          <!-- Grouped display -->
          {#each [...groupedTemplates.entries()] as [category, templates]}
            {@const catInfo = getCategoryInfo(category)}
            <div class="category-group">
              <h3 class="category-group-title" style:color={catInfo.color}>{catInfo.label}</h3>
              <div class="template-grid">
                {#each templates as template (template.id)}
                  <PatternItemCard
                    name={template.name}
                    description={template.description}
                    selected={selectedTemplateId === template.id}
                    glassColor={catInfo.color}
                    isTemplate
                    onclick={() => handleTemplateSelect(template.id)}
                  />
                {/each}
              </div>
            </div>
          {/each}
        {:else}
          <!-- Flat grid for single category -->
          <div class="template-grid">
            {#each filteredTemplates as template (template.id)}
              {@const catInfo = getCategoryInfo(template.category)}
              <PatternItemCard
                name={template.name}
                description={template.description}
                selected={selectedTemplateId === template.id}
                glassColor={catInfo.color}
                isTemplate
                onclick={() => handleTemplateSelect(template.id)}
              />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </Drawer>
</div>

<style>
  .rhythm-sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    /* Override dialog user-agent color (CanvasText/black) for portaled content */
    color: var(--theme-text, #ffffff);
  }

  .sheet-header {
    flex-shrink: 0;
    padding: 8px 16px 0;
  }

  .sheet-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0 8px;
  }

  .sheet-title {
    font-size: var(--font-size-lg, 1.125rem);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    margin: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    font-size: 1.1rem;
    transition: background 150ms ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
  }

  /* Category filter */
  .category-filter {
    display: flex;
    gap: 6px;
    padding: 8px 16px;
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .category-filter::-webkit-scrollbar {
    display: none;
  }

  .category-chip {
    flex-shrink: 0;
    padding: 10px 16px;
    min-height: 44px;
    border-radius: 22px;
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .category-chip.active {
    background: color-mix(in srgb, var(--cat-color) 25%, transparent);
    border-color: color-mix(in srgb, var(--cat-color) 60%, transparent);
    color: var(--theme-text, #ffffff);
    box-shadow: 0 0 8px color-mix(in srgb, var(--cat-color) 20%, transparent);
  }

  .category-chip:hover:not(.active) {
    border-color: rgba(255, 255, 255, 0.2);
    color: var(--theme-text, #ffffff);
  }

  .category-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
  }

  /* Template list */
  .template-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px calc(24px + env(safe-area-inset-bottom, 0px));
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  /* Category group headers for "all" view */
  .category-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .category-group-title {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 8px 0 0;
    opacity: 0.8;
  }

  /* Fullscreen on mobile - browsing interface needs space */
  @media (max-width: 768px) {
    :global(.drawer-content:has(.rhythm-sheet)) {
      height: 100vh !important;
      height: 100dvh !important;
      max-height: none !important;
      border-radius: 0 !important;
    }
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .category-chip,
    .close-btn {
      transition: none;
    }
  }
</style>
