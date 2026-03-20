<!--
  SettingsModalLayout.svelte - Responsive settings shell

  Desktop (>=768px): BaseModal with side-by-side preview + controls layout
  Mobile (<768px): Full-height bottom Drawer with stacked preview + controls

  Used by: PictographSettingsModal, CardSettingsModal
  NOT used by: AnimationSettingsModal (has its own complex layout)
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount, onDestroy } from "svelte";
  import BaseModal from "../modal/BaseModal.svelte";
  import Drawer from "../Drawer.svelte";

  interface Props {
    title: string;
    icon: string;
    open: boolean;
    onclose?: () => void;
    preview: Snippet;
    controls: Snippet;
  }

  let { title, icon, open = $bindable(), onclose, preview, controls }: Props = $props();

  let isMobile = $state(false);
  let mediaQuery: MediaQueryList | null = null;

  function handleMediaChange(e: MediaQueryListEvent | MediaQueryList) {
    isMobile = !e.matches;
  }

  onMount(() => {
    mediaQuery = window.matchMedia("(min-width: 768px)");
    handleMediaChange(mediaQuery);
    mediaQuery.addEventListener("change", handleMediaChange);
  });

  onDestroy(() => {
    mediaQuery?.removeEventListener("change", handleMediaChange);
  });

  function handleClose() {
    open = false;
    onclose?.();
  }

  // Drawer.svelte emits CustomEvent<{ reason }> — we only need to trigger handleClose
  function handleDrawerClose(_event: CustomEvent<{ reason: string }>) {
    handleClose();
  }
</script>

{#if isMobile}
  <Drawer
    isOpen={open}
    placement="bottom"
    showHandle={true}
    onclose={handleDrawerClose}
    ariaLabel={title}
    class="settings-modal-drawer"
  >
    <div class="settings-layout-mobile">
      <div class="settings-header">
        <i class="fas {icon}" aria-hidden="true"></i>
        <h2>{title}</h2>
      </div>
      <div class="settings-preview-mobile">
        {@render preview()}
      </div>
      <div class="settings-controls-mobile themed-scrollbar">
        {@render controls()}
      </div>
    </div>
  </Drawer>
{:else}
  <BaseModal {open} onclose={handleClose} size="lg" animation="pop">
    {#snippet header()}
      <div class="settings-header">
        <i class="fas {icon}" aria-hidden="true"></i>
        <h2>{title}</h2>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="settings-layout-desktop">
        <div class="settings-preview-desktop">
          {@render preview()}
        </div>
        <div class="settings-controls-desktop themed-scrollbar">
          {@render controls()}
        </div>
      </div>
    {/snippet}
  </BaseModal>
{/if}

<style>
  .settings-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
  }

  .settings-header h2 {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    margin: 0;
    color: var(--theme-text, #ffffff);
  }

  .settings-header i {
    color: var(--theme-accent, #3b82f6);
    font-size: var(--font-size-lg, 18px);
  }

  .settings-layout-desktop {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    padding: 1rem;
    min-height: 400px;
  }

  .settings-preview-desktop {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-lg, 12px);
    padding: 1rem;
  }

  .settings-controls-desktop {
    overflow-y: auto;
    max-height: 60vh;
    padding-right: 0.5rem;
  }

  .settings-layout-mobile {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .settings-preview-mobile {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    flex: 0 0 40%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .settings-controls-mobile {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  :global(.settings-modal-drawer) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
    height: 85vh;
  }
</style>
