<!--
  /test/mandala-decoder

  Text-list proof of the mandala equivalence-class pipeline end-to-end in the
  browser. Loads the prebuilt fingerprint index (static/data/mandala-index.json,
  served at /data/mandala-index.json) and surfaces one glyph's equivalence class
  grouped by the three lenses: exact glyph, by-color (blue-only / red-only /
  combo), and rotation/mirror twins (same orbit).

  Scope: index + grouping proof only. The full live-decode deck picker — calling
  decode() with paths from calculate(steps) and rendering real mini-mandalas via
  MandalaRenderer — is a documented follow-up, intentionally not built here.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type {
    MandalaIndex,
    IndexedRef,
  } from "$lib/shared/mandala/services/mandala-index-builder";

  let index = $state<MandalaIndex | null>(null);
  let status = $state("loading index…");
  let selected = $state<{
    shapeKey: string;
    exact: IndexedRef[];
    blueOnly: IndexedRef[];
    redOnly: IndexedRef[];
    combo: IndexedRef[];
    twins: IndexedRef[];
  } | null>(null);

  onMount(async () => {
    const res = await fetch("/data/mandala-index.json");
    if (!res.ok) {
      status = `index missing (run scripts/build-mandala-index.ts) — ${res.status}`;
      return;
    }
    index = (await res.json()) as MandalaIndex;
    status = `${Object.keys(index.byShape).length} distinct glyphs indexed`;
  });

  function showGlyph(shapeKey: string) {
    if (!index) return;
    const refs = index.byShape[shapeKey] ?? [];
    const orbitKey = refs[0]?.orbitKey;
    const twins = (orbitKey ? (index.byOrbit[orbitKey] ?? []) : [])
      .filter((k) => k !== shapeKey)
      .flatMap((k) => index!.byShape[k] ?? []);
    selected = {
      shapeKey,
      exact: refs,
      blueOnly: refs.filter((r) => r.colorSig.blueOnly),
      redOnly: refs.filter((r) => r.colorSig.redOnly),
      combo: refs.filter((r) => !r.colorSig.blueOnly && !r.colorSig.redOnly),
      twins,
    };
  }
</script>

<main class="decoder">
  <h1>Mandala Decoder</h1>
  <p class="status">{status}</p>

  {#if index}
    <section class="glyph-list">
      <h2>Glyphs ({Object.keys(index.byShape).length})</h2>
      <ul>
        {#each Object.entries(index.byShape) as [key, refs]}
          <li>
            <button onclick={() => showGlyph(key)}>
              {refs[0]?.word ?? "?"}
              <span class="count">({refs.length} pathways)</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if selected}
    <section class="result">
      <h2>Exact glyph — {selected.exact.length} pathways</h2>
      <ul>
        {#each selected.exact as r}
          <li>{r.word} <small>({r.deck})</small></li>
        {/each}
      </ul>

      <h3>By color</h3>
      <p class="color-counts">
        blue-only {selected.blueOnly.length} ·
        red-only {selected.redOnly.length} ·
        combo {selected.combo.length}
      </p>

      <h3>Rotated / mirrored twins — {selected.twins.length}</h3>
      <ul>
        {#each selected.twins as r}
          <li>{r.word} <small>({r.deck})</small></li>
        {/each}
      </ul>
    </section>
  {/if}
</main>

<style>
  .decoder {
    padding: 1rem;
    color: var(--text-primary, #eee);
  }
  .status,
  .color-counts {
    font-variant-numeric: tabular-nums;
  }
  .count {
    opacity: 0.6;
  }
  button {
    cursor: pointer;
  }
</style>
