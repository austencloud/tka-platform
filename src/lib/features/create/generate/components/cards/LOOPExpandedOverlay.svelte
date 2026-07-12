<!--
LOOPExpandedOverlay.svelte - Expanded LOOP selection that covers the card grid
Animates forward in z-axis and expands to fill the container space
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import {
    generateLOOPType,
    canExtendCombo,
    buildLoopSpec,
  } from "$lib/shared/create/services/loop-type-utils";
  import { gateRhythm } from "$lib/shared/create/services/loop-rhythm-gating";
  import { blockSignatures } from "$lib/shared/create/services/loop-block-signatures";
  import { onMount } from "svelte";
  import {
    LOOP_COMPONENTS,
    LOOPComponent,
  } from "$lib/features/create/generate/shared/domain/constants/loop-components";
  import { generateExplanationText } from "$lib/features/create/generate/shared/services/loop-explanation-text-generator";
  import { LOOPType } from "../../circular/domain/models/circular-models";
  import LOOPComponentGrid from "../modals/LOOPComponentGrid.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import LoopBlockTimeline from "$lib/shared/components/LoopBlockTimeline.svelte";

  type RhythmValue = {
    rotationInterval: 2 | 4;
    inversionInterval: 2 | 4;
    inversionMode: "expand" | "overlay";
  };

  let {
    currentType,
    selectedComponents,
    onChange,
    onClose,
    onLoopDisable,
    layout = "grid",
    rhythm,
    sequenceLength,
    onRhythmChange,
  } = $props<{
    currentType: LOOPType;
    selectedComponents: Set<LOOPComponent>;
    onChange: (loopType: LOOPType) => void;
    onClose: () => void;
    onLoopDisable?: () => void;
    layout?: "grid" | "list";
    /** Current rhythm + context for the Rhythm tier. All optional — absent = tier hidden (legacy callers unaffected). */
    rhythm?: RhythmValue;
    sequenceLength?: number;
    onRhythmChange?: (updates: Partial<RhythmValue>) => void;
  }>();

  let hapticService: HapticFeedback | null = null;
  let isMultiSelectMode = $state(false);
  let localSelectedComponents = $state(new Set<LOOPComponent>());

  // Sync local state with prop changes
  $effect(() => {
    localSelectedComponents = new Set<LOOPComponent>(selectedComponents);
  });

  // Rhythm tier: LOCAL until Apply, synced from the prop the same way
  // localSelectedComponents is. Defaults only matter when `rhythm` is absent
  // (tier hidden — see `hasRhythmTier` below), so they're never shown.
  let localRhythm = $state<RhythmValue>({
    rotationInterval: 2,
    inversionInterval: 2,
    inversionMode: "expand",
  });
  let isRhythmOpen = $state(false);

  $effect(() => {
    if (rhythm) {
      localRhythm = { ...rhythm };
    }
  });

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Generate explanation text based on selected components
  const explanationText = $derived(
    generateExplanationText(localSelectedComponents)
  );

  // Does the current selection map to a real, generatable LOOP type?
  // (Intermediate states on the way to a bigger combo can be unmapped —
  // those disable Apply but keep compatible components selectable.)
  const isImplemented = $derived(
    generateLOOPType(localSelectedComponents) !== null
  );

  // Combo mode gating: a component is out of play when no implemented combo
  // contains it together with everything already selected. Selected
  // components always stay enabled so they can be deselected.
  const disabledComponents = $derived.by(() => {
    if (!isMultiSelectMode) return null;
    const disabled = new Set<LOOPComponent>();
    for (const info of LOOP_COMPONENTS) {
      const component = info.component as LOOPComponent;
      if (localSelectedComponents.has(component)) continue;
      if (!canExtendCombo(localSelectedComponents, component)) {
        disabled.add(component);
      }
    }
    return disabled;
  });

  // Derive selection count
  const selectionCount = $derived(localSelectedComponents.size);

  // ===== Rhythm tier (combo mode only; hidden entirely when `rhythm` is absent) =====
  const hasRhythmTier = $derived(!!rhythm);

  const hasRhythmKnobs = $derived(
    localSelectedComponents.has(LOOPComponent.ROTATED) ||
      localSelectedComponents.has(LOOPComponent.INVERTED)
  );

  // Wire-form spec for the CURRENT selection + rhythm — same helper the
  // generation orchestrator uses. Null when the combo isn't implemented
  // (mirrors `isImplemented`, single source of truth in loop-type-utils).
  const specWire = $derived(buildLoopSpec(localSelectedComponents, localRhythm));

  // Apply-gating + word-math data. Only computed once the spec is buildable
  // and the caller told us the target length — legacy callers (no
  // sequenceLength) skip this entirely and behave exactly as today.
  const rhythmGate = $derived.by(() => {
    if (sequenceLength === undefined || !specWire) return null;
    return gateRhythm(localSelectedComponents, localRhythm, sequenceLength);
  });

  const wordMathText = $derived.by(() => {
    const gate = rhythmGate;
    if (!gate) return null;
    if (!gate.ok) return gate.reason;
    const overlaySuffix =
      localSelectedComponents.has(LOOPComponent.INVERTED) &&
      localRhythm.inversionMode === "overlay"
        ? " · inversion on top"
        : "";
    return `${gate.seedLength} letters × ${gate.multiplier} = ${sequenceLength} beats${overlaySuffix}`;
  });

  const inversionCaption = $derived.by(() => {
    const { inversionInterval, inversionMode } = localRhythm;
    if (inversionMode === "overlay") {
      return inversionInterval === 4
        ? "Same hand positions — props flip spin direction every quarter."
        : "Same hand positions — props flip spin direction for the second half.";
    }
    return inversionInterval === 4
      ? "Inverted blocks are added, alternating every quarter."
      : "The inverted half is added to the sequence.";
  });

  // Button text for combo mode
  const buttonText = $derived.by(() => {
    if (selectionCount === 0) return "Select Components";
    if (!isImplemented) return "Combo Not Supported";
    if (selectionCount === 1) {
      const component = Array.from(localSelectedComponents)[0] as LOOPComponent;
      const formatted = component.charAt(0) + component.slice(1).toLowerCase();
      return `Apply ${formatted}`;
    }
    return `Apply ${selectionCount}-Component Combo`;
  });

  function handleToggle(component: LOOPComponent) {
    hapticService?.trigger("selection");

    // Single-select mode: Apply immediately
    if (!isMultiSelectMode) {
      localSelectedComponents = new Set([component]);
      applyAndClose();
      return;
    }

    // Multi-select mode: Toggle selection
    const newSet = new Set(localSelectedComponents);
    if (newSet.has(component)) {
      newSet.delete(component);
    } else {
      newSet.add(component);
    }
    localSelectedComponents = newSet;
  }

  function handleModeChange(isMulti: boolean) {
    hapticService?.trigger("selection");
    isMultiSelectMode = isMulti;
  }

  function updateRhythm(updates: Partial<RhythmValue>) {
    hapticService?.trigger("selection");
    localRhythm = { ...localRhythm, ...updates };
  }

  function toggleRhythmOpen() {
    hapticService?.trigger("selection");
    isRhythmOpen = !isRhythmOpen;
  }

  function applyAndClose() {
    if (selectionCount === 0) return;

    const newLoopType = generateLOOPType(localSelectedComponents);
    if (newLoopType === null) return; // unmapped combo — Apply is disabled anyway

    // Rhythm changes are LOCAL until Apply — fire the diff BEFORE onChange so
    // the config-mapper reads both the new rhythm and the new loop type on
    // the next generate.
    if (rhythm && onRhythmChange) {
      const diff: Partial<RhythmValue> = {};
      if (localRhythm.rotationInterval !== rhythm.rotationInterval) {
        diff.rotationInterval = localRhythm.rotationInterval;
      }
      if (localRhythm.inversionInterval !== rhythm.inversionInterval) {
        diff.inversionInterval = localRhythm.inversionInterval;
      }
      if (localRhythm.inversionMode !== rhythm.inversionMode) {
        diff.inversionMode = localRhythm.inversionMode;
      }
      if (Object.keys(diff).length > 0) {
        onRhythmChange(diff);
      }
    }

    onChange(newLoopType);
    onClose();
  }

  function handleConfirm() {
    if (selectionCount === 0 || !isImplemented) return;
    if (rhythmGate && !rhythmGate.ok) return;
    hapticService?.trigger("selection");
    applyAndClose();
  }

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }

  function handleDisableLoop() {
    hapticService?.trigger("selection");
    onLoopDisable?.();
  }
