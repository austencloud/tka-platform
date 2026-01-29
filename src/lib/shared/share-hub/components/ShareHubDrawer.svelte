<!--
  ShareHubDrawer.svelte

  Drawer wrapper for ShareHubPanel with animation coordination.
  Handles the drawer/sheet behavior and passes animation state to the panel.
-->
<script lang="ts">
  import ShareHubPanel from "./ShareHubPanel.svelte";
  import AnimationExportView from "./single-media/AnimationExportView.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { ExportSettings } from "../domain/models/ExportSettings";

  interface Props {
    isOpen: boolean;
    sequence?: SequenceData | null;
    isMobile?: boolean;
    onClose: () => void;
    onExport: (mode: "single" | "composite", settings?: ExportSettings) => void;
    selectedFormat?: "animation" | "static" | "performance";
  }

  let {
    isOpen,
    sequence,
    isMobile = false,
    onClose,
    onExport,
    selectedFormat = "animation",
  }: Props = $props();
</script>

{#if isOpen}
  <div
    class="share-hub-drawer-backdrop"
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div
      class="share-hub-drawer-content"
      onclick={(e) => e.stopPropagation()}
      role="document"
    >
      {#if selectedFormat === "animation"}
        <AnimationExportView />
      {:else}
        <ShareHubPanel
          {sequence}
          {isMobile}
          {onExport}
        />
      {/if}
    </div>
  </div>
{/if}

<style>
  .share-hub-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .share-hub-drawer-content {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: 12px;
    max-width: 90vw;
    max-height: 90vh;
    width: 800px;
    height: 600px;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  @media (max-width: 768px) {
    .share-hub-drawer-content {
      max-width: 100vw;
      max-height: 100vh;
      width: 100%;
      height: 100%;
      border-radius: 0;
    }
  }
</style>
