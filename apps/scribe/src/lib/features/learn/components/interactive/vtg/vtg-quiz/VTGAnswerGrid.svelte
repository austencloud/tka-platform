<!--
VTGAnswerGrid - Grid of VTG mode answer buttons
-->
<script lang="ts">
  import {
    VTG_MODES,
    type VTGMode,
  } from "../../../../domain/constants/vtg-quiz-data";
  import VTGAnswerButton from "./VTGAnswerButton.svelte";

  let {
    correctAnswer,
    selectedAnswer,
    showResult,
    onSelect,
  }: {
    correctAnswer: VTGMode;
    selectedAnswer: VTGMode | null;
    showResult: boolean;
    onSelect: (mode: VTGMode) => void;
  } = $props();
</script>

<div class="answers-grid">
  {#each VTG_MODES as vtgMode}
    <VTGAnswerButton
      mode={vtgMode.mode}
      name={vtgMode.name}
      color={vtgMode.color}
      isSelected={vtgMode.mode === selectedAnswer}
      isCorrect={vtgMode.mode === correctAnswer}
      {showResult}
      onclick={() => onSelect(vtgMode.mode)}
      disabled={showResult}
    />
  {/each}
</div>

<style>
  .answers-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.625rem;
  }

  @media (max-width: 480px) {
    .answers-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
