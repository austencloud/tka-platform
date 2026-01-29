<!--
SpellSettingsBar.svelte - 2026 Premium Settings UI

State-of-the-art interaction patterns:
- Spring physics for natural, interruptible animations
- Gesture-driven expansion (drag to expand/collapse)
- Shared element morphing for label transitions
- Micro-interactions with selection feedback
- Haptic choreography synced to animation keyframes
- Graceful interruption handling

Container-aware responsive design:
- Mobile (<700px height): Gesture-enabled expanding chips
- Desktop (≥700px height): Expanded sections with all options visible
-->
<script lang="ts">
  import { spring } from "svelte/motion";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { SpellPreferences } from "../domain/models/spell-models";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  let {
    gridMode,
    preferences,
    onGridModeChange,
    onPreferenceChange,
  }: {
    gridMode: GridMode;
    preferences: SpellPreferences;
    onGridModeChange: (mode: GridMode) => void;
    onPreferenceChange: <K extends keyof SpellPreferences>(
      key: K,
      value: SpellPreferences[K]
    ) => void;
  } = $props();

  const haptic = container.items.hapticFeedback as IHapticFeedback;

  // ============================================================
  // SPRING PHYSICS SYSTEM
  // ============================================================

  // Spring configs for different interaction types
  const SPRING_CONFIGS = {
    // Snappy for direct responses
    snappy: { stiffness: 0.3, damping: 0.8 },
    // Bouncy for playful feedback
    bouncy: { stiffness: 0.2, damping: 0.6 },
    // Gentle for ambient motion
    gentle: { stiffness: 0.1, damping: 0.9 },
  };

  // Expansion progress (0 = collapsed, 1 = expanded)
  const expansionSpring = spring(0, SPRING_CONFIGS.snappy);

  // Which setting is being expanded/was expanded
  let expandedId = $state<string | null>(null);
  let previousExpandedId = $state<string | null>(null);

  // Selection feedback springs (one per option button)
  const selectionPulse = spring(1, SPRING_CONFIGS.bouncy);
  let lastSelectedIndex = $state<number | null>(null);

  // ============================================================
  // GESTURE SYSTEM
  // ============================================================

  let isDragging = $state(false);
  let dragStartY = $state(0);
  let dragCurrentY = $state(0);
  let dragChipId = $state<string | null>(null);

  // Velocity tracking for momentum
  let lastDragTime = $state(0);
  let lastDragY = $state(0);
  let dragVelocity = $state(0);

  const DRAG_THRESHOLD = 20; // px to start recognizing as drag
  const EXPAND_THRESHOLD = 0.4; // 40% drag = commit to expand
  const VELOCITY_THRESHOLD = 0.5; // px/ms for momentum-based decision

  // ============================================================
  // SETTING DEFINITIONS
  // ============================================================

  const settings = [
    {
      id: "dashes",
      label: "Dashes",
      expandedLabel: "Dashes",
      getValue: () => {
        if (preferences.motionTypeFilter === "no-dash") return "Low";
        if (preferences.motionTypeFilter === "prefer-dash") return "High";
        return "Mixed";
      },
      options: [
        { value: "no-dash", label: "Low" },
        { value: null, label: "Mixed" },
        { value: "prefer-dash", label: "High" },
      ],
      isSelected: (v: unknown) => preferences.motionTypeFilter === v,
      onSelect: (v: string | null) =>
        onPreferenceChange("motionTypeFilter", v as SpellPreferences["motionTypeFilter"]),
    },
    {
      id: "props",
      label: "Props",
      expandedLabel: "Prop Reversals",
      getValue: () => {
        if (preferences.constraintPreset === "smooth") return "Smooth";
        if (preferences.constraintPreset === "high-reversal") return "High";
        return "Mixed";
      },
      options: [
        { value: "smooth", label: "Smooth" },
        { value: "mixed", label: "Mixed" },
        { value: "high-reversal", label: "High" },
      ],
      isSelected: (v: unknown) => preferences.constraintPreset === v,
      onSelect: (v: string) => onPreferenceChange("constraintPreset", v as SpellPreferences["constraintPreset"]),
    },
    {
      id: "hands",
      label: "Hands",
      expandedLabel: "Hand Reversals",
      getValue: () => {
        if (preferences.handPathMode === "smooth") return "Smooth";
        if (preferences.handPathMode === "high") return "High";
        return "Mixed";
      },
      options: [
        { value: "smooth", label: "Smooth" },
        { value: "mixed", label: "Mixed" },
        { value: "high", label: "High" },
      ],
      isSelected: (v: unknown) => preferences.handPathMode === v,
      onSelect: (v: string) =>
        onPreferenceChange("handPathMode", v as SpellPreferences["handPathMode"]),
    },
  ];

  // ============================================================
  // GESTURE HANDLERS
  // ============================================================

  // Simple approach: click for taps, pointer events only for drag detection

  function handleChipClick(settingId: string) {
    // If we were dragging, don't also trigger click
    if (isDragging) return;

    haptic.trigger("selection");

    if (expandedId === settingId) {
      collapseChip();
    } else {
      expandChip(settingId);
    }
  }

  function handlePointerDown(e: PointerEvent, settingId: string) {
    if (e.button !== 0) return;

    dragStartY = e.clientY;
    dragChipId = settingId;
    lastDragTime = e.timeStamp;
    lastDragY = e.clientY;
    dragVelocity = 0;
    isDragging = false;
  }

  function handlePointerMove(e: PointerEvent) {
    if (dragChipId === null) return;

    const deltaY = e.clientY - dragStartY;

    // Start drag mode after threshold
    if (!isDragging && Math.abs(deltaY) > DRAG_THRESHOLD) {
      isDragging = true;
      haptic.trigger("selection");
    }

    if (isDragging) {
      // Calculate velocity
      const dt = e.timeStamp - lastDragTime;
      if (dt > 0) {
        dragVelocity = (e.clientY - lastDragY) / dt;
      }
      lastDragTime = e.timeStamp;
      lastDragY = e.clientY;

      // Update spring based on drag progress (downward = expand)
      const dragProgress = Math.min(1, Math.max(0, deltaY / 100));

      // If already expanded, invert (upward = collapse)
      if (expandedId === dragChipId) {
        expansionSpring.set(1 - Math.min(1, Math.max(0, -deltaY / 100)), { hard: true });
      } else {
        expansionSpring.set(dragProgress, { hard: true });
      }
    }
  }

  function handlePointerUp() {
    if (dragChipId === null) return;

    const settingId = dragChipId;

    if (isDragging) {
      // Momentum-based decision for drag gestures
      const shouldExpand = expandedId !== settingId
        ? (dragVelocity > VELOCITY_THRESHOLD || $expansionSpring > EXPAND_THRESHOLD)
        : (dragVelocity < -VELOCITY_THRESHOLD || $expansionSpring < (1 - EXPAND_THRESHOLD));

      if (shouldExpand && expandedId !== settingId) {
        expandChip(settingId);
      } else if (!shouldExpand && expandedId === settingId) {
        collapseChip();
      } else {
        // Snap back
        expansionSpring.set(expandedId === settingId ? 1 : 0);
      }
    }
    // Note: tap handling is done by click event, not here

    // Reset drag state
    dragChipId = null;
    dragVelocity = 0;

    // Reset isDragging after a microtask so click handler can check it
    setTimeout(() => { isDragging = false; }, 0);
  }

  // ============================================================
  // EXPANSION/COLLAPSE WITH SPRING PHYSICS
  // ============================================================

  function expandChip(settingId: string) {
    previousExpandedId = expandedId;
    expandedId = settingId;
    expansionSpring.set(1);

    // Haptic at expansion complete (synced to spring)
    setTimeout(() => haptic.trigger("impact"), 150);
  }

  function collapseChip() {
    previousExpandedId = expandedId;
    expandedId = null;
    expansionSpring.set(0);

    haptic.trigger("selection");
  }

  function handleCollapse() {
    collapseChip();
  }

  // ============================================================
  // SELECTION WITH MICRO-INTERACTIONS
  // ============================================================

  function handleSelect(setting: (typeof settings)[0], value: unknown, index: number) {
    // Trigger selection pulse
    lastSelectedIndex = index;
    selectionPulse.set(1.15);
    setTimeout(() => selectionPulse.set(1), 50);

    // Haptic feedback
    haptic.trigger("impact");

    // Apply selection
    setting.onSelect(value as never);

    // Delay collapse for visual feedback
    setTimeout(() => {
      collapseChip();
      // Second haptic on collapse complete
      setTimeout(() => haptic.trigger("selection"), 150);
    }, 200);
  }

  // ============================================================
  // TOGGLE HANDLERS
  // ============================================================

  function toggleLoop() {
    haptic.trigger("impact");
    onPreferenceChange("makeCircular", !preferences.makeCircular);
  }

  function toggleGridMode() {
    haptic.trigger("impact");
    const newMode = gridMode === "diamond" ? "box" : "diamond";
    onGridModeChange(newMode as GridMode);
  }

  // ============================================================
  // COMPUTED STYLES FROM SPRINGS
  // ============================================================

  // Derive CSS values from spring
  const springStyles = $derived.by(() => {
    const expansion = $expansionSpring;
    const pulse = $selectionPulse;

    return {
      // Expanded chip width percentage
      expandedWidth: `${expansion * 100}%`,
      // Sibling opacity (inverse of expansion)
      siblingOpacity: 1 - expansion,
      // Sibling scale
      siblingScale: 1 - (expansion * 0.2),
      // Toggle row opacity and transform
      toggleRowOpacity: 1 - expansion,
      toggleRowScale: 1 - (expansion * 0.05),
      // Selection pulse
      selectionScale: pulse,
    };
  });
