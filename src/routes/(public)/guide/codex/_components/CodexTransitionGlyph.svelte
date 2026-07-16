<script lang="ts">
  /**
   * Canonical position-transition glyph for codex box/cell headers - renders
   * "α→β" (or a single "γ") using the SAME letter + arrow SVG assets the
   * pictograph PositionGlyph uses (images/letters_trimmed/Type6 + arrow.svg),
   * instead of typing the Greek letters as text. Matches the original printed
   * guide, where these headers are the system's glyphs, not font glyphs.
   */
  const GROUP_TO_SVG: Record<string, string> = {
    α: "/images/letters_trimmed/Type6/α.svg",
    β: "/images/letters_trimmed/Type6/β.svg",
    γ: "/images/letters_trimmed/Type6/γ.svg",
  };
  const ARROW_SVG = "/images/arrow.svg";

  let { text }: { text: string } = $props();

  // "α→β" → ["α","β"]; "γ" → ["γ"]. Unknown letters fall back to plain text.
  const parts = $derived(text.split("→").map((s) => s.trim()));
  const renderable = $derived(parts.length >= 1 && parts.every((p) => GROUP_TO_SVG[p]));
</script>

{#if renderable}
  <span class="transition-glyph" role="img" aria-label={text}>
    {#each parts as part, i (i)}
      {#if i > 0}
        <img class="arrow" src={ARROW_SVG} alt="" />
      {/if}
      <img class="letter" src={GROUP_TO_SVG[part]} alt="" />
    {/each}
  </span>
{:else}
  <span class="transition-glyph">{text}</span>
{/if}

<style>
  .transition-glyph {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #1a1a1a;
    line-height: 1;
  }

  .letter {
    height: 13px;
    width: auto;
    display: block;
  }

  .arrow {
    width: 14px;
    height: auto;
    display: block;
  }
</style>
