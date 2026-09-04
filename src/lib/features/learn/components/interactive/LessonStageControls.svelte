<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import ExperienceProgressIndicator from "./ExperienceProgressIndicator.svelte";

  let {
    label,
    currentStep,
    totalSteps,
    onAction,
    onPrevious,
    previousLabel = "Previous",
    previousDisabled = false,
    actionIcon = "arrow",
  }: {
    label: string;
    currentStep: number;
    totalSteps: number;
    onAction: () => void;
    onPrevious?: () => void;
    previousLabel?: string;
    previousDisabled?: boolean;
    actionIcon?: "arrow" | "check";
  } = $props();
</script>

<div class="lesson-stage-controls" class:navigation={onPrevious !== undefined}>
  {#if onPrevious}
    <PanelButton
      variant="secondary"
      onclick={onPrevious}
      disabled={previousDisabled}
    >
      <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
      <span>{previousLabel}</span>
    </PanelButton>
    <ExperienceProgressIndicator {currentStep} {totalSteps} />
    <PanelButton variant="primary" onclick={onAction}>
      <span>{label}</span>
      {#if actionIcon === "check"}
        <i class="fa-solid fa-check" aria-hidden="true"></i>
      {:else}
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      {/if}
    </PanelButton>
  {:else}
    <button class="primary-action" onclick={onAction}>{label}</button>
    <ExperienceProgressIndicator {currentStep} {totalSteps} />
  {/if}
</div>

<style>
  .lesson-stage-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
  }

  .lesson-stage-controls.navigation {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    width: 100%;
  }

  .navigation > :global(:first-child) {
    justify-self: start;
  }

  .navigation > :global(:last-child) {
    justify-self: end;
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

  @container (max-width: 560px) {
    .lesson-stage-controls.navigation {
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .navigation :global(.progress-indicator) {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-self: center;
    }

    .navigation :global(.panel-btn) {
      width: 100%;
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
