<!--
  DurationLabModule.svelte - Visual duration template experimenter

  Left panel: browse and filter duration templates with mini bar previews.
  Right panel: live ChoreoCard showing a dummy sequence with
  the selected template applied.
-->
<script lang="ts">
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import {
    getTemplatesForStepCount,
    getTemplatesByCategory,
    getCategoryInfo,
    getAvailableCategories,
  } from "$lib/features/create/shared/domain/templates/duration-templates";
  import type {
    DurationTemplateDefinition,
    DurationCategory,
  } from "$lib/features/create/shared/domain/templates/duration-templates";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";

  // State
  let stepCount = $state(8);
  let selectedCategory = $state<DurationCategory | "all">("all");
  let selectedTemplateId = $state<string | null>(null);
  let rowCapacityOverride = $state<number | null>(null);

  const BEAT_OPTIONS = [4, 8, 12, 16] as const;
  const CATEGORIES: Array<DurationCategory | "all"> = ["all", "accent", "meter", "feel", "world"];

  // Derived: filtered templates
  const filteredTemplates = $derived(
    getTemplatesByCategory(stepCount, selectedCategory)
  );

  // Derived: selected template
  const selectedTemplate = $derived(
    selectedTemplateId
      ? filteredTemplates.find(t => t.id === selectedTemplateId) ?? null
      : null
  );

  // Build a dummy sequence with the selected template applied
  const dummySequence = $derived.by((): SequenceData | null => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    // Generate dummy steps with minimal but type-safe data
    const steps: StepData[] = [];
    for (let i = 0; i < stepCount; i++) {
      const letter = letters[i % letters.length]!;
      let duration = 1;

      if (selectedTemplate) {
        const entries = selectedTemplate.generator(stepCount);
        const entry = entries[i];
        if (entry) {
          duration = entry.duration;
        }
      }

      // Factory fills both hands with invisible placeholders (both-required
      // canonical Step shape) — the duration lab only reads letters/durations.
      steps.push(
        createStepData({
          id: `lab-step-${i}`,
          letter: letter as import("$lib/shared/foundation/domain/models/letter").Letter,
          stepNumber: i + 1,
          duration,
          isBlank: false,
        })
      );
    }

    return createSequenceData({
      id: `duration-lab-${stepCount}-${selectedTemplateId ?? "uniform"}`,
      word: selectedTemplate?.name ?? "UNIFORM",
      steps,
      level: 1,
    });
  });

  // Generate mini bar visualization for a template
  function getBarWidths(template: DurationTemplateDefinition): number[] {
    const entries = template.generator(stepCount);
    return entries.map(e => e.duration);
  }

  function selectTemplate(id: string) {
    selectedTemplateId = selectedTemplateId === id ? null : id;
  }
</script>

