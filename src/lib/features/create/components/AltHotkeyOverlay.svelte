<script lang="ts">
  import { container } from "$lib/shared/di";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { getCreateModuleContext } from "../shared/context/create-module-context";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { shiftStartPosition } from "../shared/services/implementations/sequence-transforms/sequence-transforms";
  import type { PropPreset } from "$lib/shared/settings/domain/AppSettings";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  const ctx = getCreateModuleContext();

  let visible = $state(false);
  let fadeOut = $state(false);

  // Read sequence state for transform enable/disable
  // $derived takes an expression, not a function
  const hasSequence = $derived(
    ctx.CreateModuleState.getActiveTabSequenceState()?.hasSequence() ?? false
  );

  // Read prop presets from settings
  const settingsState = container.items.settingsState;
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
    { type: "swapColors", label: "Swap", icon: "fa-right-left", color: "#fb7185", bgTint: "rgba(244,63,94,0.12)", keyBg: "rgba(244,63,94,0.2)", keyBorder: "rgba(244,63,94,0.3)", keyColor: "#ff8fa0", key: "S" },
    { type: "invert", label: "Invert", icon: "fa-circle-half-stroke", color: "#fbbf24", bgTint: "rgba(234,179,8,0.12)", keyBg: "rgba(234,179,8,0.2)", keyBorder: "rgba(234,179,8,0.3)", keyColor: "#fcd34d", key: "I" },
    { type: "shiftStart", label: "Shift", icon: "fa-step-backward", color: "#818cf8", bgTint: "rgba(99,102,241,0.12)", keyBg: "rgba(99,102,241,0.2)", keyBorder: "rgba(99,102,241,0.3)", keyColor: "#a5b4fc", key: "F" },
    { type: "rewind", label: "Rewind", icon: "fa-backward", color: "#34d399", bgTint: "rgba(16,185,129,0.12)", keyBg: "rgba(16,185,129,0.2)", keyBorder: "rgba(16,185,129,0.3)", keyColor: "#6ee7b7", key: "W" },
  ] as const;

  const rotateButtons = [
    { direction: "counterclockwise" as const, label: "CCW", icon: "fa-rotate-left", key: "L" },
    { direction: "clockwise" as const, label: "CW", icon: "fa-rotate-right", key: "R" },
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
      blueBuugengFlipped: preset.blueBuugengFlipped,
      redBuugengFlipped: preset.redBuugengFlipped,
    });
  }

  function handleEditPresets() {
    visible = false;
    fadeOut = false;
    navigationState.setCurrentModule("settings", "props");
  }

  function needsRotation(propType: string): boolean {
    return propType !== PropType.HAND;
  }

  function dismiss() {
    fadeOut = true;
    setTimeout(() => {
      visible = false;
      fadeOut = false;
    }, 120);
  }

  // Alt key toggle listener (press to show, press again to hide)
  $effect(() => {
    if (isMobile || typeof window === "undefined") return;

    // Track whether Alt was pressed alone (no other key combined)
    let altDownAlone = false;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Alt") {
        if (isInputFocused()) return;
        e.preventDefault();
        altDownAlone = true;
        return;
      }
      // Any other key while Alt is down means it's a combo, not a toggle
      if (e.altKey) {
        altDownAlone = false;
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key !== "Alt") return;
      if (!altDownAlone) return;

      // Toggle: if visible, dismiss; if hidden, show
      if (visible && !fadeOut) {
        dismiss();
      } else {
        fadeOut = false;
        visible = true;
      }
      altDownAlone = false;
    }

    // Dismiss if window loses focus while overlay is open
    function onBlur() {
      visible = false;
      fadeOut = false;
      altDownAlone = false;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  });
</script>

