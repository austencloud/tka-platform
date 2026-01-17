<!--
  IOSSafariGuide.svelte

  Animated iOS Safari installation guide with bouncing arrows.
  This is the critical component for iOS since there's no native install prompt.

  Key insight from research: Animated bouncing arrows pointing at the Share button
  "drastically affect install rates" (add-to-homescreen library claims 85% rate)

  Flow:
  1. Show overlay with bouncing arrow pointing to Safari's Share button
  2. After user taps Share, show arrow pointing to "Add to Home Screen"
  3. Celebrate and close when done
-->
<script lang="ts">
  import { fade, fly, scale } from "svelte/transition";
  import { elasticOut, backOut } from "svelte/easing";

  // Props
  let {
    onDismiss,
    onComplete,
  }: {
    onDismiss: () => void;
    onComplete: () => void;
  } = $props();

  // Current step in the guide
  let currentStep = $state<1 | 2 | 3>(1);

  // Arrow animation state
  let arrowBouncing = $state(true);

  // Step descriptions
  const steps = {
    1: {
      title: "Tap the Share button",
      subtitle: "Look for this icon at the bottom of Safari",
      icon: "fas fa-share",
    },
    2: {
      title: 'Tap "Add to Home Screen"',
      subtitle: "Scroll down in the menu to find it",
      icon: "fas fa-plus-square",
    },
    3: {
      title: "You're all set!",
      subtitle: "TKA Scribe is now on your home screen",
      icon: "fas fa-check-circle",
    },
  };

  // Handle step progression
  function advanceStep() {
    if (currentStep === 1) {
      currentStep = 2;
    } else if (currentStep === 2) {
      currentStep = 3;
      // Auto-complete after celebration
      setTimeout(() => {
        onComplete();
      }, 2000);
    }
  }

  // Handle "I did it" button
  function handleDidIt() {
    advanceStep();
  }

  // Handle skip/dismiss
  function handleSkip() {
    onDismiss();
  }
</script>

