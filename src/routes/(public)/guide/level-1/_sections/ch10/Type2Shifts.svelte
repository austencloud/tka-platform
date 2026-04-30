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
      label: "Sigma / Delta / Theta / Omega",
      sublabel: "One shifts, one static",
      cells: [
        { data: p("R-0"), label: "Σ" },
        { data: p("S-0"), label: "Δ" },
        { data: p("T-0"), label: "θ" },
        { data: p("U-0"), label: "Ω" },
      ],
    },
  ];
</script>

<GuideSection id="type-2-shifts" title="Type 2 - Shifts">
  <p>
    To move between Γ and α/β, you can shift one hand and keep the other hand static.
    This combination is called a Shift (with a capital "S").
  </p>
  <p>
    Their letters are organized by end position: α, β, then Γ.
    These can also be categorized by opening or closing.
  </p>
  <p>
    Though simple at this stage, these motions become more complex
    as we dive deeper into the Alphabet and add rotations to static motions.
  </p>

  <GuidePictographGrid rows={rows} />
</GuideSection>
