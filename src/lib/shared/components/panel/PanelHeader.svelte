<script lang="ts">
  /**
   * PanelHeader - Shared panel header component
   *
   * Provides consistent header styling across all panel components.
   */

  interface Props {
    /** Panel title */
    title: string;
    /** Optional subtitle */
    subtitle?: string;
    /** Optional FontAwesome icon class (e.g., "fa-trophy") */
    icon?: string;
    /**
     * Heading rank for the title. A panel nested inside a page keeps the
     * default 2; a panel that IS the page's masthead takes 1 so the document
     * has exactly one top-level heading. Presentation is identical either way.
     */
    headingLevel?: 1 | 2 | 3;
  }

  let { title, subtitle, icon, headingLevel = 2 }: Props = $props();
</script>

<div class="panel-header">
  <div class="panel-header__title">
    {#if icon}
      <i class="fas {icon} panel-header__icon" aria-hidden="true"></i>
    {/if}
    <svelte:element this={`h${headingLevel}`} class="panel-header__text">
      {title}
    </svelte:element>
  </div>
  {#if subtitle}
    <p class="panel-header__subtitle">{subtitle}</p>
  {/if}
</div>

<style>
  .panel-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 20px 20px 0;
    flex-shrink: 0;
  }

  .panel-header__title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .panel-header__icon {
    font-size: var(--font-size-2xl);
    color: var(--theme-accent);
  }

  .panel-header__text {
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--theme-text);
    margin: 0;
  }

  .panel-header__subtitle {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin: 0;
    padding-left: 36px;
  }

  @media (max-width: 640px) {
    .panel-header {
      padding: 16px 16px 0;
    }

    .panel-header__text {
      font-size: var(--font-size-2xl);
    }

    .panel-header__subtitle {
      font-size: var(--font-size-compact);
      padding-left: 32px;
    }
  }
</style>
