<!--
  StaticSettings.svelte

  Settings panel for static image export footer customization.
  Works in two modes:
  1. Standalone mode: Directly modifies persistent defaults (ImageCompositionManager)
  2. Export panel mode: Uses per-export overrides via ExportPanelState context

  Domain: Export Panel - Settings - Static Image Format
-->
<script lang="ts">
  import { getContext } from "svelte";
  import type { ExportPanelState } from "../../state/export-panel-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { onMount, onDestroy } from "svelte";

  // Try to get export panel context (may not exist if used standalone)
  const EXPORT_PANEL_STATE_KEY = Symbol.for("ExportPanelState");
  const exportPanelState = getContext<ExportPanelState | undefined>(EXPORT_PANEL_STATE_KEY);
  const isInExportPanel = !!exportPanelState;

  const imageCompositionManager = getImageCompositionManager();

  // Local state for footer settings (initialized from defaults)
  let showCreatorName = $state(imageCompositionManager.showCreatorName);
  let showNotes = $state(imageCompositionManager.showNotes);
  let showBirthday = $state(imageCompositionManager.showBirthday);
  let customNotesText = $state(imageCompositionManager.customNotesText);
  let isCustomized = $state(false);

  // Sync with persistent settings changes
  function handleSettingsChange() {
    if (!isCustomized) {
      showCreatorName = imageCompositionManager.showCreatorName;
      showNotes = imageCompositionManager.showNotes;
      showBirthday = imageCompositionManager.showBirthday;
      customNotesText = imageCompositionManager.customNotesText;
    }
  }

  onMount(() => {
    imageCompositionManager.registerObserver(handleSettingsChange);

    // If in export panel, check if already customized for this export
    if (isInExportPanel && exportPanelState) {
      const currentSettings = exportPanelState.staticSettings;
      if (currentSettings.isUsingCustomFooter) {
        showCreatorName = currentSettings.showCreatorName ?? showCreatorName;
        showNotes = currentSettings.showNotes ?? showNotes;
        showBirthday = currentSettings.showBirthday ?? showBirthday;
        customNotesText = currentSettings.customNotesText ?? customNotesText;
        isCustomized = true;
      }
    }
  });

  onDestroy(() => {
    imageCompositionManager.unregisterObserver(handleSettingsChange);
  });

  function toggleSetting(key: "name" | "notes" | "birthday") {
    switch (key) {
      case "name":
        showCreatorName = !showCreatorName;
        break;
      case "notes":
        showNotes = !showNotes;
        break;
      case "birthday":
        showBirthday = !showBirthday;
        break;
    }
    applyChanges();
  }

  function handleNotesInput(e: Event) {
    customNotesText = (e.target as HTMLInputElement).value;
    applyChanges();
  }

  function applyChanges() {
    if (isInExportPanel && exportPanelState) {
      // Per-export override mode
      isCustomized = true;
      exportPanelState.staticSettings = {
        ...exportPanelState.staticSettings,
        showCreatorName,
        showNotes,
        showBirthday,
        customNotesText,
        isUsingCustomFooter: true,
      };
    } else {
      // Standalone mode - update persistent defaults directly
      imageCompositionManager.setShowCreatorName(showCreatorName);
      imageCompositionManager.setShowNotes(showNotes);
      imageCompositionManager.setShowBirthday(showBirthday);
      imageCompositionManager.setCustomNotesText(customNotesText);
    }
  }

  function resetToDefaults() {
    showCreatorName = imageCompositionManager.showCreatorName;
    showNotes = imageCompositionManager.showNotes;
    showBirthday = imageCompositionManager.showBirthday;
    customNotesText = imageCompositionManager.customNotesText;
    isCustomized = false;

    // Clear custom settings from export panel state
    if (isInExportPanel && exportPanelState) {
      exportPanelState.staticSettings = {
        ...exportPanelState.staticSettings,
        showCreatorName: undefined,
        showNotes: undefined,
        showBirthday: undefined,
        customNotesText: undefined,
        isUsingCustomFooter: false,
      };
    }
  }
</script>

<div class="static-settings">
  <!-- Header with status indicator -->
  <div class="settings-header">
    <h4>Footer Content</h4>
    {#if isInExportPanel}
      <span class="status-badge" class:customized={isCustomized}>
        {isCustomized ? "Custom for this export" : "Using your defaults"}
      </span>
    {/if}
  </div>

  <!-- Footer toggles -->
  <div class="toggle-grid">
    <button
      class="toggle-btn"
      class:active={showCreatorName}
      aria-pressed={showCreatorName}
      onclick={() => toggleSetting("name")}
    >
      Name
    </button>
    <button
      class="toggle-btn"
      class:active={showNotes}
      aria-pressed={showNotes}
      onclick={() => toggleSetting("notes")}
    >
      Notes
    </button>
    <button
      class="toggle-btn birthday-btn"
      class:active={showBirthday}
      aria-pressed={showBirthday}
      onclick={() => toggleSetting("birthday")}
      aria-label="Birthday date"
      title="Birthday date"
    >
      <span aria-hidden="true">🎂</span>
    </button>
  </div>

  <!-- Custom notes input -->
  <div class="notes-input-group">
    <label class="input-label" for="export-notes">Notes Text</label>
    <input
      id="export-notes"
      type="text"
      class="notes-input"
      value={customNotesText}
      placeholder="Created using Flow Arts Composer"
      oninput={handleNotesInput}
    />
  </div>

  <!-- Reset button (only shown when customized in Export panel mode) -->
  {#if isInExportPanel && isCustomized}
    <button class="reset-btn" onclick={resetToDefaults}>
      <i class="fas fa-undo" aria-hidden="true"></i>
      Reset to defaults
    </button>
  {/if}
</div>

<style>
  .static-settings {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .settings-header h4 {
    font-size: var(--font-size-min);
    font-weight: 600;
    color: var(--theme-text, white);
    margin: 0;
  }

  .status-badge {
    font-size: var(--font-size-compact);
    padding: 4px 10px;
    border-radius: 20px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text-dim);
    transition: all var(--duration-fast) ease;
  }

  .status-badge.customized {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-accent);
  }

  .toggle-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 10px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .toggle-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .toggle-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 45%, transparent);
    color: white;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-accent) 15%, transparent);
  }

  .toggle-btn.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 35%, transparent);
  }

  .birthday-btn {
    font-size: clamp(16px, 3cqi, 20px);
    line-height: 1;
  }

  .notes-input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim);
    padding-left: 2px;
  }

  .notes-input {
    width: 100%;
    min-height: 44px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text);
    font-size: var(--font-size-compact);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    transition: all var(--duration-fast) ease;
    box-sizing: border-box;
  }

  .notes-input::placeholder {
    color: var(--theme-text-dim);
    opacity: 0.6;
  }

  .notes-input:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .notes-input:focus {
    outline: none;
    border-color: var(--theme-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .reset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 16px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .reset-btn:hover {
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .reset-btn i {
    font-size: var(--font-size-compact);
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-btn,
    .notes-input,
    .reset-btn,
    .status-badge {
      transition: none;
    }
  }
</style>
