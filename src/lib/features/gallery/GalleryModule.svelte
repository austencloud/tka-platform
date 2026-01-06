<script lang="ts">
  /**
   * GalleryModule
   *
   * Main entry point for the 3D virtual gallery experience.
   * Walk through a museum displaying your sequences as art.
   */

  import { onMount, onDestroy } from "svelte";
  import { resolve } from "$lib/shared/inversify/di";
  import {
    loadFeatureModule,
    resolveAsync,
  } from "$lib/shared/inversify/container";
  import { GALLERY_TYPES } from "./inversify/gallery.types";
  import { ANIMATION_3D_TYPES } from "$lib/shared/3d-animation/inversify/animation-3d.types";
  import type { IGalleryLayoutGenerator } from "./services/contracts/IGalleryLayoutGenerator";
  import type { IExhibitLoader } from "./services/contracts/IExhibitLoader";
  import type { IPropStateInterpolator } from "$lib/shared/3d-animation/services/contracts/IPropStateInterpolator";
  import type { ISequenceConverter } from "$lib/shared/3d-animation/services/contracts/ISequenceConverter";
  import { createGalleryState } from "./state/gallery-state.svelte";
  import GalleryScene from "./components/GalleryScene.svelte";
  import GalleryHUD from "./components/GalleryHUD.svelte";

  // Create gallery state
  const galleryState = createGalleryState();

  // Track pointer lock for HUD
  let isNavigating = $state(false);

  // 3D avatar services (loaded async)
  let avatarServiceDeps = $state<{
    propInterpolator: IPropStateInterpolator;
    sequenceConverter: ISequenceConverter;
  } | null>(null);

  // Initialize gallery on mount
  onMount(async () => {
    galleryState.setLoading(true);

    try {
      // Load 3D viewer module for avatar services
      await loadFeatureModule("3d-viewer");
      const propInterpolator = await resolveAsync<IPropStateInterpolator>(
        ANIMATION_3D_TYPES.IPropStateInterpolator
      );
      const sequenceConverter = await resolveAsync<ISequenceConverter>(
        ANIMATION_3D_TYPES.ISequenceConverter
      );
      avatarServiceDeps = { propInterpolator, sequenceConverter };

      // Resolve gallery services
      const layoutGenerator = resolve<IGalleryLayoutGenerator>(
        GALLERY_TYPES.IGalleryLayoutGenerator
      );
      const exhibitLoader = resolve<IExhibitLoader>(GALLERY_TYPES.IExhibitLoader);

      // Generate layout (start with a reasonable exhibit count)
      const layout = layoutGenerator.generate({
        exhibitCount: 10, // Will be limited by actual sequence count
        layoutType: "hallway",
      });
      galleryState.setLayout(layout);

      // Load exhibits from user's library
      const exhibits = await exhibitLoader.loadExhibits(layout, {
        source: "user_library",
        limit: 20,
      });
      galleryState.setExhibits(exhibits);

      galleryState.setLoading(false);
    } catch (error) {
      console.error("[GalleryModule] Failed to initialize:", error);
      galleryState.setError(
        error instanceof Error ? error.message : "Failed to load gallery"
      );
      galleryState.setLoading(false);
    }
  });

  // Track pointer lock state
  function handlePointerLockChange() {
    isNavigating = document.pointerLockElement !== null;
  }

  onMount(() => {
    document.addEventListener("pointerlockchange", handlePointerLockChange);
  });

  onDestroy(() => {
    document.removeEventListener("pointerlockchange", handlePointerLockChange);
    galleryState.reset();
  });
</script>

<div class="gallery-module">
  <GalleryScene state={galleryState} {avatarServiceDeps} />
  <GalleryHUD state={galleryState} {isNavigating} />
</div>

<style>
  .gallery-module {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
  }
</style>
