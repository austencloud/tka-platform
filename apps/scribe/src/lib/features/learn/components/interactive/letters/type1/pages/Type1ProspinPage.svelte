<!--
Type1ProspinPage - Prospin (Pro-Pro) letters lesson page
Page 2 of 5: Letters A, D, G, J, M, P, S
Now uses shared Type1LetterLessonPage component
-->
<script lang="ts">
  import Type1LetterLessonPage from "./Type1LetterLessonPage.svelte";
  import { PROSPIN_PAGE_CONFIG } from "../domain/type1-page-config";
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

No<Type1LetterLessonPage
  config={PROSPIN_PAGE_CONFIG}
  {currentLetter}
  {letterIndex}
  {onCycle}
  {onSelectLetter}
  {onNext}
  {onPrevious}
/>
