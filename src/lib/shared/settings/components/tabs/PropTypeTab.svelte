<!--
  PropTypeTab.svelte - Prop Type Selection

  Clean button-based interface with bottom sheet prop picker.
  Supports up to 6 presets for quick prop switching.
-->
<script lang="ts">
  import type { AppSettings, PropPreset } from "../../domain/AppSettings";
  import { resolve } from "../../../inversify/di";
  import { TYPES } from "../../../inversify/types";
  import { PropType } from "../../../pictograph/prop/domain/enums/PropType";
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import { onMount } from "svelte";
  import {
    getPropTypeDisplayInfo,
    hasVariations,
    getNextVariation,
  } from "./prop-type/PropTypeRegistry";
  import CatDogToggle from "./prop-type/CatDogToggle.svelte";
  import PropSelectionSheet from "./prop-type/PropSelectionSheet.svelte";
  import PropPresetBar from "./prop-type/PropPresetBar.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Entry animation
  let isVisible = $state(false);

  let { settings, onUpdate } = $props<{
    settings: AppSettings;
    onUpdate?: (event: { key: string; value: unknown }) => void;
  }>();

  // Services
  let hapticService: IHapticFeedback;

  onMount(async () => {
    hapticService = await resolve<IHapticFeedback>(TYPES.IHapticFeedback);
    setTimeout(() => (isVisible = true), 30);
  });

  // Current selections - initialized with defaults, synced from settings via $effect below
  let selectedBluePropType = $state(PropType.STAFF);
  let selectedRedPropType = $state(PropType.STAFF);

  // CatDog Mode
  let catDogMode = $state(false);
  let rememberedRedProp = $state<PropType | null>(null);

  // Sheet state
  let isSheetOpen = $state(false);
  let selectingHand = $state<"blue" | "red">("blue");

  // Preset state (fixed 3 slots)
  let propPresets = $state<PropPreset[]>([]);
  let selectedPresetIndex = $state(-1);

  // Sync from settings prop
  $effect(() => {
    selectedBluePropType =
      settings.bluePropType || settings.propType || PropType.STAFF;
    selectedRedPropType =
      settings.redPropType || settings.propType || PropType.STAFF;
    catDogMode = settings.catDogMode ?? false;
    propPresets = settings.propPresets || [];
    selectedPresetIndex = settings.selectedPresetIndex ?? -1;
  });

  // Watch for settings changes and sync internal state
  $effect(() => {
    const newBlueProp =
      settings.bluePropType || settings.propType || PropType.STAFF;
    const newRedProp =
      settings.redPropType || settings.propType || PropType.STAFF;
    const newCatDogMode = settings.catDogMode ?? false;

    if (newBlueProp !== selectedBluePropType) {
      selectedBluePropType = newBlueProp;
    }
    if (newRedProp !== selectedRedPropType) {
      selectedRedPropType = newRedProp;
    }
    if (newCatDogMode !== catDogMode) {
      catDogMode = newCatDogMode;
    }

    if (!catDogMode && selectedBluePropType !== selectedRedPropType) {
      selectedRedPropType = selectedBluePropType;
    }

    // Sync presets from settings
    const newPresets = settings.propPresets || [];
    if (JSON.stringify(newPresets) !== JSON.stringify(propPresets)) {
      propPresets = newPresets;
    }
    const newSelectedIndex = settings.selectedPresetIndex ?? -1;
    if (newSelectedIndex !== selectedPresetIndex) {
      selectedPresetIndex = newSelectedIndex;
    }
  });

  // Preset management functions
  function handleSelectPreset(index: number) {
    hapticService?.trigger("selection");

    const preset = propPresets[index];
    if (!preset) return; // Empty slot - do nothing on select

    selectedPresetIndex = index;
    selectedBluePropType = preset.bluePropType;
    selectedRedPropType = preset.redPropType;
    catDogMode = preset.catDogMode;
    blueBuugengFlipped = preset.blueBuugengFlipped ?? false;
    redBuugengFlipped = preset.redBuugengFlipped ?? false;

    // Update all settings at once
    onUpdate?.({ key: "selectedPresetIndex", value: index });
    onUpdate?.({ key: "bluePropType", value: preset.bluePropType });
    onUpdate?.({ key: "redPropType", value: preset.redPropType });
    onUpdate?.({ key: "catDogMode", value: preset.catDogMode });
    onUpdate?.({ key: "blueBuugengFlipped", value: blueBuugengFlipped });
    onUpdate?.({ key: "redBuugengFlipped", value: redBuugengFlipped });
  }

  function handleSaveToSlot(index: number) {
    hapticService?.trigger("selection");

    // Save current config to this slot
    const newPreset: PropPreset = {
      bluePropType: selectedBluePropType,
      redPropType: selectedRedPropType,
      catDogMode,
      blueBuugengFlipped,
      redBuugengFlipped,
    };

    // Ensure array is long enough
    const newPresets = [...propPresets];
    while (newPresets.length <= index) {
      newPresets.push(undefined as unknown as PropPreset);
    }
    newPresets[index] = newPreset;

    // Clean up undefined entries but keep structure
    const cleanedPresets = newPresets
      .map((p, i) => p || null)
      .filter((p): p is PropPreset => p !== null);

    propPresets = cleanedPresets;
    selectedPresetIndex = cleanedPresets.findIndex(
      (p) =>
        p.bluePropType === newPreset.bluePropType &&
        p.redPropType === newPreset.redPropType &&
        p.catDogMode === newPreset.catDogMode
    );

    onUpdate?.({ key: "propPresets", value: cleanedPresets });
    onUpdate?.({ key: "selectedPresetIndex", value: selectedPresetIndex });
  }

  function updateCurrentPreset() {
    // Update the currently selected preset with the current prop configuration
    if (selectedPresetIndex < 0 || selectedPresetIndex >= propPresets.length)
      return;

    const updatedPreset: PropPreset = {
      bluePropType: selectedBluePropType,
      redPropType: selectedRedPropType,
      catDogMode,
      blueBuugengFlipped,
      redBuugengFlipped,
    };

    const newPresets = [...propPresets];
    newPresets[selectedPresetIndex] = updatedPreset;
    propPresets = newPresets;

    onUpdate?.({ key: "propPresets", value: newPresets });
  }

  function toggleCatDogMode() {
    hapticService?.trigger("selection");
    const newCatDogMode = !catDogMode;

    if (newCatDogMode) {
      if (rememberedRedProp !== null) {
        selectedRedPropType = rememberedRedProp;
        onUpdate?.({ key: "redPropType", value: rememberedRedProp });
        rememberedRedProp = null;
      }
    } else {
      if (selectedRedPropType !== selectedBluePropType) {
        rememberedRedProp = selectedRedPropType;
      }
      selectedRedPropType = selectedBluePropType;
      onUpdate?.({ key: "redPropType", value: selectedBluePropType });
    }

    catDogMode = newCatDogMode;
    onUpdate?.({ key: "catDogMode", value: catDogMode });

    // Update preset if we have one selected
    updateCurrentPreset();
  }

  function handleChangeProp() {
    hapticService?.trigger("selection");
    selectingHand = "blue";
    isSheetOpen = true;
  }

  function handlePropSelect(propType: PropType) {
    if (selectingHand === "blue") {
      selectedBluePropType = propType;
      onUpdate?.({ key: "bluePropType", value: propType });
      if (!catDogMode) {
        selectedRedPropType = propType;
        onUpdate?.({ key: "redPropType", value: propType });
      }
      // In cat-dog mode, user clicks the red card directly to select red prop
      // No need for sequential selection flow
    } else {
      selectedRedPropType = propType;
      onUpdate?.({ key: "redPropType", value: propType });
    }

    // Update preset if we have one selected
    updateCurrentPreset();
  }

  function toggleVariation(hand: "blue" | "red") {
    hapticService?.trigger("selection");
    const currentProp =
      hand === "blue" ? selectedBluePropType : selectedRedPropType;

    if (!hasVariations(currentProp)) return;

    const newProp = getNextVariation(currentProp);
    if (!newProp) return;

    if (hand === "blue") {
      selectedBluePropType = newProp;
      onUpdate?.({ key: "bluePropType", value: newProp });
      if (!catDogMode) {
        selectedRedPropType = newProp;
        onUpdate?.({ key: "redPropType", value: newProp });
      }
    } else {
      selectedRedPropType = newProp;
      onUpdate?.({ key: "redPropType", value: newProp });
    }

    // Update preset if we have one selected
    updateCurrentPreset();
  }

  // Buugeng family - asymmetric props that can be flipped
  const BUUGENG_FAMILY = new Set([
    PropType.BUUGENG,
    PropType.BIGBUUGENG,
    PropType.FRACTALGENG,
  ]);

  // Buugeng flip state
  let blueBuugengFlipped = $state(false);
  let redBuugengFlipped = $state(false);

  // Sync buugeng flip state from settings
  $effect(() => {
    blueBuugengFlipped = settings.blueBuugengFlipped ?? false;
    redBuugengFlipped = settings.redBuugengFlipped ?? false;
  });

  function toggleBuugengFlip(hand: "blue" | "red") {
    hapticService?.trigger("selection");

    if (hand === "blue") {
      blueBuugengFlipped = !blueBuugengFlipped;
      onUpdate?.({ key: "blueBuugengFlipped", value: blueBuugengFlipped });
      // In single-prop mode, sync both hands
      if (!catDogMode) {
        redBuugengFlipped = blueBuugengFlipped;
        onUpdate?.({ key: "redBuugengFlipped", value: redBuugengFlipped });
      }
    } else {
      redBuugengFlipped = !redBuugengFlipped;
      onUpdate?.({ key: "redBuugengFlipped", value: redBuugengFlipped });
    }
  }

  // Display info
  const blueInfo = $derived(getPropTypeDisplayInfo(selectedBluePropType));
  const redInfo = $derived(getPropTypeDisplayInfo(selectedRedPropType));
  const blueHasVariations = $derived(hasVariations(selectedBluePropType));
  const redHasVariations = $derived(hasVariations(selectedRedPropType));
  const blueIsBuugeng = $derived(BUUGENG_FAMILY.has(selectedBluePropType));
  const redIsBuugeng = $derived(BUUGENG_FAMILY.has(selectedRedPropType));
