<!--
  RhythmGlyph.svelte
  Inline twin-dot (2-lane) or single-dot (1-lane) preview of a rhythm mask over
  `sampleBeats` beats. Used as the leading glyph inside rhythm chips.
-->
<script lang="ts">
  import { maskAt, activeAt } from "$lib/shared/create/domain/rhythm/rhythm-mask";

  interface Props {
    sym: string;
    lanes?: 1 | 2;
    sampleBeats?: number;
  }
  let { sym, lanes = 2, sampleBeats = 4 }: Props = $props();

  const beats = $derived(Array.from({ length: sampleBeats }, (_, i) => i));
</script>

<span class="glyph" aria-hidden="true">
  {#if lanes === 2}
    <span class="row">
      {#each beats as i}<span class="dot" class:blue={maskAt(sym, i).blue}></span>{/each}
    </span>
    <span class="row">
      {#each beats as i}<span class="dot" class:red={maskAt(sym, i).red}></span>{/each}
    </span>
  {:else}
    <span class="row">
      {#each beats as i}<span class="dot" class:hold={activeAt(sym, i)}></span>{/each}
    </span>
  {/if}
</span>

<style>
  .glyph { display: inline-flex; flex-direction: column; gap: 2px; }
  .row { display: flex; gap: 2px; }
  .dot {
    width: 7px; height: 7px; border-radius: 2px;
    background: color-mix(in srgb, var(--theme-text) 16%, transparent);
  }
  .dot.blue { background: var(--theme-blue, #6f9bff); }
  .dot.red { background: var(--theme-red, #ff7a8a); }
  .dot.hold { background: var(--theme-accent, #2dd4bf); }
</style>
