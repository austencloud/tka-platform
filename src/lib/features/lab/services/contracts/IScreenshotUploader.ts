/**
 * IScreenshotUploader
 *
 * Uploads screenshot PNG blobs to Firebase Storage during capture.
 * Writes a metadata document to Firestore for gallery queries.
 */

import type { DeviceCategory } from "./IScreenshotOrchestrator";

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

export interface IScreenshotUploader {
  /** Upload a screenshot blob to Firebase Storage and write Firestore metadata doc */
  upload(params: UploadScreenshotParams): Promise<ScreenshotMetadata>;
}
