<script lang="ts">
  import { getGlyphCache } from "$lib/shared/render/get-glyph-cache";
  import { isDashLetter, getBaseLetter } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
  import { compressWord, type CompressedSegment } from "$lib/shared/foundation/utils/word-simplifier";

  interface Props {
    word: string;
    /** Height of each glyph in px. Dash bar scales proportionally. */
    height?: number;
    darkMode?: boolean;
  }

  let { word, height = 32, darkMode = false }: Props = $props();

  const cache = getGlyphCache();

  const DASH_HEIGHT_RATIO = 0.20;
  const DASH_WIDTH_RATIO = 0.70;
  const DASH_GAP_RATIO = 0.10;
  const LETTER_GAP_RATIO = 0.12;
  const DOT_SIZE_RATIO = 0.15;
  const GROUP_GAP_RATIO = 0.35;

  const segments = $derived(word ? compressWord(word) : []);
  const hasCompression = $derived(segments.some((s: CompressedSegment) => s.repeat > 1));
</script>

{#if segments.length > 0}
  <div class="tka-word-glyph" class:dark-mode={darkMode} style="height: {height}px;">
    {#each segments as segment, segIdx}
      {#if segIdx > 0 && hasCompression}
        <span
          class="group-dot"
          style="width: {height * DOT_SIZE_RATIO}px; height: {height * DOT_SIZE_RATIO}px; margin: 0 {height * GROUP_GAP_RATIO * 0.5}px;"
        ></span>
      {/if}
      <span class="token-row" style="gap: {height * LETTER_GAP_RATIO}px;">
        {#each segment.tokens as token}
          {@const baseLetter = isDashLetter(token) ? getBaseLetter(token) : token}
          {@const dataUrl = cache.getGlyphDataUrl(baseLetter)}
          {#if dataUrl}
            {@const isAlpha = baseLetter === 'α'}
            <span class="glyph" style="gap: {height * DASH_GAP_RATIO}px;">
              <img src={dataUrl} alt={token} height={height} draggable="false" class:alpha-baseline={isAlpha} />
              {#if isDashLetter(token)}
                <span
                  class="dash-bar"
                  style="height: {height * DASH_HEIGHT_RATIO}px; width: {height * DASH_WIDTH_RATIO}px;"
                ></span>
              {/if}
            </span>
          {/if}
        {/each}
      </span>
    {/each}
  </div>
{/if}

<style>
  .tka-word-glyph {
    display: flex;
    align-items: center;
    overflow: hidden;
  }

  .token-row {
    display: flex;
    align-items: center;
  }

  .glyph {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .glyph img {
    display: block;
    width: auto;
  }

  .glyph img.alpha-baseline {
    transform: translateY(10%);
  }

  .dark-mode .glyph img {
    filter: invert(0.9);
  }

  .dash-bar {
    display: inline-block;
    background: currentColor;
    border-radius: 9999px;
    flex-shrink: 0;
  }

  .group-dot {
    display: inline-block;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.4;
    flex-shrink: 0;
  }
</style>
