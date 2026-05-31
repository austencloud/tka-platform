<!--
  DesktopConfigPanel - All-in-one configuration for desktop onboarding

  Shows all 4 configuration sections (name, background, prop, pictograph mode)
  simultaneously in a 2x2 grid. Desktop users configure everything at once
  instead of stepping through sequentially.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import {
    registerBackgroundCard,
    BACKGROUND_CARD_REGISTRY,
  } from "@austencloud/backgrounds/card";
  import type { BackgroundCardSelectDetail } from "@austencloud/backgrounds/card";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  registerBackgroundCard();
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { examplePictographData } from "$lib/shared/settings/components/tabs/visibility/example-data";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    initialDisplayName: string;
    initialPronouns: string;
    initialTheme: BackgroundType;
    initialProp: PropType;
    initialMode: "light" | "dark";
    onComplete: (data: {
      displayName: string;
      pronouns: string;
      theme: BackgroundType;
      prop: PropType;
      mode: "light" | "dark";
    }) => void;
    onBack: () => void;
    onSkip: () => void;
    onThemePreview: (theme: BackgroundType) => void;
  }

  const props: Props = $props();

  // Destructure callbacks (always current)
  const { onComplete, onBack, onSkip, onThemePreview } = props;

  // Capture initial values into local state (intentionally one-time snapshot)
  const _initName = props.initialDisplayName;
  const _initPronouns = props.initialPronouns;
  const _initTheme = props.initialTheme;
  const _initProp = props.initialProp;
  const _initMode = props.initialMode;

  let displayName = $state(_initName || authState.user?.displayName || "");
  let pronouns = $state(_initPronouns);
  let selectedTheme = $state<BackgroundType>(_initTheme);
  let selectedProp = $state<PropType>(_initProp);
  let selectedMode = $state<"light" | "dark">(_initMode);

  // Pronoun presets
  const PRONOUN_PRESETS = $derived([
    { key: "he/him", label: t("pronoun_preset_he_him") },
    { key: "she/her", label: t("pronoun_preset_she_her") },
    { key: "they/them", label: t("pronoun_preset_they_them") },
  ]);

  // Background options
  const animatedBackgrounds = $derived(
    BACKGROUND_CARD_REGISTRY.filter(
      (bg) => bg.type !== BackgroundType.VOID
    )
  );

  let themeGridEl: HTMLDivElement;

  // Featured props
  const FEATURED_PROPS: PropType[] = [
    PropType.STAFF,
    PropType.CLUB,
    PropType.FAN,
    PropType.TRIAD,
    PropType.MINIHOOP,
    PropType.BUUGENG,
    PropType.TRIQUETRA,
    PropType.EIGHTRINGS,
  ];

  function selectPronounPreset(preset: string) {
    if (pronouns.trim() === preset) {
      pronouns = "";
    } else {
      pronouns = preset;
    }
  }

  function handleThemeSelect(type: BackgroundType) {
    selectedTheme = type;
    onThemePreview(type);
  }

  function handleFinish() {
    onComplete({
      displayName: displayName.trim() || authState.user?.displayName || "",
      pronouns: pronouns.trim(),
      theme: selectedTheme,
      prop: selectedProp,
      mode: selectedMode,
    });
  }

  onMount(() => {
    function handleCardSelect(e: Event) {
      const detail = (e as CustomEvent<BackgroundCardSelectDetail>).detail;
      handleThemeSelect(detail.type as BackgroundType);
    }

    themeGridEl.addEventListener("background-select", handleCardSelect);
    return () =>
      themeGridEl.removeEventListener("background-select", handleCardSelect);
  });
</script>