</script>

<div class="settings-container">
  <!-- ============================================================ -->
  <!-- MOBILE LAYOUT: Gesture-enabled expanding chips -->
  <!-- ============================================================ -->
  <div
    class="mobile-layout"
    class:has-expanded={expandedId !== null}
    style:--expansion={$expansionSpring}
  >
    <!-- Row 1: Three setting chips -->
    <div class="chips-row" class:has-expanded={expandedId !== null}>
      {#each settings as setting, settingIndex (setting.id)}
        {@const isExpanded = expandedId === setting.id}
        {@const isHidden = expandedId !== null && !isExpanded}
        {@const isBeingDragged = dragChipId === setting.id}

        <div
          class="chip-wrapper"
          class:expanded={isExpanded}
          class:hidden={isHidden}
          class:dragging={isBeingDragged && isDragging}
          style:--sibling-opacity={isHidden ? springStyles.siblingOpacity : 1}
          style:--sibling-scale={isHidden ? springStyles.siblingScale : 1}
        >
          {#if isExpanded}
            <!-- Expanded state: shows options -->
            <div class="expanded-chip">
              <button
                class="chip-header"
                onclick={handleCollapse}
                aria-expanded="true"
              >
                <i class="fas fa-chevron-left back-icon" aria-hidden="true"></i>
                <span class="chip-label morphing-label">{setting.expandedLabel}</span>
              </button>
              <div class="options-row" role="radiogroup" aria-label="{setting.label} options">
                {#each setting.options as option, optionIndex}
                  {@const selected = setting.isSelected(option.value)}
                  {@const isPulsing = lastSelectedIndex === optionIndex && selected}
                  <button
                    class="option-btn"
                    class:selected
                    class:pulsing={isPulsing}
                    style:--pulse-scale={isPulsing ? springStyles.selectionScale : 1}
                    onclick={() => handleSelect(setting, option.value, optionIndex)}
                    role="radio"
                    aria-checked={selected}
                  >
                    <span class="option-label">{option.label}</span>
                    {#if selected}
                      <span class="selection-indicator"></span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <!-- Collapsed state: tap via click, drag via pointer events -->
            <button
              class="chip"
              onclick={() => handleChipClick(setting.id)}
              onpointerdown={(e) => handlePointerDown(e, setting.id)}
              onpointermove={handlePointerMove}
              onpointerup={handlePointerUp}
              onpointercancel={handlePointerUp}
              aria-expanded="false"
              aria-haspopup="listbox"
            >
              <span class="chip-label">{setting.label}</span>
              <span class="chip-value">{setting.getValue()}</span>
              <!-- Drag hint indicator -->
              <span class="drag-hint" aria-hidden="true">
                <i class="fas fa-grip-lines"></i>
              </span>
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Row 2: Grid and Loop toggles -->
    <div
      class="chips-row toggles-row"
      class:hidden={expandedId !== null}
      style:--toggle-opacity={springStyles.toggleRowOpacity}
      style:--toggle-scale={springStyles.toggleRowScale}
    >
      <button
        class="chip grid-chip"
        onclick={toggleGridMode}
        aria-label="Toggle grid mode between Diamond and Box"
      >
        <span class="chip-label">Grid</span>
        <span class="chip-value">{gridMode === "diamond" ? "Diamond" : "Box"}</span>
      </button>

      <button
        class="chip loop-chip"
        class:loop-active={preferences.makeCircular}
        onclick={toggleLoop}
        aria-pressed={preferences.makeCircular}
      >
        <span class="chip-label">Loop</span>
        <span class="chip-value">{preferences.makeCircular ? "On" : "Off"}</span>
        {#if preferences.makeCircular}
          <span class="loop-glow"></span>
        {/if}
      </button>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- DESKTOP LAYOUT: Expanded sections with all options visible -->
  <!-- ============================================================ -->
  <div class="desktop-layout">
    {#each settings as setting}
      <div class="setting-section">
        <span class="section-label">{setting.expandedLabel}</span>
        <div class="section-options" role="radiogroup" aria-label="{setting.label} options">
          {#each setting.options as option, optionIndex}
            {@const selected = setting.isSelected(option.value)}
            <button
              class="section-option"
              class:selected
              onclick={() => {
                haptic.trigger("impact");
                setting.onSelect(option.value as never);
              }}
              role="radio"
              aria-checked={selected}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>
    {/each}

    <!-- Grid and Loop row -->
    <div class="setting-section toggles-section">
      <div class="toggle-group">
        <span class="section-label">Grid</span>
        <div class="section-options" role="radiogroup" aria-label="Grid mode">
          <button
            class="section-option"
            class:selected={gridMode === "diamond"}
            onclick={() => { haptic.trigger("impact"); onGridModeChange("diamond" as GridMode); }}
            role="radio"
            aria-checked={gridMode === "diamond"}
          >
            ◇ Diamond
          </button>
          <button
            class="section-option"
            class:selected={gridMode === "box"}
            onclick={() => { haptic.trigger("impact"); onGridModeChange("box" as GridMode); }}
            role="radio"
            aria-checked={gridMode === "box"}
          >
            ▢ Box
          </button>
        </div>
      </div>

      <div class="toggle-group">
        <span class="section-label">Loop</span>
        <div class="section-options" role="radiogroup" aria-label="Loop mode">
          <button
            class="section-option"
            class:selected={!preferences.makeCircular}
            onclick={() => { haptic.trigger("impact"); onPreferenceChange("makeCircular", false); }}
            role="radio"
            aria-checked={!preferences.makeCircular}
          >
            Off
          </button>
          <button
            class="section-option loop-on"
            class:selected={preferences.makeCircular}
            onclick={() => { haptic.trigger("impact"); onPreferenceChange("makeCircular", true); }}
            role="radio"
            aria-checked={preferences.makeCircular}
          >
            On
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-container {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    --scale: var(--spell-scale, 1);
  }

  /* ============================================================ */
  /* LAYOUT SWITCHING */
  /* ============================================================ */

  .mobile-layout {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    /* Fixed height prevents layout shift */
    height: 132px;
    overflow: hidden;
    /* Spring-driven gap */
    gap: calc(var(--settings-spacing-sm, 8px) * (1 - var(--expansion, 0)));
  }

  .desktop-layout {
    display: none;
  }

  @container tool-panel (min-height: 700px) {
    .mobile-layout {
      display: none;
    }

    .desktop-layout {
      display: flex;
      flex-direction: column;
      gap: calc(var(--settings-spacing-md, 12px) * var(--scale));
    }
  }

  /* ============================================================ */
  /* MOBILE: Spring-animated expanding chips */
  /* ============================================================ */

  .chips-row {
    display: flex;
    gap: var(--settings-spacing-sm, 8px);
    /* Spring-driven gap collapse */
    gap: calc(var(--settings-spacing-sm, 8px) * (1 - var(--expansion, 0)));
  }

  .chips-row.has-expanded {
    flex: 1;
    height: 100%;
    min-height: 0;
  }

  /* Toggle row with spring-driven hide */
  .chips-row.toggles-row {
    opacity: var(--toggle-opacity, 1);
    transform: scale(var(--toggle-scale, 1));
    transform-origin: top center;
  }

  .chips-row.toggles-row.hidden {
    max-height: 0;
    pointer-events: none;
    margin-top: calc(-1 * var(--settings-spacing-sm, 8px));
    overflow: hidden;
  }

  /* ============================================================ */
  /* Chip wrapper - spring-animated */
  /* ============================================================ */

  .chip-wrapper {
    flex: 1;
    min-width: 0;
    /* Spring values applied via inline styles */
    opacity: var(--sibling-opacity, 1);
    transform: scale(var(--sibling-scale, 1));
    transform-origin: center center;
    /* Smooth transition for non-spring properties */
    transition: flex 300ms cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  .chip-wrapper.expanded {
    flex: 1 0 100%;
    height: 100%;
    min-height: 0;
  }

  .chip-wrapper.hidden {
    flex: 0 0 0%;
    pointer-events: none;
    overflow: hidden;
  }

  .chip-wrapper.dragging {
    z-index: 10;
  }

  /* ============================================================ */
  /* Collapsed chip - gesture-enabled */
  /* ============================================================ */

  .chip {
    width: 100%;
    min-height: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-xs, 4px);
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 12px);
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: var(--settings-radius-lg, 18px);
    color: var(--theme-text);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    /* Disable all browser touch actions - we handle everything */
    touch-action: none;
    position: relative;
    overflow: hidden;
    /* Micro-interaction: subtle hover lift */
    transition:
      background 150ms ease,
      border-color 150ms ease,
      transform 200ms cubic-bezier(0.34, 1.2, 0.64, 1),
      box-shadow 200ms ease;
  }

  .chip:active {
    transform: scale(0.97);
  }

  @media (hover: hover) {
    .chip:hover {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .chip:hover .drag-hint {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .chip-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-muted);
    white-space: nowrap;
    transition: color 150ms ease;
  }

  .chip-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
  }

  /* Drag hint - subtle indicator that chip is draggable */
  .drag-hint {
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%) translateY(2px);
    font-size: 8px;
    color: var(--theme-text-muted);
    opacity: 0;
    transition: opacity 200ms ease, transform 200ms ease;
    pointer-events: none;
  }

  /* Loop chip active state with glow */
  .loop-chip {
    position: relative;
    overflow: visible;
  }

  .loop-chip.loop-active {
    background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-card-bg));
    border-color: var(--theme-accent);
  }

  .loop-chip.loop-active .chip-value {
    color: var(--theme-accent-light, var(--theme-accent));
  }

  .loop-glow {
    position: absolute;
    inset: -2px;
    border-radius: calc(var(--settings-radius-lg, 18px) + 2px);
    background: radial-gradient(ellipse at center, var(--theme-accent) 0%, transparent 70%);
    opacity: 0.15;
    pointer-events: none;
    animation: loopPulse 2s ease-in-out infinite;
  }

  @keyframes loopPulse {
    0%, 100% { opacity: 0.1; transform: scale(1); }
    50% { opacity: 0.2; transform: scale(1.02); }
  }

  /* ============================================================ */
  /* Expanded chip - morphing container */
  /* ============================================================ */

  .expanded-chip {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px);
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-accent);
    border-radius: var(--settings-radius-lg, 18px);
    box-shadow:
      0 4px 20px rgba(99, 102, 241, 0.15),
      0 0 0 1px rgba(99, 102, 241, 0.1);
    height: 132px;
    box-sizing: border-box;
    /* Entrance animation */
    animation: expandIn 350ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
  }

  @keyframes expandIn {
    0% {
      opacity: 0;
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .chip-header {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-xs, 4px) var(--settings-spacing-sm, 8px);
    background: transparent;
    border: none;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    border-radius: var(--settings-radius-sm, 8px);
    transition:
      background 150ms ease,
      transform 150ms cubic-bezier(0.34, 1.2, 0.64, 1);
    min-height: 40px;
  }

  .chip-header:hover {
    background: var(--theme-card-hover-bg);
  }

  .chip-header:active {
    transform: scale(0.97);
  }

  .chip-header:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .chip-header .chip-label {
    color: var(--theme-accent);
    font-size: var(--font-size-min, 14px);
  }

  /* Morphing label with staggered entrance */
  .morphing-label {
    animation: labelMorph 300ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
  }

  @keyframes labelMorph {
    0% {
      opacity: 0;
      transform: translateX(-8px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .back-icon {
    font-size: 12px;
    transition: transform 200ms cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  .chip-header:hover .back-icon {
    transform: translateX(-3px);
  }

  /* ============================================================ */
  /* Options with micro-interactions */
  /* ============================================================ */

  .options-row {
    display: flex;
    gap: var(--settings-spacing-xs, 4px);
    flex: 1;
    min-height: 0;
  }

  .option-btn {
    flex: 1;
    min-height: 48px;
    align-self: stretch;
    padding: var(--settings-spacing-sm, 8px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1.5px solid var(--theme-stroke);
    border-radius: var(--settings-radius-md, 12px);
    color: var(--theme-text-muted);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    overflow: hidden;
    /* Spring-driven scale for selection pulse */
    transform: scale(var(--pulse-scale, 1));
    transition:
      background 150ms ease,
      border-color 150ms ease,
      color 150ms ease,
      box-shadow 150ms ease;
    /* Staggered entrance */
    animation: optionIn 350ms cubic-bezier(0.34, 1.2, 0.64, 1) backwards;
  }

  .option-btn:nth-child(1) { animation-delay: 80ms; }
  .option-btn:nth-child(2) { animation-delay: 140ms; }
  .option-btn:nth-child(3) { animation-delay: 200ms; }

  @keyframes optionIn {
    0% {
      opacity: 0;
      transform: translateY(12px) scale(0.92);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .option-btn:active {
    transform: scale(0.96);
  }

  @media (hover: hover) {
    .option-btn:hover:not(.selected) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }

  .option-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .option-btn.selected {
    background: color-mix(in srgb, var(--theme-accent) 25%, var(--theme-card-bg));
    border-color: var(--theme-accent);
    color: var(--theme-text);
    box-shadow:
      0 0 0 1px rgba(99, 102, 241, 0.2),
      0 2px 8px rgba(99, 102, 241, 0.15);
  }

  /* Selection indicator - animated checkmark feel */
  .selection-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 6px;
    height: 6px;
    background: var(--theme-accent);
    border-radius: 50%;
    animation: indicatorPop 300ms cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
  }

  @keyframes indicatorPop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.4);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .option-label {
    position: relative;
    z-index: 1;
  }

  /* Pulsing state for selection feedback */
  .option-btn.pulsing::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--theme-accent);
    border-radius: inherit;
    opacity: 0;
    animation: selectionRipple 400ms ease-out forwards;
  }

  @keyframes selectionRipple {
    0% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    100% {
      opacity: 0;
      transform: scale(1.1);
    }
  }

  /* ============================================================ */
  /* DESKTOP: Expanded sections */
  /* ============================================================ */

  .setting-section {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--scale));
    padding: calc(16px * var(--scale));
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: calc(var(--settings-radius-lg, 18px) * var(--scale));
  }

  .section-label {
    font-size: calc(var(--font-size-compact, 12px) * var(--scale));
    font-weight: 600;
    color: var(--theme-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-options {
    display: flex;
    gap: calc(8px * var(--scale));
  }

  .section-option {
    flex: 1;
    min-height: calc(56px * var(--scale));
    padding: calc(12px * var(--scale)) calc(16px * var(--scale));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1.5px solid var(--theme-stroke);
    border-radius: calc(var(--settings-radius-md, 12px) * var(--scale));
    color: var(--theme-text-muted);
    font-size: calc(var(--font-size-min, 14px) * var(--scale));
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      color 150ms ease,
      transform 150ms cubic-bezier(0.34, 1.2, 0.64, 1),
      box-shadow 150ms ease;
  }

  .section-option:active {
    transform: scale(0.97);
  }

  @media (hover: hover) {
    .section-option:hover:not(.selected) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
      transform: translateY(-1px);
    }
  }

  .section-option:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .section-option.selected {
    background: color-mix(in srgb, var(--theme-accent) 25%, var(--theme-card-bg));
    border-color: var(--theme-accent);
    color: var(--theme-text);
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15);
  }

  .section-option.loop-on.selected {
    background: color-mix(in srgb, var(--theme-accent) 30%, var(--theme-card-bg));
  }

  .toggles-section {
    display: flex;
    flex-direction: row;
    gap: calc(16px * var(--scale));
    padding: calc(16px * var(--scale));
  }

  .toggle-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--scale));
  }

  .toggle-group .section-options {
    flex: 1;
  }

  /* ============================================================ */
  /* Reduced motion - respects user preference */
  /* ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .chip-wrapper,
    .chips-row.toggles-row,
    .chip,
    .expanded-chip,
    .chip-header,
    .option-btn,
    .section-option,
    .back-icon,
    .loop-glow,
    .selection-indicator {
      transition: none;
      animation: none;
    }

    .loop-glow {
      animation: none;
      opacity: 0.15;
    }
  }
</style>
