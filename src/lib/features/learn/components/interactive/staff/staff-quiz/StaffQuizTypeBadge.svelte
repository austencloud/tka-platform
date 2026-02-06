<!--
StaffQuizTypeBadge - Question type indicator badge
-->
<script lang="ts">
  import type { QuestionType } from "../../../../domain/constants/staff-quiz-questions";

  let { type }: { type: QuestionType } = $props();
</script>

<div
  class="question-type-badge"
  class:position={type === "position"}
  class:thumb={type === "thumb"}
  class:rotation={type === "rotation"}
>
  {#if type === "position"}
    <i class="fa-solid fa-crosshairs" aria-hidden="true"></i>
    <span>Position</span>
  {:else if type === "thumb"}
    <i class="fa-solid fa-hand-point-up" aria-hidden="true"></i>
    <span>Thumb</span>
  {:else}
    <i class="fa-solid fa-sync-alt" aria-hidden="true"></i>
    <span>Rotation</span>
  {/if}
</div>

<style>
  .question-type-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.375rem 0.875rem;
    border-radius: 16px;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .question-type-badge.position {
    background: rgba(255, 107, 107, 0.15);
    color: #ff6b6b;
  }

  .question-type-badge.thumb {
    background: rgba(59, 130, 246, 0.15);
    color: var(--semantic-info);
  }

  .question-type-badge.rotation {
    background: rgba(34, 211, 238, 0.15);
    color: #22d3ee;
  }
</style>
