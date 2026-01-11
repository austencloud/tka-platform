<!--
RotationSelector.svelte - Rotation direction selection UI

Allows user to select between clockwise and counter-clockwise rotation
for SHIFT motions in the completed hand paths.
-->
<script lang="ts">
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";

  const { onSelect } = $props<{
    onSelect: (rotation: RotationDirection) => void;
  }>();

  // Access haptic feedback service from ITI container
  const hapticService = container.items.hapticFeedback as IHapticFeedback;

  function selectClockwise() {
    hapticService?.trigger("success");
    onSelect(RotationDirection.CLOCKWISE);
  }

  function selectCounterClockwise() {
    hapticService?.trigger("success");
    onSelect(RotationDirection.COUNTER_CLOCKWISE);
  }
</script>

<div class="rotation-selector">
  <h2 class="title">Choose Rotation</h2>
  <p class="description">
    How should your props rotate between positions?
  </p>

  <div class="rotation-options">
    <button class="rotation-button clockwise" onclick={selectClockwise}>
      <div class="icon-container">
        <svg class="rotation-icon" viewBox="0 0 48 48" fill="none">
          <path
            class="arrow-path"
            d="M24 8C15.2 8 8 15.2 8 24s7.2 16 16 16c6.2 0 11.5-3.5 14.2-8.6"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            fill="none"
          />
          <path
            class="arrow-head"
            d="M38 24l-4-6h8l-4 6z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div class="label">Clockwise</div>
      <div class="sublabel">Props rotate right</div>
      <div class="keyboard-hint">Press 1</div>
    </button>

    <button
      class="rotation-button counter-clockwise"
      onclick={selectCounterClockwise}
    >
      <div class="icon-container">
        <svg class="rotation-icon" viewBox="0 0 48 48" fill="none">
          <path
            class="arrow-path"
            d="M24 8C32.8 8 40 15.2 40 24s-7.2 16-16 16c-6.2 0-11.5-3.5-14.2-8.6"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            fill="none"
          />
          <path
            class="arrow-head"
            d="M10 24l4-6H6l4 6z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div class="label">Counter-Clockwise</div>
      <div class="sublabel">Props rotate left</div>
      <div class="keyboard-hint">Press 2</div>
    </button>
  </div>
</div>

<style>
  .rotation-selector {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 40px;
    max-width: 500px;
    margin: 0 auto;
  }

  .title {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    margin: 0;
    color: var(--theme-text);
    text-align: center;
  }

  .description {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  .rotation-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    width: 100%;
    margin-top: 8px;
  }

  .rotation-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 28px 20px;
    background: var(--theme-card-bg);
    border: 2px solid var(--theme-stroke);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  /* Icon container with continuous animation */
  .icon-container {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rotation-icon {
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim);
    transition: color 0.2s ease;
  }

  /* Continuous rotation animation */
  .rotation-button.clockwise .icon-container {
    animation: spin-cw 4s linear infinite;
  }

  .rotation-button.counter-clockwise .icon-container {
    animation: spin-ccw 4s linear infinite;
  }

  @keyframes spin-cw {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes spin-ccw {
    from { transform: rotate(0deg); }
    to { transform: rotate(-360deg); }
  }

  .rotation-button .label {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: var(--theme-text);
  }

  .rotation-button .sublabel {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .rotation-button .keyboard-hint {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    opacity: 0.5;
    padding: 4px 10px;
    background: var(--theme-stroke);
    border-radius: 6px;
    margin-top: 4px;
  }

  /* Hover effects */
  @media (hover: hover) {
    .rotation-button:hover {
      transform: translateY(-4px);
    }

    .rotation-button:hover .icon-container {
      animation-duration: 1s; /* Speed up on hover */
    }
  }

  .rotation-button:active {
    transform: translateY(-2px);
    transition: transform 0.1s ease;
  }

  /* Color themes */
  .rotation-button.clockwise {
    background: linear-gradient(135deg, var(--theme-card-bg), rgba(59, 130, 246, 0.08));
  }

  .rotation-button.clockwise:hover {
    border-color: rgba(59, 130, 246, 0.5);
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.2));
    box-shadow: 0 8px 32px rgba(59, 130, 246, 0.2), 0 0 0 1px rgba(59, 130, 246, 0.1);
  }

  .rotation-button.clockwise:hover .rotation-icon {
    color: var(--semantic-info);
  }

  .rotation-button.counter-clockwise {
    background: linear-gradient(135deg, var(--theme-card-bg), rgba(239, 68, 68, 0.08));
  }

  .rotation-button.counter-clockwise:hover {
    border-color: rgba(239, 68, 68, 0.5);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.2));
    box-shadow: 0 8px 32px rgba(239, 68, 68, 0.2), 0 0 0 1px rgba(239, 68, 68, 0.1);
  }

  .rotation-button.counter-clockwise:hover .rotation-icon {
    color: var(--semantic-error);
  }

  /* Mobile adjustments */
  @media (max-width: 640px) {
    .rotation-selector {
      padding: 24px 16px;
      gap: 20px;
    }

    .title {
      font-size: var(--font-size-xl);
    }

    .rotation-options {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .rotation-button {
      flex-direction: row;
      justify-content: flex-start;
      gap: 20px;
      padding: 20px 24px;
    }

    .icon-container {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
    }

    .rotation-button .label,
    .rotation-button .sublabel,
    .rotation-button .keyboard-hint {
      text-align: left;
    }

    .rotation-button .keyboard-hint {
      margin-top: 0;
      margin-left: auto;
    }
  }

  /* Accessibility - reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .rotation-button,
    .rotation-button .icon-container {
      transition: none;
      animation: none;
    }
  }
</style>
