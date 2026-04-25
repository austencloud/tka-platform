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
      label: "Type 3",
      sublabel: "One shifts, one dashes",
      cells: [
        { data: p("V-0"), label: "V" },
        { data: p("W-0"), label: "W" },
        { data: p("X-0"), label: "X" },
      ],
    },
  ];
</script>

<GuideSection id="type-3-cross-shifts" title="Type 3 — Cross-Shifts">
  <p>
    Type 3 letters use a <span class="type-cross-shift">cross-shift</span> — one hand
    shifts (moves with rotation) while the other dashes (moves without rotation).
    The combination of rotating and non-rotating movement gives cross-shifts their
    distinctive asymmetric feel.
  </p>

  <GuidePictographGrid rows={rows} />
</GuideSection>
