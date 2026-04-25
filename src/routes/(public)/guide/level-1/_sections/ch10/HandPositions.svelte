<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const alphaRows = [
    {
      label: "Alpha",
      sublabel: "Hands opposite",
      cells: [
        { data: p("A-0"), label: "α1" },
        { data: p("A-1"), label: "α2" },
        { data: p("A-2"), label: "α3" },
        { data: p("A-3"), label: "α4" },
      ],
    },
  ];

  const betaRows = [
    {
      label: "Beta",
      sublabel: "Hands together",
      cells: [
        { data: p("B-0"), label: "β1" },
        { data: p("B-1"), label: "β2" },
        { data: p("B-2"), label: "β3" },
        { data: p("B-3"), label: "β4" },
      ],
    },
  ];

  const gammaRows = [
    {
      label: "Gamma",
      sublabel: "Hands at right angle",
      cells: [
        { data: p("G-0"), label: "Γ1" },
        { data: p("G-1"), label: "Γ2" },
        { data: p("G-2"), label: "Γ3" },
        { data: p("G-3"), label: "Γ4" },
      ],
    },
  ];
</script>

<GuideSection id="hand-positions" title="Hand Positions">
  <p>
    Hand positions describe where both hands are on the grid at the same time.
    There are three position families: alpha, beta, and gamma.
  </p>

  <h3 class="type-dual-shift">Alpha — Hands at Opposite Points</h3>
  <GuidePictographGrid rows={alphaRows} />

  <h3 class="type-dual-shift">Beta — Hands at the Same Point</h3>
  <GuidePictographGrid rows={betaRows} />

  <h3 class="type-dual-shift">Gamma — Hands at a Right Angle</h3>
  <GuidePictographGrid rows={gammaRows} />
</GuideSection>
