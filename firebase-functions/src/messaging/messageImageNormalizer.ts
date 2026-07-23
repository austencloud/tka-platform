import sharp from "sharp";

const MAX_INPUT_PIXELS = 40_000_000;
const MAX_EDGE = 2048;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export interface NormalizedMessageImage {
  buffer: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
}

export class InvalidMessageImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMessageImageError";
  }
}

export async function normalizeMessageImage(
  input: Buffer
): Promise<NormalizedMessageImage> {
  try {
    const source = sharp(input, {
      animated: false,
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
    });
    const metadata = await source.metadata();

    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      throw new InvalidMessageImageError(
        "Only JPEG, PNG, and WebP images are supported."
      );
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new InvalidMessageImageError("Animated images are not supported.");
    }
    if (!metadata.width || !metadata.height) {
      throw new InvalidMessageImageError("The image dimensions are invalid.");
    }

    const { data, info } = await source
      .autoOrient()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88, effort: 5 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      contentType: "image/webp",
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    if (error instanceof InvalidMessageImageError) throw error;
    throw new InvalidMessageImageError(
      "The selected file could not be decoded as a supported image."
    );
  }
}
