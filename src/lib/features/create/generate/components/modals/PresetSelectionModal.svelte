<!--
PresetSelectionModal.svelte - Modal for selecting saved generation presets
Displays user-saved presets with delete option and allows loading preset configuration
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import type { GenerationPreset } from "../../state/preset.svelte";
  import ModalHeader from "./ModalHeader.svelte";
  import { portal } from "./portal";
  import PresetGrid from "./PresetGrid.svelte";

  let { presets, onPresetSelect, onPresetDelete, onPresetEdit, onClose } =
    $props<{
      presets: GenerationPreset[];
      onPresetSelect: (preset: GenerationPreset) => void;
      onPresetDelete: (presetId: string) => void;
      onPresetEdit: (preset: GenerationPreset) => void;
      onClose: () => void;
    }>();

  let hapticService: IHapticFeedback;
  let modalElement: HTMLElement;

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
    <ModalHeader title="Load Preset" icon="⚙️" onClose={handleClose} />
    <PresetGrid {presets} {onPresetSelect} {onPresetEdit} {onPresetDelete} />
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
    animation: backdrop-appear var(--duration-emphasis) ease-out;
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
    max-width: min(900px, 92vw);
    width: 100%;
    max-height: var(--modal-max-height, min(90dvh, calc(100dvh - 30px)));
    max-height: var(--modal-max-height, min(90vh, calc(100vh - 30px)));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modal-appear var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    margin: auto;
    flex-shrink: 0;
    box-sizing: border-box;
    padding-top: env(safe-area-inset-top, 0);
    padding-bottom: env(safe-area-inset-bottom, 0);
    padding-left: env(safe-area-inset-left, 0);
    padding-right: env(safe-area-inset-right, 0);
    box-shadow:
      0 20px 60px var(--theme-shadow, var(--theme-shadow)),
      0 0 0 1px var(--theme-stroke) inset;
  }

  /* Optimize for narrow devices (foldable phones, etc.) */
  @media (max-width: 380px) {
    .modal-backdrop {
      padding: 12px;
    }

    .modal-content {
      max-width: 96vw;
      border-radius: 12px;
    }
  }

  @keyframes modal-appear {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
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
  }
</style>
