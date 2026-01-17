<!--
  StepperStep.svelte

  Individual step in the workflow stepper.
  Shows step number, label, and active/completed state.
-->
<script lang="ts">
  let {
    stepNumber,
    label,
    icon,
    isActive,
    isCompleted = false,
    onClick,
  }: {
    stepNumber: number;
    label: string;
    icon: string;
    isActive: boolean;
    isCompleted?: boolean;
    onClick: () => void;
  } = $props();
</script>

<button
  class="stepper-step"
  class:active={isActive}
  class:completed={isCompleted}
  onclick={onClick}
  aria-current={isActive ? "step" : undefined}
>
  <div class="step-indicator">
    {#if isCompleted && !isActive}
      <i class="fas fa-check" aria-hidden="true"></i>
    {:else}
      <span class="step-number">{stepNumber}</span>
    {/if}
  </div>
  <div class="step-content">
    <i class={icon} aria-hidden="true"></i>
    <span class="step-label">{label}</span>
  </div>
</button>

<style>
  .stepper-step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
  }

  .stepper-step:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text-dim);
  }

  .stepper-step.active {
    background: rgba(139, 92, 246, 0.15);
    color: rgba(167, 139, 250, 1);
  }

  .stepper-step.completed:not(.active) {
    color: rgba(34, 197, 94, 0.8);
  }

  .step-indicator {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    font-size: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .stepper-step.active .step-indicator {
    background: rgba(139, 92, 246, 0.3);
    color: rgba(196, 181, 253, 1);
  }

  .stepper-step.completed:not(.active) .step-indicator {
    background: rgba(34, 197, 94, 0.2);
    color: rgba(74, 222, 128, 1);
  }

  .step-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .step-content i {
    font-size: 0.9rem;
  }

  .step-label {
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
  }

  /* Mobile: hide labels, show only icons */
  @media (max-width: 600px) {
    .step-label {
      display: none;
    }

    .stepper-step {
      padding: 0.5rem 0.75rem;
    }
  }
</style>
