/**
 * GalleryItemAdapter
 *
 * Converts TKA GalleryItem (uses tagIds: string[]) to the shared
 * MediaItem type (uses tags: string[]) expected by @austencloud/media-tagging-* components.
 */

export interface GalleryItem {
  id: string;
  filename: string;
  routeLabel: string;
  module: string;
  deviceSlug: string;
  deviceCategory: string;
  deviceName: string;
  width: number;
  height: number;
  imageUrl: string;
  tagIds: string[];
  capturedAt: Date | null;
}

/**
 * ScreenshotOrchestrator - Coordinates on-demand screenshot captures
 * from the Lab UI via the Vite dev server endpoints.
 */

export type DeviceCategory = "phone" | "tablet" | "desktop";

export interface DeviceInfo {
  slug: string;
  name: string;
  width: number;
  height: number;
  category: DeviceCategory;
}

export interface RouteNode {
  label: string;
  moduleId: string;
  tabId?: string;
  requiresAuth: boolean;
}

export interface ModuleGroup {
  moduleId: string;
  displayName: string;
  routes: RouteNode[];
}

export interface CaptureJobStatus {
  id: string;
  status: "running" | "completed" | "failed";
  total: number;
  completed: number;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
  /** Filenames of captured PNGs (populated when status is "completed") */
  capturedFiles?: string[];
}

export interface CaptureRequest {
  routes: string[];
  devices: string[];
}

export interface CaptureStartResult {
  jobId: string;
  total: number;
}

/**
 * ScreenshotUploader
 *
 * Uploads screenshot PNG blobs to Firebase Storage during capture.
 * Writes a metadata document to Firestore for gallery queries.
 */


export interface ScreenshotMetadata {
  id: string;
  filename: string;
  storagePath: string;
  downloadUrl: string;
  routeLabel: string;
  module: string;
  deviceSlug: string;
  deviceCategory: DeviceCategory;
  deviceName: string;
  width: number;
  height: number;
  tagIds: string[];
  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadScreenshotParams {
  blob: Blob;
  filename: string;
  routeLabel: string;
  module: string;
  deviceSlug: string;
  deviceCategory: DeviceCategory;
  deviceName: string;
  width: number;
  height: number;
}

/**
 * ScreenshotUploadOrchestrator
 *
 * Coordinates uploading captured PNGs from disk (via dev server)
 * to Firebase Storage + Firestore so the gallery can display them.
 */

export interface UploadProgress {
  phase: "deduplicating" | "uploading" | "completed" | "failed";
  total: number;
  uploaded: number;
  skipped: number;
  failed: number;
  errors: string[];
  currentFile: string | null;
}

