<script lang="ts">
  /**
   * Generic faithful TEXT layer for a manifest page that maps to a page in the
   * original proof PDF. Renders the proof's exact text runs at their own
   * coordinates (PROOF_TEXT, keyed by manifest id) — same absolute-layer
   * technique as the bespoke built pages, but data-driven. Bold / italic /
   * bold-italic / heading + font size all come straight from the proof's fonts.
   *
   * Title is NOT rendered here (GuidePage draws it from the manifest). Images and
   * pictographs are NOT here yet — text only, to be perfected after.
   *
   * Body font is Cambria (the proof's actual face) so multi-run line spacing
   * matches the extracted x-coordinates, with Georgia/Times fallback off-Windows.
   */
  import { PROOF_TEXT, type ProofRun } from "../_data/proof-text";
  import { guideEdit, ptDrag, pt, editText, registerEditSource } from "../_data/guide-edit.svelte";

  let { id }: { id: string } = $props();

  const S = 816 / 612; // pt → px (4/3), same as the bespoke pages
  // Local mutable copy so ?edit drags can reposition runs; renders identically.
  let runs = $state<ProofRun[]>((PROOF_TEXT[id] ?? []).map((r) => ({ ...r })));

  const r1 = (n: number) => Math.round(n * 10) / 10;
  $effect(() =>
    registerEditSource(`Proof: ${id}`, () =>
      runs.map((r) => `  ${JSON.stringify(r.t).slice(0, 30)}: x: ${r1(r.x)}, y: ${r1(r.y)}`).join("\n")
    )
  );
</script>

<div class="proof-text">
  {#each runs as r, i (i)}
    <span
      class="run s-{r.s}"
      class:edit={guideEdit.on}
      class:selected={guideEdit.selectedId === `proof-${id}-run-${i}`}
      style="left:{r.x * S}px; top:{r.y * S}px; width:{r.w * S}px; font-size:{r.fs * S}px"
      use:ptDrag={pt(`proof-${id}-run-${i}`, r.t, r)}
      use:editText={{ id: `proof-${id}-run-${i}`, label: r.t, get: () => r.t, set: (v) => (r.t = v), plain: true }}
      >{r.t}</span
    >
  {/each}
</div>

<style>
  /* Absolute layer over the whole sheet; proof points map straight to pt×S. */
  .proof-text {
    position: absolute;
    inset: 0;
    color: #141414;
  }
  .run {
    position: absolute;
    font-family: "Cambria", Georgia, "Times New Roman", serif;
    line-height: 1;
    white-space: nowrap;
  }
  .s-bold {
    font-weight: 700;
  }
  .s-italic {
    font-style: italic;
  }
  .s-bolditalic {
    font-weight: 700;
    font-style: italic;
  }
  /* f1 (Monotype Corsiva) sub-headings — kept serif per the page-title-only
     script rule; sized by the proof, weighted to read as a heading. */
  .s-heading {
    font-weight: 600;
  }
  /* edit mode: show each run as a draggable block; selected = solid outline. */
  .run.edit {
    outline: 1px dashed rgba(55, 48, 163, 0.4);
    cursor: move;
  }
  .run.selected {
    outline: 1.5px solid #3730a3;
    outline-offset: 1px;
  }
</style>
