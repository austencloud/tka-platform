<!--
  PropTypeTab.svelte - Prop Type Selection

  Clean rewrite with:
  - 10 preset slots in 5x2 grid
  - Simple media query for desktop side-by-side layout
  - Inline prop grid on desktop (700px+)
  - Keyboard shortcuts (1-9, 0) for presets
-->
<script lang="ts">
  import type { AppSettings, PropPreset } from "../../domain/AppSettings";
  import { container } from "$lib/shared/di";
  import { PropType } from "../../../pictograph/prop/domain/enums/PropType";
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import type { IDeviceDetector } from "../../../device/services/contracts/IDeviceDetector";
  import { onMount, onDestroy } from "svelte";
  import {
    hasVariations,
    getNextVariation,
  } from "./prop-type/PropTypeRegistry";
  import CatDogToggle from "./prop-type/CatDogToggle.svelte";
  import PropSelectionSheet from "./prop-type/PropSelectionSheet.svelte";
  import PresetChipBar from "./prop-type/PresetChipBar.svelte";
  import CompactPropDisplay from "./prop-type/CompactPropDisplay.svelte";
  import InlinePropGrid from "./prop-type/InlinePropGrid.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  const PRESET_COUNT = 10;

  let { settings, onUpdate } = $props<{
    settings: AppSettings;
    onUpdate?: (event: { key: string; value: unknown }) => void;
  }>();

  // Services
  let hapticService: IHapticFeedback;
  let deviceDetector: IDeviceDetector | null = null;

  // Device detection
  let hasKeyboard = $state(false);

  // Current selections
  let selectedBluePropType = $state(PropType.STAFF);
  let selectedRedPropType = $state(PropType.STAFF);

  // CatDog Mode
  let catDogMode = $state(false);
  let rememberedRedProp = $state<PropType | null>(null);

  // Sheet state (mobile)
  let isSheetOpen = $state(false);
  let selectingHand = $state<"blue" | "red">("blue");

  // Preset state
  let propPresets = $state<(PropPreset | null)[]>([]);
  let selectedPresetIndex = $state(-1);

  // Buugeng flip state
  let blueBuugengFlipped = $state(false);
  let redBuugengFlipped = $state(false);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    deviceDetector = container.items.deviceDetector as IDeviceDetector;

    updateDeviceCapabilities();
    const cleanup = deviceDetector?.onCapabilitiesChanged(() => {
      updateDeviceCapabilities();
    });

    window.addEventListener("keydown", handleKeydown);

    return () => {
      cleanup?.();
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
  });

  function updateDeviceCapabilities() {
    if (!deviceDetector) return;
    const caps = deviceDetector.getCapabilities();
    hasKeyboard = caps.inputMethod !== "touch";
  }

  // Sync from settings
  $effect(() => {
    selectedBluePropType =
      settings.bluePropType || settings.propType || PropType.STAFF;
    selectedRedPropType =
      settings.redPropType || settings.propType || PropType.STAFF;
    catDogMode = settings.catDogMode ?? false;
    blueBuugengFlipped = settings.blueBuugengFlipped ?? false;
    redBuugengFlipped = settings.redBuugengFlipped ?? false;

    const existingPresets = settings.propPresets || [];
    propPresets = Array.from(
      { length: PRESET_COUNT },
      (_, i) => existingPresets[i] || null
    );
    selectedPresetIndex = settings.selectedPresetIndex ?? -1;
  });

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const key = e.key;
    let presetIndex = -1;

    if (key >= "1" && key <= "9") {
      presetIndex = parseInt(key, 10) - 1;
    } else if (key === "0") {
      presetIndex = 9;
    }

    if (presetIndex >= 0 && presetIndex < PRESET_COUNT) {
      e.preventDefault();
      const preset = propPresets[presetIndex];
      if (preset) {
        handleSelectPreset(presetIndex);
      } else {
        handleSaveToSlot(presetIndex);
      }
    }
  }

  // Preset management
  function handleSelectPreset(index: number) {
    hapticService?.trigger("selection");

    const preset = propPresets[index];
    if (!preset) return;

    selectedPresetIndex = index;
    selectedBluePropType = preset.bluePropType;
    selectedRedPropType = preset.redPropType;
    catDogMode = preset.catDogMode;
    blueBuugengFlipped = preset.blueBuugengFlipped ?? false;
    redBuugengFlipped = preset.redBuugengFlipped ?? false;

    onUpdate?.({ key: "selectedPresetIndex", value: index });
    onUpdate?.({ key: "bluePropType", value: preset.bluePropType });
    onUpdate?.({ key: "redPropType", value: preset.redPropType });
    onUpdate?.({ key: "catDogMode", value: preset.catDogMode });
    onUpdate?.({ key: "blueBuugengFlipped", value: blueBuugengFlipped });
    onUpdate?.({ key: "redBuugengFlipped", value: redBuugengFlipped });
  }

  function handleSaveToSlot(index: number) {
    hapticService?.trigger("selection");

    const newPreset: PropPreset = {
      bluePropType: selectedBluePropType,
      redPropType: selectedRedPropType,
      catDogMode,
      blueBuugengFlipped,
      redBuugengFlipped,
    };

    const newPresets = [...propPresets];
    newPresets[index] = newPreset;
    propPresets = newPresets;
    selectedPresetIndex = index;

    const presetsToStore = newPresets.filter((p): p is PropPreset => p !== null);
    onUpdate?.({ key: "propPresets", value: presetsToStore });
    onUpdate?.({ key: "selectedPresetIndex", value: index });
  }

  function handleClearSlot(index: number) {
    hapticService?.trigger("selection");

    const newPresets = [...propPresets];
    newPresets[index] = null;
    propPresets = newPresets;

    if (selectedPresetIndex === index) {
      selectedPresetIndex = -1;
      onUpdate?.({ key: "selectedPresetIndex", value: -1 });
    }

    const presetsToStore = newPresets.filter((p): p is PropPreset => p !== null);
    onUpdate?.({ key: "propPresets", value: presetsToStore });
  }

  function updateCurrentPreset() {
    if (selectedPresetIndex < 0 || !propPresets[selectedPresetIndex]) return;

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

    const presetsToStore = newPresets.filter((p): p is PropPreset => p !== null);
    onUpdate?.({ key: "propPresets", value: presetsToStore });
  }

  // CatDog mode
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
    updateCurrentPreset();
  }

  // Prop selection (mobile sheet)
  function handleOpenSheet(hand: "blue" | "red") {
    hapticService?.trigger("selection");
    selectingHand = hand;
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
    } else {
      selectedRedPropType = propType;
      onUpdate?.({ key: "redPropType", value: propType });
    }
    updateCurrentPreset();
  }

  // Inline selection (desktop)
  function handleInlineSelect(propType: PropType) {
    hapticService?.trigger("selection");
    selectedBluePropType = propType;
    onUpdate?.({ key: "bluePropType", value: propType });
    if (!catDogMode) {
      selectedRedPropType = propType;
      onUpdate?.({ key: "redPropType", value: propType });
    }
    updateCurrentPreset();
  }

  function handleInlineSelectRed(propType: PropType) {
    hapticService?.trigger("selection");
    selectedRedPropType = propType;
    onUpdate?.({ key: "redPropType", value: propType });
    updateCurrentPreset();
  }

  // Variation/flip
  function handleToggleVariation(hand: "blue" | "red") {
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
    updateCurrentPreset();
  }

  function handleToggleFlip(hand: "blue" | "red") {
    hapticService?.trigger("selection");

    if (hand === "blue") {
      blueBuugengFlipped = !blueBuugengFlipped;
      onUpdate?.({ key: "blueBuugengFlipped", value: blueBuugengFlipped });
      if (!catDogMode) {
        redBuugengFlipped = blueBuugengFlipped;
        onUpdate?.({ key: "redBuugengFlipped", value: redBuugengFlipped });
      }
    } else {
      redBuugengFlipped = !redBuugengFlipped;
      onUpdate?.({ key: "redBuugengFlipped", value: redBuugengFlipped });
    }
    updateCurrentPreset();
  }
