<!--
VTGNextButton - Next question/see results button
-->
<script lang="ts">
  let {
    isLastQuestion,
    onclick,
  }: {
    isLastQuestion: boolean;
    onclick: () => void;
  } = $props();
</script>

<button class="next-button" {onclick}>
  {isLastQuestion ? "See Results" : "Next Question"}
  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
</button>

<style>
  .next-button {
    align-self: center;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 2rem;
    background: linear-gradient(
      135deg,
      rgba(34, 211, 238, 0.25) 0%,
      rgba(6, 182, 212, 0.25) 100%
    );
    border: 1px solid rgba(34, 211, 238, 0.4);
    border-radius: 10px;
    color: #22d3ee;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .next-button:hover {
    background: linear-gradient(
      135deg,
      rgba(34, 211, 238, 0.35) 0%,
      rgba(6, 182, 212, 0.35) 100%
    );
    border-color: rgba(34, 211, 238, 0.6);
  }
</style>
