<!--
  MobileSequenceDetailSheet.svelte

  2026 immersive mobile experience for sequence details.

  Design:
  - Full-bleed media viewer takes most of screen
  - Bottom sheet slides up with info, swipe to expand
  - Floating action cluster (Save) over media
  - Spring-animated sheet transitions
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
    import { onMount } from "svelte";
  import SequenceViewer from "$lib/shared/sequence-viewer/components/SequenceViewer.svelte";
  import MobileDetailSheet from "./MobileDetailSheet.svelte";
  import FloatingActionCluster from "./FloatingActionCluster.svelte";

  const {
    sequence,
    onClose = () => {},
    onAction = () => {},
  }: {
    sequence: SequenceData;
    onClose?: () => void;
    onAction?: (action: string, sequence: SequenceData) => void;
  } = $props();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Sheet state: 'peek' (shows just word), 'expanded' (shows all info)
  let sheetState = $state<"peek" | "expanded">("peek");

  function handleAction(action: string) {
    hapticService?.trigger("selection");
    onAction(action, sequence);
  }

  function handleSheetStateChange(state: "peek" | "expanded") {
    sheetState = state;
    hapticService?.trigger("selection");
  }
</script>

<div class="mobile-detail">
  <!-- Full-bleed media viewer -->
  <div class="media-fullbleed">
    <SequenceViewer
      {sequence}
      initialMediaType="image"
      controlsLevel="standard"
      showVisibilitySettings={true}
    />
  </div>

  <!-- Gradient fade at bottom for readability -->
  <div class="bottom-gradient"></div>

  <!-- Floating action cluster (Save, etc.) -->
  <FloatingActionCluster
    {sequence}
    onFavorite={() => handleAction("favorite")}
    onShare={() => handleAction("share")}
    visible={sheetState === "peek"}
  />

  <!-- Close button (top right) -->
  <button class="close-btn" onclick={onClose} aria-label="Close">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </button>

  <!-- Bottom sheet with swipe-up for more -->
  <MobileDetailSheet
    {sequence}
    {sheetState}
    onStateChange={handleSheetStateChange}
    onAction={handleAction}
  />
</div>

<style>
  .mobile-detail {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg, #000);
    overflow: hidden;
    touch-action: none;
  }

  /* Full-bleed media */
  .media-fullbleed {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Bottom gradient for text readability */
  .bottom-gradient {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.9) 0%,
      rgba(0, 0, 0, 0.5) 40%,
      transparent 100%
    );
    pointer-events: none;
  }

  /* Close button */
  .close-btn {
    position: absolute;
    top: max(env(safe-area-inset-top, 12px), 12px);
    right: 12px;
    z-index: 100;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--theme-stroke);
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .close-btn svg {
    width: 20px;
    height: 20px;
    color: white;
  }

  .close-btn:hover {
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .close-btn:active {
    transform: scale(0.92);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .close-btn:active {
      transform: none;
    }
  }
</style>
