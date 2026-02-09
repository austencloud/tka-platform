<!--
  PreferencesTab.svelte - Workflow and Behavior Preferences

  Controls app behavior like confirmation dialogs, prompts, and other
  workflow preferences that users may want to customize.

  Uses toggle rows (not chips) because behavior settings need descriptions
  to explain what they do. Chips work for visibility where the element name
  IS the setting, but preferences need context.
-->
<script lang="ts">
  import type { AppSettings } from "../../domain/AppSettings";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import {
    TIME_SIGNATURES,
    type TimeSignatureKey,
  } from "../../../foundation/domain/models/TimeSignature";
  import { onMount } from "svelte";
  import {
    getSettings,
    updateSettings,
    isSettingsPreviewMode,
  } from "$lib/shared/application/state/app-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let { currentSettings, onSettingUpdate } = $props<{
    currentSettings: AppSettings;
    onSettingUpdate?: (event: { key: string; value: unknown }) => void;
  }>();

  // Services
  let hapticService: IHapticFeedback | null = null;
  const animationVisibilityManager = getAnimationVisibilityManager();

  // Entry animation
  let isVisible = $state(false);

  // Dark Mode state - derived from AppSettings
  const darkMode = $derived(getSettings().darkMode ?? false);
  const isPreview = $derived(isSettingsPreviewMode());

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    setTimeout(() => (isVisible = true), 30);
  });

  // Derive toggle state from settings
  const showClearConfirmation = $derived(
    !currentSettings?.skipClearConfirmation
  );
  const musicianMode = $derived(currentSettings?.musicianMode ?? false);
  const voiceControlEnabled = $derived(currentSettings?.voiceControlEnabled ?? false);
  const defaultTimeSignature = $derived<TimeSignatureKey>(
    currentSettings?.defaultTimeSignature ?? "4/4"
  );

  // Time signature options for the dropdown
  const timeSignatureOptions: { key: TimeSignatureKey; label: string }[] = [
    { key: "4/4", label: "4/4 (Common)" },
    { key: "3/4", label: "3/4 (Waltz)" },
    { key: "6/8", label: "6/8 (Compound)" },
  ];

  function handleToggleClearConfirmation() {
    hapticService?.trigger("selection");
    onSettingUpdate?.({
      key: "skipClearConfirmation",
      value: showClearConfirmation, // Toggle: if currently showing, now skip
    });
  }

  function handleDarkModeToggle() {
    if (isPreview) return;
    hapticService?.trigger("selection");
    const newValue = !darkMode;
    void updateSettings({ darkMode: newValue });
    animationVisibilityManager.setDarkMode(newValue);
  }

  function handleToggleMusicianMode() {
    hapticService?.trigger("selection");
    onSettingUpdate?.({
      key: "musicianMode",
      value: !musicianMode,
    });
  }

  function handleToggleVoiceControl() {
    hapticService?.trigger("selection");
    onSettingUpdate?.({
      key: "voiceControlEnabled",
      value: !voiceControlEnabled,
    });
  }

  function handleTimeSignatureChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value as TimeSignatureKey;
    hapticService?.trigger("selection");
    onSettingUpdate?.({
      key: "defaultTimeSignature",
      value,
    });
  }
</script>