<div class="desktop-config-panel">
  <!-- Header -->
  <div class="panel-header">
    <button
      type="button"
      class="back-button"
      onclick={onBack}
      aria-label="Go back"
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
    </button>

    <h1 class="panel-title">Set up your experience</h1>

    <div class="header-actions">
      <button type="button" class="finish-button" onclick={handleFinish}>
        Finish <i class="fas fa-check" aria-hidden="true"></i>
      </button>
      <button type="button" class="skip-button" onclick={onSkip}>
        Skip all
      </button>
    </div>
  </div>

  <!-- 2x2 config grid -->
  <div class="config-grid">
    <!-- Section 1: Name (top-left) -->
    <div class="config-section name-section">
      <div class="section-header">
        <div class="section-icon name-icon">
          <i class="fas fa-user" aria-hidden="true"></i>
        </div>
        <h2 class="section-title">Your name</h2>
      </div>

      <input
        type="text"
        class="name-input"
        placeholder="Your name or nickname"
        bind:value={displayName}
        maxlength="50"
        autocomplete="name"
        spellcheck="false"
      />

      <div class="pronouns-area">
        <div class="pronouns-label">
          <span>{t("profile_pronouns_label")}</span>
          <span class="optional-tag">{t("profile_optional")}</span>
        </div>
        <div class="pronoun-chips" role="group" aria-label="Pronoun presets">
          {#each PRONOUN_PRESETS as preset}
            <button
              type="button"
              class="pronoun-chip"
              class:selected={pronouns.trim() === preset.key}
              onclick={() => selectPronounPreset(preset.key)}
            >
              {preset.label}
            </button>
          {/each}
        </div>
        <input
          type="text"
          class="pronouns-input"
          bind:value={pronouns}
          maxlength="50"
          placeholder={t("profile_pronouns_placeholder")}
          spellcheck="false"
        />
      </div>
    </div>

    <!-- Section 2: Background (top-right) -->
    <div class="config-section theme-section">
      <div class="section-header">
        <div class="section-icon theme-icon">
          <i class="fas fa-palette" aria-hidden="true"></i>
        </div>
        <h2 class="section-title">Background</h2>
      </div>

      <div
        class="themes-grid"
        bind:this={themeGridEl}
        role="radiogroup"
        aria-label="Choose background theme"
      >
        {#each animatedBackgrounds as bg}
          <background-card
            type={bg.type}
            selected={selectedTheme === bg.type ? "" : undefined}
          ></background-card>
        {/each}
      </div>

      <div class="minimalist-row">
        <span class="minimalist-label">Prefer something simpler?</span>
        <button
          class="minimalist-card"
          class:selected={selectedTheme === BackgroundType.VOID}
          onclick={() => handleThemeSelect(BackgroundType.VOID)}
          aria-pressed={selectedTheme === BackgroundType.VOID}
          aria-label="Select Pure Black minimalist theme"
        >
          <div class="minimalist-preview"></div>
          <span class="minimalist-name">Pure Black</span>
        </button>
      </div>
    </div>

    <!-- Section 3: Pictograph Mode (bottom-left) -->
    <div class="config-section mode-section">
      <div class="section-header">
        <div class="section-icon mode-icon">
          <i class="fas fa-lightbulb" aria-hidden="true"></i>
        </div>
        <h2 class="section-title">Pictograph style</h2>
      </div>

      <div class="mode-options">
        <button
          class="mode-card"
          class:selected={selectedMode === "light"}
          onclick={() => (selectedMode = "light")}
          aria-pressed={selectedMode === "light"}
        >
          <div class="preview-frame light-bg">
            <PictographContainer
              pictographData={examplePictographData}
              disableTransitions={true}
              darkMode={false}
            />
          </div>
          <span class="mode-label">Light</span>
          {#if selectedMode === "light"}
            <div class="selected-badge">
              <i class="fas fa-check" aria-hidden="true"></i>
            </div>
          {/if}
        </button>

        <button
          class="mode-card"
          class:selected={selectedMode === "dark"}
          onclick={() => (selectedMode = "dark")}
          aria-pressed={selectedMode === "dark"}
        >
          <div class="preview-frame dark-bg">
            <PictographContainer
              pictographData={examplePictographData}
              disableTransitions={true}
              darkMode={true}
            />
          </div>
          <span class="mode-label">Dark</span>
          {#if selectedMode === "dark"}
            <div class="selected-badge">
              <i class="fas fa-check" aria-hidden="true"></i>
            </div>
          {/if}
        </button>
      </div>
    </div>

    <!-- Section 4: Favorite Prop (bottom-right) -->
    <div class="config-section prop-section">
      <div class="section-header">
        <div class="section-icon prop-icon">
          <i class="fas fa-fire" aria-hidden="true"></i>
        </div>
        <h2 class="section-title">Favorite prop</h2>
      </div>

      <div class="props-grid">
        {#each FEATURED_PROPS as propType}
          {@const info = getPropTypeDisplayInfo(propType)}
          <button
            class="prop-card"
            class:selected={selectedProp === propType}
            onclick={() => (selectedProp = propType)}
            aria-pressed={selectedProp === propType}
            aria-label={`Select ${info.label}`}
          >
            <img
              src={info.image}
              alt={info.label}
              class="prop-image"
              loading="lazy"
            />
            <span class="prop-label">{info.label}</span>
            {#if selectedProp === propType}
              <div class="selected-badge">
                <i class="fas fa-check" aria-hidden="true"></i>
              </div>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Footer hint -->
  <p class="footer-hint">You can change any of these later in settings</p>
</div>

<style>
  .desktop-config-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 960px;
    width: 100%;
    padding: 28px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Header */
  .panel-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.9rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    flex-shrink: 0;
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  .panel-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    margin: 0;
    flex: 1;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .finish-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: color-mix(in srgb, #22c55e 40%, transparent);
    border: 2px solid color-mix(in srgb, #22c55e 60%, transparent);
    border-radius: 10px;
    color: white;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .finish-button:hover {
    background: color-mix(in srgb, #22c55e 50%, transparent);
    border-color: color-mix(in srgb, #22c55e 80%, transparent);
  }

  .finish-button:active {
    transform: scale(0.98);
  }

  .skip-button {
    padding: 8px 14px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.85rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .skip-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    border-color: rgba(255, 255, 255, 0.3);
  }

  /* 2x2 Grid */
  .config-grid {
    display: grid;
    grid-template-columns: 38fr 62fr;
    gap: 16px;
  }

  .config-section {
    padding: 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .name-icon {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .theme-icon {
    background: color-mix(in srgb, #a855f7 15%, transparent);
    color: #a855f7;
  }

  .mode-icon {
    background: color-mix(in srgb, #f59e0b 15%, transparent);
    color: #f59e0b;
  }

  .prop-icon {
    background: color-mix(in srgb, #f97316 15%, transparent);
    color: #f97316;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: white;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.8rem;
  }

  /* Name section */
  .name-input {
    width: 100%;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 500;
    transition: all var(--duration-normal) ease;
    box-sizing: border-box;
  }

  .name-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .name-input:focus {
    outline: none;
    border-color: var(--theme-accent, #a78bfa);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 8%, transparent);
  }

  .pronouns-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pronouns-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .optional-tag {
    font-size: 0.7rem;
    font-weight: 400;
    font-style: italic;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .pronoun-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .pronoun-chip {
    padding: 5px 12px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .pronoun-chip:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
    color: white;
  }

  .pronoun-chip.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 25%,
      transparent
    );
    border-color: var(--theme-accent-strong, #8b5cf6);
    color: var(--theme-accent, #a78bfa);
  }

  .pronouns-input {
    width: 100%;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: white;
    font-size: 0.85rem;
    transition: all var(--duration-normal) ease;
    box-sizing: border-box;
  }

  .pronouns-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .pronouns-input:focus {
    outline: none;
    border-color: var(--theme-accent, #a78bfa);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 8%, transparent);
  }

  /* Theme section */
  .themes-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .minimalist-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .minimalist-label {
    font-size: 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .minimalist-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
  }

  .minimalist-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .minimalist-card.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 20%,
      transparent
    );
    border-color: var(--theme-accent-strong, #8b5cf6);
  }

  .minimalist-preview {
    width: 24px;
    height: 16px;
    background: #000;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .minimalist-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  /* Mode section */
  .mode-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .mode-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px 10px 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
  }

  .mode-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-2px);
  }

  .mode-card.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    border-color: var(--theme-accent-strong, #8b5cf6);
  }

  .mode-card:active {
    transform: scale(0.98);
  }

  .preview-frame {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .light-bg {
    background: white;
  }

  .dark-bg {
    background: #0a0a0f;
  }

  .preview-frame :global(.pictograph) {
    width: 100%;
    height: 100%;
  }

  .mode-label {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--theme-text, white);
  }

  /* Prop section */
  .props-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .prop-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 4px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
    min-height: 80px;
  }

  .prop-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-2px);
  }

  .prop-card.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 20%,
      transparent
    );
    border-color: var(--theme-accent-strong, #8b5cf6);
  }

  .prop-card:active {
    transform: scale(0.97);
  }

  .prop-image {
    width: 40px;
    height: 40px;
    object-fit: contain;
    opacity: 0.85;
    filter: brightness(1.1);
  }

  .prop-card:hover .prop-image,
  .prop-card.selected .prop-image {
    opacity: 1;
  }

  .prop-label {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--theme-text, white);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Selected badge */
  .selected-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-accent-strong, #8b5cf6);
    border-radius: 50%;
    color: white;
    font-size: 0.6rem;
    animation: pop-in var(--duration-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes pop-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Footer */
  .footer-hint {
    text-align: center;
    font-size: 0.85rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .minimalist-card,
    .mode-card,
    .prop-card,
    .back-button,
    .finish-button,
    .skip-button,
    .pronoun-chip,
    .name-input,
    .pronouns-input {
      transition: none;
    }

    .mode-card:hover,
    .mode-card:active,
    .mode-card.selected,
    .prop-card:hover,
    .prop-card:active,
    .prop-card.selected,
    .finish-button:active {
      transform: none;
    }

    .selected-badge {
      animation: none;
    }
  }
</style>
