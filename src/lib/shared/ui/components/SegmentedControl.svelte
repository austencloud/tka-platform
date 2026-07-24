<script lang="ts" generics="T extends string">
  /**
   * Generic segmented button group shared across app and public surfaces.
   * Uses --theme-* and --prop-* CSS variables for consistent theming.
   *
   * The option LIST may change at runtime (the construct picker swaps the turn
   * palette when the level changes: 4 buttons at L2, 8 at L3). Segments are
   * keyed and FLIPped so survivors glide + scale into their new geometry
   * instead of the row snapping, and arrivals pop in. Static option lists —
   * most consumers — never trigger either.
   *
   * Options that represent a prop or hand carry their own tone. This keeps
   * Blue / Left and Red / Right identifiable even when neither is selected,
   * while the visible label remains the cue for anyone who cannot read color.
   */
  import { flip } from "svelte/animate";
  import { flipDuration, popIn } from "$lib/shared/transitions/motion";
  import type { Snippet } from "svelte";

  interface Option {
    value: T;
    label: string;
    /** Compact visible label; the full label remains the accessible name. */
    shortLabel?: string;
    /** More descriptive accessible name, such as a label plus result count. */
    ariaLabel?: string;
    icon?: string; // FontAwesome class
    /** Optional trailing count badge (e.g. number of items in this group). */
    count?: number | null;
    /** Not selectable (e.g. a "coming soon" size). Still rendered, dimmed. */
    disabled?: boolean;
    /** Semantic option color. Use blue/red when the option means that prop. */
    tone?: "blue" | "red" | "accent";
    /** Tab ID and controlled panel ID when semantics="tabs". */
    id?: string;
    controls?: string;
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
    /** Compact visual shell with a larger invisible pointer target. */
    density?: "standard" | "compact";
    /** Accessible name for the option group. */
    ariaLabel?: string;
    /** ID of a visible label that names the option group. */
    ariaLabelledby?: string;
    /** Tabs and radio groups add roving focus and arrow-key selection. */
    semantics?: "button-group" | "tabs" | "radiogroup";
    /** Custom visible content. The option's label still owns its accessible name. */
    optionContent?: Snippet<[T]>;
  }

  let {
    options,
    value,
    onchange,
    color = "blue",
    size = "md",
    density = "standard",
    ariaLabel,
    ariaLabelledby,
    semantics = "button-group",
    optionContent,
  }: Props = $props();

  function handleSelect(val: T) {
    onchange(val);
  }

  // Find selected index for indicator position
  const selectedIndex = $derived(options.findIndex((o) => o.value === value));
  const selectedTone = $derived(options[selectedIndex]?.tone ?? color);

  function handleSingleSelectKeydown(
    event: KeyboardEvent,
    optionIndex: number
  ) {
    if (semantics === "button-group") return;

    const enabledIndexes = options.flatMap((option, index) =>
      option.disabled ? [] : [index]
    );
    const currentEnabledIndex = enabledIndexes.indexOf(optionIndex);
    if (currentEnabledIndex === -1) return;

    let nextEnabledIndex: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        nextEnabledIndex =
          (currentEnabledIndex - 1 + enabledIndexes.length) %
          enabledIndexes.length;
        break;
      case "ArrowRight":
        nextEnabledIndex = (currentEnabledIndex + 1) % enabledIndexes.length;
        break;
      case "Home":
        nextEnabledIndex = 0;
        break;
      case "End":
        nextEnabledIndex = enabledIndexes.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    if (nextEnabledIndex === null) return;
    const nextOptionIndex = enabledIndexes[nextEnabledIndex];
    if (nextOptionIndex === undefined) return;
    const nextOption = options[nextOptionIndex];
    if (!nextOption) return;

    const currentTarget = event.currentTarget as HTMLButtonElement;
    const segments =
      currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        "button.segment"
      );
    segments?.[nextOptionIndex]?.focus();
    handleSelect(nextOption.value);
  }
