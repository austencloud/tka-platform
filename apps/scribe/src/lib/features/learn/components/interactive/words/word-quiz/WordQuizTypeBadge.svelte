<!--
WordQuizTypeBadge - Question type indicator badge
-->
<script lang="ts">
  import {
    TYPE_ICONS,
    type QuestionType,
  } from "../../../../domain/constants/word-quiz-questions";

  let { type }: { type: QuestionType } = $props();
</script>

<div class="question-type">
  <i class="fa-solid {TYPE_ICONS[type]}" aria-hidden="true"></i>
  <span>{type.replace(/-/g, " ")}</span>
</div>

<style>
  .question-type {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: rgba(168, 85, 247, 0.15);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #a855f7;
    text-transform: capitalize;
  }
</style>
