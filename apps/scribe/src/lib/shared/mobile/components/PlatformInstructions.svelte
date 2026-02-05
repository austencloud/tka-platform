<!--
  PlatformInstructions.svelte

  Displays platform-specific installation instructions and benefits.
  Data-driven component that receives instructions configuration.
-->
<script lang="ts">
  import type { InstallInstructions } from "../config/pwa-install-instructions";
  import InstructionStep from "./InstructionStep.svelte";

  let {
    instructions,
    compact = false,
  }: {
    instructions: InstallInstructions;
    compact?: boolean;
  } = $props();
</script>

<div class="instructions-container" class:compact>
  <!-- Steps Section -->
  <div class="steps-section">
    <h3 class="section-heading" class:compact>
      <i class="fas fa-list-ol" aria-hidden="true"></i>
      <span>Follow These Steps</span>
    </h3>
    <div class="steps-grid">
      {#each instructions.steps as step, index}
        <InstructionStep {step} {index} {compact} />
      {/each}
    </div>
  </div>

  <!-- Benefits Section -->
  <div class="benefits-section" class:compact>
    <h3 class="section-heading" class:compact>
      <i class="fas fa-star" aria-hidden="true"></i>
      <span>Why Install?</span>
    </h3>
    <div class="benefits-grid" class:compact>
      {#each instructions.benefits as benefit}
        <div class="benefit-item" class:compact>
          <i class="fas fa-check-circle" aria-hidden="true"></i>
          <span>{benefit}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .instructions-container {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3cqh, 20px);
  }

  .compact.instructions-container {
    gap: clamp(8px, 2cqh, 12px);
  }

  /* Section Headings - Fluid sizing */
  .section-heading {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2cqw, 10px);
    margin: 0 0 clamp(10px, 2cqh, 14px) 0;
    font-size: clamp(13px, 3cqw, 15px);
    font-weight: 600;
    color: var(--theme-text);
  }

  .compact.section-heading {
    font-size: clamp(12px, 2.5cqw, 14px);
    margin-bottom: clamp(8px, 1.5cqh, 10px);
  }

  .section-heading i {
    color: rgba(139, 92, 246, 1);
    font-size: clamp(14px, 3cqw, 16px);
  }

  /* Steps Section */
  .steps-section {
    margin-bottom: 0;
  }

  /* Steps Grid - Uses container queries for responsive columns */
  .steps-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: clamp(8px, 2cqh, 12px);
  }

  @container install-guide (min-width: 600px) {
    .steps-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: clamp(10px, 2cqh, 14px);
    }
  }

  .compact .steps-grid {
    gap: clamp(6px, 1.5cqh, 8px);
  }

  /* Benefits Section - Fluid sizing */
  .benefits-section {
    padding: clamp(10px, 2.5cqh, 16px);
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-radius: clamp(8px, 2cqw, 12px);
  }

  .compact.benefits-section {
    padding: clamp(8px, 2cqh, 12px);
  }

  .benefits-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: clamp(6px, 1.5cqh, 10px);
  }

  @container install-guide (min-width: 600px) {
    .benefits-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: clamp(8px, 2cqh, 12px);
    }
  }

  .compact.benefits-grid {
    gap: clamp(5px, 1cqh, 8px);
  }

  .benefit-item {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2cqw, 12px);
    color: rgba(255, 255, 255, 0.88);
    font-size: clamp(11px, 2.5cqw, 13px);
    line-height: 1.5;
  }

  .compact.benefit-item {
    font-size: clamp(10px, 2cqw, 12px);
    line-height: 1.4;
  }

  .benefit-item i {
    color: rgba(139, 92, 246, 1);
    font-size: clamp(13px, 3cqw, 15px);
    flex-shrink: 0;
  }
</style>
