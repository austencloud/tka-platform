<!--
  HandSelector.svelte

  Hand/color selector shared by Sequence Actions and the mandala viewer.
  Defaults to Left / Both / Right; callers can supply labels for the same
  blue / purple / red visual states.

  Segmented track with a sliding indicator that recolors per hand
  (Left=blue, Both=purple, Right=red), matching the prop colors and the
  turn/reversal strip editor's visual language. Single-select; the indicator
  carries the active state so it never needs a checkbox or per-button border.
-->
<script lang="ts">
  import type { TargetHand } from "../../state/panel-coordination-state.svelte.ts";

  interface Props {
    value: TargetHand;
    onChange: (hand: TargetHand) => void;
    sectionLabel?: string;
    labelId?: string;
    labels?: Record<TargetHand, string>;
  }

  let {
    value,
    onChange,
    sectionLabel = "Apply To",
    labelId = "apply-to-label",
    labels = { blue: "Left", both: "Both", red: "Right" },
  }: Props = $props();

  // The fixed color order drives the indicator position; labels can describe
  // either hands (Left/Both/Right) or the rendered mandala (Blue/Purple/Red).
  const ORDER: TargetHand[] = ["blue", "both", "red"];
  const index = $derived(Math.max(0, ORDER.indexOf(value)));
</script>

<div class="hand-selector-section">
  <span class="section-label" id={labelId}>{sectionLabel}</span>

  <div
    class="seg-track sel-{value}"
    role="radiogroup"
    aria-labelledby={labelId}
    style="--index: {index}"
  >
    <span class="indicator" aria-hidden="true"></span>

    <button
      class="seg blue"
      class:active={value === "blue"}
      role="radio"
      aria-checked={value === "blue"}
      onclick={() => onChange("blue")}
    >
      <span class="dot blue"></span>{labels.blue}
    </button>

    <button
      class="seg both"
      class:active={value === "both"}
      role="radio"
      aria-checked={value === "both"}
      onclick={() => onChange("both")}
    >
      {labels.both}
    </button>

    <button
      class="seg red"
      class:active={value === "red"}
      role="radio"
      aria-checked={value === "red"}
      onclick={() => onChange("red")}
    >
      <span class="dot red"></span>{labels.red}
    </button>
  </div>
</div>

<style>
  .hand-selector-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.55);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
  }

  /* Segmented track */
  .seg-track {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Sliding indicator — one third wide, recolored per selection below. */
  .indicator {
    position: absolute;
    z-index: 0;
    top: 4px;
    bottom: 4px;
    left: calc(4px + (100% - 8px) / 3 * var(--index));
    width: calc((100% - 8px) / 3);
    border-radius: 9px;
    transition:
      left var(--duration-normal, 220ms) cubic-bezier(0.4, 0, 0.2, 1),
      background var(--duration-normal, 220ms) ease,
      box-shadow var(--duration-normal, 220ms) ease;
  }
  .sel-blue .indicator {
    background: linear-gradient(135deg, #6f9bff, #4b7bff);
    box-shadow: 0 4px 16px -4px rgba(111, 155, 255, 0.6);
  }
  .sel-both .indicator {
    background: linear-gradient(135deg, #a98bff, #7c5cff);
    box-shadow: 0 4px 16px -4px rgba(124, 92, 255, 0.6);
  }
  .sel-red .indicator {
    background: linear-gradient(135deg, #ff7a8a, #ff5068);
    box-shadow: 0 4px 16px -4px rgba(255, 122, 138, 0.6);
  }

  .seg {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 10px;
    border: none;
    background: none;
    border-radius: 9px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: color var(--duration-fast, 120ms) ease;
  }

  /* Inactive labels: tinted per hand but kept readable (AAA on the dark track). */
  .seg.blue {
    color: #93b4ff;
  }
  .seg.both {
    color: #c9b3ff;
  }
  .seg.red {
    color: #ffb3bd;
  }
  .seg:hover {
    color: #fff;
  }
  .seg.active {
    color: #fff;
  }

  /* Small hand dot on Left/Right reinforces the prop-color mapping. */
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot.blue {
    background: #6f9bff;
  }
  .dot.red {
    background: #ff7a8a;
  }
  .seg.active .dot {
    background: #fff;
  }

  .seg:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.85));
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .indicator,
    .seg {
      transition: none;
    }
  }
</style>