<!-- Full screen overlay -->
<div class="ios-guide-overlay" transition:fade={{ duration: 200 }}>
  <!-- Backdrop with tap-through hole at the bottom for Share button -->
  <div
    class="backdrop"
    class:step-1={currentStep === 1}
    class:step-2={currentStep === 2}
  >
    <!-- Cutout highlight for Safari UI (step 1 only) -->
    {#if currentStep === 1}
      <div class="safari-highlight" transition:fade={{ duration: 300 }}>
        <div class="highlight-glow"></div>
      </div>
    {/if}
  </div>

  <!-- Main content card -->
  <div
    class="guide-card"
    class:bottom={currentStep === 1}
    class:center={currentStep === 2 || currentStep === 3}
    transition:fly={{ y: 50, duration: 400, easing: backOut }}
  >
    <!-- App icon and branding -->
    <div class="app-header">
      <div class="app-icon">
        <img src="/favicon.png" alt="TKA Scribe" />
      </div>
      <div class="app-info">
        <span class="app-name">TKA Scribe</span>
        <span class="app-url">tkascribe.com</span>
      </div>
    </div>

    <!-- Step indicator -->
    <div class="step-indicator">
      {#each [1, 2, 3] as step}
        <div
          class="step-dot"
          class:active={currentStep === step}
          class:completed={currentStep > step}
        ></div>
      {/each}
    </div>

    <!-- Current step content -->
    {#key currentStep}
      <div class="step-content">
        {#if currentStep === 3}
          <!-- Celebration state -->
          <div
            class="celebration"
            transition:scale={{ duration: 400, easing: elasticOut }}
          >
            <div class="celebration-icon">
              <i class="fas fa-check-circle"></i>
            </div>
            <h2>{steps[currentStep].title}</h2>
            <p>{steps[currentStep].subtitle}</p>
          </div>
        {:else}
          <!-- Instruction state -->
          <div class="instruction">
            <div class="instruction-icon">
              <i class={steps[currentStep].icon}></i>
            </div>
            <h2>{steps[currentStep].title}</h2>
            <p>{steps[currentStep].subtitle}</p>
          </div>
        {/if}
      </div>
    {/key}

    <!-- Action buttons -->
    {#if currentStep !== 3}
      <div class="actions">
        <button class="btn-primary" onclick={handleDidIt}>
          <i class="fas fa-check"></i>
          <span>I did it</span>
        </button>
        <button class="btn-secondary" onclick={handleSkip}>
          Continue in browser
        </button>
      </div>
    {/if}
  </div>

  <!-- Bouncing arrow pointing to Safari Share button (step 1) -->
  {#if currentStep === 1 && arrowBouncing}
    <div
      class="bouncing-arrow bottom-arrow"
      transition:fade={{ duration: 200 }}
    >
      <div class="arrow-container">
        <i class="fas fa-arrow-down"></i>
      </div>
      <span class="arrow-label">Tap here</span>
    </div>
  {/if}

  <!-- Arrow pointing to Add to Home Screen option (step 2) -->
  {#if currentStep === 2}
    <div class="instruction-arrow" transition:fade={{ duration: 200 }}>
      <div class="arrow-with-icon">
        <i class="fas fa-plus-square icon-preview"></i>
        <span class="arrow-text">Look for this icon</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .ios-guide-overlay {
    position: fixed;
    inset: 0;
    z-index: 100000;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
  }

  /* Backdrop with gradient */
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    transition: background 0.3s ease;
  }

  .backdrop.step-1 {
    /* Leave bottom area slightly visible for Share button context */
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.9) 0%,
      rgba(0, 0, 0, 0.9) 80%,
      rgba(0, 0, 0, 0.6) 100%
    );
  }

  /* Highlight glow around Safari Share area */
  .safari-highlight {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 80px;
    height: 80px;
    pointer-events: none;
  }

  .highlight-glow {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(99, 102, 241, 0.4) 0%,
      rgba(99, 102, 241, 0) 70%
    );
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.2);
      opacity: 1;
    }
  }

  /* Guide card */
  .guide-card {
    position: absolute;
    left: 16px;
    right: 16px;
    max-width: 400px;
    margin: 0 auto;

    background: rgba(30, 30, 40, 0.98);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 24px;
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;

    z-index: 10;
  }

  .guide-card.bottom {
    bottom: 100px; /* Above Safari toolbar */
  }

  .guide-card.center {
    top: 50%;
    transform: translateY(-50%);
  }

  /* App header */
  .app-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .app-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(99, 102, 241, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .app-icon img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .app-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .app-name {
    font-size: 18px;
    font-weight: 700;
    color: white;
  }

  .app-url {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Step indicator */
  .step-indicator {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 24px;
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }

  .step-dot.active {
    width: 24px;
    border-radius: 4px;
    background: #6366f1;
  }

  .step-dot.completed {
    background: #22c55e;
  }

  /* Step content */
  .step-content {
    text-align: center;
    margin-bottom: 24px;
  }

  .instruction,
  .celebration {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .instruction-icon,
  .celebration-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
  }

  .instruction-icon {
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
  }

  .celebration-icon {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    animation: celebrate 0.6s ease-out;
  }

  @keyframes celebrate {
    0% {
      transform: scale(0) rotate(-180deg);
    }
    60% {
      transform: scale(1.2) rotate(10deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }

  .step-content h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: white;
  }

  .step-content p {
    margin: 0;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.4;
  }

  /* Action buttons */
  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 16px;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 17px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    background: #818cf8;
    transform: translateY(-1px);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-secondary {
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    border: none;
    padding: 12px;
    font-size: 15px;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .btn-secondary:hover {
    color: white;
  }

  /* Bouncing arrow */
  .bouncing-arrow {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    z-index: 5;
    pointer-events: none;
  }

  .bottom-arrow {
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
  }

  .arrow-container {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #6366f1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: white;
    animation: bounce-arrow 1s ease-in-out infinite;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.5);
  }

  @keyframes bounce-arrow {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(10px);
    }
  }

  .arrow-label {
    font-size: 14px;
    font-weight: 600;
    color: white;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    animation: fade-pulse 2s ease-in-out infinite;
  }

  @keyframes fade-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  /* Step 2 instruction arrow */
  .instruction-arrow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, 100px);
    z-index: 5;
    pointer-events: none;
  }

  .arrow-with-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    background: rgba(99, 102, 241, 0.15);
    border: 2px dashed rgba(99, 102, 241, 0.4);
    border-radius: 16px;
    animation: gentle-pulse 2s ease-in-out infinite;
  }

  @keyframes gentle-pulse {
    0%,
    100% {
      border-color: rgba(99, 102, 241, 0.4);
      transform: scale(1);
    }
    50% {
      border-color: rgba(99, 102, 241, 0.8);
      transform: scale(1.02);
    }
  }

  .icon-preview {
    font-size: 36px;
    color: #818cf8;
  }

  .arrow-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
  }

  /* Safe area padding for notched devices */
  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    .guide-card.bottom {
      bottom: calc(100px + env(safe-area-inset-bottom));
    }

    .bouncing-arrow.bottom-arrow {
      bottom: calc(20px + env(safe-area-inset-bottom));
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .highlight-glow {
      animation: none;
    }
    .celebration-icon {
      animation: none;
    }
    .arrow-container {
      animation: none;
    }
    .arrow-label {
      animation: none;
    }
    .arrow-with-icon {
      animation: none;
    }
    /* Disable local keyframe animations */
    [style*="celebrate"] {
      animation: none;
    }
    [style*="bounce-arrow"] {
      animation: none;
    }
    [style*="fade-pulse"] {
      animation: none;
    }
    [style*="gentle-pulse"] {
      animation: none;
    }
  }
</style>
