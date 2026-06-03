<!--
  StaticPreview.svelte

  Static image format preview using the actual ImageComposer.
  Shows a real preview of what the exported image will look like.

  Features:
  - Uses saved visibility settings from ImageCompositionManager
  - Quick-access toggle chips for common settings
  - White background always
  - High quality export

  Domain: Export Panel - Single Media - Static Image Format
-->
<script lang="ts">
  import { getExportPanelState } from "../../state/export-panel-state.svelte";
  import { getSequenceRenderer } from "$lib/shared/render/get-sequence-renderer";
  import type { SequenceRenderer } from "$lib/shared/render/services/sequence-renderer";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { onMount } from "svelte";

  const hubState = getExportPanelState();
  const imageSettings = getImageCompositionManager();

  // Preview state
  let previewDataUrl = $state<string | null>(null);
  let isLoading = $state(false);
  let previewError = $state<string | null>(null);
  let renderService = $state<SequenceRenderer | null>(null);
  let renderVersion = $state(0); // Increment to trigger re-render

  // Local reactive copies of settings (for UI)
  let addWord = $state(imageSettings.addWord);
  let addStepNumbers = $state(imageSettings.addStepNumbers);
  let includeStartPosition = $state(imageSettings.includeStartPosition);
  let addDifficultyLevel = $state(imageSettings.addDifficultyLevel);
  let addUserInfo = $state(imageSettings.addUserInfo);
  let darkMode = $state(imageSettings.darkMode);

  // Load render service on mount
  $effect(() => {
    try {
      renderService = getSequenceRenderer();
      if (!renderService) {
        console.warn("⚠️ SequenceRenderer not available in container");
      }
    } catch (error) {
      console.error("Failed to get sequenceRenderer from container:", error);
    }
  });

  // Sync settings from manager and listen for changes
  onMount(() => {
    const updateFromManager = () => {
      addWord = imageSettings.addWord;
      addStepNumbers = imageSettings.addStepNumbers;
      includeStartPosition = imageSettings.includeStartPosition;
      addDifficultyLevel = imageSettings.addDifficultyLevel;
      addUserInfo = imageSettings.addUserInfo;
      darkMode = imageSettings.darkMode;
      renderVersion++; // Trigger re-render
    };

    imageSettings.registerObserver(updateFromManager);
    return () => imageSettings.unregisterObserver(updateFromManager);
  });

  // Generate preview when sequence, settings, or render service changes
  $effect(() => {
    const sequence = hubState.sequence;
    const service = renderService;
    // Track all settings for reactivity
    const _word = addWord;
    const _beats = addStepNumbers;
    const _start = includeStartPosition;
    const _diff = addDifficultyLevel;
    const _user = addUserInfo;
    const _darkMode = darkMode;
    const _version = renderVersion;
    // Track prop type settings for reactivity
    const _catDogMode = settingsService.settings.catDogMode;
    const _bluePropType = settingsService.settings.bluePropType;
    const _redPropType = settingsService.settings.redPropType;
    // Track user display name for footer
    const _userName = authState.user?.displayName;

    if (!sequence || !service) {
      previewDataUrl = null;
      return;
    }

    // Generate preview with user's saved settings
    isLoading = true;
    previewError = null;

    service
      .generatePreview(sequence, {
        backgroundColor: _darkMode ? "#0a0a0f" : "#FFFFFF",
        quality: 1.0,
        stepScale: 1.0,
        includeStartPosition: _start,
        addStepNumbers: _beats,
        addWord: _word,
        addUserInfo: _user,
        addDifficultyLevel: _diff,
        // Pass current user's display name for footer
        userName: _userName || "",
        // Include prop type settings so preview updates when prop type changes
        bluePropTypeOverride: _bluePropType,
        redPropTypeOverride: _catDogMode ? _redPropType : _bluePropType,
        // Pass dark mode as visibility override
        visibilityOverrides: {
          darkMode: _darkMode,
        },
      })
      .then((dataUrl) => {
        previewDataUrl = dataUrl;
        isLoading = false;
      })
      .catch((error) => {
        console.error("Preview generation failed:", error);
        previewError =
          error instanceof Error ? error.message : "Preview failed";
        isLoading = false;
      });
  });

  // Toggle handlers - update manager (which persists to localStorage)
  function toggleWord() {
    imageSettings.toggle("addWord");
  }

  function toggleStepNumbers() {
    imageSettings.toggle("addStepNumbers");
  }

  function toggleStartPosition() {
    imageSettings.toggle("includeStartPosition");
  }

  function toggleDifficulty() {
    imageSettings.toggle("addDifficultyLevel");
  }

  function toggleUserInfo() {
    imageSettings.toggle("addUserInfo");
  }

  function toggleDarkMode() {
    imageSettings.toggle("darkMode");
  }
