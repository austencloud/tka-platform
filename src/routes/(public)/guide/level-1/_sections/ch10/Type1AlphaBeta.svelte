<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const type1Rows = [
    {
      label: "Split-Same",
      sublabel: "α → α",
      cells: [
        { data: p("A-0"), label: "A" },
        { data: p("B-0"), label: "B" },
        { data: p("C-0"), label: "C" },
      ],
    },
    {
      label: "Tog-Same",
      sublabel: "β → β",
      cells: [
        { data: p("D-0"), label: "G" },
        { data: p("E-0"), label: "H" },
        { data: p("F-0"), label: "I" },
      ],
    },
    {
      label: "Tog-Opp / Split-Opp",
      sublabel: "α ↔ β",
      cells: [
        { data: p("G-0"), label: "D" },
        { data: p("H-0"), label: "E" },
        { data: p("I-0"), label: "F" },
      ],
    },
  ];
</script>

<GuideSection id="type-1-alpha-beta" title="Type 1 — Dual-Shifts">
  <p>
    When both hands move to adjacent locations, it's called a Dual-Shift.
  </p>
  <p>
    Our first Dual-Shifts correspond to the four modes of timing/direction: SS, TS, SO, TO.
    You can determine the start position by looking at the non-pointed end of the arrow.
  </p>
  <p>
    The Kinetic Alphabet puts focus on simultaneous motions between
    two positions, relative to the center point.
  </p>
  <p>
    Notice the pattern: Pro - Anti - Hybrid. This pattern helps you navigate/memorize the letters.
    If you only remember that A has prospins, you can infer that B has antispins.
    If you memorize only one letter in each group, you know all of them.
  </p>

  <GuidePictographGrid rows={type1Rows} />

  <p>
    Practice using Dual-Shifts to travel between Alpha and Beta in each mode.
  </p>
</GuideSection>
