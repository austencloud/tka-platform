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
      label: "Quarter-Opp",
      sublabel: "Γ → Γ",
      cells: [
        { data: p("J-0"), label: "M" },
        { data: p("K-0"), label: "N" },
        { data: p("L-0"), label: "O" },
      ],
    },
    {
      label: "Quarter-Same",
      sublabel: "Γ → Γ",
      cells: [
        { data: p("M-0"), label: "S" },
        { data: p("N-0"), label: "T" },
        { data: p("O-0"), label: "U" },
        { data: p("P-0"), label: "V" },
      ],
    },
  ];
</script>

<GuideSection id="type-1-gamma" title="Gamma">
  <p>
    Gamma, aka quarter-time, is based on two often forgotten modes:
    Quarter-Opp and Quarter-Same.
  </p>
  <p>
    Quarter-Opp has variations of parallel and antiparallel.
  </p>
  <p>
    When in gamma, you can move to any other variation of gamma.
  </p>

  <GuidePictographGrid rows={gammaRows} />

  <p>
    Practice using Dual-Shifts to create other non-continuous Γ→Γ variations!
  </p>
</GuideSection>