{#if visible && !isMobile}
  <div
    class="alt-overlay"
    class:fade-out={fadeOut}
    role="toolbar"
    aria-label="Keyboard shortcuts (Alt held)"
  >
    <!-- Alt badge -->
    <div class="alt-badge-section">
      <span class="alt-key-badge">Alt</span>
      <span class="alt-hint">toggle</span>
    </div>

    <div class="divider"></div>

    <!-- Rotate section -->
    <div class="section">
      <span class="section-label">Rotate</span>
      <div class="rotate-row">
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
      <div class="transform-row">
        {#each transforms as t}
          <button
            class="transform-item"
            disabled={!hasSequence}
            onclick={() => executeTransform(t.type)}
            title="{t.label} (Alt+{t.key})"
          >
            <span class="icon-badge" style="background: {t.bgTint}; color: {t.color};">
              <i class="fas {t.icon}" aria-hidden="true"></i>
            </span>
            <span class="item-label">{t.label}</span>
            <span class="key-badge" style="background: {t.keyBg}; border-color: {t.keyBorder}; color: {t.keyColor};">{t.key}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Prop presets section -->
    <div class="section section-grow">
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

    <!-- Close button -->
    <button class="close-btn" onclick={dismiss} title="Close (Alt)" aria-label="Close shortcut overlay">
      <i class="fas fa-xmark" aria-hidden="true"></i>
    </button>
  </div>
{/if}

<style>
  .alt-overlay {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    max-width: 1060px;
    width: calc(100% - 32px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.97));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 14px 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    gap: 20px;
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

  .alt-badge-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4px 0;
  }

  .alt-key-badge {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 6px 12px;
    font-family: monospace;
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.5);
    font-weight: 600;
  }

  .alt-hint {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.2);
    margin-top: 4px;
  }

  .divider {
    width: 1px;
    align-self: stretch;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .section { flex-shrink: 0; }
  .section-grow { flex: 1; min-width: 0; }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-weight: 600;
    margin-bottom: 8px;
    display: block;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .section-header .section-label { margin-bottom: 0; }

  .rotate-row { display: flex; gap: 4px; }

  .rotate-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    min-height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    cursor: pointer;
    color: inherit;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .rotate-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .rotate-btn:active:not(:disabled) { transform: scale(0.97); }
  .rotate-btn:disabled { opacity: 0.3; cursor: default; }

  .rotate-icon { background: rgba(59, 130, 246, 0.12); color: #60a5fa; font-size: 14px; }
  .rotate-key { background: rgba(59, 130, 246, 0.2); border-color: rgba(59, 130, 246, 0.3); color: #7ba3ff; }

  .transform-row { display: flex; gap: 4px; }

  .transform-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 8px 10px;
    min-width: 56px;
    min-height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    cursor: pointer;
    color: inherit;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .transform-item:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .transform-item:active:not(:disabled) { transform: scale(0.97); }
  .transform-item:disabled { opacity: 0.3; cursor: default; }

  .icon-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 14px;
  }

  .item-label { font-size: var(--font-size-compact, 12px); color: rgba(255, 255, 255, 0.6); }

  .key-badge {
    border-radius: 4px;
    padding: 2px 8px;
    font-size: var(--font-size-compact, 12px);
    font-family: monospace;
    font-weight: 600;
    border: 1px solid transparent;
  }

  .preset-row { display: flex; gap: 4px; }

  .preset-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 6px;
    min-height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
    color: inherit;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .preset-item:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .preset-item.selected { border-color: var(--theme-accent, #a855f7); }
  .preset-item.cat-dog { border-color: rgba(255, 180, 50, 0.15); }

  .preset-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preset-icon:not(.no-rotate) .prop-svg { transform: rotate(-90deg); }
  .preset-icon.empty { color: rgba(255, 255, 255, 0.2); font-size: 12px; }

  .prop-svg { width: 24px; height: 24px; object-fit: contain; }
  .prop-svg.red-prop { filter: hue-rotate(125deg) saturate(1.2); width: 18px; height: 18px; }
  .prop-svg.blue-prop { width: 18px; height: 18px; }

  .preset-key { background: rgba(255, 180, 50, 0.2); border-color: rgba(255, 180, 50, 0.3); color: #f5c842; }
  .preset-key.selected-key { background: rgba(168, 85, 247, 0.2); border-color: rgba(168, 85, 247, 0.3); color: #a855f7; }

  .edit-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 4px 10px;
    min-height: 28px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.4);
    font-size: var(--font-size-compact, 12px);
    transition: all 150ms ease;
  }

  .edit-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .edit-btn i { font-size: 10px; }

  /* Close button */
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    min-width: 32px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.3);
    font-size: var(--font-size-sm, 14px);
    transition: all 150ms ease;
    align-self: center;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    border-color: rgba(255, 255, 255, 0.15);
  }

  @media (prefers-reduced-motion: reduce) {
    .alt-overlay { animation: none; }
    .alt-overlay.fade-out { animation: none; opacity: 0; }
    .rotate-btn, .transform-item, .preset-item, .edit-btn { transition: none; }
  }
</style>
