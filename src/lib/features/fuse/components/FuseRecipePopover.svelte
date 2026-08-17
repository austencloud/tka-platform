<!--
  FuseRecipePopover — one tile on the header's recipe rail.

  Most tiles answer their question in a popover hung under the tile. A tile that
  passes `onActivate` does the thing itself instead — Grid flips between its two
  values on the spot, and Pairing opens the recipe drawer at its own section
  because that editor is a nine-choice, two-step form a popover could only show
  by clipping itself into an inner scroller.

  No leading icon, deliberately. Six tiles each carrying a glyph in its own
  bordered box read as six badges competing with the words; the tile already
  names itself, and the trailing glyph is the only one that says something the
  label does not — whether pressing this opens a menu, flips a value, or moves
  you into a panel.
-->
<script lang="ts">
  import { Popover } from "bits-ui";
  import type { FuseRecipeDestination } from "../domain/fuse-recipe-destination";
  import FuseRecipeSettingContent from "./FuseRecipeSettingContent.svelte";

  let {
    destination,
    title,
    summary,
    color,
    shadowColor,
    textColor = "white",
    width = "34rem",
    align = "center",
    open = false,
    disabled = false,
    onOpenChange = () => {},
    onActivate,
    trailingIcon,
    ariaLabel,
  }: {
    destination: FuseRecipeDestination;
    title: string;
    summary: string;
    color: string;
    shadowColor: string;
    textColor?: string;
    width?: string;
    align?: "start" | "center" | "end";
    open?: boolean;
    disabled?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Act on press instead of opening a popover. */
    onActivate?: () => void;
    /** Overrides the trailing glyph. Defaults to what the press will do. */
    trailingIcon?: string;
    /** Overrides the spoken label, for tiles whose press is not "edit". */
    ariaLabel?: string;
  } = $props();

  const glyph = $derived(
    trailingIcon ?? (onActivate ? "fa-chevron-right" : "fa-chevron-down")
  );

  const titleId = `fuse-recipe-${destination}-title`;

  function close(): void {
    onOpenChange(false);
  }
</script>

