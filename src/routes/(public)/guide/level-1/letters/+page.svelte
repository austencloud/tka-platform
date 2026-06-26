<script lang="ts">
  import { setGuideData } from "../_data/guide-data-context";
  import chapterData from "../_data/letters.json";
  import type { GuideChapterData } from "../_data/guide-types";

  import CodexType12 from "../_sections/ch11/CodexType12.svelte";
  import CodexType36 from "../_sections/ch11/CodexType36.svelte";
  import Type1Letters from "../_sections/ch11/Type1Letters.svelte";
  import AlphaBetaWords from "../_sections/ch11/AlphaBetaWords.svelte";
  import CompoundLetters from "../_sections/ch11/CompoundLetters.svelte";
  import CompoundWords from "../_sections/ch11/CompoundWords.svelte";
  import GammaLetters from "../_sections/ch11/GammaLetters.svelte";
  import GammaWords from "../_sections/ch11/GammaWords.svelte";
  import Type2ShiftLetters from "../_sections/ch11/Type2ShiftLetters.svelte";
  import Type3CrossShiftLetters from "../_sections/ch11/Type3CrossShiftLetters.svelte";
  import Type456Letters from "../_sections/ch11/Type456Letters.svelte";

  setGuideData(chapterData as unknown as GuideChapterData);
</script>

<svelte:head>
  <title>1.1 Letters · Level 1 Guide · The Kinetic Alphabet</title>
  <meta name="description" content="Level 1 letter codex for The Kinetic Alphabet. Types 1–6, compound letters, gamma letters, and the full double-staff codex." />
  <meta property="og:title" content="1.1 Letters: Level 1 Guide" />
  <meta property="og:description" content="The complete Level 1 letter codex for double staves. Types 1–6, compounds, gamma letters." />
  <meta property="og:image" content="/guide/level-1/images/_shared/level-1-front-cover.png" />
</svelte:head>

<h1>Letters</h1>

<CodexType12 />
<CodexType36 />
<Type1Letters />
<AlphaBetaWords />
<CompoundLetters />
<CompoundWords />
<GammaLetters />
<GammaWords />
<Type2ShiftLetters />
<Type3CrossShiftLetters />
<Type456Letters />
