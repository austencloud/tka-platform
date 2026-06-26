<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const togOppRows = [
    {
      label: "Tog-Opp",
      sublabel: "α ↔ β",
      cells: [
        { data: p("D-0"), label: "D" },
        { data: p("E-0"), label: "E" },
        { data: p("F-0"), label: "F" },
      ],
    },
  ];

  const splitOppRows = [
    {
      label: "Split-Opp",
      sublabel: "α ↔ β",
      cells: [
        { data: p("J-0"), label: "J" },
        { data: p("K-0"), label: "K" },
        { data: p("L-0"), label: "L" },
      ],
    },
  ];
</script>

<GuideSection id="compound-letters" title="Compound Letters">
  <p>
    Now let's look at the letters that move from &#945;&#8596;&#946; or &#946;&#8596;&#945;.
    All pictographs can be rotated or mirrored without changing letters.
    These can be either Tog-Opp or Split-Opp depending on which &#945;/&#946; you start from.
  </p>

  <GuidePictographGrid
    rows={togOppRows}
    columnHeaders={["Iso", "Anti", "Hybrid"]}
  />

  <GuidePictographGrid
    rows={splitOppRows}
    columnHeaders={["Iso", "Anti", "Hybrid"]}
  />

  <p>
    These compound letters can't be self-combined like the previous letters.
    Instead, they combine with other compound letters to form the words DJ, EK, and FL.
    Here they are along with cute phrases to help you remember:
  </p>

  <div class="mnemonic-row">
    <GuideDiagram
      src="/guide/level-1/images/compound-letters/DJ.png"
      alt="DJ compound word sequence"
      caption="DJ: Disco Jam"
    />
    <GuideDiagram
      src="/guide/level-1/images/compound-letters/EK.png"
      alt="EK compound word sequence"
      caption="EK: Exploding Kitten"
    />
    <GuideDiagram
      src="/guide/level-1/images/compound-letters/FL.png"
      alt="FL compound word sequence"
      caption="FL: Fruity Loops"
    />
  </div>
</GuideSection>

<style>
  .mnemonic-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
    margin: 1.5rem 0;
  }
</style>
