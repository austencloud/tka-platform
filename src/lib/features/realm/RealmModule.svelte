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

  import { onMount } from "svelte";
  import { destinationManager } from "$lib/shared/3d/destinations/destination-manager.svelte";
  import { DESTINATIONS } from "$lib/shared/3d/destinations/definitions";
  import DestinationPicker from "./components/picker/DestinationPicker.svelte";
  import DestinationRenderer from "./components/picker/DestinationRenderer.svelte";

  // Current destination state
  const currentDestinationId = $derived(destinationManager.currentDestinationId);
  const isPickerActive = $derived(destinationManager.isPickerActive());

  // Get enabled destinations
  const enabledDestinations = $derived(
    DESTINATIONS.filter((d) => d.enabled !== false)
  );

  // If only one destination is enabled, skip the picker and go straight to it
  onMount(() => {
    if (enabledDestinations.length === 1 && isPickerActive) {
      const destination = enabledDestinations[0];
      if (destination) {
        destinationManager.navigateTo(destination.id);
      }
    }
  });

  function handleDestinationSelect(destinationId: string) {
    destinationManager.navigateTo(destinationId);
  }

  function handleReturn() {
    // If only one destination is enabled, don't return to picker (nowhere else to go)
    if (enabledDestinations.length === 1) {
      return;
    }
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
