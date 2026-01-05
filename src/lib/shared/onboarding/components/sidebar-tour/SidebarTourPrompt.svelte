<script lang="ts">
  /**
   * SidebarTourPrompt
   *
   * Initial modal asking "Want a quick tour of the modules?"
   * Two options: "Take the tour" / "Explore on my own"
   */

  interface Props {
    onTakeTour: () => void;
    onExploreOwn: () => void;
  }

  const { onTakeTour, onExploreOwn }: Props = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onExploreOwn();
    } else if (event.key === "Enter") {
      onTakeTour();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    // Only dismiss if clicking the backdrop itself, not the modal content
    if (event.target === event.currentTarget) {
      onExploreOwn();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="tour-prompt-backdrop"
  onclick={handleBackdropClick}
  role="button"
  tabindex="0"
  aria-label="Dismiss welcome prompt"
>
  <div
    class="tour-prompt-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tour-title"
  >
    <div class="tour-icon">
      <i class="fas fa-map-signs" aria-hidden="true"></i>
    </div>

    <h2 id="tour-title" class="tour-title">Welcome to TKA Scribe</h2>

    <p class="tour-description">
      Want a quick tour of the modules? It only takes a moment.
    </p>

    <div class="tour-actions">
      <button class="tour-button primary" onclick={onTakeTour}>
        <i class="fas fa-play" aria-hidden="true"></i>
        Take the tour
      </button>
      <button class="tour-button secondary" onclick={onExploreOwn}>
        Explore on my own
      </button>
    </div>

    <p class="tour-hint">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      You can replay this tour anytime from Settings
    </p>
  </div>
</div>

<style>
  .tour-prompt-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease-out;
  }

  .tour-prompt-modal {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    text-align: center;
    animation: slideUp 0.3s ease-out;
  }

  .tour-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
    font-size: 1.75rem;
    color: white;
  }

  .tour-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0 0 0.75rem;
  }

  .tour-description {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    margin: 0 0 1.5rem;
  }

  .tour-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .tour-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    border-radius: 10px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .tour-button.primary {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
  }

  .tour-button.primary:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    transform: translateY(-1px);
  }

  .tour-button.secondary {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }

  .tour-button.secondary:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #ffffff);
  }

  .tour-hint {
    margin-top: 1.25rem;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
  }

  .tour-hint i {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
