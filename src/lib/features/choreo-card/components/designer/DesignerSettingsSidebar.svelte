<!--
  DesignerSettingsSidebar.svelte - Slide-out settings panel for the card designer

  Slides in from the right edge of the card preview area. Controls are wired
  directly to the global state managers - the sidebar IS the control surface
  for those managers, not a reflection of props passed down.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/settings/utils/public-page-backgrounds";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import type { BackgroundType } from "@austencloud/backgrounds";

  interface Props {
    open: boolean;
    onClose: () => void;
    onExport: () => void;
    isExporting: boolean;
    showInfoCard: boolean;
    onInfoCardToggle: () => void;
  }

  let {
    open,
    onClose,
    onExport,
    isExporting,
    showInfoCard,
    onInfoCardToggle,
  }: Props = $props();

  const imageComposition = getImageCompositionManager();

  // Observer-driven reactivity: bump a version counter so $derived blocks re-read.
  // The manager is not rune-based, so we bridge via the observer pattern.
  let compositionVersion = $state(0);

  function onCompositionChanged(): void {
    compositionVersion++;
  }

  imageComposition.registerObserver(onCompositionChanged);

  onDestroy(() => {
    imageComposition.unregisterObserver(onCompositionChanged);
  });

  // Read current state from managers, re-evaluated when version bumps.
  const currentTheme = $derived(settingsService.settings.backgroundType);
  const wordOn = $derived.by(() => {
    void compositionVersion;
    return imageComposition.addWord;
  });
  const startPosOn = $derived.by(() => {
    void compositionVersion;
    return imageComposition.includeStartPosition;
  });
  const qrOn = $derived.by(() => {
    void compositionVersion;
    return imageComposition.showQRCode;
  });
  const birthdayOn = $derived.by(() => {
    void compositionVersion;
    return imageComposition.showBirthday;
  });

  function handleThemeClick(type: BackgroundType): void {
    settingsService.updateSetting("backgroundType", type);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && open) {
      onClose();
    }
  }

  function toggleWord(): void {
    imageComposition.setAddWord(!wordOn);
  }

  function toggleStartPos(): void {
    imageComposition.setIncludeStartPosition(!startPosOn);
  }

  function toggleQR(): void {
    imageComposition.setShowQRCode(!qrOn);
  }

  function toggleBirthday(): void {
    imageComposition.setShowBirthday(!birthdayOn);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="sidebar-overlay" class:open aria-hidden={!open}>
  <div class="sidebar-header">
    <h3 class="sidebar-title">Settings</h3>
    <button class="close-btn" onclick={onClose} aria-label="Close settings" type="button">
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>

  <!-- Theme section -->
  <section>
    <span class="section-label">Theme</span>
    <div class="theme-chips" role="toolbar" aria-label="Card back theme">
      {#each ANIMATED_BACKGROUNDS as bg (bg.type)}
        <button
          class="theme-chip"
          class:active={currentTheme === bg.type}
          onclick={() => handleThemeClick(bg.type)}
          aria-pressed={currentTheme === bg.type}
          aria-label={bg.label}
          title={bg.label}
          type="button"
        >
          <i class="fas {bg.icon}" aria-hidden="true"></i>
        </button>
      {/each}
    </div>
  </section>

  <!-- Display section -->
  <section>
    <span class="section-label">Display</span>
    <div class="toggle-list">
      <button
        class="toggle-row"
        class:on={wordOn}
        onclick={toggleWord}
        aria-pressed={wordOn}
        aria-label="Toggle word"
        type="button"
      >
        <i class="fas fa-tag toggle-icon" aria-hidden="true"></i>
        <span class="toggle-label">Word</span>
        <span class="toggle-indicator" aria-hidden="true"></span>
      </button>

      <button
        class="toggle-row"
        class:on={startPosOn}
        onclick={toggleStartPos}
        aria-pressed={startPosOn}
        aria-label="Toggle start position"
        type="button"
      >
        <i class="fas fa-map-marker-alt toggle-icon" aria-hidden="true"></i>
        <span class="toggle-label">Start position</span>
        <span class="toggle-indicator" aria-hidden="true"></span>
      </button>

      <button
        class="toggle-row"
        class:on={qrOn}
        onclick={toggleQR}
        aria-pressed={qrOn}
        aria-label="Toggle QR code"
        type="button"
      >
        <i class="fas fa-qrcode toggle-icon" aria-hidden="true"></i>
        <span class="toggle-label">QR code</span>
        <span class="toggle-indicator" aria-hidden="true"></span>
      </button>

      <button
        class="toggle-row"
        class:on={birthdayOn}
        onclick={toggleBirthday}
        aria-pressed={birthdayOn}
        aria-label="Toggle birthday"
        type="button"
      >
        <i class="fas fa-birthday-cake toggle-icon" aria-hidden="true"></i>
        <span class="toggle-label">Birthday</span>
        <span class="toggle-indicator" aria-hidden="true"></span>
      </button>
    </div>
  </section>

  <!-- Actions section -->
  <section class="actions-section">
    <button
      class="action-btn"
      onclick={onInfoCardToggle}
      aria-pressed={showInfoCard}
      aria-label={showInfoCard ? "Show sequence" : "Show rules card"}
      type="button"
    >
      <i class="fas {showInfoCard ? 'fa-layer-group' : 'fa-info-circle'}" aria-hidden="true"></i>
      <span>{showInfoCard ? "Show sequence" : "Show rules card"}</span>
    </button>

    <button
      class="action-btn export-btn"
      onclick={onExport}
      disabled={isExporting}
      type="button"
      aria-label="Export card as PNG"
    >
      {#if isExporting}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <span>Exporting…</span>
      {:else}
        <i class="fas fa-download" aria-hidden="true"></i>
        <span>Export PNG</span>
      {/if}
    </button>
  </section>
</div>

<style>
  .sidebar-overlay {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 280px;
    z-index: 20;
    transform: translateX(100%);
    transition: transform 300ms ease;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;

    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .sidebar-overlay::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar-overlay::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 3px;
  }

  .sidebar-overlay.open {
    transform: translateX(0);
  }

  /* Header */

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .sidebar-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
    font-size: 12px;
  }

  .close-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #ffffff);
  }

  /* Sections */

  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.45));
    font-weight: 500;
  }

  /* Theme chips */

  .theme-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .theme-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    font-size: 13px;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
  }

  .theme-chip:hover {
    background: var(--theme-card-hover, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .theme-chip.active {
    background: var(--theme-accent, rgba(120, 100, 255, 0.25));
    border-color: var(--theme-accent-border, rgba(120, 100, 255, 0.6));
    color: var(--theme-text, #ffffff);
  }

  /* Toggle list */

  .toggle-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.55));
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    text-align: left;
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
    width: 100%;
  }

  .toggle-row:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
  }

  .toggle-row.on {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .toggle-icon {
    width: 14px;
    flex-shrink: 0;
    font-size: 13px;
    text-align: center;
  }

  .toggle-label {
    flex: 1;
  }

  /* Pill-shaped on/off indicator */
  .toggle-indicator {
    flex-shrink: 0;
    width: 28px;
    height: 14px;
    border-radius: 7px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    position: relative;
    transition: background 200ms ease, border-color 200ms ease;
  }

  .toggle-indicator::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--theme-text-muted, rgba(255, 255, 255, 0.35));
    transition: transform 200ms ease, background 200ms ease;
  }

  .toggle-row.on .toggle-indicator {
    background: var(--theme-accent, rgba(100, 150, 255, 0.35));
    border-color: var(--theme-accent-border, rgba(100, 150, 255, 0.5));
  }

  .toggle-row.on .toggle-indicator::after {
    transform: translateX(14px);
    background: var(--theme-text, #ffffff);
  }

  /* Actions */

  .actions-section {
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    transition: background 150ms ease, border-color 150ms ease;
    margin-bottom: 8px;
  }

  .action-btn:last-child {
    margin-bottom: 0;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--theme-card-hover, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .export-btn {
    background: var(--theme-accent, rgba(100, 130, 255, 0.2));
    border-color: var(--theme-accent-border, rgba(100, 130, 255, 0.4));
  }

  .export-btn:hover:not(:disabled) {
    background: var(--theme-accent-hover, rgba(100, 130, 255, 0.35));
  }
</style>
