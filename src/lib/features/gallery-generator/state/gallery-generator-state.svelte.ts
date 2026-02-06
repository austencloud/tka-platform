/**
 * Gallery Generator State
 *
 * Centralized state management for the gallery generator feature.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { RenderedImage, FailedSequence } from "../domain/gallery-models";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

/** Core prop types for gallery generation (excludes "big" variants) */
export const CORE_PROP_TYPES = [
  PropType.STAFF,
  PropType.CLUB,
  PropType.FAN,
  PropType.TRIAD,
  PropType.MINIHOOP,
  PropType.BUUGENG,
  PropType.HAND,
  PropType.TRIQUETRA,
  PropType.SWORD,
  PropType.DOUBLESTAR,
] as const;

class GalleryGeneratorState {
  // Core data
  sequences = $state<SequenceData[]>([]);
  renderedImages = $state<RenderedImage[]>([]);
  failedSequences = $state<FailedSequence[]>([]);

  // UI state
  isLoading = $state(true);
  isRendering = $state(false);
  isCancelled = $state(false);
  error = $state<string | null>(null);
  lightMode = $state(false);
  viewingImage = $state<{ name: string; url: string } | null>(null);
  /** Names of sequences currently being rendered (for progress tracking) */
  renderingSequences = $state<string[]>([]);
  /** Selected prop type for rendering (null = default/no override) */
  selectedPropType = $state<PropType | null>(null);

  // Blob storage (in-memory, backed by IndexedDB for persistence)
  pendingBlobs = new Map<string, Blob>();

  // Callback for persistence (set by component)
  onImageAdded?: (name: string, blob: Blob, written: boolean) => void;
  onImageWritten?: (name: string) => void;
  onResultsCleared?: () => void;

  // Derived state
  get renderedNames(): Set<string> {
    return new Set(this.renderedImages.map((r) => r.name));
  }

  get pendingSequences(): SequenceData[] {
    return this.sequences.filter(
      (s) => !this.renderedNames.has(s.word || s.name)
    );
  }

  get previewCount(): number {
    return this.renderedImages.filter((r) => !r.written).length;
  }

  get hasResults(): boolean {
    return this.renderedImages.length > 0 || this.failedSequences.length > 0;
  }

  // Actions
  setSequences(sequences: SequenceData[]) {
    this.sequences = sequences;
  }

  setLoading(loading: boolean) {
    this.isLoading = loading;
  }

  setRendering(rendering: boolean) {
    this.isRendering = rendering;
  }

  setCancelled(cancelled: boolean) {
    this.isCancelled = cancelled;
  }

  setError(error: string | null) {
    this.error = error;
  }

  setLightMode(light: boolean) {
    if (this.lightMode !== light) {
      // Clear rendered images when mode changes - they're no longer valid
      this.clearResults();
      this.lightMode = light;
    }
  }

  setPropType(propType: PropType | null) {
    if (this.selectedPropType !== propType) {
      // Clear rendered images when prop type changes - they're no longer valid
      this.clearResults();
      this.selectedPropType = propType;
    }
  }

  /** Get the output folder path based on selected prop type */
  get outputFolder(): string {
    if (this.selectedPropType) {
      return `static/gallery/${this.selectedPropType}/`;
    }
    return "static/gallery/{word}/";
  }

  setViewingImage(image: { name: string; url: string } | null) {
    this.viewingImage = image;
  }

  addRenderingSequence(name: string) {
    if (!this.renderingSequences.includes(name)) {
      this.renderingSequences = [...this.renderingSequences, name];
    }
  }

  removeRenderingSequence(name: string) {
    this.renderingSequences = this.renderingSequences.filter((n) => n !== name);
  }

  clearRenderingSequences() {
    this.renderingSequences = [];
  }

  isSequenceRendering(name: string): boolean {
    return this.renderingSequences.includes(name);
  }

  addRenderedImage(image: RenderedImage, blob: Blob) {
    this.pendingBlobs.set(image.name, blob);
    this.renderedImages = [...this.renderedImages, image];
    // Persist to IndexedDB
    this.onImageAdded?.(image.name, blob, image.written);
  }

  /**
   * Restore state from IndexedDB persistence
   */
  restoreFromPersistence(images: RenderedImage[], blobs: Map<string, Blob>) {
    this.renderedImages = images;
    this.pendingBlobs = blobs;
  }

  markAsWritten(name: string) {
    const idx = this.renderedImages.findIndex((r) => r.name === name);
    const existing = this.renderedImages[idx];
    if (idx >= 0 && existing) {
      this.renderedImages[idx] = {
        name: existing.name,
        imageUrl: existing.imageUrl,
        written: true,
      };
      this.renderedImages = [...this.renderedImages];
      // Update in IndexedDB
      this.onImageWritten?.(name);
    }
  }

  addFailedSequence(failed: FailedSequence) {
    this.failedSequences = [...this.failedSequences, failed];
  }

  getBlob(name: string): Blob | undefined {
    return this.pendingBlobs.get(name);
  }

  clearResults() {
    // Revoke blob URLs to free memory
    for (const img of this.renderedImages) {
      if (img.imageUrl) {
        URL.revokeObjectURL(img.imageUrl);
      }
    }
    this.pendingBlobs.clear();
    this.renderedImages = [];
    this.failedSequences = [];
    this.error = null;
    // Clear IndexedDB
    this.onResultsCleared?.();
  }

  reset() {
    this.clearResults();
    this.sequences = [];
    this.isLoading = true;
    this.isRendering = false;
    this.isCancelled = false;
  }
}

// Singleton instance
export const galleryGeneratorState = new GalleryGeneratorState();
