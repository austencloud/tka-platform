<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const dashRows = [
    {
      label: "Dash",
      sublabel: "One dashes, one static",
      cells: [
        { data: p("Φ-0"), label: "Φ" },
        { data: p("Ψ-0"), label: "Ψ" },
        { data: p("Λ-0"), label: "Λ" },
      ],
    },
  ];

  const dualDashRows = [
    {
      label: "Dual-Dash",
      sublabel: "Both hands dash",
      cells: [
        { data: p("Φ--0"), label: "Φ-" },
        { data: p("Ψ--0"), label: "Ψ-" },
        { data: p("Λ--0"), label: "Λ-" },
      ],
    },
  ];

  const staticRows = [
    {
      label: "Static",
      sublabel: "Both hands still",
      cells: [
        { data: p("α-0"), label: "α" },
        { data: p("β-0"), label: "β" },
        { data: p("γ-0"), label: "Γ" },
      ],
    },
  ];
</script>

<GuideSection id="type-4-5-6-letters" title="Type 4/5/6 Letters">
  <h3 class="type-dash">Type 4 — Dash</h3>
  <p>
    With a Dash, one prop executes a dash and the other remains static.
    "Lambda" can be further shortened by calling it "Lam".
  </p>

  <GuidePictographGrid rows={dashRows} />

  <h3 class="type-dual-dash">Type 5 — Dual-Dash</h3>
  <p>
    In a Dual-Dash, both hands are dashing. The end position remains the same.
  </p>

  <GuidePictographGrid rows={dualDashRows} />

  <h3 class="type-static">Type 6 — Static</h3>
  <p>
    In a Static motion, both hands remain still for a beat. These become more
    interesting when adding turns.
  </p>

  <GuidePictographGrid rows={staticRows} />
</GuideSection>
