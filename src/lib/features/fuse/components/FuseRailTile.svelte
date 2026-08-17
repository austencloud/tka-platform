<!--
  FuseRailTile — the shell every non-popover slot on the header's recipe rail
  wears.

  Most slots are a button that opens an editor (FuseRecipePopover). The ones that
  own a value with two or three settings do not open anything: the control sits
  in the tile and you press it. They still have to look like the rest of the
  rail, so the painted card — colour, gradient, stroke, shadow, label, height —
  lives here once instead of being copied into each of them.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    ariaLabel,
    color,
    shadowColor,
    textColor = "white",
    children,
    trailing,
  }: {
    label: string;
    ariaLabel?: string;
    color: string;
    shadowColor: string;
    textColor?: string;
    /** The control the tile exists to hold. */
    children: Snippet;
    /** Optional value or action shown on the label row. */
    trailing?: Snippet;
  } = $props();
</script>

<div
  class="rail-tile"
  role="group"
  aria-label={ariaLabel ?? label}
  style="--recipe-color: {color}; --recipe-shadow: {shadowColor}; --recipe-text: {textColor};"
>
  <div class="tile-head">
    <span class="tile-label">{label}</span>
    <!-- Reserved whether or not anything fills it, so a value that appears or
         changes never resizes the header. -->
    <span class="tile-trailing">{@render trailing?.()}</span>
  </div>

  {@render children()}
</div>

<style>
  .rail-tile {
    position: relative;
    display: grid;
    gap: 8px;
    align-content: center;
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
  }

  .tile-head {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: clamp(7px, 0.55cqw, 11px);
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

  .tile-trailing {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 2rem;
    min-width: 0;
  }

  @media (min-width: 2600px) and (min-height: 1400px) {
    .rail-tile {
      min-height: 5rem;
      border-radius: 18px;
    }

    .tile-trailing {
      height: 2.6rem;
    }

    .tile-label {
      font-size: 0.8rem;
    }
  }
</style>
