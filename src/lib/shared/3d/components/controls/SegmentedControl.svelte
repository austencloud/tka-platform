<script lang="ts" generics="T extends string">
  /**
   * SegmentedControl - iOS-style segmented button group
   * Uses --theme-* and --prop-* CSS variables for consistent theming.
   */

  interface Option {
    value: T;
    label: string;
    icon?: string; // FontAwesome class
    /** Optional trailing count badge (e.g. number of items in this group). */
    count?: number | null;
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

  {#each options as option}
    <button
      type="button"
      class="segment"
      class:selected={value === option.value}
      onclick={() => handleSelect(option.value)}
      aria-label={option.label}
      aria-pressed={value === option.value}
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
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
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
    transition: left var(--duration-normal) ease;
    z-index: 0;
  }

  .blue .indicator {
    background: var(--prop-blue);
  }

  .red .indicator {
    background: var(--prop-red);
  }

  .accent .indicator {
    background: var(--theme-accent);
  }

  .segment {
    flex: 1;
    min-height: var(--min-touch-target); /* WCAG AA touch target */
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
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    overflow: hidden;
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
