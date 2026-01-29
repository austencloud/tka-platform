<!--
RotationSelector.svelte - Rotation direction selection UI

Preview-before-commit flow:
1. User picks blue rotation → preview updates
2. User picks red rotation → preview updates
3. User sees actual PRO/ANTI arrows and can adjust
4. "Done" button finalizes when both selected
-->
<script lang="ts">
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";

  const { onConfirm, onPreviewChange } = $props<{
    onConfirm: (blueRotation: RotationDirection, redRotation: RotationDirection) => void;
    onPreviewChange: (blueRotation: RotationDirection | null, redRotation: RotationDirection | null) => void;
  }>();

  const hapticService = container.items.hapticFeedback as IHapticFeedback;

  // Track selections for each hand
  let blueRotation = $state<RotationDirection | null>(null);
  let redRotation = $state<RotationDirection | null>(null);

  // Can confirm when both are selected
  const canConfirm = $derived(blueRotation !== null && redRotation !== null);

  function selectBlue(rotation: RotationDirection) {
    hapticService?.trigger("selection");
    blueRotation = rotation;
    onPreviewChange(blueRotation, redRotation);
  }

  function selectRed(rotation: RotationDirection) {
    hapticService?.trigger("selection");
    redRotation = rotation;
    onPreviewChange(blueRotation, redRotation);
  }

  function handleConfirm() {
    if (blueRotation && redRotation) {
      hapticService?.trigger("success");
      onConfirm(blueRotation, redRotation);
    }
  }
</script>

