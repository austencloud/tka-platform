<!-- GlassCard.svelte - Reusable glassmorphism card with optional header -->
<script lang="ts">
  interface Props {
    /** Optional icon class (e.g., 'fas fa-link') */
    icon?: string;
    /** Optional card title */
    title?: string;
    /** Optional card subtitle */
    subtitle?: string;
    /** Additional CSS classes for the card */
    class?: string;
    /** Additional CSS classes for the icon */
    iconClass?: string;
    children?: any;
  }

  let {
    icon,
    title,
    subtitle,
    class: className,
    iconClass,
    children,
  }: Props = $props();
</script>

<section class="glass-card {className || ''}">
  {#if icon || title}
    <header class="card-header">
      {#if icon}
        <div class="card-icon {iconClass || ''}">
          <i class={icon}></i>
        </div>
      {/if}
      {#if title}
        <div class="card-header-text">
          <h3 class="card-title">{title}</h3>
          {#if subtitle}
            <p class="card-subtitle">{subtitle}</p>
          {/if}
        </div>
      {/if}
    </header>
  {/if}
  <div class="card-content">
    {@render children?.()}
  </div>
</section>

<style>
  /* ========================================
     GLASS CARD BASE - Theme-aware
     ======================================== */
  .glass-card {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 2.5cqi, 16px);
    padding: clamp(14px, 2.5cqi, 24px);
    border-radius: clamp(12px, 3cqi, 16px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    transition:
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;
  }

  .glass-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-1px);
    box-shadow: var(--theme-shadow);
  }

  /* ========================================
     CARD HEADER
     ======================================== */
  .card-header {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2cqi, 14px);
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(36px, 8cqi, 44px);
    height: clamp(36px, 8cqi, 44px);
    border-radius: clamp(8px, 2cqi, 12px);
    font-size: clamp(16px, 3cqi, 18px);
    flex-shrink: 0;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    color: var(--theme-accent);
  }

  .card-header-text {
    flex: 1;
    min-width: 0;
  }

  .card-title {
    font-size: clamp(15px, 3cqi, 17px);
    font-weight: 600;
    margin: 0;
    color: var(--theme-text);
    font-family:
      -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  .card-subtitle {
    font-size: clamp(12px, 2cqi, 13px);
    color: var(--theme-text-dim);
    margin: 3px 0 0 0;
  }

  .card-content {
    flex: 1; /* Grow to fill available space for equal row heights */
    display: flex;
    flex-direction: column;
    padding-top: 4px;
  }

  /* ========================================
     ACCESSIBILITY
     ======================================== */
  @media (prefers-reduced-motion: reduce) {
    .glass-card {
      transition: none;
    }

    .glass-card:hover {
      transform: none;
    }
  }

  @media (prefers-contrast: high) {
    .glass-card {
      border-width: 2px;
    }
  }
</style>
