<!--
Type1AntispinPage - Antispin (Anti-Anti) letters lesson page
Page 3 of 5: Letters B, E, H, K, N, Q, T
Now uses shared Type1LetterLessonPage component
-->
<script lang="ts">
  import Type1LetterLessonPage from "./Type1LetterLessonPage.svelte";
  import { ANTISPIN_PAGE_CONFIG } from "../domain/type1-page-config";
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
  config={ANTISPIN_PAGE_CONFIG}
  {currentLetter}
  {letterIndex}
  {onCycle}
  {onSelectLetter}
  {onNext}
  {onPrevious}
/>
