/**
 * A saved entry in the user's POI image library.
 *
 * One of these is created for every image the user uploads in the POV
 * Pattern Lab (either via the upload zone or by dropping an image onto
 * the timeline). Persisted to Firestore under
 * `users/{userId}/poi-images/{id}` with the binary file living at the
 * matching Storage path.
 */
export interface PoiImageLibraryEntry {
  /** Content hash (SHA-256 hex, first 16 bytes) - doubles as doc ID and Storage filename */
  id: string;
  /** User-facing name, defaults to the original filename (no extension). Editable. */
  name: string;
  /** Original filename at upload time, for reference */
  originalFileName: string;
  /** Public download URL from Firebase Storage */
  storageUrl: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Pixel dimensions of the source image */
  width: number;
  height: number;
  /** MIME type: "image/png" | "image/jpeg" | "image/bmp" | "image/webp" */
  contentType: string;
  /** Client-side upload timestamp (ms since epoch) - safe for display */
  uploadedAt: number;
  /** Where the upload came from - useful for analytics / debugging */
  source: "upload-zone" | "timeline-drop";
}
