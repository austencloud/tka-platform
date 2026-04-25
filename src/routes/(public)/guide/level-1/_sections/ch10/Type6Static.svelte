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
      sublabel: "Both hands hold position",
      cells: [
        { data: p("α-0"), label: "α" },
        { data: p("β-0"), label: "β" },
        { data: p("γ-0"), label: "γ" },
      ],
    },
  ];
</script>

<GuideSection id="type-6-static" title="Type 6 — Static">
  <p>
    Type 6 letters are <span class="type-static">static</span> — both hands
    remain at their current grid points. The props may rotate in place (prospin
    or antispin), but neither hand moves.
  </p>

  <GuidePictographGrid rows={rows} />

  <p>
    Static letters are named after the position they hold: α (alpha), β (beta),
    and γ (gamma).
  </p>
</GuideSection>
