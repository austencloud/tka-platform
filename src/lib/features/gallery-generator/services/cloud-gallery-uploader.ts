/**
 * cloud-gallery-uploader
 *
 * Uploads rendered gallery images directly to Firebase Storage.
 * Uses the same path structure as CloudThumbnailCache for compatibility.
 *
 * Storage structure: thumbnails/{propType}/{sequenceName}_{mode}.webp
 * Example: thumbnails/staff/Butterfly_dark.webp
 */

import { getStorageInstance } from "$lib/shared/auth/firebase";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export interface UploadResult {
  name: string;
  url: string;
  success: true;
}

export interface UploadError {
  name: string;
  error: string;
  success: false;
}

export type BatchUploadResult = UploadResult | UploadError;

/**
 * Upload a single image to Firebase Storage
 */
export async function uploadGalleryImage(
  sequenceName: string,
  blob: Blob,
  propType: PropType,
  lightMode: boolean
): Promise<string> {
  const { ref, uploadBytes, getDownloadURL } =
    await import("firebase/storage");
  const storage = await getStorageInstance();

  const modeSuffix = lightMode ? "_light" : "_dark";
  const storagePath = `thumbnails/${propType}/${sequenceName}${modeSuffix}.webp`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, {
    contentType: "image/webp",
    customMetadata: {
      sequenceName,
      propType,
      lightMode: String(lightMode),
      uploadedAt: new Date().toISOString(),
      source: "gallery-generator",
    },
  });

  const url = await getDownloadURL(storageRef);
  return url;
}

/**
 * Upload multiple images to Firebase Storage.
 * Returns results for each upload (success or error).
 */
export async function uploadGalleryImageBatch(
  images: Array<{ name: string; blob: Blob }>,
  propType: PropType,
  lightMode: boolean,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchUploadResult[]> {
  const results: BatchUploadResult[] = [];
  const total = images.length;

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (!image) continue;
    const { name, blob } = image;
    try {
      const url = await uploadGalleryImage(name, blob, propType, lightMode);
      results.push({ name, url, success: true });
    } catch (err) {
      results.push({
        name,
        error: err instanceof Error ? err.message : "Upload failed",
        success: false,
      });
    }
    onProgress?.(i + 1, total);
  }

  return results;
}