</script>

<div class="prop-type-tab">
  <!-- Left: Controls -->
  <section class="controls-panel">
    <header class="panel-header">
      <span class="panel-icon">
        <i class="fas fa-wand-sparkles" aria-hidden="true"></i>
      </span>
      <div class="panel-header-text">
        <h3 class="panel-title">{t("settings_prop_type")}</h3>
        <p class="panel-subtitle">{t("settings_prop_subtitle")}</p>
      </div>
    </header>

    <!-- Presets -->
    <div class="section">
      <h4 class="section-label">{t("settings_quick_presets")}</h4>
      <PresetChipBar
        presets={propPresets}
        selectedIndex={selectedPresetIndex}
        showKeyboardBadges={hasKeyboard}
        onSelectPreset={handleSelectPreset}
        onSaveToSlot={handleSaveToSlot}
        onClearSlot={handleClearSlot}
      />
    </div>

    <!-- CatDog Toggle -->
    <div class="mode-row">
      <CatDogToggle {catDogMode} onToggle={toggleCatDogMode} />
      <span class="mode-hint">
        {catDogMode ? t("settings_different_props") : t("settings_same_props")}
      </span>
    </div>

    <!-- Compact Prop Display -->
    <div class="prop-display">
      <CompactPropDisplay
        bluePropType={selectedBluePropType}
        redPropType={selectedRedPropType}
        {catDogMode}
        {blueBuugengFlipped}
        {redBuugengFlipped}
        onOpenSheet={handleOpenSheet}
        onToggleVariation={handleToggleVariation}
        onToggleFlip={handleToggleFlip}
      />
    </div>
  </section>

  <!-- Right: Inline Prop Grid (desktop only, via CSS) -->
  <section class="selection-panel">
    {#if catDogMode}
      <div class="dual-grids">
        <InlinePropGrid
          selectedPropType={selectedBluePropType}
          color="blue"
          title={t("settings_select_left_prop")}
          onSelect={handleInlineSelect}
        />
        <InlinePropGrid
          selectedPropType={selectedRedPropType}
          color="red"
          title={t("settings_select_right_prop")}
          onSelect={handleInlineSelectRed}
        />
      </div>
    {:else}
      <InlinePropGrid
        selectedPropType={selectedBluePropType}
        color="blue"
        title="Select Prop"
        onSelect={handleInlineSelect}
      />
    {/if}
  </section>
</div>

<!-- Mobile Sheet -->
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
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 16px;
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  /* Desktop: side by side, stretch to fill height */
  @media (min-width: 900px) {
    .prop-type-tab {
      flex-direction: row;
      align-items: stretch;
      overflow: hidden;
    }
  }

  /* Controls Panel - uses container queries for responsive sizing */
  .controls-panel {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqi, 20px);
    padding: clamp(12px, 3cqi, 20px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
    container-type: inline-size;
    container-name: controls-panel;
  }

  @media (min-width: 900px) {
    .controls-panel {
      flex: 0 0 clamp(360px, 25vw, 480px);
      min-height: 0;
      overflow-y: auto;
    }
  }

  /* Selection Panel - hidden on mobile, shown on desktop */
  .selection-panel {
    display: none;
  }

  @media (min-width: 900px) {
    .selection-panel {
      display: flex;
      flex: 1;
      min-width: 0;
      height: 100%;
    }
  }

  .dual-grids {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    height: 100%;
  }

  @media (min-width: 1200px) {
    .dual-grids {
      flex-direction: row;
    }

    .dual-grids > :global(*) {
      flex: 1;
      min-width: 0;
    }
  }

  /* Header */
  .panel-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .panel-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    font-size: 18px;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 35%, transparent);
    color: var(--theme-accent);
  }

  .panel-header-text {
    flex: 1;
  }

  .panel-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 13px;
    color: var(--theme-text-dim);
    margin: 4px 0 0 0;
  }

  /* Section */
  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Presets section grows to fill available space on desktop */
  @media (min-width: 900px) {
    .section {
      flex: 1;
      min-height: 0;
    }
  }

  .section-label {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Mode Row */
  .mode-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mode-hint {
    font-size: 13px;
    color: var(--theme-text-dim);
    font-style: italic;
  }

  /* Prop Display - at bottom on mobile, natural position on desktop */
  .prop-display {
    margin-top: auto;
  }

  @media (min-width: 900px) {
    .prop-display {
      margin-top: auto;
    }
  }

</style>
