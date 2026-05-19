<script lang="ts">
  import { setGuideData } from "../../level-1/_data/guide-data-context";
  import chapterData from "../_data/turns.json";
  import type { GuideChapterData } from "../../level-1/_data/guide-types";

  import TurnShifts from "../_sections/ch20/TurnShifts.svelte";
  import TurnDashes from "../_sections/ch20/TurnDashes.svelte";
  import TurnStatic from "../_sections/ch20/TurnStatic.svelte";
  import GlyphsPADS from "../_sections/ch20/GlyphsPADS.svelte";
  import Type1Turns from "../_sections/ch20/Type1Turns.svelte";
  import SandT from "../_sections/ch20/SandT.svelte";
  import Type2Turns from "../_sections/ch20/Type2Turns.svelte";
  import Type3Turns from "../_sections/ch20/Type3Turns.svelte";
  import Type4Turns from "../_sections/ch20/Type4Turns.svelte";
  import OpeningClosing from "../_sections/ch20/OpeningClosing.svelte";
  import Type5Turns from "../_sections/ch20/Type5Turns.svelte";
  import Type6Turns from "../_sections/ch20/Type6Turns.svelte";
  import OneOneTurns from "../_sections/ch20/OneOneTurns.svelte";

  setGuideData(chapterData as unknown as GuideChapterData);
</script>

<svelte:head>
  <title>2.0 1-Turns — Level 2 Guide</title>
</svelte:head>

<h1>1-Turns</h1>

<TurnShifts />
<TurnDashes />
<TurnStatic />
<GlyphsPADS />
<Type1Turns />
<SandT />
<Type2Turns />
<Type3Turns />
<Type4Turns />
<OpeningClosing />
<Type5Turns />
<Type6Turns />
<OneOneTurns />
