const WEBP_CONTENT_TYPE = "image/webp";

export const PROFILE_PHOTO_INPUT_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_MAX_UPLOAD_BYTES = 1024 * 1024;
export const PROFILE_PHOTO_MAX_DIMENSION = 512;

const WEBP_QUALITIES = [0.86, 0.76, 0.66] as const;

export type ProfilePhotoErrorCode =
  | "signed-out"
  | "input-too-large"
  | "input-not-image"
  | "decode-failed"
  | "encode-unsupported"
  | "output-too-large";

export class ProfilePhotoError extends Error {
  constructor(
    readonly code: ProfilePhotoErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ProfilePhotoError";
  }
}

interface DecodedProfilePhoto {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

interface ProfilePhotoCanvas {
  width: number;
  height: number;
  getContext: (contextId: "2d") => CanvasRenderingContext2D | null;
  toBlob: (callback: BlobCallback, type?: string, quality?: number) => void;
}

export interface ProfilePhotoImageDependencies {
  decode: (file: File) => Promise<DecodedProfilePhoto>;
  createCanvas: () => ProfilePhotoCanvas;
}

export interface PreparedProfilePhoto {
  blob: Blob;
  width: number;
  height: number;
}

export function assertProfilePhotoInput(file: File): void {
  if (file.size > PROFILE_PHOTO_INPUT_MAX_BYTES) {
    throw new ProfilePhotoError(
      "input-too-large",
      "Choose an image smaller than 5 MB."
    );
  }

  if (!file.type.startsWith("image/")) {
    throw new ProfilePhotoError("input-not-image", "Choose an image file.");
  }
}

export function fitProfilePhotoDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new ProfilePhotoError(
      "decode-failed",
      "That photo could not be read. Try a JPEG, PNG, HEIC, or WebP image."
    );
  }

  const scale = Math.min(
    1,
    PROFILE_PHOTO_MAX_DIMENSION / width,
    PROFILE_PHOTO_MAX_DIMENSION / height
  );

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeWithImageElement(
  file: File
): Promise<DecodedProfilePhoto> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Browser image decoding failed"));
      image.src = objectUrl;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function decodeInBrowser(file: File): Promise<DecodedProfilePhoto> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Safari can decode some camera formats through Image even when
      // createImageBitmap rejects them, so give its native decoder a turn.
    }
  }

  return decodeWithImageElement(file);
}

function createBrowserCanvas(): ProfilePhotoCanvas {
  return document.createElement("canvas");
}

function encodeCanvas(
  canvas: ProfilePhotoCanvas,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Browser image encoding failed"));
        }
      },
      WEBP_CONTENT_TYPE,
      quality
    );
  });
}

export async function prepareProfilePhoto(
  file: File,
  dependencies: ProfilePhotoImageDependencies = {
    decode: decodeInBrowser,
    createCanvas: createBrowserCanvas,
  }
): Promise<PreparedProfilePhoto> {
  assertProfilePhotoInput(file);

  let decoded: DecodedProfilePhoto;
  try {
    decoded = await dependencies.decode(file);
  } catch (error) {
    throw new ProfilePhotoError(
      "decode-failed",
      "That photo could not be read. Try a JPEG, PNG, HEIC, or WebP image.",
      { cause: error }
    );
  }

  try {
    const dimensions = fitProfilePhotoDimensions(decoded.width, decoded.height);
    const canvas = dependencies.createCanvas();
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new ProfilePhotoError(
        "encode-unsupported",
        "This browser could not prepare the photo. Try a JPEG, PNG, or WebP image."
      );
    }

    context.drawImage(
      decoded.source,
      0,
      0,
      dimensions.width,
      dimensions.height
    );

    for (const quality of WEBP_QUALITIES) {
      let blob: Blob;
      try {
        blob = await encodeCanvas(canvas, quality);
      } catch (error) {
        throw new ProfilePhotoError(
          "encode-unsupported",
          "This browser could not prepare the photo. Try a JPEG, PNG, or WebP image.",
          { cause: error }
        );
      }

      // Browsers fall back to PNG when they cannot encode the requested type.
      // Storage accepts only the formats this pipeline deliberately produces.
      if (blob.type !== WEBP_CONTENT_TYPE) {
        throw new ProfilePhotoError(
          "encode-unsupported",
          "This browser could not prepare the photo. Try a JPEG, PNG, or WebP image."
        );
      }

      if (blob.size < PROFILE_PHOTO_MAX_UPLOAD_BYTES) {
        return { blob, ...dimensions };
      }
    }

    throw new ProfilePhotoError(
      "output-too-large",
      "That photo is too detailed to upload. Try a different image."
    );
  } finally {
    decoded.close?.();
  }
}

export function getProfilePhotoErrorMessage(error: unknown): string {
  if (error instanceof ProfilePhotoError) return error.message;

  const code = (error as { code?: unknown } | null)?.code;
  if (code === "storage/unauthenticated") {
    return "Sign in again, then retry the photo upload.";
  }
  if (code === "storage/unauthorized") {
    return "Photo uploads are unavailable right now. Try again later.";
  }
  if (
    code === "storage/retry-limit-exceeded" ||
    code === "storage/unknown" ||
    code === "unavailable"
  ) {
    return "The upload was interrupted. Check your connection and try again.";
  }

  return "Profile photo could not be updated. Try again.";
}
