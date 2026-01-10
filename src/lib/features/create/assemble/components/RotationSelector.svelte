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
  <h2 class="title">Select Rotation Direction</h2>
  <p class="description">
    Choose the rotation direction for SHIFT motions in your sequence.
  </p>

  <div class="rotation-options">
    <button class="rotation-button clockwise" onclick={selectClockwise}>
      <div class="icon">↻</div>
      <div class="label">Clockwise</div>
      <div class="sublabel">Pro Rotation</div>
    </button>

    <button
      class="rotation-button counter-clockwise"
      onclick={selectCounterClockwise}
    >
      <div class="icon">↺</div>
      <div class="label">Counter-Clockwise</div>
      <div class="sublabel">Anti Rotation</div>
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
    max-width: 600px;
    margin: 0 auto;
  }

  .title {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    margin: 0;
    color: var(--theme-text);
    text-align: center;
  }

  .description {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-align: center;
    margin: 0;
    max-width: 400px;
    line-height: 1.5;
  }

  .rotation-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    width: 100%;
    margin-top: 16px;
  }

  .rotation-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px;
    background: var(--theme-card-bg);
    border: 2px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 200px;
  }

  .rotation-button .icon {
    font-size: var(--font-size-3xl);
    line-height: 1;
    transition: transform 0.3s ease;
    color: var(--theme-text-dim);
  }

  .rotation-button .label {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--theme-text);
  }

  .rotation-button .sublabel {
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Hover effects */
  @media (hover: hover) {
    .rotation-button:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px var(--theme-shadow);
    }

    .rotation-button.clockwise:hover .icon {
      transform: rotate(45deg);
    }

    .rotation-button.counter-clockwise:hover .icon {
      transform: rotate(-45deg);
    }
  }

  .rotation-button:active {
    transform: translateY(-2px);
    transition: transform 0.1s ease;
  }

  /* Color themes - keep domain colors (blue=CW, red=CCW) with themed base */
  .rotation-button.clockwise {
    background: linear-gradient(
      135deg,
      var(--theme-card-bg),
      rgba(59, 130, 246, 0.12)
    );
  }

  .rotation-button.clockwise:hover {
    border-color: rgba(59, 130, 246, 0.5);
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.15),
      rgba(59, 130, 246, 0.25)
    );
    box-shadow:
      0 8px 24px var(--theme-shadow, var(--theme-shadow)),
      0 0 32px rgba(59, 130, 246, 0.2);
  }

  .rotation-button.clockwise:hover .icon {
    color: var(--semantic-info);
  }

  .rotation-button.counter-clockwise {
    background: linear-gradient(
      135deg,
      var(--theme-card-bg),
      rgba(239, 68, 68, 0.12)
    );
  }

  .rotation-button.counter-clockwise:hover {
    border-color: rgba(239, 68, 68, 0.5);
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.15),
      rgba(239, 68, 68, 0.25)
    );
    box-shadow:
      0 8px 24px var(--theme-shadow, var(--theme-shadow)),
      0 0 32px rgba(239, 68, 68, 0.2);
  }

  .rotation-button.counter-clockwise:hover .icon {
    color: var(--semantic-error);
  }

  /* Mobile adjustments */
  @media (max-width: 640px) {
    .rotation-selector {
      padding: 24px 16px;
      gap: 20px;
    }

    .title {
      font-size: var(--font-size-2xl);
    }

    .rotation-options {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .rotation-button {
      min-height: 152px;
      padding: 24px;
    }

    .rotation-button .icon {
      font-size: var(--font-size-3xl);
    }

    .rotation-button .label {
      font-size: var(--font-size-base);
    }
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .rotation-button,
    .rotation-button .icon {
      transition: none;
    }
  }
</style>
