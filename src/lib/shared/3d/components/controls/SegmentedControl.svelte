<script lang="ts" generics="T extends string">
  /**
   * SegmentedControl - iOS-style segmented button group
   * Uses --theme-* and --prop-* CSS variables for consistent theming.
   *
   * The option LIST may change at runtime (the construct picker swaps the turn
   * palette when the level changes: 4 buttons at L2, 8 at L3). Segments are
   * keyed and FLIPped so survivors glide + scale into their new geometry
   * instead of the row snapping, and arrivals pop in. Static option lists —
   * most consumers — never trigger either.
   */
  import { flip } from "svelte/animate";
  import { flipDuration, popIn } from "$lib/shared/transitions/motion";

  interface Option {
    value: T;
    label: string;
    icon?: string; // FontAwesome class
    /** Optional trailing count badge (e.g. number of items in this group). */
    count?: number | null;
    /** Not selectable (e.g. a "coming soon" size). Still rendered, dimmed. */
    disabled?: boolean;
  }

  interface Props {
    /** Available options */
    options: Option[];
    /** Currently selected value */
    value: T;
    /** Callback when selection changes */
    onchange: (value: T) => void;
    /** Color for accent indicator */
    color?: "blue" | "red" | "accent";
    /** Size variant */
    size?: "sm" | "md";
  }

  let {
    options,
    value,
    onchange,
    color = "blue",
    size = "md",
  }: Props = $props();

  function handleSelect(val: T) {
    onchange(val);
  }

  // Find selected index for indicator position
  const selectedIndex = $derived(options.findIndex((o) => o.value === value));
</script>

<div
  class="segmented-control"
  class:sm={size === "sm"}
  class:blue={color === "blue"}
  class:red={color === "red"}
  class:accent={color === "accent"}
  style="--count: {options.length}"
>
  <div class="indicator" style="--index: {selectedIndex}"></div>

  {#each options as option (option.value)}
    <button
      type="button"
      class="segment"
      class:selected={value === option.value}
      onclick={() => handleSelect(option.value)}
      aria-label={option.label}
      title={option.label}
      aria-pressed={value === option.value}
      disabled={option.disabled}
      in:popIn
      animate:flip={{ duration: flipDuration() }}
    >
      {#if option.icon}
        <i class={option.icon} aria-hidden="true"></i>
      {:else}
        <span class="segment-label">{option.label}</span>
      {/if}
      {#if option.count != null}
        <span class="segment-count">{option.count}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .segmented-control {
    display: flex;
    position: relative;
    /* Fallbacks: this control also renders on marketing-chrome pages (shop
       configurator) where the app theme pipeline may not have run. */
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
    width: 100%;
  }

  .indicator {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: calc(3px + (100% - 6px) / var(--count) * var(--index));
    width: calc((100% - 6px) / var(--count) - 2px);
    border-radius: 6px;
    /* Width too, not just position: when the option count changes the segments
       resize, and an un-animated indicator would snap while they glide. */
    transition:
      left var(--duration-normal, 200ms) cubic-bezier(0.22, 1, 0.36, 1),
      width var(--duration-normal, 200ms) cubic-bezier(0.22, 1, 0.36, 1);
    z-index: 0;
  }

  .blue .indicator {
    background: var(--prop-blue);
  }

  .red .indicator {
    background: var(--prop-red);
  }

  .accent .indicator {
    background: var(--theme-accent, #8b6cff);
  }

  .segment {
    flex: 1;
    min-height: var(--min-touch-target, 44px); /* WCAG AA touch target */
    min-width: 0;
    padding: 0.5rem 0.5rem;
    background: none;
    border: none;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
    cursor: pointer;
    transition: color var(--duration-fast);
    position: relative;
    z-index: 1;
    /* Long labels wrap instead of clipping — narrow screens were silently
       truncating "coming soon" options mid-word. Equal-width segments keep
       the sliding indicator honest; the control just grows taller. */
    white-space: normal;
    text-align: center;
    line-height: 1.25;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    overflow: hidden;
  }

  .segment:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
    border-radius: 6px;
    z-index: 2;
  }

  .segment:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .indicator,
    .segment {
      transition: none;
    }
  }

  .segment-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.1rem;
    padding: 0.05rem 0.3rem;
    border-radius: 9999px;
    background: color-mix(in srgb, currentColor 14%, transparent);
    font-size: var(--font-size-compact, 0.7rem);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.4;
  }

  .sm .segment {
    /* Touch target uses var(--min-touch-target) for WCAG AA */
    padding: 0.45rem 0.7rem;
    font-size: var(--font-size-compact, 0.75rem);
  }

  .segment:hover {
    color: var(--theme-text);
  }

  .segment.selected {
    color: var(--theme-text-on-accent, white);
  }

  .segment i {
    font-size: var(--font-size-sm, 0.875rem);
  }

  .sm .segment i {
    font-size: var(--font-size-compact, 0.75rem);
  }
</style>