</script>

<div
  class="segmented-control"
  class:sm={size === "sm"}
  class:compact={density === "compact"}
  class:blue={color === "blue"}
  class:red={color === "red"}
  class:accent={color === "accent"}
  role={semantics === "tabs"
    ? "tablist"
    : semantics === "radiogroup"
      ? "radiogroup"
      : ariaLabel || ariaLabelledby
        ? "group"
        : undefined}
  aria-orientation={semantics !== "button-group" ? "horizontal" : undefined}
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledby}
  style="--count: {options.length}"
>
  <div
    class="indicator"
    data-tone={selectedTone}
    style="--index: {selectedIndex}"
  ></div>

  {#each options as option (option.value)}
    <button
      type="button"
      class="segment"
      class:selected={value === option.value}
      data-tone={option.tone}
      onclick={() => handleSelect(option.value)}
      onkeydown={(event) =>
        handleSingleSelectKeydown(event, options.indexOf(option))}
      id={option.id}
      role={semantics === "tabs"
        ? "tab"
        : semantics === "radiogroup"
          ? "radio"
          : undefined}
      aria-controls={semantics === "tabs" ? option.controls : undefined}
      aria-selected={semantics === "tabs" ? value === option.value : undefined}
      aria-checked={semantics === "radiogroup"
        ? value === option.value
        : undefined}
      tabindex={semantics !== "button-group"
        ? value === option.value
          ? 0
          : -1
        : 0}
      aria-label={option.ariaLabel ?? option.label}
      title={option.label}
      aria-pressed={semantics === "button-group"
        ? value === option.value
        : undefined}
      disabled={option.disabled}
      in:popIn
      animate:flip={{ duration: flipDuration() }}
    >
      {#if optionContent}
        <span class="segment-label">
          {@render optionContent(option.value)}
        </span>
      {:else if option.icon}
        <i class={option.icon} aria-hidden="true"></i>
      {:else}
        <span class="segment-label">{option.shortLabel ?? option.label}</span>
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

  /* Dense toolbars need less visible chrome without making the targets harder
     to tap. The buttons stay 32px tall on screen and extend their hit area to
     48px, matching the established mobile hand-selector pattern. */
  .segmented-control.compact {
    gap: 1px;
    padding: 2px;
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
      width var(--duration-normal, 200ms) cubic-bezier(0.22, 1, 0.36, 1),
      background-color var(--duration-normal, 200ms) ease;
    z-index: 0;
  }

  .indicator[data-tone="blue"] {
    background: var(--prop-blue, #2e8bf0);
  }

  .indicator[data-tone="red"] {
    background: var(--prop-red, #ed1c24);
  }

  .indicator[data-tone="accent"] {
    background: var(--theme-accent, #8b6cff);
  }

  .compact .indicator {
    top: 2px;
    bottom: 2px;
    left: calc(2px + (100% - 4px) / var(--count) * var(--index));
    width: calc((100% - 4px) / var(--count) - 1px);
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

  .compact .segment {
    box-sizing: border-box;
    height: 32px;
    min-height: 32px;
    padding: 0 0.5rem;
    overflow: visible;
  }

  .compact .segment::before {
    content: "";
    position: absolute;
    inset: -8px 0;
  }

  .segment:hover {
    color: var(--theme-text);
  }

  .segment[data-tone="blue"]:not(.selected) {
    color: color-mix(
      in srgb,
      var(--prop-blue, #2e8bf0) 72%,
      var(--theme-text, #fff)
    );
  }

  .segment[data-tone="red"]:not(.selected) {
    color: color-mix(
      in srgb,
      var(--prop-red, #ed1c24) 72%,
      var(--theme-text, #fff)
    );
  }

  .segment[data-tone="accent"]:not(.selected) {
    color: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 68%,
      var(--theme-text, #fff)
    );
  }

  .segment[data-tone]:hover:not(.selected) {
    filter: brightness(1.18);
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
