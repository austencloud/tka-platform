<script module lang="ts">
  export type FuseSettingsDestination = "style" | "starting" | "pairing" | null;
</script>

<script lang="ts">
  import GenerationSettingsOverlay from "$lib/features/create/generate/components/cards/GenerationSettingsOverlay.svelte";
  import GenerationSettingsDrawer from "$lib/features/create/generate/components/modals/GenerationSettingsDrawer.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import SettingsDrillPanel, {
    type SettingsDrillItem,
  } from "$lib/shared/ui/components/settings-drill/SettingsDrillPanel.svelte";
  import FusePathRecipePanel from "./FusePathRecipePanel.svelte";
  import FuseRecipeBento from "./FuseRecipeBento.svelte";
  import FuseRelationshipComposer from "./FuseRelationshipComposer.svelte";

  let {
    isOpen = $bindable(false),
    destination = $bindable(null),
    desktopModal = false,
  }: {
    isOpen: boolean;
    destination?: FuseSettingsDestination;
    desktopModal?: boolean;
  } = $props();

  const drillItems: SettingsDrillItem[] = [
    { id: "style", label: "Style", value: "Path style" },
    {
      id: "starting",
      label: "Starting conditions",
      value: "Start point, orientation, and travel",
    },
    { id: "pairing", label: "Pairing", value: "How the paths interact" },
  ];

  function closeDrawer(): void {
    isOpen = false;
    destination = null;
  }

  function selectDestination(id: string | null): void {
    destination = id as FuseSettingsDestination;
  }
</script>

{#snippet settingsContent()}
  <GenerationSettingsOverlay
    title="Customize Fuse"
    titleId="fuse-settings-title"
    closeLabel="Close Fuse settings"
    onClose={closeDrawer}
  >
    {#snippet children()}
      <SettingsDrillPanel
        items={drillItems}
        bind:selected={destination}
        onSelect={selectDestination}
      >
        {#snippet listContent()}
          <FuseRecipeBento
            presentation={desktopModal ? "modal" : "drawer"}
            onOpen={selectDestination}
          />
        {/snippet}

        {#snippet detail(id)}
          {#if id === "style" || id === "starting"}
            <FusePathRecipePanel
              section={id}
              presentation={desktopModal ? "modal" : "drawer"}
            />
          {:else if id === "pairing"}
            <FuseRelationshipComposer
              presentation={desktopModal ? "modal" : "drawer"}
              onCancel={() => (destination = null)}
              onApply={closeDrawer}
            />
          {/if}
        {/snippet}
      </SettingsDrillPanel>
    {/snippet}
  </GenerationSettingsOverlay>
{/snippet}

{#if desktopModal}
  <BaseModal
    bind:open={isOpen}
    onclose={closeDrawer}
    size="xl"
    animation="pop"
    class="fuse-settings-modal"
    labelledBy="fuse-settings-title"
  >
    <div class="fuse-settings-modal-content customize-accent-scope">
      {@render settingsContent()}
    </div>
  </BaseModal>
{:else}
  <GenerationSettingsDrawer
    {isOpen}
    ariaLabel="Customize Fuse settings"
    onClose={closeDrawer}
  >
    {#snippet children()}
      {@render settingsContent()}
    {/snippet}
  </GenerationSettingsDrawer>
{/if}

<style>
  :global(dialog.fuse-settings-modal[data-size="xl"]) {
    width: min(88vw, 90rem);
    height: min(86dvh, 50rem);
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke-strong);
  }

  :global(dialog.fuse-settings-modal .modal-body) {
    overflow: hidden;
  }

  .fuse-settings-modal-content {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 1rem 1.125rem 1.125rem;
    background: var(--customize-surface-gradient);
  }

  .fuse-settings-modal-content > :global(.generation-settings-overlay) {
    position: static;
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  @container fuse (min-width: 2600px) and (min-height: 1400px) {
    :global(dialog.fuse-settings-modal[data-size="xl"]) {
      --font-size-min: 18px;
      --font-size-compact: 16px;
      --font-size-sm: 19px;
      --font-size-base: 20px;
      --font-size-lg: 24px;
      --min-touch-target: 64px;
      width: min(78vw, 112rem);
      height: min(72dvh, 53rem);
    }

    .fuse-settings-modal-content {
      padding: 1.25rem 1.5rem 1.5rem;
    }
  }
</style>
