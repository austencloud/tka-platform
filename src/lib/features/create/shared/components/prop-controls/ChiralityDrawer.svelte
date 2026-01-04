<!--
  ChiralityDrawer.svelte - Minimal bottom sheet for Buugeng chirality toggle

  Shows when a Buugeng family prop is tapped, allowing the user to flip
  the prop's chirality (mirror image).
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { IChiralityToggler } from "../../services/contracts/IChiralityToggler";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { PropHand } from "../../state/selected-prop-state.svelte";
  import { onMount } from "svelte";

  let {
    isOpen = $bindable(false),
    hand = null,
    onClose,
  } = $props<{
    isOpen?: boolean;
    hand: PropHand | null;
    onClose?: () => void;
  }>();

  let chiralityToggler: IChiralityToggler;
  let hapticService: IHapticFeedback;

  onMount(() => {
    chiralityToggler = resolve<IChiralityToggler>(TYPES.IChiralityToggler);
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Get current flip state
  const isFlipped = $derived.by(() => {
    if (!hand || !chiralityToggler) return false;
    return chiralityToggler.isFlipped(hand);
  });

  function handleFlipClick() {
    if (!hand) return;

    hapticService?.trigger("selection");
    chiralityToggler.toggleChirality(hand);
  }

  function handleClose() {
    isOpen = false;
    onClose?.();
  }
</script>

<Drawer
  bind:isOpen
  placement="bottom"
  class="chirality-drawer"
  respectLayoutMode={true}
  showHandle={true}
  onclose={handleClose}
  ariaLabel="Flip prop orientation"
>
  <div class="chirality-content">
    <div class="drawer-header">
      <span class="hand-indicator {hand}">{hand === 'blue' ? 'Blue' : 'Red'} Prop</span>
      <h3 class="drawer-title">Buugeng Orientation</h3>
    </div>

    <button
      class="flip-button"
      class:flipped={isFlipped}
      onclick={handleFlipClick}
    >
      <svg
        class="flip-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        <path d="M7 12h10" />
        <path d="M12 7l-5 5 5 5" />
      </svg>
      <span class="flip-label">Flip Chirality</span>
      <span class="flip-status">{isFlipped ? 'Mirrored' : 'Normal'}</span>
    </button>

    <p class="help-text">
      Tap to mirror the prop's orientation
    </p>
  </div>
</Drawer>

<style>
  :global(.chirality-drawer) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
    max-height: 200px;
  }

  .chirality-content {
    padding: 16px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .drawer-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .hand-indicator {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .hand-indicator.blue {
    color: var(--prop-blue, #3b82f6);
    background: rgba(59, 130, 246, 0.15);
  }

  .hand-indicator.red {
    color: var(--prop-red, #ef4444);
    background: rgba(239, 68, 68, 0.15);
  }

  .drawer-title {
    margin: 0;
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .flip-button {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text, white);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      transform 0.1s ease;
  }

  .flip-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .flip-button:active {
    transform: scale(0.98);
  }

  .flip-button.flipped {
    border-color: var(--semantic-warning, #fbbf24);
    background: rgba(251, 191, 36, 0.1);
  }

  .flip-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    transition: transform 0.3s ease;
  }

  .flip-button.flipped .flip-icon {
    transform: scaleX(-1);
  }

  .flip-label {
    flex: 1;
    font-size: var(--font-size-md, 16px);
    font-weight: 500;
    text-align: left;
  }

  .flip-status {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    padding: 2px 8px;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.3));
    border-radius: 4px;
  }

  .help-text {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-align: center;
  }
</style>
