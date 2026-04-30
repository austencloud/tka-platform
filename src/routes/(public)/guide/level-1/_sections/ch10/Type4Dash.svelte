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
      label: "Dash",
      sublabel: "One dashes, one static",
      cells: [
        { data: p("Y-0"), label: "Φ" },
        { data: p("Z-0"), label: "Ψ" },
        { data: p("Σ-0"), label: "Λ" },
      ],
    },
  ];
</script>

<GuideSection id="type-4-dash" title="Type 4 - Dash">
  <p>
    With a Dash, one prop executes a dash and the other remains static.
  </p>

  <GuidePictographGrid rows={rows} />
</GuideSection>
