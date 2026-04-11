import type { PoiImageLibraryEntry } from "../../domain/PoiImageLibraryEntry";

/**
 * Repository for the signed-in user's POI image library.
 *
 * Uploads write to Firebase Storage + Firestore under
 * `users/{userId}/poi-images/...`. All mutating methods are no-ops
 * when there is no authenticated user (guest fallback).
 */
export interface IPoiImageLibrary {
  /**
   * Upload a file to the current user's image library.
   * - Hashes the file to detect duplicates.
   * - If the image is already in the library, returns the existing entry without re-uploading.
   * - If no user is logged in, resolves to null (guest fallback).
   */
  upload(
    file: File,
    source: "upload-zone" | "timeline-drop",
  ): Promise<PoiImageLibraryEntry | null>;

  /** Subscribe to the live list of library entries for the current user. Returns an unsubscribe fn. */
  subscribe(onChange: (entries: PoiImageLibraryEntry[]) => void): () => void;

  /** Rename an entry. No-op if no user. */
  rename(id: string, name: string): Promise<void>;

  /** Delete an entry (removes both the Firestore doc AND the Storage file). No-op if no user. */
  delete(id: string): Promise<void>;

  /**
   * Fetch the binary image data for a library entry and decode it to an
   * ImageData that `patternEngine.fromImage(imageData, ledCount)` can consume.
   */
  loadAsImageData(entry: PoiImageLibraryEntry): Promise<ImageData>;
}
