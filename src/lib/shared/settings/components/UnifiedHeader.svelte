<!--
  UnifiedHeader - Universal intelligent responsive header component

  Provides consistent header styling across all panels (settings, navigation, etc.) with:
  - Container queries for true responsive behavior
  - Automatic vertical/horizontal layout switching based on available space
  - Optional help text with tooltip
  - Consistent spacing and typography

  Use for: Card headers, tab buttons, section headers, or any header that needs intelligent responsive layout
-->
<script lang="ts">
  let { title, icon, description, helpText } = $props<{
    title: string;
    icon?: string; // Font Awesome class (e.g., "fas fa-link")
    description?: string;
    helpText?: string;
  }>();

  let showTooltip = $state(false);
</script>

<div class="card-header-container">
  <div class="card-header">
    {#if icon}
      <i class={icon} aria-hidden="true"></i>
    {/if}
    <h3 class="card-title">{title}</h3>
    {#if helpText}
      <button
        class="help-button"
        aria-label="Help for {title}"
        onmouseenter={() => (showTooltip = true)}
        onmouseleave={() => (showTooltip = false)}
        onfocus={() => (showTooltip = true)}
        onblur={() => (showTooltip = false)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            d="M12 16v-1a2 2 0 012-2v0a2 2 0 002-2v0a2 2 0 00-2-2h-1a2 2 0 00-2 2"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <circle cx="12" cy="18" r="0.5" fill="currentColor" />
        </svg>
        {#if showTooltip}
          <span class="tooltip">{helpText}</span>
        {/if}
      </button>
    {/if}
  </div>
  {#if description}
    <p class="card-description">{description}</p>
  {/if}
</div>

<style>
  .card-header-container {
    container-type: inline-size;
    width: 100%;
  }

  .card-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 1.5cqi, 14px);
    margin-bottom: clamp(10px, 1.5vh, 16px);
  }

  .card-header i {
    font-size: clamp(18px, 2.5vh, 22px);
    color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 80%,
      transparent
    );
    flex-shrink: 0;
  }

  .card-title {
    font-size: clamp(16px, 2.2vh, 20px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin: 0;
    text-align: center;
    letter-spacing: -0.01em;
  }

  .help-button {
    position: relative;
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast, var(--duration-fast) ease);
    flex-shrink: 0;
  }

  .help-button:hover,
  .help-button:focus {
    color: rgba(255, 255, 255, 0.9);
    outline: none;
  }

  .tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.95);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: var(--font-size-compact);
    line-height: 1.4;
    white-space: nowrap;
    max-width: 252px;
    white-space: normal;
    text-align: left;
    box-shadow: 0 4px 12px var(--theme-shadow);
    z-index: 1000;
    pointer-events: none;
    animation: fadeIn var(--duration-normal) ease-out;
  }

  .tooltip::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.95);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .card-description {
    font-size: clamp(13px, 1.8vh, 15px);
    color: rgba(255, 255, 255, 0.65);
    text-align: center;
    margin: 0 0 clamp(16px, 2.5vh, 24px) 0;
    line-height: 1.5;
  }

  /* Container query: Switch to vertical layout on very narrow containers */
  @container (max-width: 352px) {
    .card-header {
      flex-direction: column;
      gap: clamp(6px, 1cqi, 10px);
    }

    .card-header i {
      font-size: var(--font-size-xl);
    }

    .card-title {
      font-size: var(--font-size-lg);
    }
  }

  /* Accessibility - Focus Indicators */
  .help-button:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--theme-accent) 90%, transparent);
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* Accessibility - Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .help-button,
    .tooltip {
      transition: none;
      animation: none;
    }
  }

  /* Accessibility - High Contrast */
  @media (prefers-contrast: high) {
    .card-header i {
      color: var(--theme-accent);
    }

    .help-button:focus-visible {
      outline: 3px solid white;
    }
  }
</style>
