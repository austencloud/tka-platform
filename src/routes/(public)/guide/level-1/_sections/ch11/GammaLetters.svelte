<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const quarterOppRows = [
    {
      label: "Quarter-Opp",
      sublabel: "Γ → Γ",
      cells: [
        { data: p("M-0"), label: "M" },
        { data: p("N-0"), label: "N" },
        { data: p("O-0"), label: "O" },
        { data: p("P-0"), label: "P" },
        { data: p("Q-0"), label: "Q" },
        { data: p("R-0"), label: "R" },
      ],
    },
  ];

  const quarterSameRows = [
    {
      label: "Quarter-Same",
      sublabel: "Γ → Γ",
      cells: [
        { data: p("S-0"), label: "S" },
        { data: p("T-0"), label: "T" },
        { data: p("U-0"), label: "U" },
        { data: p("V-0"), label: "V" },
      ],
    },
  ];
</script>

<GuideSection id="gamma-letters" title="Gamma Letters">
  <p>
    &#915; motions can combine with any other &#915; motion to create lots of words!
    First let's look at the compound letters (Quarter-Opp).
  </p>

  <GuidePictographGrid
    rows={quarterOppRows}
    columnHeaders={["Iso", "Anti", "Hybrid", "Iso", "Anti", "Hybrid"]}
  />

  <p>
    When combined as a continuous motion, these form MP, NQ, and OR.
    Here they are along with a memorable phrase:
  </p>

  <div class="mnemonic-row">
    <GuideDiagram
      src="/guide/level-1/images/gamma-letters/MP.png"
      alt="MP compound letter"
      caption="MP — Magic Potion"
    />
    <GuideDiagram
      src="/guide/level-1/images/gamma-letters/NQ.png"
      alt="NQ compound letter"
      caption="NQ — Never Quit"
    />
    <GuideDiagram
      src="/guide/level-1/images/gamma-letters/OR.png"
      alt="OR compound letter"
      caption="OR — Open Road"
    />
  </div>

  <p>
    The final &#915; group (Quarter-Same) has 4 instead of 3. It may seem like U and V
    contain the same information, but it's impossible to rotate or reflect U in order to
    turn it into V, and vice-versa, so they must be disambiguated.
  </p>

  <GuidePictographGrid
    rows={quarterSameRows}
    columnHeaders={["S", "T", "U", "V"]}
  />

  <p>
    Note that all four have a leading hand and a following hand. Here, the right is leading
    and left is following, but it's equally valid to swap this. U leads with an isolation
    (a round motion like the letter U). V leads with an antispin (a spiky motion like the
    letter V). These self-combine to form the words SS, TT, UU, and VV.
  </p>
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
