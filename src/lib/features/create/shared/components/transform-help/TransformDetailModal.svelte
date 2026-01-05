<!--
  TransformDetailModal.svelte

  Full-screen step-through modal for learning about a specific transform.
  Shows progressive panels: intro → single motion → dual motion (+ timeline for rewind)
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { transformHelpContent } from "../../domain/transforms/transform-help-content";
  import { portal } from "$lib/features/create/generate/components/modals/portal";
  import TransformStepNavigation from "./TransformStepNavigation.svelte";
  import TransformIntroStep from "./steps/TransformIntroStep.svelte";
  import TransformSingleStep from "./steps/TransformSingleStep.svelte";
  import TransformDualStep from "./steps/TransformDualStep.svelte";
  import RewindTimelineStep from "./steps/RewindTimelineStep.svelte";

  type TransformId = "mirror" | "flip" | "invert" | "rotate" | "swap" | "rewind";
  type StepType = "intro" | "single" | "dual" | "timeline";

  interface Props {
    transformId: TransformId;
    onClose: () => void;
  }

  let { transformId, onClose }: Props = $props();

  // Lock body scroll when modal is open
  onMount(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  });

  // Get transform content
  const transform = $derived(
    transformHelpContent.find((t) => t.id === transformId) ?? transformHelpContent[0]
  );

  // Step configuration per transform
  const TRANSFORM_STEPS: Record<TransformId, StepType[]> = {
    mirror: ["intro", "single", "dual"],
    flip: ["intro", "single", "dual"],
    invert: ["intro", "single", "dual"],
    rotate: ["intro", "single", "dual"],
    swap: ["intro", "single", "dual"],
    rewind: ["intro", "timeline", "single", "dual"], // Rewind gets extra timeline step
  };

  // Current step state
  let currentStepIndex = $state(0);
  const steps = $derived(TRANSFORM_STEPS[transformId]);
  const currentStep = $derived(steps[currentStepIndex]);
  const progress = $derived(((currentStepIndex + 1) / steps.length) * 100);

  // Navigation handlers
  function goToStep(index: number) {
    if (index >= 0 && index < steps.length) {
      currentStepIndex = index;
    }
  }

  function nextStep() {
    if (currentStepIndex < steps.length - 1) {
      currentStepIndex++;
    }
  }

  function prevStep() {
    if (currentStepIndex > 0) {
      currentStepIndex--;
    }
  }

  // Handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowLeft":
        prevStep();
        break;
      case "ArrowRight":
        nextStep();
        break;
    }
  }

  // Handle backdrop click
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
  class="modal-backdrop"
  use:portal
  onclick={handleBackdropClick}
  role="dialog"
  aria-modal="true"
  aria-label="Transform help for {transform?.name ?? 'transform'}"
>
  <div class="modal-container">
    <!-- Header -->
    <div class="modal-header" style:--transform-color={transform?.color ?? "#3b82f6"}>
      <div class="header-icon">
        <i class="fas {transform?.icon ?? 'fa-question'}" aria-hidden="true"></i>
      </div>
      <div class="header-text">
        <h2 class="header-title">{transform?.name ?? "Transform"}</h2>
        <p class="header-subtitle">{transform?.shortDesc ?? ""}</p>
      </div>
      <button class="close-btn" onclick={onClose} aria-label="Close help">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Progress bar -->
    <div class="progress-bar">
      <div class="progress-fill" style:width="{progress}%"></div>
    </div>

    <!-- Content area -->
    <div class="modal-content">
      {#if currentStep === "intro" && transform}
        <TransformIntroStep {transformId} {transform} />
      {:else if currentStep === "single" && transform}
        <TransformSingleStep {transformId} {transform} />
      {:else if currentStep === "dual" && transform}
        <TransformDualStep {transformId} {transform} />
      {:else if currentStep === "timeline" && transform}
        <RewindTimelineStep {transform} />
      {/if}
    </div>

    <!-- Step navigation -->
    <TransformStepNavigation
      {steps}
      currentIndex={currentStepIndex}
      onPrev={prevStep}
      onNext={nextStep}
      onGoToStep={goToStep}
      onExit={onClose}
    />
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-container {
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px;
    background: linear-gradient(
      180deg,
      rgba(var(--transform-color-rgb, 59, 130, 246), 0.15) 0%,
      transparent 100%
    );
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--transform-color, #3b82f6);
    color: white;
    font-size: var(--font-size-xl, 20px);
    flex-shrink: 0;
  }

  .header-text {
    flex: 1;
    min-width: 0;
  }

  .header-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .header-subtitle {
    margin: 4px 0 0;
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  /* Progress bar */
  .progress-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    transition: width 0.3s ease;
  }

  /* Content area */
  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .modal-content::-webkit-scrollbar {
    width: 6px;
  }

  .modal-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .modal-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  /* Mobile: full screen */
  @media (max-width: 540px) {
    .modal-backdrop {
      padding: 0;
    }

    .modal-container {
      max-width: none;
      max-height: none;
      height: 100%;
      border-radius: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }
  }
</style>
