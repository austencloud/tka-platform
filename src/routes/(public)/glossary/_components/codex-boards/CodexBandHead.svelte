<!--
  A type's name over its band.

  The same three parts the printed sheet's heading has - the plain leading word
  ("Type 1: ") and the coloured segments that distinguish the type - at a scale
  a screen band can afford. The sheet sets its heading in 1.5rem italic serif
  and centres it, which costs about 40px per band; four of those is a row of
  pictographs. This is a left-aligned 0.9rem line instead. The facts and the
  colours are the sheet's; only the size and the alignment differ.

  Not flex: type.word ends in a space ("Type 1: "), and flex items swallow it.
-->
<script lang="ts">
  import { typeColor } from "./codex-letters";
  import type { CodexTypeDef } from "../../../guide/codex/_data/codex-groups";

  let { type }: { type: CodexTypeDef } = $props();
</script>

<h3 class="band-head" style:--type-c={typeColor(type)}>
  <span class="band-rule" aria-hidden="true"></span><span class="band-word"
    >{type.word}</span
  >{#each type.segs as seg (seg.t)}<span style:color={seg.c}>{seg.t}</span
    >{/each}
</h3>

<style>
  .band-head {
    margin: 0 0 0.25rem;
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-weight: 600;
    font-size: 0.9rem;
    line-height: 1.3;
    white-space: nowrap;
  }

  /* The same colour the rule under each box carries, so the heading and the
     rules under its boxes read as one band rather than two unrelated marks. */
  .band-rule {
    display: inline-block;
    width: 1.1rem;
    height: 0.2rem;
    margin-right: 0.45rem;
    vertical-align: 0.15em;
    border-radius: 999px;
    background: var(--type-c);
  }

  .band-word {
    color: var(--theme-text, oklch(0.96 0.01 270));
  }
</style>
