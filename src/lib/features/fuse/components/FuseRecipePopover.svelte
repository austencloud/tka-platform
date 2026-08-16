<!--
  FuseRecipePopover — one tile on the header's recipe rail.

  Most tiles answer their question in a popover hung under the tile. A tile that
  passes `onActivate` instead opens the recipe drawer at its own section: the
  pairing editor is a nine-choice, two-step form, and a popover could only show
  it by clipping itself into an inner scroller. One editor, one presentation —
  the same panel the follower card's "Rebuilt from" button opens.
-->
<script lang="ts">
  import { Popover } from "bits-ui";
  import type { FuseRecipeDestination } from "../domain/fuse-recipe-destination";
  import FuseRecipeSettingContent from "./FuseRecipeSettingContent.svelte";

  let {
    destination,
    title,
    summary,
    icon,
    color,
    shadowColor,
    textColor = "white",
    width = "34rem",
    align = "center",
    open = false,
    disabled = false,
    onOpenChange = () => {},
    onActivate,
  }: {
    destination: FuseRecipeDestination;
    title: string;
    summary: string;
    icon: string;
    color: string;
    shadowColor: string;
    textColor?: string;
    width?: string;
    align?: "start" | "center" | "end";
    open?: boolean;
    disabled?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Route this tile to the recipe drawer instead of a popover. */
    onActivate?: () => void;
  } = $props();

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
    aria-label="Edit {title}: {summary}"
    style="--recipe-color: {color}; --recipe-shadow: {shadowColor}; --recipe-text: {textColor};"
  >
    <span class="tile-icon" aria-hidden="true">
      <i class={icon}></i>
    </span>
    <span class="tile-copy">
      <span class="tile-label">{title}</span>
      <strong>{summary}</strong>
    </span>
    <i
      class="fas {onActivate ? 'fa-chevron-right' : 'fa-chevron-down'} tile-chevron"
      aria-hidden="true"
    ></i>
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
    grid-template-columns: auto minmax(0, 1fr) auto;
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

  .recipe-tile:hover:not(:disabled),
  .recipe-tile.open {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, white 58%, var(--theme-stroke));
    box-shadow:
      0 12px 24px hsl(var(--recipe-shadow) / 36%),
      inset 0 1px 0 color-mix(in srgb, white 28%, transparent);
  }

  .recipe-tile:focus-visible,
  .close-popover:focus-visible {
    outline: 3px solid var(--theme-text);
    outline-offset: 2px;
  }

  .recipe-tile:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tile-icon {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, black 14%, transparent);
    font-size: var(--font-size-min, 14px);
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

    .tile-icon {
      width: 2.6rem;
      height: 2.6rem;
      font-size: 1rem;
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