{#snippet tile(triggerProps: Record<string, unknown>)}
  <button
    {...triggerProps}
    type="button"
    class="recipe-tile"
    class:open
    {disabled}
    aria-label={ariaLabel ?? `Edit ${title}: ${summary}`}
    style="--recipe-color: {color}; --recipe-shadow: {shadowColor}; --recipe-text: {textColor};"
  >
    <span class="tile-copy">
      <span class="tile-label">{title}</span>
      <strong>{summary}</strong>
    </span>
    <i class="fas {glyph} tile-chevron" aria-hidden="true"></i>
  </button>
{/snippet}

{#if onActivate}
  {@render tile({ onclick: onActivate })}
{:else}
  <Popover.Root {open} {onOpenChange}>
    <Popover.Trigger>
      {#snippet child({ props })}
        {@render tile(props)}
      {/snippet}
    </Popover.Trigger>

    <Popover.Portal>
      <Popover.Content
        side="bottom"
        {align}
        sideOffset={10}
        collisionPadding={18}
        class="fuse-recipe-popover"
        aria-labelledby={titleId}
        style="--popover-width: {width}; --recipe-color: {color}; --recipe-shadow: {shadowColor};"
      >
        <header class="popover-header">
          <div>
            <span>Fuse recipe</span>
            <h3 id={titleId}>{title}</h3>
          </div>
          <button
            type="button"
            class="close-popover"
            onclick={close}
            aria-label="Close {title} settings"
          >
            <i class="fas fa-xmark" aria-hidden="true"></i>
          </button>
        </header>

        <div class="popover-body">
          <FuseRecipeSettingContent
            {destination}
            presentation="popover"
            onCancel={close}
            onApply={close}
          />
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
{/if}

<style>
  .recipe-tile {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: clamp(7px, 0.55cqw, 11px);
    width: 100%;
    min-width: 0;
    min-height: 3.75rem;
    padding: 8px clamp(9px, 0.65cqw, 14px);
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: 14px;
    color: var(--recipe-text);
    background:
      linear-gradient(
        132deg,
        color-mix(in srgb, white 18%, transparent),
        transparent 42%
      ),
      var(--recipe-color);
    box-shadow:
      0 8px 18px hsl(var(--recipe-shadow) / 24%),
      inset 0 1px 0 color-mix(in srgb, white 18%, transparent);
    text-align: left;
    cursor: pointer;
    transition:
      transform var(--duration-fast, 120ms) ease,
      border-color var(--duration-fast, 120ms) ease,
      box-shadow var(--duration-fast, 120ms) ease;
  }

  .recipe-tile::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 55%, rgba(0, 0, 0, 0.1));
    pointer-events: none;
  }

  /* Emphasis is mixed from the tile's own text colour, not from white. The Level
     tile now takes the app's level palette, which is a pale blue at 1 and a gold
     at 3 with black text — a white hover border and a white focus ring both
     disappear against those. currentColor is white on the dark tiles and black
     on the light ones, so the same rule reads on every tile in the rail. */
  .recipe-tile:hover:not(:disabled),
  .recipe-tile.open {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, currentColor 52%, var(--theme-stroke));
    box-shadow:
      0 12px 24px hsl(var(--recipe-shadow) / 36%),
      inset 0 1px 0 color-mix(in srgb, white 28%, transparent);
  }

  .recipe-tile:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: 2px;
  }

  .close-popover:focus-visible {
    outline: 3px solid var(--theme-text);
    outline-offset: 2px;
  }

  .recipe-tile:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tile-copy {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .tile-label {
    overflow: hidden;
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.055em;
    opacity: 0.76;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .tile-copy strong {
    overflow: hidden;
    font-size: var(--font-size-min, 14px);
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile-chevron {
    position: relative;
    z-index: 1;
    font-size: 11px;
    opacity: 0.76;
    transition: transform var(--duration-fast, 120ms) ease;
  }

  .open .tile-chevron {
    transform: rotate(180deg);
  }

  :global(.fuse-recipe-popover) {
    z-index: var(--z-dropdown, 1000);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: min(var(--popover-width), calc(100vw - 36px));
    max-height: min(46rem, calc(100vh - 36px));
    padding: 15px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke));
    border-radius: 18px;
    background:
      linear-gradient(var(--theme-panel-bg), var(--theme-panel-bg)),
      color-mix(in srgb, var(--theme-text) 8%, black);
    box-shadow:
      0 24px 72px var(--theme-shadow),
      0 0 36px hsl(var(--recipe-shadow) / 16%);
  }

  :global(.fuse-recipe-popover[data-state="open"]) {
    animation: recipe-popover-in 150ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 0 12px 4px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .popover-header > div {
    display: grid;
    gap: 1px;
  }

  .popover-header span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .popover-header h3 {
    margin: 0;
    color: var(--theme-text);
    font-size: 1.05rem;
  }

  .close-popover {
    display: grid;
    place-items: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    flex: 0 0 auto;
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text);
    background: var(--theme-card-bg);
    cursor: pointer;
  }

  .popover-body {
    min-width: 0;
    min-height: 0;
    padding-top: 14px;
    overflow: auto;
    scrollbar-gutter: stable;
  }

  @keyframes recipe-popover-in {
    from {
      transform: translateY(-6px) scale(0.985);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  @media (min-width: 2600px) and (min-height: 1400px) {
    .recipe-tile {
      min-height: 5rem;
      border-radius: 18px;
    }

    .tile-label {
      font-size: 0.8rem;
    }

    .tile-copy strong {
      font-size: 1rem;
    }

    :global(.fuse-recipe-popover) {
      padding: 20px;
      border-radius: 22px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .recipe-tile,
    .tile-chevron,
    :global(.fuse-recipe-popover[data-state="open"]) {
      transition: none;
      animation: none;
    }
  }
</style>
