<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const gammaRows = [
    {
      label: "Gamma → Gamma",
      sublabel: "Both shift, stay at right angle",
      cells: [
        { data: p("J-0"), label: "J" },
        { data: p("K-0"), label: "K" },
        { data: p("L-0"), label: "L" },
        { data: p("M-0"), label: "M" },
      ],
    },
    {
      label: "Gamma ↔ Other",
      sublabel: "Shift to/from right angle",
      cells: [
        { data: p("N-0"), label: "N" },
        { data: p("O-0"), label: "O" },
        { data: p("P-0"), label: "P" },
        { data: p("Q-0"), label: "Q" },
      ],
    },
  ];
</script>

<GuideSection id="type-1-gamma" title="Gamma">
  <p>
    Gamma positions place the hands at a right angle — 90° apart on the grid.
    Type 1 gamma letters use dual-shifts where both hands maintain or transition
    through a right-angle relationship.
  </p>

  <GuidePictographGrid rows={gammaRows} />
</GuideSection>
