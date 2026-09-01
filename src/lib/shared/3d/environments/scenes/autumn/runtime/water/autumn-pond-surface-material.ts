import {
  Color,
  DataTexture,
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
  type Texture,
} from "three";

const WATER_BODY_COLOR = "#283650";

interface PondNormalOptions {
  seed: number;
  size?: number;
  waveCount?: number;
}

/**
 * Builds a seamless tangent-space ripple normal without a runtime asset fetch.
 * Integer wave vectors make every octave wrap exactly at the texture seam.
 */
export function createAutumnPondNormalMap({
  seed,
  size = 256,
  waveCount = 7,
}: PondNormalOptions): DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  const waves = Array.from({ length: waveCount }, (_, index) => {
    const angle = seed * 1.61803398875 + index * 2.39996322973;
    const frequency = 2 + index * 1.35;
    const x = Math.max(1, Math.round(Math.cos(angle) * frequency));
    const y = Math.max(1, Math.round(Math.sin(angle) * frequency));
    return {
      x,
      y,
      phase: seed * 4.17 + index * 1.73,
      amplitude: 1 / (1 + index * 0.72),
    };
  });

  const tau = Math.PI * 2;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      let slopeU = 0;
      let slopeV = 0;

      for (const wave of waves) {
        const phase = tau * (wave.x * u + wave.y * v) + wave.phase;
        const derivative = Math.cos(phase) * wave.amplitude * tau;
        slopeU += derivative * wave.x;
        slopeV += derivative * wave.y;
      }

      const normalX = -slopeU * 0.018;
      const normalY = -slopeV * 0.018;
      const inverseLength = 1 / Math.hypot(normalX, normalY, 1);
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round((normalX * inverseLength * 0.5 + 0.5) * 255);
      pixels[offset + 1] = Math.round(
        (normalY * inverseLength * 0.5 + 0.5) * 255
      );
      pixels[offset + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
      pixels[offset + 3] = 255;
    }
  }

  const texture = new DataTexture(
    pixels,
    size,
    size,
    RGBAFormat,
    UnsignedByteType
  );
  texture.name = `Autumn pond ripple normal ${seed}`;
  texture.colorSpace = NoColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Owns the authored Autumn pond surface response.
 *
 * A non-zero physical transmission value makes Three render every opaque
 * object a second time before drawing the pond. The recessed basin already
 * supplies the visible bed through this alpha-blended surface, so transmission
 * adds a full-scene render without adding information the shot needs.
 */
export function createAutumnPondSurfaceMaterial(
  bodyNormal: Texture,
  coatNormal: Texture
): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: new Color(WATER_BODY_COLOR),
    emissive: new Color("#0b1d2d"),
    emissiveIntensity: 0.18,
    roughness: 0.46,
    metalness: 0.04,
    transparent: true,
    opacity: 0.76,
    transmission: 0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.48,
    specularIntensity: 0.24,
    specularColor: new Color("#7786a8"),
    normalMap: bodyNormal,
    normalScale: new Vector2(0.16, 0.16),
    clearcoatNormalMap: coatNormal,
    clearcoatNormalScale: new Vector2(0.08, 0.08),
    envMapIntensity: 0.25,
    depthWrite: false,
  });
}
