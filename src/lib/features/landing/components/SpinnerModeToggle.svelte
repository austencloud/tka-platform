<!--
  SpinnerModeToggle.svelte

  Segmented control for switching between Library, Infinite, and Live modes
  in the endless spinner.

  Design:
  - iOS-style segmented control with three options
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

  const modes: { id: SpinnerMode; icon: string; label: string }[] = [
    { id: "library", icon: "fas fa-book-open", label: "Library" },
    { id: "infinite", icon: "fas fa-infinity", label: "Infinite" },
    { id: "live", icon: "fas fa-broadcast-tower", label: "Live" },
  ];

  function getModeIndex(m: SpinnerMode): number {
    return modes.findIndex((mode) => mode.id === m);
  }

  function handleModeChange(newMode: SpinnerMode) {
    onModeChange?.(newMode);
  }

  function handleKeydown(event: KeyboardEvent, targetMode: SpinnerMode) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleModeChange(targetMode);
    }
  }

  // Calculate indicator position based on mode index
  $effect(() => {
    const index = getModeIndex(mode);
    document.documentElement.style.setProperty(
      "--spinner-mode-index",
      String(index)
    );
  });
</script>

<div class="mode-toggle" role="tablist" aria-label="Spinner mode selection">
  {#each modes as modeOption (modeOption.id)}
    <button
      class="mode-option"
      class:active={mode === modeOption.id}
      class:live={modeOption.id === "live"}
      role="tab"
      aria-selected={mode === modeOption.id}
      tabindex={mode === modeOption.id ? 0 : -1}
      onclick={() => handleModeChange(modeOption.id)}
      onkeydown={(e) => handleKeydown(e, modeOption.id)}
    >
      <i class={modeOption.icon} aria-hidden="true"></i>
      <span>{modeOption.label}</span>
    </button>
  {/each}

  <!-- Sliding indicator -->
  <div
    class="indicator"
    class:live-active={mode === "live"}
    style:transform="translateX({getModeIndex(mode) * 100}%)"
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
    gap: 6px;
    padding: 10px 16px;
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
    min-width: 100px;
  }

  .mode-option i {
    font-size: 0.9rem;
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

  /* Live mode pulsing dot when active */
  .mode-option.live.active::after {
    content: "";
    position: absolute;
    top: 8px;
    right: 8px;
    width: 6px;
    height: 6px;
    background: #ef4444;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.2);
    }
  }

  /* Sliding indicator background */
  .indicator {
    position: absolute;
    top: 4px;
    left: 4px;
    width: calc(33.333% - 2.67px);
    height: calc(100% - 8px);
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 8px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
    box-shadow:
      0 2px 8px rgba(99, 102, 241, 0.3),
      0 0 0 1px rgba(139, 92, 246, 0.2);
  }

  /* Live mode has a different color */
  .indicator.live-active {
    background: linear-gradient(135deg, #ef4444, #f97316);
    box-shadow:
      0 2px 8px rgba(239, 68, 68, 0.3),
      0 0 0 1px rgba(249, 115, 22, 0.2);
  }

  /* Mobile optimization */
  @media (max-width: 600px) {
    .mode-toggle {
      width: 100%;
      max-width: 360px;
    }

    .mode-option {
      flex: 1;
      min-width: 0;
      padding: 10px 12px;
    }

    .mode-option span {
      font-size: 0.75rem;
    }

    .mode-option i {
      font-size: 0.85rem;
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

    .mode-option.live.active::after {
      animation: none;
    }
  }
</style>
