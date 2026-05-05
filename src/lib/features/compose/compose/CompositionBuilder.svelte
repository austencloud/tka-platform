<script lang="ts">
  /**
   * CompositionBuilder - Entry point for the Compose module's Arrange tab
   *
   * Flow:
   * 1. PresetPicker (choose template or "Build Custom")
   * 2a. Template selected → ContentEditor (fill cells with sequences)
   * 2b. "Build Custom" → CompositionLab (create custom layout presets)
   */

  import { getCompositionState } from "./state/composition-state.svelte";
  import PresetPicker from "./components/PresetPicker.svelte";
  import CompositionLab from "$lib/features/lab/constraint-layout-lab/CompositionLab.svelte";

  // Get singleton state
  const compState = getCompositionState();

  // Track which mode we're in
  type BuilderMode = "picker" | "content" | "lab";
  let currentMode = $state<BuilderMode>("picker");

  // Track selected preset ID
  let selectedPresetId = $state<string | undefined>(undefined);

  // Preset picker gate - show picker if user hasn't entered builder AND has no content
  const hasEnteredBuilder = $derived(compState.hasEnteredBuilder);
  const hasAnyContent = $derived(compState.hasAnyContent);
  const shouldShowPicker = $derived(!hasEnteredBuilder && !hasAnyContent);

  function handleSelectPreset(templateId: string) {
    // Store the selected preset ID and switch to content editor
    selectedPresetId = templateId;
    currentMode = "content";
    compState.setHasEnteredBuilder(true);
  }

  function handleBuildCustom() {
    // Go to CompositionLab for creating custom layouts
    selectedPresetId = undefined;
    currentMode = "lab";
    compState.setHasEnteredBuilder(true);
  }

  function handleBackToPicker() {
    // Return to preset picker
    currentMode = "picker";
    selectedPresetId = undefined;
    compState.setHasEnteredBuilder(false);
  }
</script>

<!-- Preset Picker Gate - shown before entering the builder -->
{#if shouldShowPicker}
  <PresetPicker
    onSelectPreset={handleSelectPreset}
    onBuildCustom={handleBuildCustom}
  />
{:else if currentMode === "lab"}
  <!-- CompositionLab - for creating custom layout presets -->
  <div class="composition-builder">
    <div class="builder-header">
      <button class="back-button" onclick={handleBackToPicker}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Back to Templates
      </button>
      <span class="mode-label">Layout Editor</span>
    </div>
    <div class="builder-content">
      <CompositionLab initialPresetId={selectedPresetId} />
    </div>
  </div>
{:else}
  <!-- Content mode - placeholder (ArrangeTab is the active implementation) -->
  <div class="composition-builder">
    <div class="builder-header">
      <button class="back-button" onclick={handleBackToPicker}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Back to Templates
      </button>
      <span class="mode-label">Content Editor</span>
    </div>
    <div class="builder-content placeholder">
      <p>Content editor not yet implemented. Use ArrangeTab instead.</p>
    </div>
  </div>
{/if}

<style>
  .composition-builder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .builder-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 12px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: var(--border-radius-sm, 6px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    min-height: 32px;
  }

  .back-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .mode-label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .builder-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .builder-content.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button {
      transition: none;
    }
  }
</style>
