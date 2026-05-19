<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const splitSameRows = [
    {
      label: "Split-Same",
      sublabel: "α → α",
      cells: [
        { data: p("A-0"), label: "A" },
        { data: p("B-0"), label: "B" },
        { data: p("C-0"), label: "C" },
      ],
    },
  ];

  const togSameRows = [
    {
      label: "Tog-Same",
      sublabel: "β → β",
      cells: [
        { data: p("G-0"), label: "G" },
        { data: p("H-0"), label: "H" },
        { data: p("I-0"), label: "I" },
      ],
    },
  ];
</script>

<GuideSection id="type-1-letters" title="Type 1 — Dual-Shift Letters">
  <p>
    First we'll look at A, B, and C. Their handpath is Split-Same and they move from
    &#945;&#8596;&#945;:
  </p>

  <GuidePictographGrid
    rows={splitSameRows}
    columnHeaders={["Pro", "Anti", "Hybrid"]}
  />

  <p>
    Notice the pattern: Pro - Anti - Hybrid. This pattern helps you navigate/memorize the letters.
    If you only remember that A has prospins, you can infer that B has antispins.
    If you only remember that B has antispins, you can infer that C is a hybrid.
    If you memorize only one letter in each group, you know all of them.
  </p>

  <p>
    Next let's look at G, H, and I. Their handpaths are Tog-Same and they move from
    &#946;&#8596;&#946;:
  </p>

  <GuidePictographGrid
    rows={togSameRows}
    columnHeaders={["Pro", "Anti", "Hybrid"]}
  />

  <p>
    In hybrids like C and I, either hand can execute a prospin or antispin.
    Here, the right is in pro and left in anti, but it's equally valid to swap this.
  </p>
</GuideSection>
