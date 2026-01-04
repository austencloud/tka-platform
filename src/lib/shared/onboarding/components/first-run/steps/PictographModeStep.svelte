<!--
  PictographModeStep - Choose lights on or Dark Mode

  Shows real pictographs side by side demonstrating both modes.
  Lights On: standard display on light background
  Dark Mode: inverted colors, dark background
-->
<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { examplePictographData } from "$lib/shared/settings/components/tabs/visibility/example-data";

  interface Props {
    initialValue?: "light" | "dark";
    isFinalStep?: boolean;
    onComplete: (mode: "light" | "dark") => void;
    onBack: () => void;
    onSkip: () => void;
  }

  const {
    initialValue,
    isFinalStep = false,
    onComplete,
    onBack,
    onSkip,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  let selectedMode = $state<"light" | "dark" | null>(initialValue ?? null);

  function handleSelect(mode: "light" | "dark") {
    selectedMode = mode;
  }

  function handleContinue() {
    if (selectedMode) {
      onComplete(selectedMode);
    }
  }
</script>

<div class="pictograph-mode-step">
  <div class="icon-container">
    <i class="fas fa-lightbulb" aria-hidden="true"></i>
  </div>

  <h1 class="title">Lights on or Dark Mode?</h1>

  <div class="mode-options">
    <!-- Lights On Option -->
    <button
      class="mode-card"
      class:selected={selectedMode === "light"}
      onclick={() => handleSelect("light")}
      aria-pressed={selectedMode === "light"}
    >
      <div class="preview-frame light-preview">
        <PictographContainer
          pictographData={examplePictographData}
          disableTransitions={true}
        />
      </div>
      <span class="mode-label">Lights On</span>
      {#if selectedMode === "light"}
        <div class="selected-badge">
          <i class="fas fa-check" aria-hidden="true"></i>
        </div>
      {/if}
    </button>

    <!-- Dark Mode Option -->
    <button
      class="mode-card"
      class:selected={selectedMode === "dark"}
      onclick={() => handleSelect("dark")}
      aria-pressed={selectedMode === "dark"}
    >
      <div class="preview-frame dark-preview">
        <PictographContainer
          pictographData={examplePictographData}
          disableTransitions={true}
        />
      </div>
      <span class="mode-label">Dark Mode</span>
      {#if selectedMode === "dark"}
        <div class="selected-badge">
          <i class="fas fa-check" aria-hidden="true"></i>
        </div>
      {/if}
    </button>
  </div>

  <p class="hint">You can change this anytime in settings</p>

  <div class="button-row">
    <button
      type="button"
      class="back-button"
      onclick={onBack}
      aria-label="Go back"
    >
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
    </button>

    <button
      type="button"
      class="next-button"
      class:finish-button={isFinalStep}
      disabled={!selectedMode}
      onclick={handleContinue}
    >
      {isFinalStep ? "Finish" : "Continue"}
      <i
        class="fas {isFinalStep ? 'fa-check' : 'fa-arrow-right'}"
        aria-hidden="true"
      ></i>
    </button>
  </div>
</div>

<style>
  .pictograph-mode-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 480px;
    width: 100%;
    text-align: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .icon-container {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, #f59e0b 15%, transparent);
    border-radius: 18px;
    font-size: 1.5rem;
    color: #f59e0b;
  }

  .title {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .mode-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    width: 100%;
    margin: 12px 0;
  }

  .mode-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px 12px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .mode-card:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-2px);
  }

  .mode-card.selected {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    border-color: var(--theme-accent-strong, #8b5cf6);
    transform: scale(1.02);
  }

  .mode-card:active {
    transform: scale(0.98);
  }

  .preview-frame {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .light-preview {
    background: white;
    /* Force light mode CSS variables */
    --dm-pictograph-bg: white;
  }

  .dark-preview {
    background: #0a0a0f;
    /* Force dark mode CSS variables */
    --dm-pictograph-bg: #0a0a0f;
  }

  /* Force dark mode styling on pictograph within dark-preview */
  .dark-preview :global(.pictograph) {
    filter: invert(0.9);
  }

  /* Make Pictograph fill the preview frame */
  .preview-frame :global(.pictograph) {
    width: 100%;
    height: 100%;
  }

  .mode-label {
    font-size: 1rem;
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .selected-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-accent-strong, #8b5cf6);
    border-radius: 50%;
    color: white;
    font-size: 0.7rem;
    animation: pop-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes pop-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .hint {
    font-size: 0.85rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  .button-row {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  .next-button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 24px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 40%,
      transparent
    );
    border: 2px solid
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 60%, transparent);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .next-button:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 50%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 80%,
      transparent
    );
  }

  .next-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .next-button.finish-button {
    background: color-mix(in srgb, #22c55e 40%, transparent);
    border-color: color-mix(in srgb, #22c55e 60%, transparent);
  }

  .next-button.finish-button:hover:not(:disabled) {
    background: color-mix(in srgb, #22c55e 50%, transparent);
    border-color: color-mix(in srgb, #22c55e 80%, transparent);
  }

  /* Mobile */
  @media (max-width: 480px) {
    .pictograph-mode-step {
      padding: 16px;
    }

    .icon-container {
      width: 56px;
      height: 56px;
      font-size: 1.3rem;
    }

    .title {
      font-size: 1.25rem;
    }

    .mode-options {
      gap: 12px;
    }

    .mode-card {
      padding: 12px 10px;
    }

    .mode-label {
      font-size: 0.9rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mode-card,
    .back-button,
    .next-button {
      transition: none;
    }

    .mode-card:hover,
    .mode-card:active,
    .mode-card.selected {
      transform: none;
    }

    .selected-badge {
      animation: none;
    }
  }
</style>
