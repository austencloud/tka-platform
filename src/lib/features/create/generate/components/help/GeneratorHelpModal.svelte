<!--
  GeneratorHelpModal.svelte

  Modal for learning about a specific generator control.
  Shows icon, name, description, bullet points, and tips.
  Simpler than TransformDetailModal (no interactive demo).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import {
    generatorHelpContent,
    type GeneratorHelpId,
  } from "../../domain/generator-help-content";
  import { portal } from "../modals/portal";

  interface Props {
    controlId: GeneratorHelpId;
    onClose: () => void;
  }

  let { controlId, onClose }: Props = $props();

  // Track if we should show internal animations (only on entrance)
  let hasEntered = $state(false);
  onMount(() => {
    // Small delay to ensure entrance animations play
    requestAnimationFrame(() => {
      hasEntered = true;
    });
  });

  // Lock body scroll when modal is open
  onMount(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  });

  // Get control content
  const control = $derived(
    generatorHelpContent.find((c) => c.id === controlId) ?? generatorHelpContent[0]
  );

  // Handle keyboard
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
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
  aria-label="Help for {control?.name ?? 'control'}"
  tabindex="-1"
  transition:fade={{ duration: 250, easing: cubicOut }}
>
  <div
    class="modal-container"
    class:entered={hasEntered}
    in:fly={{ y: 40, duration: 400, easing: backOut }}
    out:fly={{ y: 20, duration: 200, easing: cubicOut }}
  >
    <!-- Header -->
    <div class="modal-header" style:--control-color={control?.color ?? "#3b82f6"}>
      <div class="header-icon">
        <i class="fas {control?.icon ?? 'fa-question'}" aria-hidden="true"></i>
      </div>
      <div class="header-text">
        <h2 class="header-title">{control?.name ?? "Control"}</h2>
        <p class="header-subtitle">{control?.shortDesc ?? ""}</p>
      </div>
      <button class="close-btn" onclick={onClose} aria-label="Close help">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Content -->
    <div class="modal-content">
      <!-- Description -->
      <p class="description">{control?.fullDesc ?? ""}</p>

      <!-- Bullet points -->
      {#if control?.bullets && control.bullets.length > 0}
        <ul class="bullet-list">
          {#each control.bullets as bullet}
            <li>{bullet}</li>
          {/each}
        </ul>
      {/if}

      <!-- Tip -->
      {#if control?.tip}
        <div class="tip-box">
          <i class="fas fa-lightbulb" aria-hidden="true"></i>
          <span>{control.tip}</span>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="modal-footer">
      <button class="done-btn" onclick={onClose}>
        Got it
      </button>
    </div>
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
    /* Transitions handled by Svelte */
  }

  .modal-container {
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
    /* Transitions handled by Svelte fly */
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--control-color) 15%, transparent) 0%,
      transparent 100%
    );
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 11px;
    background: var(--control-color, #3b82f6);
    color: white;
    font-size: var(--font-size-lg, 18px);
    flex-shrink: 0;
  }

  /* Only animate internal elements on entrance */
  .modal-container.entered .header-icon {
    animation: iconBounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  }

  @keyframes iconBounceIn {
    0% {
      opacity: 0;
      transform: scale(0) rotate(-20deg);
    }
    100% {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }
  }

  .header-text {
    flex: 1;
    min-width: 0;
  }

  .modal-container.entered .header-text {
    animation: slideInRight 0.4s ease-out 0.05s backwards;
  }

  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(-15px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .header-title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .header-subtitle {
    margin: 2px 0 0;
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.85);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .close-btn:focus-visible {
    outline: 3px solid rgba(255, 255, 255, 0.9);
    outline-offset: 2px;
  }

  /* Content */
  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .description {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.9);
  }

  .modal-container.entered .description {
    animation: contentFadeUp 0.4s ease-out 0.1s backwards;
  }

  @keyframes contentFadeUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Bullet list */
  .bullet-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bullet-list li {
    position: relative;
    padding-left: 20px;
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.85);
  }

  /* Stagger bullet list items - only on entrance */
  .modal-container.entered .bullet-list li {
    animation: contentFadeUp 0.35s ease-out backwards;
  }
  .modal-container.entered .bullet-list li:nth-child(1) { animation-delay: 0.15s; }
  .modal-container.entered .bullet-list li:nth-child(2) { animation-delay: 0.22s; }
  .modal-container.entered .bullet-list li:nth-child(3) { animation-delay: 0.29s; }
  .modal-container.entered .bullet-list li:nth-child(4) { animation-delay: 0.36s; }
  .modal-container.entered .bullet-list li:nth-child(5) { animation-delay: 0.43s; }

  .bullet-list li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--control-color, #3b82f6);
  }

  /* Tip box */
  .tip-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 12px;
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.9);
  }

  .modal-container.entered .tip-box {
    animation: tipBoxPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s backwards;
  }

  @keyframes tipBoxPop {
    0% {
      opacity: 0;
      transform: scale(0.9) translateY(10px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .tip-box i {
    flex-shrink: 0;
    color: #4ade80;
    margin-top: 2px;
  }

  .modal-container.entered .tip-box i {
    animation: lightbulbGlow 2s ease-in-out 0.8s infinite;
  }

  @keyframes lightbulbGlow {
    0%, 100% {
      filter: drop-shadow(0 0 2px rgba(74, 222, 128, 0.3));
    }
    50% {
      filter: drop-shadow(0 0 8px rgba(74, 222, 128, 0.6));
    }
  }

  /* Footer */
  .modal-footer {
    padding: 14px 20px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    justify-content: center;
  }

  .modal-container.entered .modal-footer {
    animation: contentFadeUp 0.35s ease-out 0.4s backwards;
  }

  .done-btn {
    padding: 10px 32px;
    min-height: 44px;
    border-radius: 9px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .done-btn:active {
    transform: scale(0.96);
  }

  .done-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .done-btn:focus-visible {
    outline: 3px solid rgba(255, 255, 255, 0.9);
    outline-offset: 3px;
  }

  /* Mobile: full screen */
  @media (max-width: 480px) {
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
    .modal-container.entered .header-icon,
    .modal-container.entered .header-text,
    .modal-container.entered .description,
    .modal-container.entered .bullet-list li,
    .modal-container.entered .tip-box,
    .modal-container.entered .modal-footer {
      animation: none;
    }

    .modal-container.entered .tip-box i {
      animation: none;
      filter: none;
    }

    .close-btn,
    .done-btn {
      transition: none;
    }
  }
</style>
