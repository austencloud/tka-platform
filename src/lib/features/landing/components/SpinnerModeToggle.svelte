<!--
  SpinnerModeToggle.svelte

  Segmented control for switching between Library and Infinite modes
  in the endless spinner.

  Design:
  - iOS-style segmented control
  - Smooth sliding indicator animation
  - Theme-based colors
  - Keyboard accessible
-->
<script lang="ts">
  import type { SpinnerMode } from "../domain/models/spinner-models";

  let {
    mode = "library",
    onModeChange,
  }: {
    mode?: SpinnerMode;
    onModeChange?: (mode: SpinnerMode) => void;
  } = $props();

  function handleModeChange(newMode: SpinnerMode) {
    onModeChange?.(newMode);
  }

  function handleKeydown(event: KeyboardEvent, targetMode: SpinnerMode) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleModeChange(targetMode);
    }
  }
</script>

<div class="mode-toggle" role="tablist" aria-label="Spinner mode selection">
  <button
    class="mode-option"
    class:active={mode === "library"}
    role="tab"
    aria-selected={mode === "library"}
    tabindex={mode === "library" ? 0 : -1}
    onclick={() => handleModeChange("library")}
    onkeydown={(e) => handleKeydown(e, "library")}
  >
    <i class="fas fa-book-open" aria-hidden="true"></i>
    <span>Library</span>
  </button>

  <button
    class="mode-option"
    class:active={mode === "infinite"}
    role="tab"
    aria-selected={mode === "infinite"}
    tabindex={mode === "infinite" ? 0 : -1}
    onclick={() => handleModeChange("infinite")}
    onkeydown={(e) => handleKeydown(e, "infinite")}
  >
    <i class="fas fa-infinity" aria-hidden="true"></i>
    <span>Infinite</span>
  </button>

  <!-- Sliding indicator -->
  <div
    class="indicator"
    style:transform={mode === "library" ? "translateX(0%)" : "translateX(100%)"}
  ></div>
</div>

<style>
  .mode-toggle {
    position: relative;
    display: flex;
    gap: 0;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 4px;
    width: fit-content;
    margin: 0 auto;
    isolation: isolate;
  }

  .mode-option {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 24px;
    min-height: 48px;
    background: transparent;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: color 0.2s ease;
    z-index: 1;
    white-space: nowrap;
    min-width: 120px;
  }

  .mode-option i {
    font-size: 1rem;
  }

  .mode-option:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .mode-option:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }

  .mode-option.active {
    color: #fff;
  }

  /* Sliding indicator background */
  .indicator {
    position: absolute;
    top: 4px;
    left: 4px;
    width: calc(50% - 4px);
    height: calc(100% - 8px);
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 8px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
    box-shadow:
      0 2px 8px rgba(99, 102, 241, 0.3),
      0 0 0 1px rgba(139, 92, 246, 0.2);
  }

  /* Mobile optimization */
  @media (max-width: 600px) {
    .mode-toggle {
      width: 100%;
      max-width: 300px;
    }

    .mode-option {
      flex: 1;
      min-width: 0;
      padding: 10px 16px;
    }

    .mode-option span {
      font-size: 0.8125rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .indicator {
      transition: none;
    }

    .mode-option {
      transition: none;
    }
  }
</style>
