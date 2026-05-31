<script lang="ts">
  import SwapIcon from "$lib/shared/icons/SwapIcon.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { getCreateModuleContext } from "../shared/context/create-module-context";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import { shiftStartPosition } from "$lib/shared/create/services/sequence-transforms";
  import { setGridRotationDirection } from "$lib/shared/pictograph/grid/state/grid-rotation-state.svelte";
  import * as subDrawerStatePersister from "../shared/services/sub-drawer-state-persister";
  import type { PropPreset } from "$lib/shared/settings/domain/app-settings";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  const ctx = getCreateModuleContext();

  let visible = $state(false);
  let fadeOut = $state(false);

  // Read sequence state for transform enable/disable
  // $derived takes an expression, not a function
  const hasSequence = $derived(
    ctx.CreateModuleState.getActiveTabSequenceState()?.hasSequence() ?? false
  );

  // Read prop presets from settings
  const settingsState = settingsService;
  const presets = $derived<(PropPreset | null)[]>(
    settingsState?.settings?.propPresets ?? []
  );
  const selectedPresetIndex = $derived(
    settingsState?.settings?.selectedPresetIndex ?? 0
  );

  // Desktop-only check
  const isMobile = typeof window !== "undefined" && (
    "ontouchstart" in window || window.innerWidth < 768
  );

  // Transform definitions matching TransformSection visual language
  const transforms = [
    { type: "mirror", label: "Mirror", icon: "fa-left-right", color: "#60a5fa", bgTint: "rgba(59,130,246,0.12)", keyBg: "rgba(59,130,246,0.2)", keyBorder: "rgba(59,130,246,0.3)", keyColor: "#7ba3ff", key: "M" },
    { type: "flip", label: "Flip", icon: "fa-up-down", color: "#a78bfa", bgTint: "rgba(168,85,247,0.12)", keyBg: "rgba(168,85,247,0.2)", keyBorder: "rgba(168,85,247,0.3)", keyColor: "#b99aff", key: "V" },
    { type: "swapColors", label: "Swap", icon: "fa-right-left", color: "#fb7185", bgTint: "rgba(244,63,94,0.12)", keyBg: "rgba(244,63,94,0.2)", keyBorder: "rgba(244,63,94,0.3)", keyColor: "#ff8fa0", key: "X" },
    { type: "invert", label: "Invert", icon: "fa-circle-half-stroke", color: "#fbbf24", bgTint: "rgba(234,179,8,0.12)", keyBg: "rgba(234,179,8,0.2)", keyBorder: "rgba(234,179,8,0.3)", keyColor: "#fcd34d", key: "I" },
    { type: "shiftStart", label: "Shift", icon: "fa-step-backward", color: "#818cf8", bgTint: "rgba(99,102,241,0.12)", keyBg: "rgba(99,102,241,0.2)", keyBorder: "rgba(99,102,241,0.3)", keyColor: "#a5b4fc", key: "F" },
    { type: "rewind", label: "Rewind", icon: "fa-backward", color: "#34d399", bgTint: "rgba(16,185,129,0.12)", keyBg: "rgba(16,185,129,0.2)", keyBorder: "rgba(16,185,129,0.3)", keyColor: "#6ee7b7", key: "W" },
  ] as const;

  const rotateButtons = [
    { direction: "counterclockwise" as const, label: "CCW", icon: "fa-rotate-left", key: "[" },
    { direction: "clockwise" as const, label: "CW", icon: "fa-rotate-right", key: "]" },
  ];

  function isInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
  }

  function getSequenceState() {
    return ctx.CreateModuleState.getActiveTabSequenceState();
  }

  async function executeTransform(type: string) {
    const seqState = getSequenceState();
    if (!seqState?.hasSequence()) return;

    switch (type) {
      case "mirror": await seqState.mirrorSequence(); break;
      case "flip": await seqState.flipSequence(); break;
      case "swapColors": await seqState.swapColors(); break;
      case "invert": await seqState.invertSequence(); break;
      case "rewind": await seqState.rewindSequence(); break;
      case "shiftStart": {
        const seq = seqState.currentSequence;
        if (seq && seq.steps.length > 1) {
          const shifted = shiftStartPosition(seq, 2);
          seqState.setCurrentSequence(shifted);
        }
        break;
      }
    }
  }

  async function executeRotate(direction: "clockwise" | "counterclockwise") {
    const seqState = getSequenceState();
    if (!seqState?.hasSequence()) return;
    setGridRotationDirection(direction === "clockwise" ? 1 : -1);
    await seqState.rotateSequence(direction);
  }

  async function applyPreset(index: number) {
    const preset = presets[index];
    if (!preset) return;
    settingsState.updateSettings({
      selectedPresetIndex: index,
      bluePropType: preset.bluePropType,
      redPropType: preset.redPropType,
      catDogMode: preset.catDogMode,
      blueBuugengFlipped: preset.blueBuugengFlipped ?? false,
      redBuugengFlipped: preset.redBuugengFlipped ?? false,
    });
  }

  function handleEditPresets() {
    visible = false;
    fadeOut = false;
    handleModuleChange("settings", "props");
  }

  function needsRotation(propType: string): boolean {
    return propType !== PropType.HAND;
  }

  // Sequence action launchers - set the sub-drawer, then open the actions panel
  const actionButtons = [
    { label: "Duration", icon: "fa-clock", color: "#f472b6", bgTint: "rgba(244,114,182,0.12)", drawer: "duration" as const },
    { label: "Extend", icon: "fa-expand", color: "#38bdf8", bgTint: "rgba(56,189,248,0.12)", drawer: "extend" as const },
    { label: "Turns", icon: "fa-arrows-spin", color: "#fb923c", bgTint: "rgba(251,146,60,0.12)", drawer: "turnPattern" as const },
    { label: "Rotation", icon: "fa-compass", color: "#4ade80", bgTint: "rgba(74,222,128,0.12)", drawer: "rotationDirection" as const },
  ] as const;

  function openSequenceAction(drawer: string) {
    const panelState = ctx.panelState;
    dismiss();
    // Tell the persister which drawer to open, then open the panel.
    // SequenceActionsPanel reads the persister on open and restores the drawer.
    subDrawerStatePersister.setActiveSubDrawer(drawer as any);
    panelState.openSequenceActionsPanel();
  }

  function dismiss() {
    fadeOut = true;
    setTimeout(() => {
      visible = false;
      fadeOut = false;
    }, 120);
  }

  let overlayEl: HTMLDivElement | undefined = $state();

  // Alt key toggle - instant on keydown, ignore repeats
  // Also: Escape dismisses, click outside dismisses
  $effect(() => {
    if (isMobile || typeof window === "undefined") return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Alt") {
        if (e.repeat) return;
        if (isInputFocused()) return;
        e.preventDefault();

        // Alt only opens - never closes. Use X, Escape, or click outside to dismiss.
        if (!visible) {
          fadeOut = false;
          visible = true;
        }
        return;
      }

      // Escape dismisses when open
      if (e.key === "Escape" && visible) {
        dismiss();
      }
    }

    // Click outside the overlay dismisses it
    function onPointerDown(e: PointerEvent) {
      if (!visible || !overlayEl) return;
      if (!overlayEl.contains(e.target as Node)) {
        dismiss();
      }
    }

    // Dismiss if window loses focus
    function onBlur() {
      visible = false;
      fadeOut = false;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("blur", onBlur);
    };
  });
