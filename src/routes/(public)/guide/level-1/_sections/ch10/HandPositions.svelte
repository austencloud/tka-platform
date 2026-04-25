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
      sublabel: "Hands across from each other",
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
      sublabel: "Hands at the same point",
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
      sublabel: "Hands form a right angle",
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
    There are multiple ways to combine two hand points to form a hand position.
    Positions can be rotated or mirrored. Red = Right and Blue = Left.
  </p>
  <p>
    In The Kinetic Alphabet, our first three positions are called Alpha, Beta, and Gamma.
  </p>

  <h3 class="type-dual-shift">Alpha</h3>
  <p>In Alpha, the hands occupy the points across from each other.</p>
  <GuidePictographGrid rows={alphaRows} />

  <h3 class="type-dual-shift">Beta</h3>
  <p>In Beta, the hands occupy the same point.</p>
  <GuidePictographGrid rows={betaRows} />

  <h3 class="type-dual-shift">Gamma</h3>
  <p>In Gamma, the hands form a right angle.</p>
  <GuidePictographGrid rows={gammaRows} />
</GuideSection>
