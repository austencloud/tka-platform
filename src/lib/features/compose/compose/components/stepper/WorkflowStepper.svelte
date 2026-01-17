<!--
  WorkflowStepper.svelte

  Horizontal stepper showing the three workflow phases:
  1. Canvas - Build composition grid
  2. Audio - Sync with music
  3. Export - Render output
-->
<script lang="ts">
  import type { WorkflowPhase } from "../../state/composition-state.svelte";
  import StepperStep from "./StepperStep.svelte";

  let {
    currentPhase,
    onPhaseChange,
    hasContent = false,
    hasAudio = false,
  }: {
    currentPhase: WorkflowPhase;
    onPhaseChange: (phase: WorkflowPhase) => void;
    hasContent?: boolean;
    hasAudio?: boolean;
  } = $props();

  const steps: Array<{
    phase: WorkflowPhase;
    label: string;
    icon: string;
  }> = [
    { phase: "canvas", label: "Canvas", icon: "fas fa-th-large" },
    { phase: "audio", label: "Audio", icon: "fas fa-music" },
    { phase: "export", label: "Export", icon: "fas fa-download" },
  ];

  function getStepNumber(phase: WorkflowPhase): number {
    const index = steps.findIndex((s) => s.phase === phase);
    return index + 1;
  }

  function isStepCompleted(phase: WorkflowPhase): boolean {
    // Canvas is "completed" if there's content
    if (phase === "canvas") return hasContent;
    // Audio is "completed" if audio is loaded
    if (phase === "audio") return hasAudio;
    // Export is never pre-completed
    return false;
  }
</script>

<nav class="workflow-stepper" aria-label="Composition workflow">
  <div class="steps-container">
    {#each steps as step, index}
      {#if index > 0}
        <div
          class="step-connector"
          class:active={getStepNumber(currentPhase) > index}
        ></div>
      {/if}
      <StepperStep
        stepNumber={index + 1}
        label={step.label}
        icon={step.icon}
        isActive={currentPhase === step.phase}
        isCompleted={isStepCompleted(step.phase)}
        onClick={() => onPhaseChange(step.phase)}
      />
    {/each}
  </div>
</nav>

<style>
  .workflow-stepper {
    display: flex;
    justify-content: center;
    padding: 0.75rem 1rem;
  }

  .steps-container {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .step-connector {
    width: 32px;
    height: 2px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 1px;
    transition: background var(--duration-normal) ease;
  }

  .step-connector.active {
    background: rgba(139, 92, 246, 0.4);
  }

  /* Mobile adjustments */
  @media (max-width: 600px) {
    .workflow-stepper {
      padding: 0.5rem 0.75rem;
    }

    .step-connector {
      width: 20px;
    }
  }
</style>
