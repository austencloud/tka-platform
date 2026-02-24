<!--
  ImagePanel.svelte

  Settings panel for image export visibility options.
  Controls what elements are included in exported images.
  Shows simulated export layout with smooth fade transitions
  for each visibility toggle.
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import ImageExportPreviewLayered from "./ImageExportPreviewLayered.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    addWord: boolean;
    addDifficultyLevel: boolean;
    includeStartPosition: boolean;
    // Granular footer controls
    showCreatorName: boolean;
    showNotes: boolean;
    showBirthday: boolean;
    customNotesText: string;
    // Dark mode
    darkMode: boolean;
    // Pictograph visibility callbacks for fade transitions
    onPictographToggle: (key: string) => void;
    onToggle: (key: string) => void;
    onCustomNotesChange: (value: string) => void;
    isMobileHidden?: boolean;
  }

  let {
    addWord,
    addDifficultyLevel,
    includeStartPosition,
    showCreatorName,
    showNotes,
    showBirthday,
    customNotesText,
    darkMode,
    onPictographToggle,
    onToggle,
    onCustomNotesChange,
    isMobileHidden = false,
  }: Props = $props();

  let collapsed = $state(false);
</script>

<section
  class="settings-panel image-panel"
  class:mobile-hidden={isMobileHidden}
