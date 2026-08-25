<!--
  What the coloured rule under each box means.

  The printed sheet names its types in a heading above each block; a flat flow
  has no blocks, so the naming moves here and the rule carries the colour. Only
  the boards built on CodexFlow need it - Sheets still has the literal headings.
-->
<script lang="ts">
  import { CODEX_TYPES, typeColor } from "./codex-letters";
</script>

<ul class="legend">
  {#each CODEX_TYPES as type (type.n)}
    <li class="legend-item">
      <span class="swatch" style:background={typeColor(type)}></span>
      <span class="legend-word">{type.word}</span><span
        class="legend-seg"
        style:color={typeColor(type)}>{type.segs.map((s) => s.t).join("")}</span
      >
    </li>
  {/each}
</ul>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.8rem;
    line-height: 1.2;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--theme-text-muted, oklch(0.72 0.015 270));
  }
  .swatch {
    width: 0.9rem;
    height: 0.25rem;
    border-radius: 999px;
    flex: 0 0 auto;
  }
  .legend-word {
    color: var(--theme-text, oklch(0.96 0.01 270));
  }
  .legend-seg {
    font-weight: 700;
  }
</style>
