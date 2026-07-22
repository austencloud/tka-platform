<!--
  MobileHandSelector.svelte

  M3-inspired segmented button for hand selection on mobile.
  Defaults to L | Both | R and accepts a narrower option set for focused tools.
  Visual height: 32px. Touch target: 48px via invisible padding.
-->
<script lang="ts">
  import type { TargetHand } from "$lib/shared/create/domain/panel-types";

  interface HandOption {
    hand: TargetHand;
    label: string;
    shortLabel: string;
  }

  const defaultOptions: HandOption[] = [
    { hand: "blue", label: "Left", shortLabel: "L" },
    { hand: "both", label: "Both", shortLabel: "Both" },
    { hand: "red", label: "Right", shortLabel: "R" },
  ];

  interface Props {
    value: TargetHand;
    onChange: (hand: TargetHand) => void;
    options?: HandOption[];
    ariaLabel?: string;
    fullWidth?: boolean;
  }

  let {
    value,
    onChange,
    options = defaultOptions,
    ariaLabel = "Apply transforms to hand",
    fullWidth = false,
  }: Props = $props();
</script>

<div
  class="segmented-group"
  class:full-width={fullWidth}
  role="group"
  aria-label={ariaLabel}
>
  {#each options as opt}
    <button
      type="button"
      class="segment {opt.hand}"
      class:active={value === opt.hand}
      onclick={() => onChange(opt.hand)}
      aria-pressed={value === opt.hand}
      aria-label={opt.label}
    >
      <span class="segment-label">{opt.shortLabel}</span>
    </button>
  {/each}
</div>

<style>
  .segmented-group {
    display: flex;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    flex-shrink: 0;
  }

  .segmented-group.full-width {
    width: 100%;
  }

  .segment {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    min-width: 44px;
    padding: 0 10px;
    border: none;
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    /* 48px touch target via padding beyond visual height */
    position: relative;
  }

  .full-width .segment {
    flex: 1;
  }

  .segment::before {
    content: "";
    position: absolute;
    inset: -8px 0;
    /* Extends touch target to 48px (32 + 8 + 8) */
  }

  .segment:last-child {
    border-right: none;
  }

  .segment-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.02em;
    pointer-events: none;
  }

  /* Active states per hand color */
  .segment.blue.active {
    background: rgba(59, 130, 246, 0.3);
    color: rgb(147, 197, 253);
  }

  .segment.both.active {
    background: rgba(168, 85, 247, 0.3);
    color: rgb(216, 180, 254);
  }

  .segment.red.active {
    background: rgba(239, 68, 68, 0.3);
    color: rgb(252, 165, 165);
  }

  /* Hover */
  .segment:not(.active):hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  /* Focus */
  .segment:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: -2px;
    z-index: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .segment {
      transition: none;
    }
  }
</style>
