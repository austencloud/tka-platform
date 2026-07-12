<script lang="ts">
  /**
   * A single codex cell — one letter's pictograph plus its transition/name
   * captions. Print/card callers (the /codex sheets, poster, Choreo Card
   * printing) pass NOTHING beyond `cell`: they get the exact byte-identical
   * static Double-Staff rendering this component always produced.
   *
   * The interactive guide reader (GuideCodexPage.svelte) additionally passes
   * `propType`/`visibility`/`dataOverride`/`onSelect` — the SAME sheet, live:
   * propType re-skins the pictograph, visibility toggles its layers, and
   * `onSelect` makes the cell clickable via the shared sequence-selection
   * primitive (`SelectionHit` + `.tka-seq-cell`, the same hover/select ring
   * used elsewhere in the guide — see feedback_sequence_selection_primitive),
   * never a hand-rolled button/hover style. No gray fill is added either way —
   * the printable white-paper look is preserved.
   */
  import GuidePictograph from "../../level-1/_components/GuidePictograph.svelte";
  import CodexTransitionGlyph from "./CodexTransitionGlyph.svelte";
  import SelectionHit from "$lib/shared/selection/SelectionHit.svelte";
  import { getSequenceSelection } from "$lib/shared/selection/sequence-selection.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { codexData, type CodexCellDef } from "../_data/codex-groups";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  let {
    cell,
    propType = PropType.STAFF,
    showGlyph = false,
    showGrid = true,
    showTKA = true,
    showPositions = false,
    showReversals = false,
    showNonRadialPoints = false,
    dataOverride,
    onSelect,
  }: {
    cell: CodexCellDef;
    propType?: PropType;
    showGlyph?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showPositions?: boolean;
    showReversals?: boolean;
    showNonRadialPoints?: boolean;
    /** Live-transformed pictograph (rotate/mirror/color-swap) to render instead
     *  of the canonical dataset. Only the interactive reader supplies this. */
    dataOverride?: PictographData | null;
    /** Presence makes the cell clickable — only the reader supplies it. */
    onSelect?: (id: string) => void;
  } = $props();

  const data = $derived(dataOverride ?? codexData(cell.id));
  const selection = onSelect ? getSequenceSelection() : null;
</script>

{#snippet cellBody()}
  {#if cell.top}
    <span class="cell-top"><CodexTransitionGlyph text={cell.top} /></span>
  {/if}
  <div class="picto">
    <GuidePictograph
      {data}
      size="sm"
      showGrid={showGrid}
      showArrows={true}
      {propType}
      showTKA={showTKA}
      showTnD={showGlyph}
      showElemental={showGlyph}
      showPositions={showPositions}
      showReversals={showReversals}
      showNonRadialPoints={showNonRadialPoints}
      printMode={true}
      darkMode={false}
      eager={true}
    />
  </div>
  {#if cell.name}
    <span class="cell-name">{cell.name}</span>
  {/if}
{/snippet}

{#if onSelect}
  <div
    class="codex-cell interactive tka-seq-cell"
    class:is-hovered={selection?.isHovered(cell.id)}
    class:is-selected={selection?.isSelected(cell.id)}
  >
    {@render cellBody()}
    <SelectionHit
      groupId={cell.id}
      isGroupStart
      label={`Animate ${cell.label}`}
      onselect={() => onSelect(cell.id)}
    />
  </div>
{:else}
  <div class="codex-cell">
    {@render cellBody()}
  </div>
{/if}

<style>
  .codex-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }

  .cell-top {
    font-size: 0.62rem;
    font-weight: 600;
    color: #333;
    line-height: 1.1;
  }

  /* ONE fixed pictograph size across the whole codex (both pages, every type) —
     never sized off the row's leftover space, which made 4-cell/full-width rows
     render bigger pictographs than 3-cell rows. Each pictograph carries its own
     plain 1px border and sits flush against its neighbors (CodexBox collapses
     the shared walls), reproducing the original guide's table look — no inset
     floating squares. The pictograph's dark-mode outline (--pictograph-border)
     is suppressed so the only frame is this border. aspect-ratio keeps the box
     square so the async pictograph swap never reflows neighbors. */
  .picto {
    width: var(--codex-picto-size, 100px);
    aspect-ratio: 1;
    box-sizing: border-box;
    border: 1px solid #2b2b2b;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    --pictograph-border: none;
  }

  /* Force the whole pictograph (wrapper + SVG) to fill the 64px box. The
     size-sm wrapper otherwise keeps its own ~120px intrinsic size (max-width
     140px + its own aspect-ratio) and ignores this box, so it overflowed —
     spilling into neighbors, or cropped once the box clipped it. The SVG
     viewBox is a clean square, so filling the box shows the whole pictograph
     at cell size: no overflow, no crop. */
  .picto :global(.guide-pictograph) {
    width: 100%;
    height: 100%;
    gap: 0;
  }
  .picto :global(.pictograph-wrapper) {
    width: 100%;
    height: 100%;
    max-width: none;
  }

  .cell-name {
    font-style: italic;
    font-size: 0.6rem;
    color: #555;
    line-height: 1.1;
  }

  /* Interactive (reader) cells: cursor affordance only — the hover/select
   * ring comes entirely from the shared .tka-seq-cell primitive above, never
   * a gray fill. Keeps the print-sheet white-paper look intact. */
  .codex-cell.interactive {
    cursor: pointer;
  }
</style>
