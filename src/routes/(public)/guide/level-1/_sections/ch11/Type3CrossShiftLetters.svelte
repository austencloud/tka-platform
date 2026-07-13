<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const crossShiftRows = [
    {
      label: "Cross-Shift",
      sublabel: "Shift + Dash",
      cells: [
        { data: p("W--0"), label: "W-" },
        { data: p("X--0"), label: "X-" },
        { data: p("Y--0"), label: "Y-" },
        { data: p("Z--0"), label: "Z-" },
        { data: p("Σ--0"), label: "Σ-" },
        { data: p("Δ--0"), label: "Δ-" },
        { data: p("Θ--0"), label: "Θ-" },
        { data: p("Ω--0"), label: "Ω-" },
      ],
    },
  ];
</script>

<GuideSection id="type-3-cross-shift-letters" title="Type 3: Cross-Shift Letters">
  <p>
    Cross-Shifts use the same letters as Shifts, but each letter is followed by a dash
    to indicate that the other hand is dashing into its end position. They are spoken as
    "W Dash" or "Sigma Dash". A dash symbol in the glyph equals a dash arrow on the graph.
    The end position for each Type 2/3 letter remains the same.
  </p>

  <GuidePictographGrid rows={crossShiftRows} />

  <p>
    Cross-Shifts can be tricky to remember. It helps to first picture the corresponding
    Type 2 pictograph, then add the dash arrow without changing any other variables.
  </p>

  <p>
    Just like we did with hands, let's break down some Cross-Shifts step-by-step:
  </p>

  <div class="breakdown-row">
    <GuideDiagram
      src="/guide/level-1/images/type-3/alpha_cross_shifts.png"
      alt="Cross-Shift breakdown for alpha end position"
      caption="Alpha Cross-Shifts: start → halfway → end"
    />
    <GuideDiagram
      src="/guide/level-1/images/type-3/beta_cross_shifts.png"
      alt="Cross-Shift breakdown for beta end position"
      caption="Beta Cross-Shifts: start → halfway → end"
    />
  </div>

  <p>
    When initially learning, it's useful to pause at the halfway point to ensure proper timing.
  </p>
</GuideSection>

<style>
  .breakdown-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
    margin: 1.5rem 0;
  }
</style>