<div class="rotation-selector">
  <p class="title">Prop rotation direction</p>

  <div class="hand-rows">
    <!-- Blue hand row -->
    <div class="hand-row">
      <div class="hand-label blue">
        <svg viewBox="0 0 75 100" class="hand-icon">
          <path
            d="M11.17 44.59h3.37V12.7a5.61 5.61 0 1 1 11.2-.01v31.9h3.32V5.72A5.5 5.5 0 0 1 34.66 0a5.55 5.55 0 0 1 5.58 5.77v38.81h3.32V13.56c0-2.99 1.95-5.19 4.97-5.64 3.08-.45 6.18 2.1 6.19 5.15q.02 5.73 0 11.46v38.13c0 .79.16 1.47.94 1.87.85.44 1.73.15 2.27-.77l6.41-10.87c1.64-2.79 4.42-3.73 7.43-2.48 3.04 1.26 4.15 4.73 2.41 7.7L65.3 73.19c-2.17 3.68-4.29 7.4-6.55 11.03a18 18 0 0 1-2.81 3.27 46 46 0 0 1-14.76 9.87c-5.01 2.03-10.23 3.03-15.63 2.51-9.85-.94-17.1-5.78-21.71-14.35A32 32 0 0 1 .26 73a76 76 0 0 1-.25-6.23L0 25.08a5.6 5.6 0 0 1 5.74-5.7 5.5 5.5 0 0 1 5.42 5.41z"
          />
        </svg>
      </div>
      <div class="rotation-buttons">
        <button
          class="rotation-btn"
          class:selected={blueRotation === RotationDirection.CLOCKWISE}
          onclick={() => selectBlue(RotationDirection.CLOCKWISE)}
          aria-label="Blue hand clockwise"
        >
          <svg class="arrow-icon cw" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4C7.58 4 4 7.58 4 12s3.58 8 8 8c3.1 0 5.75-1.75 7.1-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M19 10l-3 4h6l-3-4z" fill="currentColor"/>
          </svg>
        </button>
        <button
          class="rotation-btn"
          class:selected={blueRotation === RotationDirection.COUNTER_CLOCKWISE}
          onclick={() => selectBlue(RotationDirection.COUNTER_CLOCKWISE)}
          aria-label="Blue hand counter-clockwise"
        >
          <svg class="arrow-icon ccw" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4C16.42 4 20 7.58 20 12s-3.58 8-8 8c-3.1 0-5.75-1.75-7.1-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M5 10l3 4H2l3-4z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Red hand row -->
    <div class="hand-row">
      <div class="hand-label red">
        <svg viewBox="0 0 75 100" class="hand-icon mirrored">
          <path
            d="M11.17 44.59h3.37V12.7a5.61 5.61 0 1 1 11.2-.01v31.9h3.32V5.72A5.5 5.5 0 0 1 34.66 0a5.55 5.55 0 0 1 5.58 5.77v38.81h3.32V13.56c0-2.99 1.95-5.19 4.97-5.64 3.08-.45 6.18 2.1 6.19 5.15q.02 5.73 0 11.46v38.13c0 .79.16 1.47.94 1.87.85.44 1.73.15 2.27-.77l6.41-10.87c1.64-2.79 4.42-3.73 7.43-2.48 3.04 1.26 4.15 4.73 2.41 7.7L65.3 73.19c-2.17 3.68-4.29 7.4-6.55 11.03a18 18 0 0 1-2.81 3.27 46 46 0 0 1-14.76 9.87c-5.01 2.03-10.23 3.03-15.63 2.51-9.85-.94-17.1-5.78-21.71-14.35A32 32 0 0 1 .26 73a76 76 0 0 1-.25-6.23L0 25.08a5.6 5.6 0 0 1 5.74-5.7 5.5 5.5 0 0 1 5.42 5.41z"
          />
        </svg>
      </div>
      <div class="rotation-buttons">
        <button
          class="rotation-btn"
          class:selected={redRotation === RotationDirection.CLOCKWISE}
          onclick={() => selectRed(RotationDirection.CLOCKWISE)}
          aria-label="Red hand clockwise"
        >
          <svg class="arrow-icon cw" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4C7.58 4 4 7.58 4 12s3.58 8 8 8c3.1 0 5.75-1.75 7.1-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M19 10l-3 4h6l-3-4z" fill="currentColor"/>
          </svg>
        </button>
        <button
          class="rotation-btn"
          class:selected={redRotation === RotationDirection.COUNTER_CLOCKWISE}
          onclick={() => selectRed(RotationDirection.COUNTER_CLOCKWISE)}
          aria-label="Red hand counter-clockwise"
        >
          <svg class="arrow-icon ccw" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4C16.42 4 20 7.58 20 12s-3.58 8-8 8c-3.1 0-5.75-1.75-7.1-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M5 10l3 4H2l3-4z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Confirm button -->
  <button
    class="confirm-btn"
    onclick={handleConfirm}
    disabled={!canConfirm}
  >
    {#if canConfirm}
      Done
    {:else if !blueRotation && !redRotation}
      Select rotations
    {:else if !blueRotation}
      Select blue rotation
    {:else}
      Select red rotation
    {/if}
  </button>
</div>

<style>
  .rotation-selector {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
    height: 100%;
    width: 100%;
    max-width: 320px;
    margin: 0 auto;
  }

  .title {
    font-size: var(--font-size-base);
    font-weight: 500;
    margin: 0;
    color: var(--theme-text-dim);
    text-align: center;
  }

  .hand-rows {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .hand-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .hand-label {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  .hand-label.blue {
    color: var(--semantic-info);
  }

  .hand-label.red {
    color: var(--semantic-error);
  }

  .hand-icon {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }

  .hand-icon.mirrored {
    transform: scaleX(-1);
  }

  .rotation-buttons {
    display: flex;
    gap: 8px;
    flex: 1;
  }

  .rotation-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 2px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    min-height: 56px;
  }

  .rotation-btn:hover {
    border-color: var(--theme-accent);
    background: rgba(139, 92, 246, 0.1);
  }

  .rotation-btn.selected {
    border-color: var(--theme-accent);
    background: rgba(139, 92, 246, 0.2);
  }

  .rotation-btn:active {
    transform: scale(0.97);
    transition: transform var(--duration-instant) ease;
  }

  .arrow-icon {
    width: 28px;
    height: 28px;
    color: var(--theme-text);
    transition: color var(--duration-normal) ease;
  }

  .rotation-btn:hover .arrow-icon,
  .rotation-btn.selected .arrow-icon {
    color: var(--theme-accent);
  }

  .arrow-icon.cw {
    animation: spin-cw 3s linear infinite;
  }

  .arrow-icon.ccw {
    animation: spin-ccw 3s linear infinite;
  }

  @keyframes spin-cw {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes spin-ccw {
    from { transform: rotate(0deg); }
    to { transform: rotate(-360deg); }
  }

  @media (hover: hover) {
    .rotation-btn:hover .arrow-icon {
      animation-duration: 1s;
    }
  }

  /* Confirm button */
  .confirm-btn {
    width: 100%;
    padding: 14px 20px;
    border: none;
    border-radius: 12px;
    font-size: var(--font-size-base);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    background: linear-gradient(135deg, var(--semantic-success), #059669);
    color: white;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .confirm-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
  }

  .confirm-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .confirm-btn:disabled {
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    box-shadow: none;
    cursor: not-allowed;
  }

  /* Accessibility - reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .rotation-btn,
    .arrow-icon,
    .confirm-btn {
      transition: none;
      animation: none;
    }
  }
</style>
