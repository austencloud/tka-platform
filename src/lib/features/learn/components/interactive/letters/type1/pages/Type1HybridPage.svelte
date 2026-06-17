<!--
Type1HybridPage - Hybrid letters lesson page
Page 4 of 5: Letters C, F, I, L, O, R, U, V
Now uses shared Type1LetterLessonPage component
-->
<script lang="ts">
  import Type1LetterLessonPage from "./Type1LetterLessonPage.svelte";
  import { HYBRID_PAGE_CONFIG } from "../domain/type1-page-config";
  import type { Type1LetterData } from "../type1-letter-data";
  import { PLAIN_QUARTER_SAME_EXPLANATION } from "@tka/domain";

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

<aside class="quarter-same-note">
  {#each PLAIN_QUARTER_SAME_EXPLANATION.split("\n\n") as para}
    <p>{para}</p>
  {/each}
</aside>

<style>
  .quarter-same-note {
    margin: 1rem auto 0;
    max-width: 48ch;
    padding: 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: 0.9375rem;
    line-height: 1.5;
  }
  .quarter-same-note p { margin: 0 0 0.75rem; }
  .quarter-same-note p:last-child { margin-bottom: 0; }
</style>