<div class="duration-lab">
  <!-- Left: Template Browser -->
  <div class="template-browser">
    <div class="browser-header">
      <h2 class="browser-title">Duration Templates</h2>
      <p class="browser-subtitle">{filteredTemplates.length} templates for {stepCount} beats</p>
    </div>

    <!-- Beat count selector -->
    <div class="control-row">
      <span class="control-label">Beats</span>
      <div class="chip-group">
        {#each BEAT_OPTIONS as count (count)}
          <button
            class="chip"
            class:active={stepCount === count}
            onclick={() => { stepCount = count; selectedTemplateId = null; }}
            type="button"
          >
            {count}
          </button>
        {/each}
      </div>
    </div>

    <!-- Category filter -->
    <div class="control-row">
      <span class="control-label">Category</span>
      <div class="chip-group">
        {#each CATEGORIES as cat (cat)}
          {@const info = cat === "all" ? { label: "All", color: "#94a3b8" } : getCategoryInfo(cat)}
          <button
            class="chip"
            class:active={selectedCategory === cat}
            style="--chip-color: {info.color};"
            onclick={() => { selectedCategory = cat; }}
            type="button"
          >
            {info.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Row capacity override -->
    <div class="control-row">
      <span class="control-label">Row capacity</span>
      <div class="chip-group">
        <button
          class="chip"
          class:active={rowCapacityOverride === null}
          onclick={() => { rowCapacityOverride = null; }}
          type="button"
        >
          Auto
        </button>
        {#each [3, 4, 5, 6, 8] as cap (cap)}
          <button
            class="chip"
            class:active={rowCapacityOverride === cap}
            onclick={() => { rowCapacityOverride = cap; }}
            type="button"
          >
            {cap}
          </button>
        {/each}
      </div>
    </div>

    <!-- Template list -->
    <div class="template-list themed-scrollbar">
      {#each filteredTemplates as template (template.id)}
        {@const catInfo = getCategoryInfo(template.category)}
        {@const isSelected = selectedTemplateId === template.id}
        <button
          class="template-card"
          class:selected={isSelected}
          onclick={() => selectTemplate(template.id)}
          type="button"
        >
          <div class="template-header">
            <span class="template-name">{template.name}</span>
            <span class="template-category-badge" style="background: {catInfo.color}20; color: {catInfo.color};">
              {catInfo.label}
            </span>
          </div>
          <p class="template-description">{template.description}</p>

          <!-- Mini duration bar visualization -->
          <div class="mini-bars">
            {#each getBarWidths(template) as width, i (i)}
              <div
                class="mini-bar"
                style="flex: {width}; background: {catInfo.color}{isSelected ? 'cc' : '66'};"
              ></div>
            {/each}
          </div>
        </button>
      {/each}

      {#if filteredTemplates.length === 0}
        <div class="empty-state">
          No templates match these filters
        </div>
      {/if}
    </div>
  </div>

  <!-- Right: Live Preview -->
  <div class="preview-panel">
    <div class="preview-header">
      <h2 class="preview-title">
        {selectedTemplate?.name ?? "Uniform (default)"}
      </h2>
      {#if selectedTemplate}
        <p class="preview-subtitle">{selectedTemplate.description}</p>
      {:else}
        <p class="preview-subtitle">Select a template to see duration-proportional layout</p>
      {/if}
    </div>

    <div class="preview-container">
      {#if dummySequence}
        {#key `${dummySequence.id}-${rowCapacityOverride}`}
          <ChoreoCard
            sequence={dummySequence}
            darkMode={true}
            showDifficultyLevel={false}
            showLoopGlyph={false}
            showCreatorName={false}
            showNotes={false}
            showBirthday={false}
            columnCount={rowCapacityOverride !== null ? rowCapacityOverride + 1 : null}
          />
        {/key}
      {/if}
    </div>

    <!-- Duration bar overlay -->
    {#if selectedTemplate}
      <div class="duration-overlay">
        <span class="overlay-label">Duration values:</span>
        <div class="duration-values">
          {#each getBarWidths(selectedTemplate) as d, i (i)}
            <span class="duration-value" class:accent={Math.abs(d - 1) > 0.05}>
              {d.toFixed(2)}
            </span>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .duration-lab {
    display: flex;
    height: 100%;
    gap: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Left panel */
  .template-browser {
    width: 340px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    overflow: hidden;
  }

  .browser-header {
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .browser-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .browser-subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 4px 0 0;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
  }

  .control-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    min-width: 52px;
    flex-shrink: 0;
  }

  .chip-group {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .chip {
    padding: 4px 10px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, #fff);
  }

  .chip.active {
    background: var(--chip-color, var(--theme-accent, #6366f1));
    border-color: var(--chip-color, var(--theme-accent, #6366f1));
    color: #fff;
  }

  .template-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .template-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    cursor: pointer;
    text-align: left;
    color: var(--theme-text, #fff);
    font: inherit;
    transition: border-color 0.15s ease;
    width: 100%;
  }

  .template-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .template-card.selected {
    border-color: var(--theme-accent, #6366f1);
    background: rgba(99, 102, 241, 0.08);
  }

  .template-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .template-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
  }

  .template-category-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    font-weight: 500;
    flex-shrink: 0;
  }

  .template-description {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  .mini-bars {
    display: flex;
    gap: 1px;
    height: 8px;
    border-radius: 2px;
    overflow: hidden;
    margin-top: 2px;
  }

  .mini-bar {
    border-radius: 1px;
    min-width: 2px;
  }

  .empty-state {
    padding: 32px 16px;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-min, 14px);
  }

  /* Right panel */
  .preview-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    min-width: 0;
  }

  .preview-header {
    padding: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .preview-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .preview-subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin: 4px 0 0;
  }

  .preview-container {
    flex: 1;
    min-height: 0;
    padding: 16px;
  }

  .duration-overlay {
    padding: 12px 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .overlay-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
  }

  .duration-values {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .duration-value {
    font-size: 11px;
    font-family: monospace;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .duration-value.accent {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  /* Mobile: stack vertically */
  @media (max-width: 768px) {
    .duration-lab {
      flex-direction: column;
    }

    .template-browser {
      width: 100%;
      max-height: 45%;
    }
  }
</style>
