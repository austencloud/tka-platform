import {
  DataTexture,
  ImageBitmapLoader,
  RGBAFormat,
  Texture,
  UnsignedByteType,
} from "three";

/**
 * Load an ordinary image texture in either a window or an OffscreenCanvas
 * renderer worker. TextureLoader creates an HTMLImageElement through
 * `document`, which does not exist in a worker; ImageBitmapLoader uses the
 * worker-safe fetch/createImageBitmap path instead.
 */
export async function loadWorkerTexture(url: string): Promise<Texture> {
  const image = await new ImageBitmapLoader()
    .setOptions({ imageOrientation: "flipY" })
    .loadAsync(url);
  const texture = new Texture(image);
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

/** A neutral tangent-space normal for an optional map with no shipped asset. */
export function createWorkerFlatNormalTexture(): DataTexture {
  const texture = new DataTexture(
    new Uint8Array([128, 128, 255, 255]),
    1,
    1,
    RGBAFormat,
    UnsignedByteType
  );
  texture.needsUpdate = true;
  return texture;
}
