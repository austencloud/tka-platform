<!--
  RetroTooltip - Win95-style pale yellow tooltip

  Positioned absolutely near the target element. Shows after a delay
  on mouseenter, hides on mouseleave. Classic Win95 tooltip: #FFFFE1
  background, 1px black border, system font.

  Usage: Wrap a target element and provide the `text` prop.
  The tooltip auto-positions below the slotted content.

  Domain: Retro Desktop Shell
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    text,
    delay = 500,
    children,
  }: {
    text: string;
    delay?: number;
    children: Snippet;
  } = $props();

  let visible = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function handleMouseEnter() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      visible = true;
    }, delay);
  }

  function handleMouseLeave() {
    clearTimeout(timer);
    visible = false;
  }

  $effect(() => {
    return () => clearTimeout(timer);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class="retro-tooltip-anchor"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  {@render children()}
  {#if visible && text}
    <span class="retro-tooltip" role="tooltip">{text}</span>
  {/if}
</span>

<style>
  .retro-tooltip-anchor {
    position: relative;
    display: inline-flex;
  }

  .retro-tooltip {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    padding: 2px 4px;
    background: var(--retro-tooltip-bg, #ffffe1);
    border: 1px solid var(--retro-black, #000);
    color: var(--retro-black, #000);
    font-family: var(
      --retro-font-family,
      "Microsoft Sans Serif",
      Arial,
      sans-serif
    );
    font-size: var(--retro-font-size, 11px);
    white-space: nowrap;
    z-index: var(--retro-z-dropdown, 500);
    pointer-events: none;
    line-height: 1.3;
  }
</style>