<div class="preferences-tab" class:visible={isVisible}>
  <!-- Header -->
  <header class="tab-header">
    <div class="header-icon">
      <i class="fas fa-sliders" aria-hidden="true"></i>
    </div>
    <div class="header-content">
      <h1>{t("settings_preferences")}</h1>
      <p>{t("settings_customize_behavior")}</p>
    </div>
  </header>

  <!-- Visual Effects Section -->
  <section class="section">
    <h2 class="section-title">
      <i class="fas fa-moon" aria-hidden="true"></i>
      {t("settings_visual_effects")}
    </h2>

    <div class="toggle-list">
      <!-- Dark Mode -->
      <button
        type="button"
        class="toggle-row dark-mode-row"
        class:disabled={isPreview}
        onclick={handleDarkModeToggle}
        aria-pressed={darkMode}
        disabled={isPreview}
      >
        <div class="toggle-info">
          <span class="toggle-label">{t("settings_dark_mode")}</span>
        </div>
        <div class="toggle-switch dark-mode-switch" class:active={darkMode}>
          <div class="toggle-knob"></div>
        </div>
      </button>
    </div>
  </section>

  <!-- Confirmation Dialogs Section -->
  <section class="section">
    <h2 class="section-title">
      <i class="fas fa-message-question" aria-hidden="true"></i>
      {t("settings_confirmation_dialogs")}
    </h2>

    <div class="toggle-list">
      <!-- Clear Sequence Confirmation -->
      <button
        type="button"
        class="toggle-row"
        onclick={handleToggleClearConfirmation}
        aria-pressed={showClearConfirmation}
      >
        <div class="toggle-info">
          <span class="toggle-label">{t("settings_ask_before_clearing")}</span>
        </div>
        <div class="toggle-switch" class:active={showClearConfirmation}>
          <div class="toggle-knob"></div>
        </div>
      </button>

      <!-- Future preferences can be added here with the same pattern -->
    </div>
  </section>

  <!-- Timing Display Section -->
  <section class="section">
    <h2 class="section-title">
      <i class="fas fa-music" aria-hidden="true"></i>
      Timing Display
    </h2>

    <div class="toggle-list">
      <!-- Musician Mode -->
      <button
        type="button"
        class="toggle-row"
        onclick={handleToggleMusicianMode}
        aria-pressed={musicianMode}
      >
        <div class="toggle-info">
          <span class="toggle-label">Musician Mode</span>
          <span class="toggle-description">
            Show beat positions as "1 e & a" instead of decimals (1.25, 1.5)
          </span>
        </div>
        <div class="toggle-switch" class:active={musicianMode}>
          <div class="toggle-knob"></div>
        </div>
      </button>

      <!-- Time Signature -->
      <div class="select-row">
        <div class="select-info">
          <span class="select-label">Time Signature</span>
          <span class="select-description">
            Default time signature for new sequences. Affects beat subdivision
            (4/4 uses quarter notes, 6/8 uses triplets).
          </span>
        </div>
        <select
          class="time-signature-select"
          value={defaultTimeSignature}
          onchange={handleTimeSignatureChange}
          aria-label="Time Signature"
        >
          {#each timeSignatureOptions as option (option.key)}
            <option value={option.key}>{option.label}</option>
          {/each}
        </select>
      </div>
    </div>
  </section>

  <!-- Experimental Section -->
  <section class="section">
    <h2 class="section-title">
      <i class="fas fa-flask" aria-hidden="true"></i>
      Experimental
    </h2>

    <div class="toggle-list">
      <!-- Voice Control -->
      <button
        type="button"
        class="toggle-row"
        onclick={handleToggleVoiceControl}
        aria-pressed={voiceControlEnabled}
      >
        <div class="toggle-info">
          <span class="toggle-label">Voice Control</span>
          <span class="toggle-description">
            Say "Hey Tika" followed by a command to control the app hands-free.
            Shows a microphone button on mobile and in the sidebar on desktop.
          </span>
        </div>
        <div class="toggle-switch" class:active={voiceControlEnabled}>
          <div class="toggle-knob"></div>
        </div>
      </button>
    </div>
  </section>

  <!-- Helpful tip -->
  <div class="tip-card">
    <i class="fas fa-lightbulb" aria-hidden="true"></i>
    <p>
      <strong>{t("settings_tip")}</strong> {t("settings_undo_tip")}
    </p>
  </div>
</div>

<style>
  .preferences-tab {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 16px;
    opacity: 0;
    transform: translateY(8px);
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
  }

  .preferences-tab.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Header */
  .tab-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .header-icon {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    border-radius: 16px;
    font-size: var(--font-size-2xl);
    color: white;
    flex-shrink: 0;
  }

  .header-content h1 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .header-content p {
    margin: 4px 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Section */
  .section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .section-title i {
    font-size: var(--font-size-sm);
    color: var(--theme-accent, #f97316);
  }

  .section-title i.fa-moon {
    color: #00ffff;
  }

  .section-title i.fa-music {
    color: #a855f7;
  }

  .section-title i.fa-flask {
    color: #22c55e;
  }

  /* Toggle List */
  .toggle-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    text-align: left;
    width: 100%;
  }

  .toggle-row:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .toggle-row:active {
    transform: scale(0.995);
  }

  .toggle-row:focus-visible {
    outline: 2px solid var(--theme-accent, #f97316);
    outline-offset: 2px;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .toggle-label {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
  }

  .toggle-description {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }

  /* Select Row (similar to toggle-row but with select instead of switch) */
  .select-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
  }

  .select-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .select-label {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
  }

  .select-description {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }

  .time-signature-select {
    padding: 10px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-base);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
    min-width: 140px;
  }

  .time-signature-select:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  .time-signature-select:focus-visible {
    outline: 2px solid var(--theme-accent, #f97316);
    outline-offset: 2px;
  }

  .time-signature-select option {
    background: var(--theme-panel-bg, #1a1a2e);
    color: var(--theme-text, #ffffff);
    padding: 8px;
  }

  /* Toggle Switch */
  .toggle-switch {
    width: 52px;
    height: 32px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 16px;
    padding: 3px;
    transition: background var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .toggle-switch.active {
    background: var(--semantic-success, #22c55e);
  }

  .toggle-knob {
    width: 26px;
    height: 26px;
    background: white;
    border-radius: 50%;
    transition: transform var(--duration-normal) ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle-switch.active .toggle-knob {
    transform: translateX(20px);
  }

  /* Dark Mode Toggle - Cyan glow effect */
  .dark-mode-row.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  .dark-mode-switch.active {
    background: rgba(0, 255, 255, 0.4);
    box-shadow:
      0 0 12px rgba(0, 255, 255, 0.4),
      0 0 24px rgba(0, 255, 255, 0.2);
  }

  .dark-mode-row:has(.dark-mode-switch.active) {
    background: rgba(0, 255, 255, 0.08);
    border-color: rgba(0, 255, 255, 0.3);
  }

  .dark-mode-row:has(.dark-mode-switch.active):hover {
    background: rgba(0, 255, 255, 0.12);
    border-color: rgba(0, 255, 255, 0.4);
  }

  .dark-mode-row:has(.dark-mode-switch.active) .toggle-label {
    color: #00ffff;
    text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
  }

  /* Tip Card */
  .tip-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #f97316) 10%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #f97316) 25%, transparent);
    border-radius: 12px;
  }

  .tip-card i {
    font-size: var(--font-size-lg);
    color: var(--theme-accent, #f97316);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .tip-card p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text, #ffffff);
    line-height: 1.5;
  }

  .tip-card strong {
    color: var(--theme-accent, #f97316);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .preferences-tab {
      padding: 12px;
      gap: 20px;
    }

    .header-icon {
      width: 48px;
      height: 48px;
      font-size: var(--font-size-xl);
    }

    .toggle-row {
      padding: 14px;
    }

    .toggle-switch {
      width: 48px;
      height: 28px;
    }

    .toggle-knob {
      width: 22px;
      height: 22px;
    }

    .toggle-switch.active .toggle-knob {
      transform: translateX(20px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .preferences-tab,
    .toggle-row,
    .toggle-switch,
    .toggle-knob {
      transition: none !important;
    }
  }
</style>
