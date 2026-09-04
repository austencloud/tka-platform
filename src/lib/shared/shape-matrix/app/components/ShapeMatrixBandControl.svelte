<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixBandControl.svelte
  How far the Theory ratio field opens.

  The Theory counterpart of the Matrix's LevelSelector, and deliberately NOT
  that component. LevelSelector wears the Kinetic Alphabet's level identity —
  the numeral in the card-badge gradient, the level colour, the "Level 4" name
  — and Theory has no level. Wearing it there told a visitor that a 4:9 flower
  sits at Level 4, when this control only reports hand-cycle bounds.

  So this is a plain SegmentedControl over the four band names, per
  chip-primitives.md: single-select, exactly one active, no numerals, no level
  colour. The full band reaches 15 cycles, matching the ratio editor's cap. -->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    asTheoryBand,
    THEORY_BAND_DESCRIPTIONS,
    THEORY_BANDS,
    type TheoryBand,
  } from "$lib/shared/shape-matrix/domain/theory-ratio-band";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    /** Keep a compact host on the detail pane through the band change. */
    stayOnDetail?: boolean;
  }

  const { stayOnDetail = false }: Props = $props();
  const state = getShapeMatrixAppContext();

  const options = THEORY_BANDS.map((band) => ({
    value: String(band),
    label: THEORY_BAND_DESCRIPTIONS[band].name,
    ariaLabel: `${THEORY_BAND_DESCRIPTIONS[band].name}. ${THEORY_BAND_DESCRIPTIONS[band].blurb}`,
  }));
</script>

<SegmentedControl
  {options}
  value={String(state.theoryBand)}
  onchange={(next: string) =>
    state.setTheoryBand(asTheoryBand(Number(next)) as TheoryBand, {
      stayOnDetail,
    })}
  size="sm"
  density="tight"
  color="accent"
  semantics="radiogroup"
  ariaLabel="How far the ratio field opens"
/>
