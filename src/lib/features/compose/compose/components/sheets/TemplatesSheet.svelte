<script lang="ts">
  /**
   * TemplatesSheet - Drawer displaying composition template presets
   *
   * Shows available templates with visual previews.
   * Templates provide pre-configured layouts and cell settings.
   */

  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import {
    getBasicTemplates,
    getAdvancedTemplates,
  } from "../../domain/templates";
  import type { CompositionTemplate } from "../../domain/types";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (templateId: string) => void;
  }

  let { isOpen = $bindable(), onClose, onSelectTemplate }: Props = $props();

  const basicTemplates = getBasicTemplates();
  const advancedTemplates = getAdvancedTemplates();

  let showAdvanced = $state(false);

  function handleSelectTemplate(template: CompositionTemplate) {
    onSelectTemplate(template.id);
    onClose();
  }
</script>

<Drawer bind:isOpen placement="bottom" ariaLabel="Choose a template">
  <div class="templates-sheet">
    <header class="sheet-header">
      <h2 class="sheet-title">Templates</h2>
      <p class="sheet-subtitle">Choose a preset or build from scratch</p>
    </header>

    <!-- Basic Templates -->
    <section class="templates-section">
      <h3 class="section-title">Quick Start</h3>
      <div class="templates-grid">
        {#each basicTemplates as template (template.id)}
          <button
            class="template-card"
            style:--template-color={template.color}
            onclick={() => handleSelectTemplate(template)}
          >
            <!-- Layout Preview -->
            <div class="template-preview">
              {#each Array(template.layout.rows) as _, row}
                <div class="preview-row">
                  {#each Array(template.layout.cols) as _, col}
                    {@const cellIndex = row * template.layout.cols + col}
                    {@const cellDefault = template.cellDefaults[cellIndex]}
                    <div
                      class="preview-cell"
                      class:tunnel={cellDefault?.type === "tunnel"}
                      class:mirrored={cellDefault?.isMirrored}
                    >
                      {#if cellDefault?.type === "tunnel"}
                        <span class="tunnel-indicator">
                          <i class="fas fa-layer-group" aria-hidden="true"></i>
                        </span>
                      {:else if cellDefault?.isMirrored}
                        <span class="mirror-indicator">
                          <i class="fas fa-clone" aria-hidden="true"></i>
                        </span>
                      {:else if cellDefault?.rotationOffset}
                        <span class="rotation-indicator">
                          {cellDefault.rotationOffset}°
                        </span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/each}
            </div>

            <div class="template-info">
              <span class="template-name">{template.name}</span>
              <span class="template-description">{template.description}</span>
            </div>
          </button>
        {/each}
      </div>
    </section>

    <!-- Advanced Templates (Expandable) -->
    {#if advancedTemplates.length > 0}
      <section class="templates-section advanced-section">
        <button
          class="section-toggle"
          onclick={() => (showAdvanced = !showAdvanced)}
          aria-expanded={showAdvanced}
          aria-controls="advanced-templates-grid"
        >
          <h3 class="section-title">Advanced</h3>
          <i
            class="fas fa-chevron-{showAdvanced ? 'up' : 'down'}"
            aria-hidden="true"
          ></i>
        </button>

        {#if showAdvanced}
          <div class="templates-grid" id="advanced-templates-grid">
            {#each advancedTemplates as template (template.id)}
              <button
                class="template-card"
                style:--template-color={template.color}
                onclick={() => handleSelectTemplate(template)}
              >
                <div class="template-preview">
                  {#each Array(template.layout.rows) as _, row}
                    <div class="preview-row">
                      {#each Array(template.layout.cols) as _, col}
                        {@const cellIndex = row * template.layout.cols + col}
                        {@const cellDefault = template.cellDefaults[cellIndex]}
                        <div
                          class="preview-cell"
                          class:tunnel={cellDefault?.type === "tunnel"}
                        >
                          {#if cellDefault?.type === "tunnel"}
                            <i class="fas fa-layer-group" aria-hidden="true"
                            ></i>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/each}
                </div>

                <div class="template-info">
                  <span class="template-name">{template.name}</span>
                  <span class="template-description"
                    >{template.description}</span
                  >
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    <!-- Custom Layout Hint -->
    <div class="custom-hint">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      <span>Use the layout picker in controls to build custom grids</span>
    </div>
  </div>
</Drawer>

<style>
  .templates-sheet {
    padding: clamp(12px, 3cqi, 20px);
    max-height: 70vh;
    overflow-y: auto;
    container-type: inline-size;
    container-name: templates;
  }

  .sheet-header {
    text-align: center;
    margin-bottom: clamp(16px, 4cqi, 28px);
  }

  .sheet-title {
    font-size: clamp(1.25rem, 4cqi, 1.5rem);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    margin: 0 0 clamp(3px, 1cqi, 6px) 0;
  }

  .sheet-subtitle {
    font-size: clamp(0.8rem, 2.5cqi, 0.95rem);
    color: var(--theme-text-dim);
    margin: 0;
  }

  /* Sections */
  .templates-section {
    margin-bottom: clamp(16px, 4cqi, 28px);
  }

  .section-title {
    font-size: clamp(0.85rem, 2.8cqi, 1rem);
    font-weight: 600;
    color: var(--theme-text-dim);
    margin: 0 0 clamp(6px, 1.5cqi, 12px) 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Section toggle - 48px minimum touch target */
  .section-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: clamp(10px, 2.5cqi, 14px) 0;
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    cursor: pointer;
  }

  .section-toggle:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .section-toggle .section-title {
    margin: 0;
  }

  /* Templates Grid */
  .templates-grid {
    display: grid;
    grid-template-columns: repeat(
      auto-fill,
      minmax(clamp(120px, 30cqi, 160px), 1fr)
    );
    gap: clamp(6px, 1.5cqi, 12px);
  }

  /* Template Card */
  .template-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 12px);
    padding: clamp(12px, 3cqi, 20px);
    background: var(--theme-card-bg);
    border: clamp(1px, 0.3cqi, 2px) solid var(--theme-stroke);
    border-radius: clamp(6px, 2cqi, 14px);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .template-card:hover {
    background: color-mix(in srgb, var(--template-color) 15%, transparent);
    border-color: var(--template-color);
    transform: translateY(clamp(-1px, -0.3cqi, -3px));
  }

  .template-card:active {
    transform: translateY(0);
  }

  /* Template Preview */
  .template-preview {
    display: flex;
    flex-direction: column;
    gap: clamp(2px, 0.6cqi, 4px);
    padding: clamp(6px, 1.5cqi, 10px);
    background: rgba(0, 0, 0, 0.3);
    border-radius: clamp(4px, 1cqi, 8px);
  }

  .preview-row {
    display: flex;
    gap: clamp(2px, 0.6cqi, 4px);
  }

  .preview-cell {
    width: clamp(20px, 6cqi, 36px);
    height: clamp(20px, 6cqi, 36px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--template-color, rgba(255, 255, 255, 0.2));
    border-radius: clamp(2px, 0.6cqi, 5px);
    font-size: clamp(0.5rem, 1.5cqi, 0.7rem);
    color: rgba(255, 255, 255, 0.8);
  }

  .preview-cell.tunnel {
    background: linear-gradient(
      135deg,
      var(--template-color) 0%,
      rgba(255, 255, 255, 0.3) 50%,
      var(--template-color) 100%
    );
  }

  .preview-cell.mirrored {
    opacity: 0.6;
  }

  .tunnel-indicator,
  .mirror-indicator,
  .rotation-indicator {
    font-size: clamp(0.45rem, 1.4cqi, 0.6rem);
    opacity: 0.9;
  }

  /* Template Info */
  .template-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(1px, 0.4cqi, 3px);
    text-align: center;
  }

  .template-name {
    font-size: clamp(0.8rem, 2.5cqi, 0.95rem);
    font-weight: 600;
    color: var(--theme-text);
  }

  .template-description {
    font-size: clamp(0.65rem, 2cqi, 0.75rem);
    color: var(--theme-text-dim);
  }

  /* Custom Hint */
  .custom-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.5cqi, 10px);
    padding: clamp(6px, 1.5cqi, 12px) clamp(12px, 3cqi, 20px);
    background: var(--theme-card-bg);
    border-radius: clamp(6px, 1.5cqi, 10px);
    color: var(--theme-text-dim);
    font-size: clamp(0.7rem, 2.2cqi, 0.85rem);
  }

  .custom-hint i {
    color: rgba(59, 130, 246, 0.7);
  }

  /* Responsive container query */
  @container templates (max-width: 400px) {
    .templates-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .template-card {
      transition: none;
    }

    .template-card:hover {
      transform: none;
    }
  }
</style>
