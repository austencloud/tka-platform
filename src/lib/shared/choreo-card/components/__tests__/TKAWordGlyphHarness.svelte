<script lang="ts">
  import TKAWordGlyph from "../TKAWordGlyph.svelte";

  let {
    width,
    word,
  }: {
    width: number;
    word: string;
  } = $props();
</script>

<div data-testid="glyph-host" style="width: {width}px;">
  <TKAWordGlyph {word} height={40} darkMode fitToParent />
</div>

<style>
  :global(.glyph img) {
    width: 40px !important;
  }
</style>
