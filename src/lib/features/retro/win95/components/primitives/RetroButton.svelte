<!--
  RetroButton - 98.css-styled pushbutton primitive

  Renders as either a label string or custom snippet content (for icon buttons).
  The isDefault prop adds the thicker border indicating the dialog's default action.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label = "",
    disabled = false,
    isDefault = false,
    saveShortcut = false,
    onclick,
    children,
  }: {
    label?: string;
    disabled?: boolean;
    isDefault?: boolean;
    saveShortcut?: boolean;
    onclick?: () => void;
    children?: Snippet;
  } = $props();
</script>

<button
  data-save-shortcut={saveShortcut ? "" : undefined}
  class:default={isDefault}
  {disabled}
  {onclick}
  type="button"
>
  {#if children}
    {@render children()}
  {:else}
    {label}
  {/if}
</button>

<style>
  button {
    min-width: 75px;
    min-height: 23px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    padding: var(--retro-padding-sm, 2px) var(--retro-padding-lg, 8px);
  }

  button.default {
    /* 98.css applies the thick border via the "default" class automatically */
    font-weight: bold;
  }

  button:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: -4px;
  }
</style>
