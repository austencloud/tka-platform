<script lang="ts">
  import { setGuideData } from "../_data/guide-data-context";
  import chapterData from "../_data/words.json";
  import type { GuideChapterData } from "../_data/guide-types";

  import WordsIntro from "../_sections/ch12/WordsIntro.svelte";
  import Loops from "../_sections/ch12/Caps.svelte";
  import LoopsVsCaps from "../_sections/ch12/LoopsVsCaps.svelte";
  import Reversals from "../_sections/ch12/Reversals.svelte";
  import AABBExamples from "../_sections/ch12/AABBExamples.svelte";
  import AABBBodyTurn from "../_sections/ch12/AABBBodyTurn.svelte";
  import ACACBCBC from "../_sections/ch12/ACACBCBC.svelte";
  import Type1Loops from "../_sections/ch12/Type1Caps.svelte";
  import GammaLoops from "../_sections/ch12/GammaCaps.svelte";
  import Type2Loops from "../_sections/ch12/Type2Caps.svelte";
  import SixteenCount from "../_sections/ch12/SixteenCount.svelte";
  import EightLetterWords from "../_sections/ch12/EightLetterWords.svelte";
  import PropReversalLoops from "../_sections/ch12/PropReversalCaps.svelte";
  import FullReversalLoops from "../_sections/ch12/FullReversalCaps.svelte";

  setGuideData(chapterData as unknown as GuideChapterData);
</script>

<svelte:head>
  <title>1.2 Words & LOOPs — Level 1 Guide — The Kinetic Alphabet</title>
  <meta name="description" content="Level 1 words, LOOPs, and reversals for The Kinetic Alphabet. AABB patterns, body turns, 16-count sequences, and 8-letter words." />
  <meta property="og:title" content="1.2 Words & LOOPs — Level 1 Guide" />
  <meta property="og:description" content="Words, LOOPs, reversals, and multi-beat sequences for double staves." />
  <meta property="og:image" content="/guide/level-1/images/_shared/level-1-front-cover.png" />
</svelte:head>

<h1>Words, LOOPs & Reversals</h1>

<WordsIntro />
<Loops />
<LoopsVsCaps />
<Reversals />
<AABBExamples />
<AABBBodyTurn />
<ACACBCBC />
<Type1Loops />
<GammaLoops />
<Type2Loops />
<SixteenCount />
<EightLetterWords />
<PropReversalLoops />
<FullReversalLoops />