</script>

<div class="static-preview">
  <!-- Preview Canvas -->
  <div class="preview-canvas">
    {#if !hubState.sequence}
      <div class="empty-state">
        <i class="fas fa-image" aria-hidden="true"></i>
        <p>No sequence loaded</p>
      </div>
    {:else if isLoading || !renderService}
      <div class="loading-state">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <p>Generating preview...</p>
      </div>
    {:else if previewError}
      <div class="error-state">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <p>{previewError}</p>
      </div>
    {:else if previewDataUrl}
      <img src={previewDataUrl} alt="Sequence preview" class="preview-image" />
    {:else}
      <div class="empty-state">
        <i class="fas fa-image" aria-hidden="true"></i>
        <p>No preview available</p>
      </div>
    {/if}
  </div>

  <!-- Quick Settings Chips -->
  <div class="settings-chips">
    <button
      class="chip"
      class:active={darkMode}
      onclick={toggleDarkMode}
      aria-pressed={darkMode}
      title="Toggle dark mode for export (overrides global setting)"
    >
      Dark Mode
    </button>
    <button
      class="chip"
      class:active={addWord}
      onclick={toggleWord}
      aria-pressed={addWord}
    >
      Word
    </button>
    <button
      class="chip"
      class:active={addStepNumbers}
      onclick={toggleStepNumbers}
      aria-pressed={addStepNumbers}
    >
      Beat #s
    </button>
    <button
      class="chip"
      class:active={includeStartPosition}
      onclick={toggleStartPosition}
      aria-pressed={includeStartPosition}
    >
      Start Pos
    </button>
    <button
      class="chip"
      class:active={addDifficultyLevel}
      onclick={toggleDifficulty}
      aria-pressed={addDifficultyLevel}
    >
      Difficulty
    </button>
    <button
      class="chip"
      class:active={addUserInfo}
      onclick={toggleUserInfo}
      aria-pressed={addUserInfo}
    >
      User Info
    </button>
  </div>
</div>

<style>
  .static-preview {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 12px;
  }

  .preview-canvas {
    flex: 1;
    min-height: 0;
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    background: var(--theme-card-bg);
  }

  .preview-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 4px 16px var(--theme-shadow);
  }

  .empty-state,
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--theme-text-dim);
  }

  .empty-state i,
  .loading-state i,
  .error-state i {
    font-size: var(--font-size-3xl);
    opacity: 0.3;
  }

  .error-state i {
    color: var(--semantic-error);
    opacity: 0.7;
  }

  .empty-state p,
  .loading-state p,
  .error-state p {
    font-size: var(--font-size-min);
    margin: 0;
    text-align: center;
  }

  /* Settings Chips */
  .settings-chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px 16px;
    min-height: var(--min-touch-target); /* WCAG 2.1 AA touch target minimum */
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 24px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text, white);
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    color: white;
  }

  .chip.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 35%, transparent);
    border-color: var(--theme-accent);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Mobile: horizontal scroll if needed, but maintain touch targets */
  @media (max-width: 600px) {
    .settings-chips {
      padding: 10px;
      gap: 8px;
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
    }

    .chip {
      padding: 10px 14px;
      min-height: var(--min-touch-target); /* Maintain WCAG touch target on mobile */
      white-space: nowrap;
      flex-shrink: 0;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
  }
</style>
