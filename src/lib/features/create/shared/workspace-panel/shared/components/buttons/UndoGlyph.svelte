<!--
  UndoGlyph.svelte

  The Undo button's glyph — an inline SVG arrow, the one workspace-button icon
  that isn't a FontAwesome class. Shared by the real UndoButton and the create
  tutorial's diagram so the two can never draw a different undo icon. Sizes via
  width/height + currentColor, so it carries no parent-scoped CSS dependency and
  is safe to render inside either component.
-->
<script lang="ts">
  let { size = 20 }: { size?: number } = $props();
</script>

<svg
  class="undo-glyph"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <path
    d="M9 14L4 9L9 4"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M4 9H15A6 6 0 0 1 15 21H13"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>

<style>
  .undo-glyph {
    flex-shrink: 0;
  }
</style>
