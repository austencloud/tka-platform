<script lang="ts">
  import { getGlyphCache } from "$lib/shared/render/getGlyphCache";
  import { isDashLetter, getBaseLetter } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
  import { tokenizeWord } from "$lib/shared/pictograph/tka-glyph/utils/word-tokenizer";

  interface Props {
    word: string;
    /** Height of each glyph in px. Dash bar scales proportionally. */
    height?: number;
  }

  let { word, height = 32 }: Props = $props();

  const cache = getGlyphCache();

  // Dash bar dimensions as fractions of glyph height.
  // Derived from Dash.svelte constants (DASH_H=20, DASH_W=70) relative to
  // a typical letter natural height of ~65px in the trimmed SVG viewBox.
  const DASH_HEIGHT_RATIO = 0.31;
  const DASH_WIDTH_RATIO = 1.08;

  const tokens = $derived(word ? tokenizeWord(word) : []);
</script>

{#if tokens.length > 0}
  <div class="tka-word-glyph" style="height: {height}px">
    {#each tokens as token}
      {@const baseLetter = isDashLetter(token) ? getBaseLetter(token) : token}
      {@const dataUrl = cache.getGlyphDataUrl(baseLetter)}
      {#if dataUrl}
        <span class="glyph">
          <img
            src={dataUrl}
            alt={token}
            height={height}
            draggable="false"
          />
          {#if isDashLetter(token)}
            <span
              class="dash-bar"
              style="height: {height * DASH_HEIGHT_RATIO}px; width: {height * DASH_WIDTH_RATIO}px;"
            ></span>
          {/if}
        </span>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .tka-word-glyph {
    display: flex;
    align-items: center;
    gap: 0.15em;
    overflow: hidden;
  }

  .glyph {
    display: flex;
    align-items: center;
    gap: 0.1em;
    flex-shrink: 0;
  }

  .glyph img {
    display: block;
    width: auto;
  }

  .dash-bar {
    display: inline-block;
    background: currentColor;
    border-radius: 9999px;
    flex-shrink: 0;
  }
</style>
