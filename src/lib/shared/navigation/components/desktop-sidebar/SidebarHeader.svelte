<!-- Sidebar Header Component -->
<!-- Contains the logo/branding and collapse toggle button -->
<script lang="ts">
  let { isCollapsed, onLogoClick, onToggleCollapse } = $props<{
    isCollapsed: boolean;
    onLogoClick: () => void;
    onToggleCollapse: () => void;
  }>();
</script>

<div class="sidebar-header">
  <!-- Collapse Toggle Button -->
  <button
    class="collapse-toggle"
    onclick={onToggleCollapse}
    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
  >
    <i class="fas fa-{isCollapsed ? 'indent' : 'outdent'}" aria-hidden="true"
    ></i>
  </button>
</div>

<style>
  /* ============================================================================
     SIDEBAR HEADER - Premium Glassmorphism Design
     ============================================================================ */
  .sidebar-header {
    border-bottom: 1px solid var(--theme-stroke);
    background: linear-gradient(
      135deg,
      color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 10%,
          transparent
        )
        0%,
      color-mix(
          in srgb,
          var(--theme-accent-strong, var(--theme-accent-strong)) 8%,
          transparent
        )
        50%,
      rgba(236, 72, 153, 0.06) 100%
    );
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* Subtle glow effect at top */
  .sidebar-header::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--theme-accent) 40%, transparent),
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent-strong)) 40%,
        transparent
      ),
      transparent
    );
  }

  /* ============================================================================
     COLLAPSE TOGGLE BUTTON
     ============================================================================ */
  .collapse-toggle {
    width: 100%;
    min-height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    font-size: var(--font-size-sm);
    position: relative;
    overflow: hidden;
  }

  /* Shimmer effect */
  .collapse-toggle::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      transparent 40%,
      var(--theme-card-bg) 50%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
  }

  .collapse-toggle:hover::before {
    opacity: 1;
    animation: header-shimmer 1s ease-in-out;
  }

  @keyframes header-shimmer {
    0% {
      transform: translateX(-100%) translateY(-100%);
    }
    100% {
      transform: translateX(100%) translateY(100%);
    }
  }

  .collapse-toggle:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
    border-color: var(--theme-stroke-strong);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 var(--theme-stroke);
  }

  .collapse-toggle:active {
    transform: scale(0.97);
    transition-duration: var(--duration-instant);
  }

  .collapse-toggle i {
    transition: transform var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .collapse-toggle:hover i {
    transform: scale(1.15);
  }

  /* Focus styles for keyboard navigation */
  .collapse-toggle:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  /* ============================================================================
     ANIMATIONS & TRANSITIONS
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .collapse-toggle,
    .collapse-toggle::before,
    .collapse-toggle i {
      transition: none !important;
      animation: none !important;
    }
    .collapse-toggle:hover,
    .collapse-toggle:active {
      transform: none;
    }
  }
</style>
