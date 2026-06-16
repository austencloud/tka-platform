<!-- Sidebar Header Component -->
<!-- Shows "TKA Composer" branding that doubles as collapse/expand toggle -->
<script lang="ts">
  let { isCollapsed, onLogoClick, onToggleCollapse } = $props<{
    isCollapsed: boolean;
    onLogoClick: () => void;
    onToggleCollapse: () => void;
  }>();
</script>

<div class="sidebar-header">
  <button
    class="brand-toggle"
    onclick={onToggleCollapse}
    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
  >
    {#if isCollapsed}
      <span class="brand-icon">TKA</span>
    {:else}
      <span class="brand-text">TKA Composer</span>
      <i class="fas fa-chevron-left toggle-icon" aria-hidden="true"></i>
    {/if}
  </button>
</div>

<style>
  .sidebar-header {
    border-bottom: 1px solid var(--theme-stroke);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 10%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent-strong) 8%, transparent) 50%,
      rgba(236, 72, 153, 0.06) 100%
    );
    display: flex;
    flex-direction: column;
    position: relative;
  }

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
      color-mix(in srgb, var(--theme-accent-strong) 40%, transparent),
      transparent
    );
  }

  .brand-toggle {
    width: 100%;
    min-height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 14px;
    background: transparent;
    border: none;
    color: var(--theme-text);
    cursor: pointer;
    transition: background var(--duration-normal) ease;
    position: relative;
    overflow: hidden;
  }

  .brand-toggle:hover {
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
  }

  .brand-toggle:active {
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  }

  .brand-toggle:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: -2px;
  }

  .brand-text {
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
    background: linear-gradient(
      135deg,
      var(--theme-text) 0%,
      color-mix(in srgb, var(--theme-accent) 60%, var(--theme-text)) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .toggle-icon {
    position: absolute;
    right: 12px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
    opacity: 0;
    transition:
      opacity var(--duration-normal) ease,
      transform var(--duration-normal) ease;
  }

  .brand-toggle:hover .toggle-icon {
    opacity: 1;
  }

  .brand-icon {
    width: 100%;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 800;
    background: linear-gradient(
      135deg,
      var(--theme-text) 0%,
      color-mix(in srgb, var(--theme-accent) 60%, var(--theme-text)) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  @media (prefers-reduced-motion: reduce) {
    .brand-toggle,
    .toggle-icon {
      transition: none !important;
    }
  }
</style>
