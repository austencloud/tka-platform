<script lang="ts">
  import { setGuideData } from "../_data/guide-data-context";
  import chapterData from "../_data/positions-motions.json";
  import type { GuideChapterData } from "../_data/guide-types";

  import TheGrid from "../_sections/ch10/TheGrid.svelte";
  import HandPositions from "../_sections/ch10/HandPositions.svelte";
  import HandMotions from "../_sections/ch10/HandMotions.svelte";
  import Type1AlphaBeta from "../_sections/ch10/Type1AlphaBeta.svelte";
  import Type1Gamma from "../_sections/ch10/Type1Gamma.svelte";
  import Type2Shifts from "../_sections/ch10/Type2Shifts.svelte";
  import Type3CrossShifts from "../_sections/ch10/Type3CrossShifts.svelte";
  import Type4Dash from "../_sections/ch10/Type4Dash.svelte";
  import Type5DualDash from "../_sections/ch10/Type5DualDash.svelte";
  import Type6Static from "../_sections/ch10/Type6Static.svelte";
  import StaffPositions from "../_sections/ch10/StaffPositions.svelte";
  import StaffMotions from "../_sections/ch10/StaffMotions.svelte";
  import NegativeSpace from "../_sections/ch10/NegativeSpace.svelte";
  import GuideSeo from "../_components/GuideSeo.svelte";

  setGuideData(chapterData as unknown as GuideChapterData);
</script>

<GuideSeo
  title="1.0 Positions & Motions · Level 1 Guide · The Kinetic Alphabet"
  description="Level 1 positions and motions for The Kinetic Alphabet: the grid, hand positions, hand motions, Types 1–6, staff positions, and negative space for double staves."
  path="/guide/level-1/positions-motions"
  partOf={{ name: "Level 1 Guide: The Kinetic Alphabet", path: "/guide/level-1" }}
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: "Level 1", path: "/guide/level-1" },
    { name: "Positions & Motions", path: "/guide/level-1/positions-motions" },
  ]}
/>

<h1>Positions & Motions</h1>

<TheGrid />
<HandPositions />
<HandMotions />
<Type1AlphaBeta />
<Type1Gamma />
<Type2Shifts />
<Type3CrossShifts />
<Type4Dash />
<Type5DualDash />
<Type6Static />
<StaffPositions />
<StaffMotions />
<NegativeSpace />
