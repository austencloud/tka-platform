<script lang="ts">
  /**
   * Test page for 3D Gallery with mansion layout.
   * Bypasses the navigation system to directly mount the GalleryModule.
   */
  import { onMount } from "svelte";
  import { loadFeatureModule } from "$lib/shared/inversify/di";

  let GalleryModule: any = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      // Load required DI modules
      await loadFeatureModule("realm");

      // Import the gallery module
      const module = await import("$lib/features/gallery/GalleryModule.svelte");
      GalleryModule = module.default;
      loading = false;
    } catch (err) {
      console.error("Failed to load gallery:", err);
      error = err instanceof Error ? err.message : "Failed to load";
      loading = false;
    }
  });
</script>

<div class="gallery-test">
  {#if loading}
    <div class="loading">
      <p>Loading 3D Gallery...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
    </div>
  {:else if GalleryModule}
    <svelte:component this={GalleryModule} />
  {/if}
</div>

<style>
  .gallery-test {
    position: fixed;
    inset: 0;
    background: #000;
  }

  .loading, .error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: white;
  }

  .error {
    color: #ef4444;
  }
</style>
