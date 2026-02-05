<!--
  IOSInstallInstructions.svelte

  Expandable iOS "Add to Home Screen" instructions for Safari.
  Shows step-by-step visual guide for manual PWA installation on iOS.
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import { backOut } from "svelte/easing";

  interface Props {
    isExpanded: boolean;
    onToggle: () => void;
  }

  let { isExpanded = $bindable(), onToggle }: Props = $props();
</script>

<div class="ios-install-container">
  <button class="btn btn-primary" onclick={onToggle} aria-expanded={isExpanded}>
    <i class="fas fa-plus-square" aria-hidden="true"></i>
    <span>Add to Home Screen</span>
    <i
      class="fas fa-chevron-down expand-icon"
      class:rotated={isExpanded}
      aria-hidden="true"
    ></i>
  </button>

  {#if isExpanded}
    <div
      class="ios-instructions"
      transition:slide={{ duration: 300, easing: backOut }}
    >
      <div class="instruction-steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <p>
              Tap the <strong>Share</strong> button
              <i class="fas fa-share ios-icon" aria-hidden="true"></i>
            </p>
          </div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <p>
              Scroll and tap <strong>"Add to Home Screen"</strong>
              <i class="fas fa-plus-square ios-icon" aria-hidden="true"></i>
            </p>
          </div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <p>Tap <strong>"Add"</strong> in the top-right</p>
          </div>
        </div>
      </div>
      <div class="ios-benefits">
        <i class="fas fa-check-circle" aria-hidden="true"></i>
        Fullscreen, quick access, works offline
      </div>
    </div>
  {/if}
</div>

<style>
  .ios-install-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 400px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 28px;
    border-radius: 12px;
    font-weight: 600;
    font-size: var(--font-size-base, 1rem);
    text-decoration: none;
    transition: all var(--duration-normal) ease;
    cursor: pointer;
    border: none;
  }

  .btn-primary {
    background: var(--primary, #6366f1);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-light, #818cf8);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
  }

  .expand-icon {
    margin-left: 4px;
    font-size: var(--font-size-compact, 0.75rem);
    transition: transform var(--duration-emphasis) ease;
  }

  .expand-icon.rotated {
    transform: rotate(180deg);
  }

  .ios-instructions {
    width: 100%;
    margin-top: 16px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
  }

  .instruction-steps {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .step-number {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }

  .step-content p {
    margin: 0;
    color: rgba(255, 255, 255, 0.9);
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.5;
  }

  .step-content :global(strong) {
    color: #60a5fa;
  }

  .ios-icon {
    color: #60a5fa;
    margin-left: 4px;
  }

  .ios-benefits {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-sm, 0.875rem);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ios-benefits i {
    color: #10b981;
  }

  @media (prefers-reduced-motion: reduce) {
    .btn,
    .expand-icon {
      transition: none;
    }
  }
</style>
