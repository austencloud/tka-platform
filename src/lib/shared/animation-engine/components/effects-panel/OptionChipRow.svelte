<script lang="ts" generics="T extends string">
  /**
   * OptionChipRow — single-select chip row for effect-customize panels.
   *
   * The shared replacement for the `.option-row` markup that used to be copy-
   * pasted into every `*Customize.svelte`. A row label sits above a wrapping
   * group of `role="radio"` chips (exactly one active). Each option may carry a
   * leading FontAwesome icon or a color swatch dot (palette rows). The chip
   * never shrinks below its own text, so long labels ("Prop-Matched") wrap as
   * whole chips instead of overflowing the button box.
   *
   * Not SegmentedControl: that primitive keeps every segment equal-width, which
   * becomes unreadable for a large set of variable-length labels. These chips
   * keep their words intact and wrap instead.
   */
  interface Option {
    value: T;
    label: string;
    /** Optional consequence shown by the tile layout. */
    description?: string;
    /** FontAwesome class without the leading "fas", e.g. "fa-ruler". */
    icon?: string;
    /** CSS color for a leading swatch dot (palette rows). */
    swatch?: string;
    /**
     * Per-option accent, overriding the row `color`. Opt-in: rows whose options
     * carry no meaning of their own leave it unset and stay one accent.
     */
    accent?: string;
    /**
     * Second accent for an option that composes two things (Fuse's Mirror +
     * Invert). Differing from `accent` turns the active chip into the same
     * two-stop sweep a composite LOOP button paints.
     */
    accent2?: string;
  }

  interface Props {
    /** Row label shown above the chip group. */
    label: string;
    /** radiogroup aria-label; defaults to the row label. */
    ariaLabel?: string;
    options: readonly Option[];
    value: T;
    onChange: (value: T) => void;
    /** Selected border/fill color. Defaults to the current theme accent. */
    color?: string;
    /** Prevent selection while the owning workflow is busy. */
    disabled?: boolean;
    /** Stack the label above the chips when the option set needs more room. */
    layout?: "inline" | "stacked" | "tiles";
  }

  const {
    label,
    ariaLabel,
    options,
    value,
    onChange,
    color = "var(--theme-accent, #8b5cf6)",
    disabled = false,
    layout = "inline",
  }: Props = $props();
</script>

<div
  class="option-row"
  class:stacked={layout === "stacked"}
  class:tiles={layout === "tiles"}
  style:--option-accent={color}
