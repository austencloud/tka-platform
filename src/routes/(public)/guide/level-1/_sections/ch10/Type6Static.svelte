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
      label: "Static",
      sublabel: "Both hands remain still",
      cells: [
        { data: p("α-0"), label: "α" },
        { data: p("β-0"), label: "β" },
        { data: p("γ-0"), label: "Γ" },
      ],
    },
  ];
</script>

<GuideSection id="type-6-static" title="Type 6 — Static">
  <p>
    Static motions are indicated by no arrow.
  </p>
  <p>
    Later on, static sequences gain complexity when adding prop rotations.
  </p>

  <GuidePictographGrid rows={rows} />
</GuideSection>
