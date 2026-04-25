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
      label: "Cross-Shifts",
      sublabel: "Shift + Dash combined",
      cells: [
        { data: p("V-0"), label: "Σ-" },
        { data: p("W-0"), label: "Δ-" },
        { data: p("X-0"), label: "θ-" },
        { data: p("Y-0"), label: "Ω-" },
      ],
    },
  ];
</script>

<GuideSection id="type-3-cross-shifts" title="Type 3 — Cross-Shifts">
  <p>
    A Cross-Shift combines a shift and a dash.
    Since a dash has further to travel, it moves slightly faster.
  </p>
  <p>
    Cross-Shifts use the same letters as Shifts, but each letter is followed by a
    dash to indicate that the other hand is dashing into its end position.
    They are spoken as "W Dash" or "Sigma Dash".
  </p>
  <p>
    A dash symbol in the glyph equals a dash arrow on the graph.
    The end position for each Type 2/3 letter remains the same.
  </p>
  <p>
    Cross-Shifts can be tricky to remember. It helps to first picture the corresponding
    Type 2 pictograph, then add the dash arrow without changing any other variables.
  </p>

  <GuidePictographGrid rows={rows} />
</GuideSection>
