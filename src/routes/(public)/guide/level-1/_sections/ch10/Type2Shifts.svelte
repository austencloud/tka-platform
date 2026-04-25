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
      label: "Type 2",
      sublabel: "One shifts, one static",
      cells: [
        { data: p("R-0"), label: "R" },
        { data: p("S-0"), label: "S" },
        { data: p("T-0"), label: "T" },
        { data: p("U-0"), label: "U" },
      ],
    },
  ];
</script>

<GuideSection id="type-2-shifts" title="Type 2 — Shifts">
  <p>
    Type 2 letters use a <span class="type-shift">shift</span> — one hand shifts
    while the other remains static. The shifting hand moves to an adjacent grid
    point with rotation; the static hand holds its position.
  </p>

  <GuidePictographGrid rows={rows} />
</GuideSection>
