<!--
  FuseRecipePopover — a recipe-rail slot whose editor opens in a popover.

  The tile is the app's own BaseCard, the same one the Generate bento uses for
  Customize, so it carries the ripple, the glossy sheen, the lift on hover and
  the spring on press for free. bits-ui drives it through BaseCard's
  `triggerProps` seam rather than a second, flatter card being built here.

  Slots whose values are few and ordered (Length, Level, Grid, Pairing) hold
  their control on the card instead — see FuseRecipeRail.
-->
<script lang="ts">
  import { Popover } from "bits-ui";
  import BaseCard from "$lib/features/create/generate/components/cards/BaseCard.svelte";
  import type { FuseRecipeDestination } from "../domain/fuse-recipe-destination";
  import FuseRecipeSettingContent from "./FuseRecipeSettingContent.svelte";

  let {
    destination,
    title,
    summary,
    color,
    shadowColor,
    width = "34rem",
    align = "center",
    open = false,
    cardIndex = 0,
    headerFontSize = "9px",
    onOpenChange = () => {},
  }: {
    destination: FuseRecipeDestination;
    title: string;
    summary: string;
    color: string;
    shadowColor: string;
    width?: string;
    align?: "start" | "center" | "end";
    open?: boolean;
    cardIndex?: number;
    headerFontSize?: string;
    onOpenChange?: (open: boolean) => void;
  } = $props();

  const titleId = `fuse-recipe-${destination}-title`;

  function close(): void {
    onOpenChange(false);
  }
</script>

<Popover.Root {open} {onOpenChange}>
  <Popover.Trigger>
    {#snippet child({ props })}
      <BaseCard
        {title}
        currentValue={summary}
        {color}
        {shadowColor}
        {cardIndex}
        {headerFontSize}
        gridColumnSpan={1}
        ariaLabel="{title}: {summary}. Opens the {title} settings."
        triggerProps={props}
      />
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

<style>
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

  /* The popover is portaled to the body, so it reads --theme-card-bg from the
     root rather than from the workspace — and at the root that token is a light
     surface. Filling the close button with it made a white block the loudest
     thing in a dark panel. It takes the panel's own stroke and a wash of its
     card colour instead, which keeps it quieter than the settings it sits
     above and matches the dismiss in the recipe column. */
  .close-popover {
    display: grid;
    place-items: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    flex: 0 0 auto;
    border: 1px solid var(--theme-stroke-strong, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text);
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    cursor: pointer;
    transition:
      background var(--duration-fast, 140ms) var(--ease-out, ease),
      border-color var(--duration-fast, 140ms) var(--ease-out, ease);
  }

  .close-popover:hover {
    background: color-mix(in srgb, var(--theme-text) 16%, transparent);
    border-color: hsl(var(--recipe-shadow) / 55%);
  }

  .close-popover:focus-visible {
    outline: 3px solid var(--theme-text);
    outline-offset: 2px;
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
    :global(.fuse-recipe-popover) {
      padding: 20px;
      border-radius: 22px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.fuse-recipe-popover[data-state="open"]) {
      animation: none;
    }
  }
</style>
