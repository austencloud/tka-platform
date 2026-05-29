<!--
  Gallery Generator

  Main orchestrator component that coordinates all gallery generation functionality.
  Composes smaller components and manages the render/write workflow.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { onMount, onDestroy } from "svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { getBrowseLoader } from "$lib/shared/browse/getBrowseLoader";
  import { getSequenceRenderer } from "$lib/shared/render/get-sequence-renderer";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
  import type { SequenceRenderer } from "$lib/shared/render/services/sequence-renderer";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";

  import { galleryGeneratorState } from "../state/gallery-generator-state.svelte";
  import { GalleryRenderer } from "../services/gallery-renderer";
  import { writeToGallery } from "../services/gallery-writer";
  import { uploadGalleryImage } from "../services/cloud-gallery-uploader";
  import { galleryPersistence } from "../services/gallery-persistence";

  import GallerySettings from "./GallerySettings.svelte";
  import GalleryActions from "./GalleryActions.svelte";
  import GalleryStats from "./GalleryStats.svelte";
  import GalleryError from "./GalleryError.svelte";
  import PendingSequencesList from "./PendingSequencesList.svelte";
  import RenderedPreviewsGrid from "./RenderedPreviewsGrid.svelte";
  import FailedSequencesList from "./FailedSequencesList.svelte";

  const state = galleryGeneratorState;
  // Batch size optimized for Ryzen 9 7950X / 128GB RAM / RTX 4090
  const BATCH_SIZE = 50;

  onDestroy(() => {
    for (const img of state.renderedImages) {
      if (img.imageUrl) URL.revokeObjectURL(img.imageUrl);
    }
  });

  // Services (initialized on mount)
  let galleryRenderer: GalleryRenderer | null = null;

  onMount(async () => {
    // Set up persistence callbacks
    state.onImageAdded = (name, blob, written) => {
      galleryPersistence.store(name, blob, written).catch(console.error);
    };
    state.onImageWritten = (name) => {
      galleryPersistence.markWritten(name).catch(console.error);
    };
    state.onResultsCleared = () => {
      galleryPersistence.clear().catch(console.error);
    };

    try {
      // Load persisted images first (before sequences load)
      const persisted = await galleryPersistence.loadAll();
      if (persisted.images.length > 0) {
        state.restoreFromPersistence(persisted.images, persisted.blobs);
      }

      // Get services from ITI container
      const loaderService = getBrowseLoader();
      const renderService = getSequenceRenderer();

      galleryRenderer = new GalleryRenderer(
        renderService,
        loaderService,
        startPositionDeriver
      );

      const sequences = await loaderService.loadSequenceMetadata();
      state.setSequences(sequences);
    } catch (err) {
      state.setError(err instanceof Error ? err.message : t('gallery_gen_failed_to_load'));
      console.error("Gallery Generator init failed:", err);
    } finally {
      state.setLoading(false);
    }
  });

  /**
   * Render a single sequence
   */
  async function handleRenderSingle(sequence: SequenceData) {
    if (!galleryRenderer) return;

    const name = sequence.word || sequence.name;
    state.setRendering(true);
    state.addRenderingSequence(name);
    state.setError(null);

    try {
      const blob = await galleryRenderer.renderSequence(
        sequence,
        state.lightMode,
        state.selectedPropType ?? undefined
      );
      const imageUrl = URL.createObjectURL(blob);
      state.addRenderedImage({ name, imageUrl, written: false }, blob);
    } catch (err) {
      state.setError(err instanceof Error ? err.message : "Render failed");
      console.error("Render failed:", err);
    } finally {
      state.removeRenderingSequence(name);
      if (state.renderingSequences.length === 0) {
        state.setRendering(false);
      }
    }
  }

  /**
   * Render all pending sequences using a worker pool pattern.
   * Always keeps BATCH_SIZE renders running - as one finishes, the next starts immediately.
   */
  async function handleRenderAll() {
    if (!galleryRenderer || state.pendingSequences.length === 0) {
      state.setError(t('gallery_gen_all_rendered_clear'));
      return;
    }

    state.setRendering(true);
    state.setCancelled(false);
    state.setError(null);

    const queue = [...state.pendingSequences];
    let activeCount = 0;
    let resolveAll: () => void;
    const allDone = new Promise<void>((r) => (resolveAll = r));

    async function processNext() {
      if (state.isCancelled || queue.length === 0) {
        activeCount--;
        if (activeCount === 0) resolveAll();
        return;
      }

      const sequence = queue.shift()!;
      const name = sequence.word || sequence.name;
      state.addRenderingSequence(name);

      try {
        const blob = await galleryRenderer!.renderSequence(
          sequence,
          state.lightMode,
          state.selectedPropType ?? undefined
        );
        const imageUrl = URL.createObjectURL(blob);
        state.removeRenderingSequence(name);
        state.addRenderedImage({ name, imageUrl, written: false }, blob);
      } catch (err) {
        state.removeRenderingSequence(name);
        state.addFailedSequence({
          name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }

      // Immediately start next one
      processNext();
    }

    try {
      // Start initial pool of workers
      const initialCount = Math.min(BATCH_SIZE, queue.length);
      activeCount = initialCount;
      for (let i = 0; i < initialCount; i++) {
        processNext();
      }

      // Wait for all to complete
      await allDone;
    } catch (err) {
      state.setError(err instanceof Error ? err.message : "Render failed");
      state.clearRenderingSequences();
    } finally {
      state.setRendering(false);
      state.clearRenderingSequences();
    }
  }

  /**
   * Write all previewed images to gallery
   */
  async function handleWriteAll() {
    const toWrite = state.renderedImages.filter((r) => !r.written);
    if (toWrite.length === 0) return;

    state.setRendering(true);
    state.setError(null);

    for (const img of toWrite) {
      const blob = state.getBlob(img.name);
      if (!blob) {
        console.warn(`No blob found for ${img.name}`);
        continue;
      }

      try {
        await writeToGallery(
          img.name,
          blob,
          state.selectedPropType ?? undefined,
          state.lightMode
        );
        state.markAsWritten(img.name);
      } catch (err) {
        console.error(`Failed to write ${img.name}:`, err);
        state.addFailedSequence({
          name: img.name,
          error: err instanceof Error ? err.message : "Write failed",
        });
      }
    }

    state.setRendering(false);
  }

  /**
   * Upload all rendered images to Firebase Storage (cloud cache)
   */
  async function handleUploadToCloud() {
    if (!state.selectedPropType) {
      state.setError(t('gallery_gen_select_prop_first'));
      return;
    }

    const toUpload = state.renderedImages;
    if (toUpload.length === 0) {
      state.setError(t('gallery_gen_no_images_to_upload'));
      return;
    }

    state.setRendering(true);
    state.setError(null);

    let successCount = 0;
    let failCount = 0;

    for (const img of toUpload) {
      const blob = state.getBlob(img.name);
      if (!blob) {
        console.warn(`No blob found for ${img.name}`);
        failCount++;
        continue;
      }

      try {
        await uploadGalleryImage(
          img.name,
          blob,
          state.selectedPropType,
          state.lightMode
        );
        successCount++;
      } catch (err) {
        console.error(`Failed to upload ${img.name}:`, err);
        failCount++;
        state.addFailedSequence({
          name: img.name,
          error: err instanceof Error ? err.message : "Cloud upload failed",
        });
      }
    }

    state.setRendering(false);
  }

  /**
   * Cancel current render operation
   */
  function handleCancel() {
    state.setCancelled(true);
  }

  /**
   * Clear all results
   */
  function handleClear() {
    state.clearResults();
  }
</script>

<div class="generator-page">
  <header class="page-header">
    <h1>{t('gallery_gen_title')}</h1>
    <p class="subtitle">
      {t('gallery_gen_subtitle')}
    </p>
  </header>

  <GallerySettings />

  <GalleryActions
    onRenderAll={handleRenderAll}
    onWriteAll={handleWriteAll}
    onUploadToCloud={handleUploadToCloud}
    onClear={handleClear}
    onCancel={handleCancel}
  />

  <GalleryStats />
  <GalleryError />

  <div class="two-column-layout">
    <PendingSequencesList onRenderSingle={handleRenderSingle} />
    <RenderedPreviewsGrid />
  </div>

  <FailedSequencesList />
</div>

<style>
  .generator-page {
    max-width: 1600px;
    margin: 0 auto;
    padding: 1.5rem;
    color: #e4e4e7;
    background: #0c0c10;
    min-height: 100vh;
  }

  .page-header {
    margin-bottom: 1.5rem;
  }

  .page-header h1 {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #fff;
  }

  .subtitle {
    color: #71717a;
    margin: 0;
    font-size: 0.875rem;
  }

  .two-column-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1rem;
  }

  @media (max-width: 900px) {
    .two-column-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
