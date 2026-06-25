<script lang="ts">
  import { setGuideData } from "../../level-1/_data/guide-data-context";
  import chapterData from "../_data/double-turns.json";
  import type { GuideChapterData } from "../../level-1/_data/guide-types";

  import DoubleTurnShifts from "../_sections/ch21/DoubleTurnShifts.svelte";
  import DoubleTurnDashes from "../_sections/ch21/DoubleTurnDashes.svelte";
  import DoubleTurnStatic from "../_sections/ch21/DoubleTurnStatic.svelte";
  import CodexPages from "../_sections/ch21/CodexPages.svelte";

  setGuideData(chapterData as unknown as GuideChapterData);
</script>

<svelte:head>
  <title>2.1 2-Turns: Level 2 Guide</title>
</svelte:head>

<h1>2-Turns</h1>

<DoubleTurnShifts />
<DoubleTurnDashes />
<DoubleTurnStatic />
<CodexPages />
