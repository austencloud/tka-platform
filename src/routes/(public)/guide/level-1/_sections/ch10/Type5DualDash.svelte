<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const rows = [
    {
      label: "Dual-Dash",
      sublabel: "Both hands dash",
      cells: [
        { data: p("Φ-0"), label: "Φ-" },
        { data: p("Ψ-0"), label: "Ψ-" },
        { data: p("Λ-0"), label: "Λ-" },
      ],
    },
  ];
</script>

<GuideSection id="type-5-dual-dash" title="Type 5 - Dual-Dash">
  <p>
    In a Dual-Dash, both hands dash simultaneously to their opposite points.
  </p>
  <p>
    Practice using Dual-Dashes, Dashes, and Cross-Shifts from different start positions.
  </p>

  <GuidePictographGrid rows={rows} />
</GuideSection>
