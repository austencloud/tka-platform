<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuidePictographGrid from "../../_components/GuidePictographGrid.svelte";
  import { getGuideData } from "../../_data/guide-data-context";

  const data = getGuideData();

  function p(id: string) {
    return data.pictographs[id] ?? null;
  }

  const shiftRows = [
    {
      label: "Shift",
      sublabel: "One shifts, one static",
      cells: [
        { data: p("W-0"), label: "W" },
        { data: p("X-0"), label: "X" },
        { data: p("Y-0"), label: "Y" },
        { data: p("Z-0"), label: "Z" },
        { data: p("Σ-0"), label: "Σ" },
        { data: p("Δ-0"), label: "Δ" },
        { data: p("Θ-0"), label: "θ" },
        { data: p("Ω-0"), label: "Ω" },
      ],
    },
  ];
</script>

<GuideSection id="type-2-shifts-letters" title="Type 2: Shift Letters">
  <p>
    So far we've learned how to move between &#945;&#8596;&#945; and between
    &#946;&#8596;&#946; and between &#945;&#8596;&#946;. In order to travel between
    these two modes, we can use a Type 2 Motion called a Shift.
  </p>

  <p>
    A Shift (or single shift) is the combination of one shift and one static motion.
    Their letters are organized by end position: &#945;, &#946;, then &#915;.
    These can also be categorized by opening or closing.
  </p>

  <GuidePictographGrid rows={shiftRows} />

  <p>
    When we arrange them in continuous motions, we get the words W&#931;Y&#952;
    and X&#916;Z&#937;.
  </p>

  <p>
    Though simple at this stage, these motions become more complex as we dive deeper
    into the Alphabet and add rotations to static motions.
  </p>
</GuideSection>
