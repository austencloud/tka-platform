<!--
  TransformSection.svelte

  Expanded section for transform operations: apply-to-hand selector,
  rotation buttons, and a 2x3 rearrange grid with color-coded icons.
-->
<script lang="ts">
  import type { CellEditorPanelState } from "../state/cell-editor-panel-state.svelte";
  import type { TransformType } from "$lib/features/compose/compose/domain/types";
  import type { TargetHand } from "$lib/features/compose/compose/domain/types";

  let {
    panelState,
    onTransform,
  }: {
    panelState: CellEditorPanelState;
    onTransform: (type: TransformType) => void;
  } = $props();

  const hands: { value: TargetHand; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "both", label: "Both" },
    { value: "right", label: "Right" },
  ];

  const rearrangeButtons: {
    type: TransformType;
    label: string;
    icon: string;
    iconColor: string;
    bgTint: string;
    description: string;
    hotkey: string;
  }[] = [
    {
      type: "mirror",
      label: "Mirror",
      icon: "fa-left-right",
      iconColor: "#60a5fa",
      bgTint: "rgba(59,130,246,0.12)",
      description: "Flip left/right",
      hotkey: "M",
    },
    {
      type: "flip",
      label: "Flip",
      icon: "fa-up-down",
      iconColor: "#a78bfa",
      bgTint: "rgba(168,85,247,0.12)",
      description: "Flip top/bottom",
      hotkey: "V",
    },
    {
      type: "swapColors",
      label: "Swap",
      icon: "fa-right-left",
      iconColor: "#fb7185",
      bgTint: "rgba(244,63,94,0.12)",
      description: "Switch hands",
      hotkey: "S",
    },
    {
      type: "invert",
      label: "Invert",
      icon: "fa-circle-half-stroke",
      iconColor: "#fbbf24",
      bgTint: "rgba(234,179,8,0.12)",
      description: "Reverse direction",
      hotkey: "I",
    },
    {
      type: "shiftStart",
      label: "Shift Start",
      icon: "fa-step-backward",
      iconColor: "#818cf8",
      bgTint: "rgba(99,102,241,0.12)",
      description: "Advance starting beat",
      hotkey: "F",
    },
    {
      type: "rewind",
      label: "Rewind",
      icon: "fa-backward",
      iconColor: "#34d399",
      bgTint: "rgba(16,185,129,0.12)",
      description: "Play backwards",
      hotkey: "\u21e7R",
    },
  ];
</script>

<div class="transform-section">
  <!-- Apply To -->
  <div class="segment-group">
    <div class="segment-strip" role="radiogroup" aria-label="Apply transform to">
      {#each hands as hand}
        <button
          class="segment-btn"
          class:active={panelState.applyToHand === hand.value}
          role="radio"
          aria-checked={panelState.applyToHand === hand.value}
          onclick={() => panelState.setApplyToHand(hand.value)}
        >
          {hand.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Rotate -->
  <label class="section-label">Rotate</label>
  <div class="segment-strip rotate-strip">
    <button class="segment-btn rotate-btn" onclick={() => onTransform("rotate45L")}>
      <i class="fas fa-rotate-left" aria-hidden="true"></i>
      45&deg; L
    </button>
    <button class="segment-btn rotate-btn" onclick={() => onTransform("rotate45R")}>
      <i class="fas fa-rotate-right" aria-hidden="true"></i>
      45&deg; R
    </button>
  </div>

  <!-- Rearrange -->
  <label class="section-label">Rearrange</label>
  <div class="rearrange-grid">
    {#each rearrangeButtons as btn}
      <button
        class="rearrange-btn"
        onclick={() => onTransform(btn.type)}
        title="{btn.label} ({btn.hotkey})"
      >
        <span class="hotkey-badge">{btn.hotkey}</span>
        <span
          class="icon-badge"
          style="background: {btn.bgTint}; color: {btn.iconColor};"
        >
          <i class="fas {btn.icon}" aria-hidden="true"></i>
        </span>
        <span class="btn-label">{btn.label}</span>
        <span class="btn-desc">{btn.description}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .transform-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: slideDown 180ms ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Section labels */
  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
    font-weight: 600;
    margin: 0;
  }

  /* Segmented strip (shared by Apply To and Rotate) */
  .segment-strip {
    display: flex;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    overflow: hidden;
  }

  .segment-btn {
    flex: 1;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .segment-btn:hover {
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .segment-btn.active {
    color: var(--theme-accent, #a855f7);
    box-shadow: inset 0 -2px 0 var(--theme-accent, #a855f7);
  }

  /* Rotate strip hover */
  .rotate-btn:hover {
    background: rgba(96, 165, 250, 0.08);
  }

  .rotate-btn:active {
    transform: scale(0.97);
  }

  /* Rearrange grid */
  .rearrange-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .rearrange-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 52px;
    padding: 8px 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .rearrange-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .rearrange-btn:active {
    transform: scale(0.97);
  }

  /* Icon badge */
  .icon-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    font-size: 14px;
  }

  /* Text labels */
  .btn-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--theme-text, white);
  }

  .btn-desc {
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  /* Hotkey badge */
  .hotkey-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 9px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.15));
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .transform-section {
      animation: none;
    }

    .segment-btn,
    .rearrange-btn {
      transition: none;
    }
  }
</style>