>
  <header class="panel-header">
    <span class="panel-icon image-icon">
      <i class="fas fa-download" aria-hidden="true"></i>
    </span>
    <h3 class="panel-title">{t("visibility_image_export")}</h3>
    <button
      class="collapse-toggle"
      onclick={() => (collapsed = !collapsed)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand image export settings" : "Collapse image export settings"}
      type="button"
    >
      <i class="fas {collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" aria-hidden="true"></i>
    </button>
  </header>

  {#if !collapsed}
    <div class="panel-body" transition:slide={{ duration: 200 }}>
      <div class="preview-frame image-preview">
        <ImageExportPreviewLayered
          showWord={addWord}
          showDifficultyLevel={addDifficultyLevel}
          {includeStartPosition}
          {showCreatorName}
          {showNotes}
          {showBirthday}
          {customNotesText}
          {darkMode}
          onToggleTKA={() => onPictographToggle("tka")}
          onToggleVTG={() => onPictographToggle("vtg")}
          onToggleElemental={() => onPictographToggle("elemental")}
          onTogglePositions={() => onPictographToggle("positions")}
          onToggleReversals={() => onPictographToggle("reversals")}
          onToggleNonRadial={() => onPictographToggle("nonRadial")}
        />
      </div>

      <div class="panel-controls">
        <div class="control-group">
          <span class="group-label">{t("visibility_include_in_image")}</span>
          <div class="toggle-grid">
            <button
              class="toggle-btn"
              class:active={addWord}
              onclick={() => onToggle("word")}>{t("visibility_word")}</button
            >
            <button
              class="toggle-btn"
              class:active={includeStartPosition}
              onclick={() => onToggle("startPosition")}>{t("visibility_start_pos")}</button
            >
            <button
              class="toggle-btn"
              class:active={addDifficultyLevel}
              onclick={() => onToggle("difficulty")}>{t("visibility_difficulty")}</button
            >
          </div>
        </div>

        <div class="control-group">
          <span class="group-label">{t("visibility_footer_info")}</span>
          <div class="toggle-grid footer-toggles">
            <button
              class="toggle-btn"
              class:active={showCreatorName}
              onclick={() => onToggle("creatorName")}>{t("visibility_name")}</button
            >
            <button
              class="toggle-btn"
              class:active={showNotes}
              onclick={() => onToggle("notes")}>{t("visibility_notes")}</button
            >
            <button
              class="toggle-btn birthday-btn"
              class:active={showBirthday}
              onclick={() => onToggle("birthday")}
              title={t("visibility_birthday_tooltip")}>🎂</button
            >
          </div>
        </div>

        <div class="control-group">
          <span class="group-label">{t("visibility_theme")}</span>
          <div class="toggle-grid theme-toggle">
            <button
              class="toggle-btn dark-mode-btn"
              class:active={darkMode}
              onclick={() => onToggle("darkMode")}
              title={t("visibility_theme")}
              aria-pressed={darkMode}
            >
              {darkMode ? `🌙 ${t("visibility_dark_mode")}` : `☀️ ${t("visibility_light_mode")}`}
            </button>
          </div>
        </div>

        <div class="control-group notes-input-group">
          <label class="group-label" for="custom-notes">{t("visibility_custom_notes_text")}</label>
          <input
            id="custom-notes"
            type="text"
            class="notes-input"
            value={customNotesText}
            placeholder={t("visibility_notes_placeholder")}
            oninput={(e) => onCustomNotesChange(e.currentTarget.value)}
          />
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .settings-panel {
    container-type: inline-size;
    container-name: image-panel;
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 2cqi, 16px);
    padding: clamp(12px, 2cqi, 20px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    min-width: 0;
    min-height: var(--vt-panel-min-h, auto);
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      transform 0.2s ease;
  }

  .settings-panel:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-1px);
  }

  .settings-panel.mobile-hidden {
    display: none;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5cqi, 10px);
    width: 100%;
    flex-shrink: var(--vt-header-shrink, 1);
  }

  .panel-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(26px, 8cqi, 32px);
    height: clamp(26px, 8cqi, 32px);
    border-radius: clamp(6px, 2cqi, 8px);
    font-size: var(--font-size-sm);
    flex-shrink: 0;
    transition: all var(--duration-fast) ease;
  }

  .panel-icon.image-icon {
    --icon-color: #34d399;
    background: color-mix(in srgb, var(--icon-color) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--icon-color) 35%, transparent);
    color: var(--icon-color);
    box-shadow: 0 0 8px color-mix(in srgb, var(--icon-color) 15%, transparent);
  }

  .settings-panel:hover .panel-icon {
    box-shadow: 0 0 12px color-mix(in srgb, var(--icon-color) 25%, transparent);
  }

  .panel-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
    white-space: nowrap;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    flex: 1;
  }

  .preview-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-panel-bg) 80%, transparent);
    border-radius: clamp(10px, 2cqi, 14px);
    border: 1px solid var(--theme-stroke);
    overflow: hidden;
    width: 100%;
    aspect-ratio: 1;
    max-width: 500px;
    box-shadow: inset 0 2px 8px var(--theme-shadow);
    min-height: var(--vt-preview-min-h, auto);
  }

  /* Make pictograph fill the preview frame */
  .preview-frame :global(.pictograph-with-visibility),
  .preview-frame :global(.pictograph) {
    width: 100% !important;
    height: 100% !important;
    max-width: 100%;
    max-height: 100%;
  }

  .preview-frame :global(svg.pictograph) {
    width: 100% !important;
    height: 100% !important;
  }

  .panel-controls {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 12px);
    width: 100%;
    /* Push controls to bottom when panel is stretched */
    margin-top: auto;
    flex-shrink: var(--vt-controls-shrink, 1);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 1cqi, 6px);
  }

  .group-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    padding-left: 2px;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    line-height: 1.2;
  }

  .toggle-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(4px, 1cqi, 8px);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px; /* WCAG touch target */
    padding: clamp(8px, 1.5cqi, 12px) clamp(8px, 1.5cqi, 10px);
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(8px, 1.5cqi, 12px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 600;
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .toggle-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateY(-1px);
  }

  .toggle-btn:active {
    transform: translateY(0) scale(0.97);
    transition-duration: 50ms;
  }

  .toggle-btn.active {
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 25%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 45%,
      transparent
    );
    color: white;
    box-shadow:
      0 0 0 1px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 15%,
          transparent
        ),
      0 4px 12px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 25%,
          transparent
        );
  }

  .toggle-btn.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 35%, transparent);
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 55%,
      transparent
    );
    box-shadow:
      0 0 0 1px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 20%,
          transparent
        ),
      0 4px 16px
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 35%,
          transparent
        );
  }

  .toggle-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  .panel-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(12px, 2cqi, 16px);
    width: 100%;
  }

  .collapse-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    border-radius: 6px;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .collapse-toggle:hover {
    background: color-mix(in srgb, var(--theme-text-dim) 15%, transparent);
    color: var(--theme-text);
  }

  .collapse-toggle:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  @container image-panel (min-width: 500px) {
    .panel-body {
      flex-direction: row;
      align-items: flex-start;
    }

    .preview-frame {
      flex-shrink: 0;
      width: 50%;
      max-width: 500px;
    }

    .panel-controls {
      flex: 1;
      margin-top: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-panel,
    .toggle-btn,
    .collapse-toggle {
      transition: none;
    }
  }

  @media (prefers-contrast: high) {
    .toggle-btn,
    .settings-panel {
      border-width: 2px;
    }

    .toggle-btn.active {
      border-color: var(--theme-accent, var(--theme-accent));
    }

    .toggle-btn:focus-visible {
      outline-width: 3px;
    }
  }

  /* Compact width adjustments */
  @container image-panel (max-width: 280px) {
    .panel-header {
      gap: 6px;
    }

    .panel-icon {
      width: 24px;
      height: 24px;
    }

    .group-label {
      font-size: 10px;
      letter-spacing: 0.3px;
    }
  }

  /* Footer toggles - 3 column grid */
  .footer-toggles {
    grid-template-columns: repeat(3, 1fr);
  }

  /* Birthday emoji button */
  .birthday-btn {
    font-size: clamp(16px, 3cqi, 20px);
    line-height: 1;
  }

  /* Theme toggle - single full-width button */
  .theme-toggle {
    grid-template-columns: 1fr;
  }

  .dark-mode-btn {
    font-size: var(--font-size-compact);
  }

  /* Notes input */
  .notes-input-group {
    margin-top: clamp(4px, 1cqi, 8px);
  }

  .notes-input {
    width: 100%;
    min-height: 44px; /* WCAG touch target */
    padding: clamp(10px, 1.5cqi, 12px);
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(8px, 1.5cqi, 12px);
    color: var(--theme-text);
    font-size: var(--font-size-compact);
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    transition: all var(--duration-fast) ease;
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
</style>
