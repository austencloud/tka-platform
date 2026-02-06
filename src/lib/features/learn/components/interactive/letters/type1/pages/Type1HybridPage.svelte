<!--
Type1HybridPage - Hybrid letters lesson page
Page 4 of 5: Letters C, F, I, L, O, R, U, V
Now uses shared Type1LetterLessonPage component
-->
<script lang="ts">
  import Type1LetterLessonPage from "./Type1LetterLessonPage.svelte";
  import { HYBRID_PAGE_CONFIG } from "../domain/type1-page-config";
  import type { Type1LetterData } from "../Type1LetterData";

  interface Props {
    currentLetter: Type1LetterData | undefined;
    letterIndex: number;
    onCycle: (direction: 1 | -1) => void;
    onSelectLetter: (index: number) => void;
    onNext: () => void;
    onPrevious: () => void;
  }

  let {
    currentLetter,
    letterIndex,
    onCycle,
    onSelectLetter,
    onNext,
    onPrevious,
  }: Props = $props();
</script>

<Type1LetterLessonPage
  config={HYBRID_PAGE_CONFIG}
  {currentLetter}
  {letterIndex}
  {onCycle}
  {onSelectLetter}
  {onNext}
  {onPrevious}
  showFinalSummary={true}
/>
