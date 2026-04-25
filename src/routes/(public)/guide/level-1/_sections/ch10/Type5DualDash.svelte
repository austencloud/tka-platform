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
        { data: p("Φ-0"), label: "Φ" },
        { data: p("Ψ-0"), label: "Ψ" },
        { data: p("Λ-0"), label: "Λ" },
      ],
    },
  ];
</script>

<GuideSection id="type-5-dual-dash" title="Type 5 — Dual-Dash">
  <p>
    Type 5 letters use <span class="type-dual-dash">dual-dashes</span> — both
    hands dash simultaneously. Neither prop rotates; both translate to new grid
    points at the same time.
  </p>

  <GuidePictographGrid rows={rows} />
</GuideSection>
