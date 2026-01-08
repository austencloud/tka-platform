<script lang="ts">
  /**
   * RealmModule - Unified 3D Destination Hub
   *
   * Visual destination picker for all 3D experiences (Stage, Gallery, Worlds, etc.).
   * Shows grid of cards with live 3D previews.
   * ESC returns to picker from any destination.
   *
   * Replaces the old tab-based navigation with a scalable destination system.
   */

  import { destinationManager } from "$lib/shared/3d-core/destinations/destination-manager.svelte";
  import DestinationPicker from "./components/DestinationPicker.svelte";
  import DestinationRenderer from "./components/DestinationRenderer.svelte";

  // Current destination state
  const currentDestinationId = $derived(destinationManager.currentDestinationId);
  const isPickerActive = $derived(destinationManager.isPickerActive());

  function handleDestinationSelect(destinationId: string) {
    destinationManager.navigateTo(destinationId);
  }

  function handleReturn() {
    destinationManager.returnToPicker();
  }
</script>

<div class="realm-module">
  {#if isPickerActive}
    <!-- Show destination picker -->
    <DestinationPicker onSelect={handleDestinationSelect} />
  {:else if currentDestinationId}
    <!-- Show active destination -->
    <DestinationRenderer
      destinationId={currentDestinationId}
      onReturn={handleReturn}
    />
  {/if}
</div>

<style>
  .realm-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, #12121c);
  }
</style>
