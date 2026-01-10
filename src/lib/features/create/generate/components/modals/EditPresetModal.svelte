<!--
EditPresetModal.svelte - Premium modal for editing preset name and icon
Provides a beautiful, unified experience for customizing presets
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import type { GenerationPreset } from "../../state/preset.svelte";
  import IconGrid from "./IconGrid.svelte";
  import ModalActions from "./ModalActions.svelte";
  import ModalHeader from "./ModalHeader.svelte";
  import { portal } from "./portal";

  let { preset, onSave, onClose } = $props<{
    preset: GenerationPreset;
    onSave: (name: string, icon?: string) => void;
    onClose: () => void;
  }>();

  let hapticService: IHapticFeedback;
  let nameInput: HTMLInputElement;

  let presetName = $state("");
  let selectedIcon = $state("⚙️");

  // Sync from preset prop
  $effect(() => {
    presetName = preset.name;
    selectedIcon = preset.icon || "⚙️";
  });

  onMount(() => {
    hapticService = container.items.hapticFeedback;

    // Focus the name input
    nameInput?.focus();
    nameInput?.select(); // Select all text for easy editing

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  });

  function handleSave() {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      return;
    }

    hapticService?.trigger("selection");
    onSave(trimmedName, selectedIcon);
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
    } else if (event.key === "Enter" && presetName.trim()) {
      handleSave();
    }
  }

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }

  const canSave = $derived(
    presetName.trim().length > 0 &&
      (presetName !== preset.name || selectedIcon !== preset.icon)
  );
</script>

<div
  class="modal-backdrop"
  use:portal
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
  tabindex="-1"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div class="modal-content">
    <ModalHeader title="Edit Preset" icon="✏️" onClose={handleClose} />

    <div class="modal-body">
      <div class="form-section">
        <label for="preset-name" class="form-label">Preset Name</label>
        <input
          id="preset-name"
          type="text"
          class="name-input"
          bind:value={presetName}
          bind:this={nameInput}
          placeholder="e.g., Diamond 16, My Practice Flow"
          maxlength="50"
        />
      </div>

      <IconGrid bind:selectedIcon label="Icon" />
    </div>

    <ModalActions
      onCancel={handleClose}
      onConfirm={handleSave}
      cancelLabel="Cancel"
      confirmLabel="Save Changes"
      confirmDisabled={!canSave}
      confirmVariant="primary"
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
    gap: 20px;
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

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .form-label {
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .name-input {
    width: 100%;
    padding: 12px 16px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-shadow) 40%, transparent),
      color-mix(in srgb, var(--theme-shadow) 30%, transparent)
    );
    border: 2px solid var(--theme-stroke-strong);
    border-radius: 10px;
    color: var(--theme-text, white);
    font-size: var(--font-size-sm);
    font-family: inherit;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px var(--theme-shadow) inset;
  }

  .name-input:focus {
    outline: none;
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--semantic-info)) 60%,
      transparent
    );
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-shadow) 50%, transparent),
      color-mix(in srgb, var(--theme-shadow) 40%, transparent)
    );
    box-shadow:
      0 0 0 3px
        color-mix(
          in srgb,
          var(--theme-accent, var(--semantic-info)) 20%,
          transparent
        ),
      0 2px 8px var(--theme-shadow, var(--theme-shadow)) inset;
  }

  .name-input::placeholder {
    color: var(--theme-text-dim);
  }

  @media (max-width: 640px) {
    .modal-content {
      max-width: 95vw;
      border-radius: 14px;
    }

    .modal-body {
      padding: 20px;
      gap: 16px;
    }

    .name-input {
      padding: 11px 14px;
      font-size: var(--font-size-sm);
    }
  }
</style>