>
  <span class="option-label">{label}</span>
  <div class="chip-group" role="radiogroup" aria-label={ariaLabel ?? label}>
    {#each options as option (option.value)}
      {@const accent2 = option.accent2 ?? option.accent}
      <button
        class="chip"
        class:swatch-chip={option.swatch != null}
        class:active={value === option.value}
        class:duotone={option.accent != null && accent2 !== option.accent}
        style={option.accent
          ? `--option-accent: ${option.accent}; --option-accent-2: ${accent2};`
          : undefined}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        {disabled}
        data-ghost={value === option.value || disabled ? undefined : "safe"}
        data-ghost-kind={value === option.value || disabled
          ? undefined
          : "effect-param"}
        data-ghost-label={option.label}
        onclick={() => onChange(option.value)}
      >
        {#if option.swatch != null}
          <span
            class="swatch"
            style="background: {option.swatch}"
            aria-hidden="true"
          ></span>
        {:else if option.icon}
          <i class="fas {option.icon}" aria-hidden="true"></i>
        {/if}
        <span class="chip-copy">
          <span class="chip-label">{option.label}</span>
          {#if option.description}
            <span class="chip-description">{option.description}</span>
          {/if}
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  /* Dense inline row: label sits BESIDE the chips (not stacked above), so a
     segmented control is one ~44px row instead of two. The chip group takes the
     remaining width and wraps only when it genuinely can't fit. */
  .option-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .option-label {
    flex: 0 0 auto;
    min-width: 3.25rem;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .chip-group {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .chip-copy {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .chip-label {
    min-width: 0;
  }

  .chip-description {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    line-height: 1.25;
  }

  .option-row.stacked {
    flex-direction: column;
    align-items: stretch;
  }

  .stacked .option-label {
    min-width: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
  }

  .option-row.tiles {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .tiles .option-label {
    min-width: 0;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  .tiles .chip-group {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .tiles .chip {
    position: relative;
    justify-content: flex-start;
    min-width: 0;
    min-height: max(var(--min-touch-target, 44px), 62px);
    padding: 10px 12px;
    text-align: left;
  }

  .tiles .chip i {
    display: grid;
    place-items: center;
    flex: 0 0 28px;
    width: 28px;
    height: 28px;
    color: color-mix(in srgb, var(--option-accent) 78%, var(--theme-text));
    font-size: var(--font-size-min, 14px);
  }

  /* Selection is a property of the whole tile, so the whole tile carries it:
     a full ring, never a strip down one edge. See no-left-edge-accent-bar.md. */
  .tiles .chip.active {
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--option-accent) 55%, transparent),
      0 8px 20px -16px var(--option-accent);
  }

  .tiles .chip.active .chip-description {
    color: color-mix(in srgb, var(--theme-text) 76%, transparent);
  }

  @container fuse (max-width: 1180px) {
    .tiles .chip-group {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  /* The settings sheet is portalled out of the `fuse` container, so the query
     above never reaches it. On a phone that left three ~93px tiles wrapping
     "Rotate 90 / Turn one quarter" over four lines. Viewport width is the only
     signal available on the far side of the portal. */
  @media (max-width: 620px) {
    .tiles .chip-group {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  /* A desktop-height Fuse workspace has two source LOOPs below this chooser.
     Keep the full explanatory gallery for native 4K, but pack ordinary desktop
     into two rows so neither LOOP loses its action bar. */
  @container fuse (min-width: 1181px) and (max-width: 2599px) and (min-height: 780px) {
    .tiles .chip-group {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .tiles .chip {
      flex-direction: column;
      min-height: var(--min-touch-target, 48px);
      padding: 8px 10px;
      gap: 3px;
      justify-content: center;
      text-align: center;
    }

    .tiles .chip i {
      flex-basis: auto;
      width: auto;
      height: auto;
      font-size: var(--font-size-compact, 14px);
    }

    .tiles .chip-label {
      white-space: nowrap;
    }

    .tiles .chip-description {
      display: none;
    }
  }

  @container fuse (min-width: 2600px) and (min-height: 1400px) {
    .option-row.tiles,
    .tiles .chip-group {
      gap: 12px;
    }

    .tiles .chip {
      min-height: 78px;
      padding: 12px 14px;
    }
  }

  .chip {
    --option-accent-2: var(--option-accent);
    flex: 1 1 auto;
    min-width: max-content;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .chip.active {
    background: color-mix(in srgb, var(--option-accent) 17%, transparent);
    border-color: var(--option-accent);
    color: var(--theme-text, white);
  }

  /* An option that composes two things wears both colors, swept the same 135deg
     as a composite LOOP button so the pairing reads identically in both places.
     The second stop rides high (24%) because at the flat tint's 9% the second
     colour simply vanished into the first. */
  .chip.active.duotone {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--option-accent) 24%, transparent) 0%,
      color-mix(in srgb, var(--option-accent-2) 24%, transparent) 100%
    );
    border-color: color-mix(in srgb, var(--option-accent) 78%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--option-accent-2) 62%, transparent),
      0 8px 20px -16px var(--option-accent-2);
  }

  .chip:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .chip:focus-visible {
    outline: 2px solid var(--option-accent);
    outline-offset: 2px;
  }

  .chip i {
    font-size: var(--font-size-compact, 12px);
  }

  /* Palette swatch rows pack two-up so a 6-7 color list stays compact. */
  .swatch-chip {
    flex: 1 1 40%;
  }

  .swatch {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
  }
</style>
