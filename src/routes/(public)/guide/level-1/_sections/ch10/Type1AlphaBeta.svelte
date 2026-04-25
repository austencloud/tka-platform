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
      label: "Alpha → Alpha",
      sublabel: "Both shift, stay opposite",
      cells: [
        { data: p("A-0"), label: "A" },
        { data: p("B-0"), label: "B" },
        { data: p("C-0"), label: "C" },
      ],
    },
    {
      label: "Beta → Beta",
      sublabel: "Both shift, stay together",
      cells: [
        { data: p("D-0"), label: "D" },
        { data: p("E-0"), label: "E" },
        { data: p("F-0"), label: "F" },
      ],
    },
    {
      label: "Alpha ↔ Beta",
      sublabel: "Shift between opposite and together",
      cells: [
        { data: p("G-0"), label: "G" },
        { data: p("H-0"), label: "H" },
        { data: p("I-0"), label: "I" },
      ],
    },
  ];
</script>

<GuideSection id="type-1-alpha-beta" title="Type 1 — Dual-Shifts">
  <p>
    Type 1 letters use <span class="type-dual-shift">dual-shifts</span> — both
    hands shift simultaneously. The prop in each hand rotates while the hand moves
    to an adjacent grid point.
  </p>

  <p>
    Type 1 letters are grouped by their start and end positions:
  </p>

  <GuidePictographGrid rows={type1Rows} />

  <p>
    Letters A, B, C start and end at alpha (hands opposite). D, E, F start and end
    at beta (hands together). G, H, I shift between alpha and beta.
  </p>
</GuideSection>
