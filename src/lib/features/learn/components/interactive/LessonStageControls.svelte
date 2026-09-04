<script lang="ts">
  import ExperienceProgressIndicator from "./ExperienceProgressIndicator.svelte";

  let {
    label,
    currentStep,
    totalSteps,
    onAction,
  }: {
    label: string;
    currentStep: number;
    totalSteps: number;
    onAction: () => void;
  } = $props();
</script>

<div class="lesson-stage-controls">
  <button class="primary-action" onclick={onAction}>{label}</button>
  <ExperienceProgressIndicator {currentStep} {totalSteps} />
</div>

<style>
  .lesson-stage-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
  }

  .primary-action {
    min-width: min(100%, 15rem);
    min-height: var(--min-touch-target, 44px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 2rem;
    border: 2px solid color-mix(in srgb, var(--theme-accent) 60%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-text);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      box-shadow var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }

  .primary-action:hover {
    border-color: color-mix(in srgb, var(--theme-accent) 80%, transparent);
    background: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    box-shadow: 0 8px 24px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .primary-action:active {
    transform: scale(0.98);
  }

  .primary-action:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .primary-action {
      transition: none;
    }
  }

  @media (min-width: 2400px) and (min-height: 1300px) {
    .primary-action {
      min-width: 18rem;
      min-height: 56px;
      padding: 0.9rem 2.5rem;
      font-size: 1.2rem;
    }
  }
</style>
