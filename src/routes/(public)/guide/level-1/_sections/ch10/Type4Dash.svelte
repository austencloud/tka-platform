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
      label: "Type 4",
      sublabel: "One dashes, one static",
      cells: [
        { data: p("Y-0"), label: "Y" },
        { data: p("Z-0"), label: "Z" },
        { data: p("Σ-0"), label: "Σ" },
      ],
    },
  ];
</script>

<GuideSection id="type-4-dash" title="Type 4 — Dash">
  <p>
    Type 4 letters use a <span class="type-dash">dash</span> — one hand dashes
    (moves without rotation) while the other remains static. The moving prop
    translates to a new grid point without spinning.
  </p>

  <GuidePictographGrid rows={rows} />
</GuideSection>
