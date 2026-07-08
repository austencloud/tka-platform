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

  import GuideSeo from "../_components/GuideSeo.svelte";

  setGuideData(chapterData as unknown as GuideChapterData);
</script>

<GuideSeo
  title="1.1 Letters · Level 1 Guide · The Kinetic Alphabet"
  description="Level 1 letter codex for The Kinetic Alphabet: Types 1–6, compound letters, gamma letters, and the full double-staff codex."
  path="/guide/level-1/letters"
  partOf={{ name: "Level 1 Guide: The Kinetic Alphabet", path: "/guide/level-1" }}
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: "Level 1", path: "/guide/level-1" },
    { name: "Letters", path: "/guide/level-1/letters" },
  ]}
/>

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
