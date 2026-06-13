<!--
  OrientationPickerDrawer.svelte

  Compact bottom drawer showing all 4 orientations for quick selection.
  Mounted at CreateModule level to ensure proper z-index layering.
  Triggered by OrientationCycler buttons via orientationPickerState.
-->
<script lang="ts">
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { orientationPickerState } from "../state/orientation-picker-state.svelte";

  const ORIENTATIONS: {
    value: Orientation;
    label: string;
    icon: string;
    hint: string;
  }[] = [
    {
      value: Orientation.IN,
      label: "In",
      icon: "fa-compress-arrows-alt",
      hint: "Toward center",
    },
    {
      value: Orientation.CLOCK,
      label: "Clock",
      icon: "fa-redo",
      hint: "Clockwise",
    },
    {
      value: Orientation.OUT,
      label: "Out",
      icon: "fa-expand-arrows-alt",
      hint: "Away from center",
    },
    {
      value: Orientation.COUNTER,
      label: "Counter",
      icon: "fa-undo",
      hint: "Counterclockwise",
    },
  ];

  const colorLabel = $derived(
    orientationPickerState.activeColor === "blue" ? "Blue" : "Red"
  );

  const drawerClass = $derived(
    `orientation-picker-drawer ${orientationPickerState.activeColor === "blue" ? "orientation-drawer-blue" : "orientation-drawer-red"}`
  );

  function handleSelect(value: Orientation) {
    orientationPickerState.select(value);
  }

  function handleClose() {
    orientationPickerState.close();
  }
</script>

<Drawer
  isOpen={orientationPickerState.isOpen}
  onOpenChange={(open) => {
    if (!open) orientationPickerState.close();
  }}
  ariaLabel="{colorLabel} orientation picker"
  showHandle={true}
  class={drawerClass}
  respectLayoutMode={false}
>
  <div class="orientation-picker">
    <h3 class="picker-title">{colorLabel} Orientation</h3>
    <div class="orientation-options">
      {#each ORIENTATIONS as opt (opt.value)}
        <button
          class="orientation-option"
          class:selected={opt.value === orientationPickerState.currentOrientation}
          class:color-blue={orientationPickerState.activeColor === "blue"}
          class:color-red={orientationPickerState.activeColor === "red"}
          onclick={() => handleSelect(opt.value)}
          aria-pressed={opt.value === orientationPickerState.currentOrientation}
          aria-label="{opt.label}: {opt.hint}"
        >
          <i class="fas {opt.icon}" aria-hidden="true"></i>
          <div class="option-text">
            <span class="option-label">{opt.label}</span>
            <span class="option-hint">{opt.hint}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>
</Drawer>

<style>
  /* ============================================
     Drawer Overrides - compact sizing and theming
     ============================================ */
  :global(.orientation-picker-drawer) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    min-height: auto !important;
  }

  :global(.orientation-drawer-blue) {
    border-top: 2px solid
      color-mix(in srgb, var(--prop-blue, #3b82f6) 50%, transparent);
  }

  :global(.orientation-drawer-red) {
    border-top: 2px solid
      color-mix(in srgb, var(--prop-red, #ef4444) 50%, transparent);
  }

  /* ============================================
     Picker Content
     ============================================ */
  .orientation-picker {
    padding: 8px 20px 24px;
  }

  .picker-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-align: center;
    margin: 0 0 16px;
    letter-spacing: 0.02em;
  }

  .orientation-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .orientation-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    min-height: var(--min-touch-target, 48px);
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .orientation-option i {
    font-size: 18px;
    opacity: 0.8;
    color: var(--theme-text);
    flex-shrink: 0;
  }

  .option-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
  }

  .option-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text);
  }

  .option-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Selected state */
  .orientation-option.selected.color-blue {
    border-color: color-mix(in srgb, var(--prop-blue, #3b82f6) 60%, transparent);
    background: var(--prop-blue-bg, rgba(59, 130, 246, 0.15));
  }

  .orientation-option.selected.color-red {
    border-color: color-mix(in srgb, var(--prop-red, #ef4444) 60%, transparent);
    background: var(--prop-red-bg, rgba(239, 68, 68, 0.15));
  }

  @media (hover: hover) {
    .orientation-option:hover:not(.selected) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
    }
  }

  .orientation-option:active {
    transform: scale(0.98);
  }

  .orientation-option:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .orientation-option {
      transition: none;
    }

    .orientation-option:active {
      transform: none;
    }
  }
</style>
