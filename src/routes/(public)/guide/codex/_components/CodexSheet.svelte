<script lang="ts">
  import CodexBox from "./CodexBox.svelte";
  import type { CodexSheetDef } from "../_data/codex-groups";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { GuideCodexVisibility } from "../../level-1/_data/guide-codex-persistence";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  let {
    sheet,
    embed = false,
    propType,
    visibility,
    getData,
    onCellSelect,
  }: {
    sheet: CodexSheetDef;
    /** Render only the type blocks - no sheet chrome (size/padding/background)
     *  and no title - for hosting inside another page frame (the Level 1 guide's
     *  GuidePage owns the sheet + paints the manifest title). */
    embed?: boolean;
    /** Interactive-reader overrides - all undefined for print/card callers,
     *  which keeps this component's default (canonical) rendering untouched. */
    propType?: PropType;
    visibility?: GuideCodexVisibility;
    getData?: (id: string) => PictographData | null | undefined;
    onCellSelect?: (id: string) => void;
  } = $props();
</script>

<section class="codex-sheet" class:embed>
  {#if sheet.title && !embed}
    <h1 class="sheet-title">{sheet.title}</h1>
  {/if}

  {#each sheet.types as type (type.n)}
    {#if type.divider}<hr class="type-divider" />{/if}
    <div class="type-block">
      <h2 class="type-head">
        <span class="type-word">{type.word}</span>{#each type.segs as seg}<span
            style:color={seg.c}>{seg.t}</span
          >{/each}
      </h2>
      <div class="type-boxes">
        {#each type.boxes as box, i (i)}
          <!-- Boxes alternate left/right down the 2-column sheet grid; the side
               pins each transition glyph to its OUTER corner (OG parity).
               Full-width boxes have no side - their header (if any) centers. -->
          <CodexBox
            {box}
            side={box.full ? undefined : i % 2 === 0 ? "left" : "right"}
            {propType}
            {visibility}
            {getData}
            {onCellSelect}
          />
        {/each}
      </div>
    </div>
  {/each}
</section>

<style>
  .codex-sheet {
    width: 8.5in;
    min-height: 11in;
    box-sizing: border-box;
    /* Tight vertical padding: the 110px cells + two type sections use nearly
       the whole 11in - fat margins here push the sheet onto a second page. */
    padding: 0.25in 0.5in 0.25in;
    background: #fff;
    color: #111;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* Embedded in another page frame (guide): the host owns sheet chrome. */
  .codex-sheet.embed {
    width: 100%;
    min-height: 0;
    padding: 0;
    background: transparent;
  }

  .sheet-title {
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-weight: 500;
    font-size: 2.6rem;
    letter-spacing: 0.01em;
    margin: 0 0 0.02in;
    color: #1a1a1a;
  }

  .type-divider {
    width: 100%;
    border: none;
    border-top: 2px solid #111;
    margin: 0.12in 0 0.03in;
  }

  .type-block {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 0.08in;
  }

  /* Tight head margins: vertical room goes to the pictographs, not the type
     headings - the sheet has to fit two types (sheet 1) / four types (sheet 2)
     on one letter page with 110px cells. */
  .type-head {
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-weight: 600;
    font-size: 1.5rem;
    margin: 0.02in 0 0.05in;
    text-align: center;
  }

  .type-word {
    color: #1a1a1a;
  }

  .type-boxes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    justify-items: center;
    align-items: start;
    gap: 0.16in 0.5in;
    width: 100%;
    max-width: 7.2in;
  }
</style>