</script>

<div
  class="loop-expanded-overlay"
  transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}
>
  <!-- Header with title, disable toggle, and close button -->
  <div class="overlay-header">
    <h3 class="overlay-title">Select LOOP Type</h3>
    <div class="header-actions">
      {#if onLoopDisable}
        <button
          class="disable-button"
          onclick={handleDisableLoop}
          aria-label="Turn off LOOP"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
          <span>Off</span>
        </button>
      {/if}
      <button
        class="close-button"
        onclick={handleClose}
        aria-label="Close LOOP selection"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>

  <!-- Mode selector (shared SegmentedControl per chip-primitives rule) -->
  <SegmentedControl
    options={[
      { value: "single", label: "Single" },
      { value: "combo", label: "Combo" },
    ]}
    value={isMultiSelectMode ? "combo" : "single"}
    onchange={(v) => handleModeChange(v === "combo")}
    size="sm"
    color="accent"
  />

  <!-- Component grid -->
  <div class="grid-container">
    <LOOPComponentGrid
      selectedComponents={localSelectedComponents}
      {disabledComponents}
      {isMultiSelectMode}
      {layout}
      onToggleComponent={handleToggle}
    />
  </div>

  <!-- Explanation panel (combo mode only) -->
  {#if isMultiSelectMode}
    <!-- Rhythm tier: collapsed disclosure for rotation/inversion interval + mode.
         Hidden entirely when the caller didn't pass `rhythm` (legacy callers). -->
    {#if hasRhythmTier && hasRhythmKnobs}
      <div class="rhythm-tier">
        <button
          class="rhythm-disclosure"
          type="button"
          onclick={toggleRhythmOpen}
          aria-expanded={isRhythmOpen}
        >
          <span>Rhythm</span>
          <i class="fas fa-chevron-{isRhythmOpen ? 'up' : 'down'}" aria-hidden="true"></i>
        </button>

        {#if isRhythmOpen}
          <div class="rhythm-rows">
            {#if localSelectedComponents.has(LOOPComponent.ROTATED)}
              <div class="rhythm-row">
                <span class="rhythm-label">Rotation</span>
                <SegmentedControl
                  options={[
                    { value: "2", label: "Half turns" },
                    { value: "4", label: "Quarter turns" },
                  ]}
                  value={String(localRhythm.rotationInterval)}
                  onchange={(v) =>
                    updateRhythm({ rotationInterval: v === "4" ? 4 : 2 })}
                  size="sm"
                  color="accent"
                />
              </div>
            {/if}

            {#if localSelectedComponents.has(LOOPComponent.INVERTED)}
              <div class="rhythm-row">
                <span class="rhythm-label">Inversion</span>
                <SegmentedControl
                  options={[
                    { value: "2", label: "At the half" },
                    { value: "4", label: "Every quarter" },
                  ]}
                  value={String(localRhythm.inversionInterval)}
                  onchange={(v) =>
                    updateRhythm({ inversionInterval: v === "4" ? 4 : 2 })}
                  size="sm"
                  color="accent"
                />
              </div>
              <div class="rhythm-row">
                <SegmentedControl
                  options={[
                    { value: "expand", label: "Adds length" },
                    { value: "overlay", label: "On top" },
                  ]}
                  value={localRhythm.inversionMode}
                  onchange={(v) => updateRhythm({ inversionMode: v })}
                  size="sm"
                  color="accent"
                />
              </div>
              <div class="rhythm-caption">
                <span class="caption-sizer" aria-hidden="true"
                  >Same hand positions — props flip spin direction for the second half.</span
                >
                <span class="caption-live">{inversionCaption}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Word-math line: always visible in combo mode once a spec is buildable
         and the caller told us the target length. -->
    {#if wordMathText}
      <div class="word-math">
        <span class="word-math-sizer" aria-hidden="true"
          >Too short — a one-beat seed has nothing for inversion to flip</span
        >
        <span class="word-math-live">{wordMathText}</span>
      </div>
    {/if}

    <!-- Block timeline: the novice bridge, shown whenever the spec is buildable. -->
    {#if specWire}
      <LoopBlockTimeline model={blockSignatures(specWire)} />
    {/if}

    <div class="explanation-section">
      <p class="explanation-text">{explanationText}</p>
      {#if !isImplemented && selectionCount > 0}
        <div class="coming-soon-badge">
          No LOOP type matches this exact combination — add or remove a component
        </div>
      {:else if rhythmGate && !rhythmGate.ok}
        <div class="coming-soon-badge">{rhythmGate.reason}</div>
      {/if}
    </div>

    <!-- Apply button -->
    <button
      class="apply-button"
      class:disabled={selectionCount === 0 || !isImplemented || (rhythmGate !== null && !rhythmGate.ok)}
      onclick={handleConfirm}
      disabled={selectionCount === 0 || !isImplemented || (rhythmGate !== null && !rhythmGate.ok)}
    >
      {buttonText}
    </button>
  {/if}
</div>

<style>
  .loop-expanded-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;

    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;

    /* Solid background matching the card theme */
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 25%, #1a1a2e) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 15%, #1a1a2e) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 20%, #1a1a2e) 100%
    );
    border-radius: 16px;
    border: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 24px color-mix(in srgb, var(--theme-accent) 30%, transparent);

    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
  }

  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .disable-button {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    padding: 8px 12px;
    height: var(--min-touch-target);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    font-family: inherit;
    transition: all var(--duration-normal) ease;
  }

  .disable-button:hover {
    background: rgba(255, 100, 100, 0.15);
    border-color: rgba(255, 100, 100, 0.3);
    color: var(--theme-text, white);
  }

  .disable-button svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .overlay-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-text, white);
    letter-spacing: 0.3px;
  }

  .close-button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    color: var(--theme-text, white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    transition: all var(--duration-normal) ease;
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .close-button svg {
    width: 20px;
    height: 20px;
  }

  .grid-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .explanation-section {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .explanation-text {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.4;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  .coming-soon-badge {
    background: color-mix(in srgb, var(--semantic-warning) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-warning) 50%, transparent);
    border-radius: 6px;
    padding: 6px 10px;
    color: var(--semantic-warning);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-align: center;
  }

  /* ===== Rhythm tier ===== */

  .rhythm-tier {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rhythm-disclosure {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .rhythm-disclosure:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  .rhythm-rows {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 2px 2px 0;
  }

  .rhythm-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rhythm-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  /* Ghost-sizer: ONE cell reserves the longest possible caption so switching
     rhythm knobs never shifts the block timeline / apply button below it. */
  .rhythm-caption {
    display: grid;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }

  .caption-sizer,
  .caption-live {
    grid-area: 1 / 1;
  }

  .caption-sizer {
    visibility: hidden;
  }

  /* Ghost-sizer: same technique for the word-math line — its longest variant
     (the "too short" gate reason) reserves the height up front. */
  .word-math {
    display: grid;
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
    color: var(--theme-text, white);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .word-math-sizer,
  .word-math-live {
    grid-area: 1 / 1;
  }

  .word-math-sizer {
    visibility: hidden;
  }

  .apply-button {
    flex-shrink: 0;
    width: 100%;
    padding: 12px 20px;
    min-height: var(--min-touch-target);

    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border: 2px solid var(--theme-accent);
    border-radius: 10px;
    color: var(--theme-text, white);

    font-size: var(--font-size-base, 16px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .apply-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent) 45%, transparent);
    transform: translateY(-1px);
  }

  .apply-button:disabled,
  .apply-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .apply-button,
    .close-button,
    .disable-button,
    .rhythm-disclosure {
      transition: none;
    }
  }
</style>
