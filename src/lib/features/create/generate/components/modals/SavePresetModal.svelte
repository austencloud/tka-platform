<!--
SavePresetModal.svelte - Premium modal for saving current settings as a preset
Provides a beautiful, unified experience for creating new presets
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import IconGrid from "./IconGrid.svelte";
  import ModalActions from "./ModalActions.svelte";
  import ModalHeader from "./ModalHeader.svelte";
  import { portal } from "./portal";

  let { onSave, onClose } = $props<{
    onSave: (icon?: string) => void;
    onClose: () => void;
  }>();

  let hapticService: IHapticFeedback;
  let modalElement: HTMLElement;

  let selectedIcon = $state("⚙️");

  onMount(() => {
    // Service resolution
    hapticService = container.items.hapticFeedback;

    // Focus the modal for accessibility
    modalElement?.focus();

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  });

  function handleSave() {
    hapticService?.trigger("selection");
    onSave(selectedIcon);
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      hapticService?.trigger("selection");
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      hapticService?.trigger("selection");
      onClose();
    } else if (event.key === "Enter") {
      handleSave();
    }
  }

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }
</script>

<div
  class="modal-backdrop"
  use:portal
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
  bind:this={modalElement}
  tabindex="-1"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div class="modal-content">
    <ModalHeader title="Save Preset" icon="💾" onClose={handleClose} />

    <div class="modal-body">
      <div class="info-banner">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>Preset name will be auto-generated from your settings</span>
      </div>

      <IconGrid bind:selectedIcon />
    </div>

    <ModalActions
      onCancel={handleClose}
      onConfirm={handleSave}
      cancelLabel="Cancel"
      confirmLabel="Save Preset"
      confirmVariant="success"
    />
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    height: var(--actual-vh, 100vh);
    background: color-mix(in srgb, var(--theme-panel-bg) 85%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    padding: max(16px, env(safe-area-inset-top, 16px))
      max(16px, env(safe-area-inset-right, 16px))
      max(16px, env(safe-area-inset-bottom, 16px))
      max(16px, env(safe-area-inset-left, 16px));
    animation: backdrop-appear 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes backdrop-appear {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    background: linear-gradient(
      135deg,
      var(--theme-stroke) 0%,
      var(--theme-card-bg, var(--theme-card-bg)) 100%
    );
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 16px;
    max-width: min(460px, 90vw);
    width: 100%;
    max-height: var(--modal-max-height, min(85dvh, calc(100dvh - 60px)));
    max-height: var(--modal-max-height, min(85vh, calc(100vh - 60px)));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modal-appear 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    margin: auto;
    flex-shrink: 0;
    box-sizing: border-box;
    box-shadow:
      0 20px 60px var(--theme-shadow, var(--theme-shadow)),
      0 0 0 1px var(--theme-stroke) inset;
  }

  @keyframes modal-appear {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .modal-body::-webkit-scrollbar {
    width: 8px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
    border-radius: 4px;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  .modal-body::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  .info-banner {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: linear-gradient(
      135deg,
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 15%,
        transparent
      ),
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 10%,
        transparent
      )
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 30%,
        transparent
      );
    border-radius: 12px;
    color: color-mix(
      in srgb,
      var(--semantic-info, var(--semantic-info)) 100%,
      #93c5fd
    );
    font-size: var(--font-size-sm);
    line-height: 1.5;
    box-shadow: 0 0 0 1px
      color-mix(
        in srgb,
        var(--semantic-info, var(--semantic-info)) 10%,
        transparent
      )
      inset;
  }

  .info-banner svg {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    filter: drop-shadow(
      0 2px 4px
        color-mix(
          in srgb,
          var(--semantic-info, var(--semantic-info)) 30%,
          transparent
        )
    );
  }

  @media (max-width: 640px) {
    .modal-content {
      max-width: 95vw;
      border-radius: 14px;
    }

    .modal-body {
      padding: 20px;
      gap: 20px;
    }

    .info-banner {
      padding: 12px 14px;
      font-size: var(--font-size-compact);
    }

    .info-banner svg {
      width: 20px;
      height: 20px;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop {
      animation: none;
    }
    .modal-content {
      animation: none;
    }
    /* Disable local keyframe animations */
    [style*="backdrop-appear"] {
      animation: none;
    }
    [style*="modal-appear"] {
      animation: none;
    }
  }
</style>
