<!--
  ControlButton.svelte

  Base circular control button component for playback controls.
  Used as a foundation for Stop, Loop, and other control buttons.
-->
<script lang="ts">
  let {
    icon,
    ariaLabel,
    active = false,
    onclick,
    size = "default",
    activeColor = "orange",
  }: {
    icon: string;
    ariaLabel: string;
    active?: boolean;
    onclick?: () => void;
    size?: "default" | "small";
    activeColor?: "orange" | "cyan" | "purple";
  } = $props();
</script>

<button
  class="control-btn"
  class:active
  class:small={size === "small"}
  class:active-orange={active && activeColor === "orange"}
  class:active-cyan={active && activeColor === "cyan"}
  class:active-purple={active && activeColor === "purple"}
  aria-label={ariaLabel}
  {onclick}
>
  <i class="fas {icon}" aria-hidden="true"></i>
</button>

<style>
  .control-btn {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 50%;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .control-btn.small {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    font-size: 0.9rem;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .control-btn:focus-visible {
    outline: 2px solid var(--primary-color, #6366f1);
    outline-offset: 2px;
  }

  /* Orange active state (default for Grid) */
  .control-btn.active-orange {
    background: rgba(251, 146, 60, 0.25);
    border-color: rgba(251, 146, 60, 0.5);
    color: #fb923c;
  }

  .control-btn.active-orange:hover {
    background: rgba(251, 146, 60, 0.35);
    border-color: rgba(251, 146, 60, 0.6);
  }

  /* Cyan active state (for Mirror) */
  .control-btn.active-cyan {
    background: rgba(6, 182, 212, 0.25);
    border-color: rgba(6, 182, 212, 0.5);
    color: #22d3ee;
  }

  .control-btn.active-cyan:hover {
    background: rgba(6, 182, 212, 0.35);
    border-color: rgba(6, 182, 212, 0.6);
  }

  /* Purple active state (for Single) */
  .control-btn.active-purple {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
    color: #c4b5fd;
    box-shadow: 0 2px 12px rgba(139, 92, 246, 0.3);
  }

  .control-btn.active-purple:hover {
    background: rgba(139, 92, 246, 0.35);
    border-color: rgba(139, 92, 246, 0.6);
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .control-btn {
      transition: none;
    }

    .control-btn:hover {
      transform: none;
    }
  }
</style>