</script>

<div class="prop-type-tab" class:visible={isVisible}>
  <section class="settings-panel">
    <header class="panel-header">
      <span class="panel-icon"
        ><i class="fas fa-wand-sparkles" aria-hidden="true"></i></span
      >
      <div class="panel-header-text">
        <h3 class="panel-title">{t("settings_prop_type")}</h3>
        <p class="panel-subtitle">{t("settings_prop_subtitle")}</p>
      </div>
    </header>

    <!-- Prop Presets -->
    <div class="presets-section">
      <h4 class="section-label">{t("settings_quick_presets")}</h4>
      <PropPresetBar
        presets={propPresets}
        selectedIndex={selectedPresetIndex}
        onSelectPreset={handleSelectPreset}
        onSaveToSlot={handleSaveToSlot}
      />
    </div>

    <!-- Cat Dog Toggle -->
    <div class="mode-section">
      <CatDogToggle {catDogMode} onToggle={toggleCatDogMode} />
      <p class="mode-hint">
        {catDogMode ? t("settings_different_props") : t("settings_same_props")}
      </p>
    </div>

    <!-- Current Selection Display -->
    {#if catDogMode}
      <!-- Two prop display -->
      <div class="prop-display dual">
        <button
          class="prop-card blue"
          onclick={() => {
            hapticService?.trigger("selection");
            selectingHand = "blue";
            isSheetOpen = true;
          }}
        >
          <span class="hand-label">
            <span class="hand-dot blue"></span>
            {t("settings_left_hand")}
          </span>
          <img
            src={blueInfo.image}
            alt={blueInfo.label}
            class="prop-icon"
            class:flipped={blueIsBuugeng && blueBuugengFlipped}
          />
          <span class="prop-name">{blueInfo.label}</span>
          {#if blueHasVariations}
            <span
              class="mini-variation-btn"
              onclick={(e) => {
                e.stopPropagation();
                toggleVariation("blue");
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleVariation("blue");
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Toggle variation"
            >
              <i class="fas fa-sync-alt" aria-hidden="true"></i>
            </span>
          {/if}
          {#if blueIsBuugeng}
            <span
              class="mini-flip-btn"
              class:active={blueBuugengFlipped}
              onclick={(e) => {
                e.stopPropagation();
                toggleBuugengFlip("blue");
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleBuugengFlip("blue");
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Flip buugeng"
              title="Flip buugeng (asymmetric prop)"
            >
              <i class="fas fa-arrows-left-right" aria-hidden="true"></i>
            </span>
          {/if}
        </button>
        <button
          class="prop-card red"
          onclick={() => {
            hapticService?.trigger("selection");
            selectingHand = "red";
            isSheetOpen = true;
          }}
        >
          <span class="hand-label">
            <span class="hand-dot red"></span>
            {t("settings_right_hand")}
          </span>
          <img
            src={redInfo.image}
            alt={redInfo.label}
            class="prop-icon"
            class:flipped={redIsBuugeng && redBuugengFlipped}
          />
          <span class="prop-name">{redInfo.label}</span>
          {#if redHasVariations}
            <span
              class="mini-variation-btn"
              onclick={(e) => {
                e.stopPropagation();
                toggleVariation("red");
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleVariation("red");
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Toggle variation"
            >
              <i class="fas fa-sync-alt" aria-hidden="true"></i>
            </span>
          {/if}
          {#if redIsBuugeng}
            <span
              class="mini-flip-btn"
              class:active={redBuugengFlipped}
              onclick={(e) => {
                e.stopPropagation();
                toggleBuugengFlip("red");
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleBuugengFlip("red");
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Flip buugeng"
              title="Flip buugeng (asymmetric prop)"
            >
              <i class="fas fa-arrows-left-right" aria-hidden="true"></i>
            </span>
          {/if}
        </button>
      </div>
    {:else}
      <!-- Single prop display -->
      <div class="prop-display single">
        <button class="prop-card" onclick={handleChangeProp}>
          <img
            src={blueInfo.image}
            alt={blueInfo.label}
            class="prop-icon"
            class:flipped={blueIsBuugeng && blueBuugengFlipped}
          />
          <span class="prop-name">{blueInfo.label}</span>
          {#if blueHasVariations}
            <span
              class="mini-variation-btn"
              onclick={(e) => {
                e.stopPropagation();
                toggleVariation("blue");
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleVariation("blue");
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Toggle variation"
            >
              <i class="fas fa-sync-alt" aria-hidden="true"></i>
            </span>
          {/if}
          {#if blueIsBuugeng}
            <span
              class="mini-flip-btn"
              class:active={blueBuugengFlipped}
              onclick={(e) => {
                e.stopPropagation();
                toggleBuugengFlip("blue");
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleBuugengFlip("blue");
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Flip buugeng"
              title="Flip buugeng (asymmetric prop)"
            >
              <i class="fas fa-arrows-left-right" aria-hidden="true"></i>
            </span>
          {/if}
        </button>
      </div>
    {/if}
  </section>
</div>

<!-- Prop Selection Sheet -->
<PropSelectionSheet
  bind:isOpen={isSheetOpen}
  selectedPropType={selectingHand === "blue"
    ? selectedBluePropType
    : selectedRedPropType}
  color={selectingHand}
  title={selectingHand === "blue"
    ? t("settings_select_left_prop")
    : t("settings_select_right_prop")}
  onSelect={handlePropSelect}
/>

<style>
  .prop-type-tab {
    container-type: size;
    container-name: prop-type-tab;
    display: flex;
    flex-direction: column;
    flex: 1;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: clamp(8px, 2cqi, 16px);
    gap: clamp(10px, 1.5cqi, 14px);
    height: 100%;
    min-height: 0;
    opacity: 0;
    transition: opacity 200ms ease;
  }

  .prop-type-tab.visible {
    opacity: 1;
  }

  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 2cqi, 20px);
    padding: clamp(16px, 2.5cqi, 24px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 20px;
    flex: 1;
    min-height: 0;
  }

  /* Panel Header */
  .panel-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .panel-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    font-size: var(--font-size-lg);
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 35%, transparent);
    color: var(--theme-accent);
  }

  .panel-header-text {
    flex: 1;
  }

  .panel-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 3px 0 0 0;
  }

  /* Mode Section */
  .mode-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mode-hint {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-style: italic;
  }

  /* Presets Section */
  .presets-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    margin: 0;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Prop Display */
  .prop-display {
    display: flex;
    gap: clamp(10px, 2cqi, 16px);
    flex: 1;
    min-height: 0;
    align-items: stretch;
  }

  .prop-display.single {
    justify-content: center;
  }

  .prop-card {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(10px, 2cqi, 14px);
    padding: clamp(16px, 2.5cqi, 24px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 16px;
    min-height: clamp(140px, 18cqi, 220px);
    height: 100%;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .prop-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-2px);
  }

  .prop-card:active {
    transform: translateY(0) scale(0.98);
  }

  .prop-card.blue {
    border-color: color-mix(in srgb, var(--prop-blue) 30%, transparent);
    background: color-mix(in srgb, var(--prop-blue) 8%, transparent);
  }

  .prop-card.blue:hover {
    border-color: color-mix(in srgb, var(--prop-blue) 50%, transparent);
    background: color-mix(in srgb, var(--prop-blue) 15%, transparent);
  }

  .prop-card.red {
    border-color: color-mix(in srgb, var(--prop-red) 30%, transparent);
    background: color-mix(in srgb, var(--prop-red) 8%, transparent);
  }

  .prop-card.red:hover {
    border-color: color-mix(in srgb, var(--prop-red) 50%, transparent);
    background: color-mix(in srgb, var(--prop-red) 15%, transparent);
  }

  .hand-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hand-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .hand-dot.blue {
    background: var(--prop-blue);
  }

  .hand-dot.red {
    background: var(--prop-red);
  }

  .prop-icon {
    width: clamp(90px, 20cqw, 160px);
    height: clamp(90px, 20cqw, 160px);
    object-fit: contain;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
  }

  /* Color-code prop icons based on hand */
  .prop-card.blue .prop-icon {
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3)) saturate(1.1);
  }

  .prop-card.red .prop-icon {
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3)) hue-rotate(125deg)
      saturate(1.2);
  }

  .prop-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
  }

  .mini-variation-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 36px;
    height: 36px;
    min-width: var(--min-touch-target, 48px);
    min-height: var(--min-touch-target, 48px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-compact);
    transition: all 0.2s ease;
  }

  .mini-variation-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-accent);
  }

  /* Flip button for asymmetric props (Buugeng) */
  .mini-flip-btn {
    position: absolute;
    top: 8px;
    left: 8px;
    width: 36px;
    height: 36px;
    min-width: var(--min-touch-target, 48px);
    min-height: var(--min-touch-target, 48px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-compact);
    transition: all 0.2s ease;
  }

  .mini-flip-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-accent);
  }

  .mini-flip-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  /* Flipped prop icon preview */
  .prop-icon.flipped {
    transform: scaleX(-1);
  }
</style>