</script>

{#if visible && !isMobile}
  <div
    bind:this={overlayEl}
    class="alt-overlay"
    class:fade-out={fadeOut}
    role="toolbar"
    aria-label="Keyboard shortcuts (Alt held)"
  >
    <!-- Alt badge - compact pill -->
    <div class="alt-badge-section">
      <span class="alt-key-badge">Alt</span>
    </div>

    <div class="divider"></div>

    <!-- Rotate section - stacked vertically to fill height -->
    <div class="section">
      <span class="section-label">Rotate</span>
      <div class="rotate-col">
        {#each rotateButtons as btn}
          <button
            class="rotate-btn"
            disabled={!hasSequence}
            onclick={() => executeRotate(btn.direction)}
            title="Rotate {btn.label} (Alt+{btn.key})"
          >
            <span class="icon-badge rotate-icon">
              <i class="fas {btn.icon}" aria-hidden="true"></i>
            </span>
            <span class="item-label">{btn.label}</span>
            <span class="key-badge rotate-key">{btn.key}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Transform section -->
    <div class="section">
      <span class="section-label">Transform</span>
      <div class="transform-grid">
        {#each transforms as t}
          <button
            class="transform-item"
            disabled={!hasSequence}
            onclick={() => executeTransform(t.type)}
            title="{t.label} (Alt+{t.key})"
          >
            <span class="icon-badge" style="background: {t.bgTint}; color: {t.color};">
              {#if t.type === "swapColors"}
                <SwapIcon size="14px" />
              {:else}
                <i class="fas {t.icon}" aria-hidden="true"></i>
              {/if}
            </span>
            <span class="item-label">{t.label}</span>
            <span class="key-badge" style="background: {t.keyBg}; border-color: {t.keyBorder}; color: {t.keyColor};">{t.key}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Actions section -->
    <div class="section">
      <span class="section-label">Actions</span>
      <div class="actions-grid">
        {#each actionButtons as action}
          <button
            class="action-item"
            disabled={!hasSequence}
            onclick={() => openSequenceAction(action.drawer)}
            title={action.label}
          >
            <span class="icon-badge" style="background: {action.bgTint}; color: {action.color};">
              <i class="fas {action.icon}" aria-hidden="true"></i>
            </span>
            <span class="item-label">{action.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Prop presets section -->
    <div class="section">
      <div class="section-header">
        <span class="section-label">Props</span>
        <button class="edit-btn" onclick={handleEditPresets} title="Edit prop presets">
          <i class="fas fa-pen" aria-hidden="true"></i>
          Edit
        </button>
      </div>
      <div class="preset-row">
        {#each presets as preset, i}
          {@const displayKey = i === 9 ? "0" : String(i + 1)}
          {@const isSelected = i === selectedPresetIndex}
          <button
            class="preset-item"
            class:selected={isSelected}
            class:cat-dog={preset?.catDogMode}
            onclick={() => applyPreset(i)}
            title={preset ? `${getPropTypeDisplayInfo(preset.bluePropType).label} (Alt+${displayKey})` : `Empty slot (Alt+${displayKey})`}
          >
            {#if preset}
              <div class="preset-icon" class:no-rotate={!needsRotation(preset.bluePropType)}>
                {#if preset.catDogMode}
                  <img
                    src={getPropTypeDisplayInfo(preset.bluePropType).image}
                    alt=""
                    class="prop-svg blue-prop"
                  />
                  <img
                    src={getPropTypeDisplayInfo(preset.redPropType).image}
                    alt=""
                    class="prop-svg red-prop"
                  />
                {:else}
                  <img
                    src={getPropTypeDisplayInfo(preset.bluePropType).image}
                    alt=""
                    class="prop-svg"
                  />
                {/if}
              </div>
            {:else}
              <div class="preset-icon empty">
                <i class="fas fa-plus" aria-hidden="true"></i>
              </div>
            {/if}
            <span class="key-badge preset-key" class:selected-key={isSelected}>{displayKey}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Close button - inline as last flex item -->
    <button class="close-btn" onclick={dismiss} title="Close (Alt)" aria-label="Close shortcut overlay">
      <i class="fas fa-xmark" aria-hidden="true"></i>
    </button>
  </div>
{/if}

<style>
  /* ===== Layout ===== */
  .alt-overlay {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-overlay);
    width: fit-content;
    max-width: calc(100vw - 48px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.97));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 10px 14px;
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: stretch;
    gap: 14px;
    animation: slideDown 180ms ease-out;
    pointer-events: auto;
  }

  .alt-overlay.fade-out {
    animation: fadeUp 120ms ease-in forwards;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @keyframes fadeUp {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  }

  /* ===== Alt badge - compact pill ===== */
  .alt-badge-section {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .alt-key-badge {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 4px 10px;
    font-family: monospace;
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.35);
    font-weight: 600;
    line-height: 1;
  }

  /* ===== Dividers ===== */
  .divider {
    width: 1px;
    align-self: stretch;
    background: linear-gradient(
      180deg,
      transparent 0%,
      var(--theme-stroke, rgba(255, 255, 255, 0.08)) 20%,
      var(--theme-stroke, rgba(255, 255, 255, 0.08)) 80%,
      transparent 100%
    );
    flex-shrink: 0;
  }

  /* ===== Sections ===== */
  .section {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.25));
    font-weight: 600;
    margin-bottom: 6px;
    display: block;
    line-height: 1;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
  }

  .section-header .section-label { margin-bottom: 0; }

  /* ===== Shared button base ===== */
  .rotate-btn,
  .transform-item,
  .action-item,
  .preset-item {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    cursor: pointer;
    color: inherit;
    transition: background 150ms ease, border-color 150ms ease, transform 100ms ease;
  }

  .rotate-btn:hover:not(:disabled),
  .transform-item:hover:not(:disabled),
  .action-item:hover:not(:disabled),
  .preset-item:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .rotate-btn:active:not(:disabled),
  .transform-item:active:not(:disabled),
  .action-item:active:not(:disabled),
  .preset-item:active { transform: scale(0.96); }

  .rotate-btn:disabled,
  .transform-item:disabled,
  .action-item:disabled { opacity: 0.3; cursor: default; }

  /* ===== Rotate - stacked vertically ===== */
  .rotate-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .rotate-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    min-height: 44px;
    flex: 1;
  }

  .rotate-icon { background: rgba(59, 130, 246, 0.12); color: #60a5fa; font-size: 14px; }
  .rotate-key { background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.3); color: #7ba3ff; }

  /* ===== Transforms - 3x2 grid ===== */
  .transform-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    flex: 1;
  }

  .transform-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    min-width: 56px;
    min-height: 44px;
  }

  /* ===== Shared icon + label + key ===== */
  .icon-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    font-size: 14px;
  }

  .item-label {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.55);
    font-weight: 500;
    line-height: 1;
  }

  .key-badge {
    border-radius: 4px;
    padding: 2px 7px;
    font-size: var(--font-size-compact, 12px);
    font-family: monospace;
    font-weight: 600;
    border: 1px solid transparent;
    line-height: 1.4;
  }

  /* ===== Actions - 2x2 grid ===== */
  .actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    flex: 1;
  }

  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    min-height: 44px;
    min-width: 56px;
  }

  /* ===== Presets - 5x2 grid ===== */
  .preset-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
    flex: 1;
  }

  .preset-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 5px 6px;
    min-height: 44px;
    min-width: 44px;
  }

  .preset-item.selected { border-color: var(--theme-accent, #a855f7); }
  .preset-item.cat-dog { border-color: rgba(255, 180, 50, 0.2); }

  .preset-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preset-icon:not(.no-rotate) .prop-svg { transform: rotate(-90deg); }
  .preset-icon.empty { color: rgba(255, 255, 255, 0.2); font-size: var(--font-size-compact, 12px); }

  .prop-svg { width: 24px; height: 24px; object-fit: contain; }
  .prop-svg.red-prop { filter: hue-rotate(125deg) saturate(1.2); width: 18px; height: 18px; }
  .prop-svg.blue-prop { width: 18px; height: 18px; }

  .preset-key { background: rgba(255, 180, 50, 0.2); border-color: rgba(255, 180, 50, 0.3); color: #f5c842; }
  .preset-key.selected-key { background: rgba(168, 85, 247, 0.2); border-color: rgba(168, 85, 247, 0.3); color: #a855f7; }

  /* ===== Edit button ===== */
  .edit-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 4px 10px;
    min-height: 44px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.35);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    transition: all 150ms ease;
  }

  .edit-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .edit-btn i { font-size: 9px; }

  /* ===== Close button - inline flex item ===== */
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.3);
    font-size: var(--font-size-compact, 12px);
    transition: all 150ms ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.2);
  }

  /* ===== Reduced motion ===== */
  @media (prefers-reduced-motion: reduce) {
    .alt-overlay { animation: none; }
    .alt-overlay.fade-out { animation: none; opacity: 0; }
    .rotate-btn, .transform-item, .action-item, .preset-item, .edit-btn, .close-btn { transition: none; }
  }
</style>
