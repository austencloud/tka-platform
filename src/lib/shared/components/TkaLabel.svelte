<!--
  TkaLabel — a name that might be a Kinetic Alphabet word.

  Titles in this app come from two different places. Some are TKA words the
  system derived from a sequence ("BBBA", "ΩORZ"); some are names a person typed
  ("Sunrise", "Tunnel #3"). A word is only a word if it is drawn in the
  alphabet — showing "ΩORZ" in the UI's sans-serif is showing the wrong
  alphabet — but running a typed name through the glyph renderer would turn it
  into letter soup. This component makes that call once, in one place, so every
  surface answers it the same way.

  Sizing rides on the caller's own font-size rather than a px prop, so a title
  set in `clamp()` or riding the 4K root ramp keeps its glyphs in proportion.
  The probe span below is how that measurement happens: it is exactly 1em tall
  and zero wide, and its bound clientHeight is the caller's em in pixels.
-->
<script lang="ts">
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { isTkaWord } from "$lib/shared/foundation/utils/word-simplifier";

  interface Props {
    /** The name to render. Rendered as glyphs only when it is a TKA word. */
    text: string;
    /** Glyph height as a multiple of the caller's font-size. Cap height rather
     *  than em box, so 1em of glyph reads slightly small next to 1em of text. */
    scale?: number;
    /** Pass true on dark grounds so the dash bar and group dot invert with the
     *  letters (TKAWordGlyph pins currentColor rather than inheriting). */
    darkMode?: boolean;
    /** Scale a long word down to the available width instead of clipping it. */
    fitToParent?: boolean;
  }

  let {
    text,
    scale = 1.15,
    darkMode = false,
    fitToParent = true,
  }: Props = $props();

  let emPx = $state(0);

  const asGlyphs = $derived(isTkaWord(text));
  // 16 is the browser default and only ever applies for the single frame before
  // the probe reports, so the glyphs never flash in at the wrong size and never
  // flash as text either.
  const glyphHeight = $derived((emPx || 16) * scale);
</script>

<span class="tka-label" class:glyphs={asGlyphs}>
  <span class="em-probe" aria-hidden="true" bind:clientHeight={emPx}></span>
  {#if asGlyphs}
    <TKAWordGlyph word={text} height={glyphHeight} {darkMode} {fitToParent} />
  {:else}
    {text}
  {/if}
</span>

<style>
  .tka-label {
    display: block;
    /* Positioned so the em probe can be taken out of flow: as a static block it
       would break the nowrap text onto its own line. */
    position: relative;
    min-width: 0;
    /* Text mode carries the ellipsis itself — the caller's .title class holds
       the font, this holds the truncation. */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tka-label.glyphs {
    /* TKAWordGlyph clips and centers itself when fitToParent is on; a second
       overflow:hidden here would crop the glyph row it just scaled to fit. */
    overflow: visible;
  }

  .em-probe {
    /* Zero-width, exactly one em tall: a ruler for the caller's font-size that
       takes no space in flow and is invisible to assistive tech. */
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 1em;
    visibility: hidden;
    pointer-events: none;
  }
</style>
