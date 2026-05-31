/**
 * LedRibbonGeometry3D - mutable BufferGeometry that extrudes a
 * camera-facing quad strip along a polyline of sample points.
 *
 * Each sample point contributes two vertices - one offset +N, one -N -
 * where N is perpendicular to both the local tangent and the direction
 * from the sample to the camera. The result is a continuous ribbon that
 * always faces the camera along its length.
 *
 * Rebuilt from scratch every frame using scratch vectors to avoid
 * allocation churn. Preallocated at maxSamples capacity; setDrawRange
 * controls how much of the buffer is actually drawn.
 */

import { BufferGeometry, BufferAttribute, Vector3 } from "three";

export interface RibbonSample {
  position: Vector3;
  timestamp: number;
  r: number;
  g: number;
  b: number;
}

/** Minimum tangent length in world units. Below this the segment is
 *  treated as degenerate (prop not moving) and the previous tangent is
 *  reused to avoid a perpendicular that flips around. */
const TANGENT_EPSILON = 1e-5;

export class LedRibbonGeometry3D {
  readonly geometry: BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly alphas: Float32Array;
  private readonly uvs: Float32Array;
  private readonly indices: Uint32Array;
  readonly maxSamples: number;

  // Scratch vectors reused every frame to avoid GC pressure.
  private readonly scratchTangent = new Vector3();
  private readonly scratchToCamera = new Vector3();
  private readonly scratchNormal = new Vector3();
  private readonly scratchLastNormal = new Vector3(1, 0, 0);

  constructor(maxSamples: number) {
    this.maxSamples = maxSamples;

    const vertexCount = maxSamples * 2;
    this.positions = new Float32Array(vertexCount * 3);
    this.colors = new Float32Array(vertexCount * 3);
    this.alphas = new Float32Array(vertexCount);
    this.uvs = new Float32Array(vertexCount * 2);

    // Triangle strip over the 2×N vertex grid: two triangles per segment.
    // For segment i: verts (2i, 2i+1, 2i+2) and (2i+1, 2i+3, 2i+2).
    const indexCount = (maxSamples - 1) * 6;
    this.indices = new Uint32Array(indexCount);
    for (let i = 0; i < maxSamples - 1; i++) {
      const v0 = i * 2;
      const ii = i * 6;
      this.indices[ii + 0] = v0;
      this.indices[ii + 1] = v0 + 1;
      this.indices[ii + 2] = v0 + 2;
      this.indices[ii + 3] = v0 + 1;
      this.indices[ii + 4] = v0 + 3;
      this.indices[ii + 5] = v0 + 2;
    }

    // Preset UVs: u varies per sample (filled during update), v is fixed
    // to 0 on the top edge and 1 on the bottom edge of every segment.
    for (let i = 0; i < maxSamples; i++) {
      this.uvs[i * 4 + 1] = 0;
      this.uvs[i * 4 + 3] = 1;
    }

    this.geometry = new BufferGeometry();
    const positionAttr = new BufferAttribute(this.positions, 3);
    positionAttr.setUsage(35048); // DynamicDrawUsage
    const colorAttr = new BufferAttribute(this.colors, 3);
    colorAttr.setUsage(35048);
    const alphaAttr = new BufferAttribute(this.alphas, 1);
    alphaAttr.setUsage(35048);
    const uvAttr = new BufferAttribute(this.uvs, 2);
    uvAttr.setUsage(35048);

    this.geometry.setAttribute("position", positionAttr);
    this.geometry.setAttribute("color", colorAttr);
    this.geometry.setAttribute("alpha", alphaAttr);
    this.geometry.setAttribute("uv", uvAttr);
    this.geometry.setIndex(new BufferAttribute(this.indices, 1));
    this.geometry.setDrawRange(0, 0);
    // Disable frustum culling: the bounding sphere is unreliable while the
    // ribbon shape changes every frame.
    this.geometry.boundingSphere = null;
    this.geometry.boundingBox = null;
  }

  /**
   * Rebuild the ribbon from the given samples.
   *
   * @param samples - ordered oldest-first up to newest. Must have ≥2 for
   *                  a visible ribbon; fewer will clear the draw range.
   * @param cameraPosition - world-space camera position for orientation.
   * @param halfWidth - ribbon half-width in world units.
   * @param currentTime - time in seconds; used with fadeDuration to
   *                      compute per-vertex alpha.
   * @param fadeDuration - how long a sample takes to fade to zero alpha.
   * @param brightness - global brightness multiplier applied to each
   *                     sample's alpha (typically tip.brightness).
   */
  update(
    samples: RibbonSample[],
    sampleCount: number,
    cameraPosition: Vector3,
    halfWidth: number,
    currentTime: number,
    fadeDuration: number,
    brightness: number,
  ): void {
    const n = Math.min(sampleCount, this.maxSamples);
    if (n < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    // Initialize last-normal with something deterministic for the first frame.
    this.scratchLastNormal.set(1, 0, 0);

    const uInvMax = 1.0 / (n - 1);

    for (let i = 0; i < n; i++) {
      const sample = samples[i]!;
      const curr = sample.position;

      // Tangent along the ribbon: use centered difference where possible,
      // forward/backward difference at the ends.
      let prevIdx = i - 1;
      let nextIdx = i + 1;
      if (prevIdx < 0) prevIdx = 0;
      if (nextIdx >= n) nextIdx = n - 1;
      const prevPos = samples[prevIdx]!.position;
      const nextPos = samples[nextIdx]!.position;
      this.scratchTangent.subVectors(nextPos, prevPos);

      // Perpendicular in screen space: cross tangent with the
      // sample→camera direction. Reuse the previous normal when the
      // tangent is too short to compute reliably.
      let normalX = this.scratchLastNormal.x;
      let normalY = this.scratchLastNormal.y;
      let normalZ = this.scratchLastNormal.z;

      if (this.scratchTangent.lengthSq() > TANGENT_EPSILON * TANGENT_EPSILON) {
        this.scratchTangent.normalize();
        this.scratchToCamera.subVectors(cameraPosition, curr);
        if (this.scratchToCamera.lengthSq() > 1e-12) {
          this.scratchToCamera.normalize();
          this.scratchNormal.crossVectors(this.scratchTangent, this.scratchToCamera);
          const len = this.scratchNormal.length();
          if (len > 1e-6) {
            this.scratchNormal.multiplyScalar(1.0 / len);
            // Ribbon normal continuity: when the tangent flips direction
            // (e.g. at the apex of a loop), the cross product flips the
            // normal too, which would twist the ribbon 180° like a Möbius
            // strip. Detect the flip by dotting with the previous normal
            // and negate to keep the ribbon consistently oriented.
            if (i > 0) {
              const dot =
                this.scratchNormal.x * this.scratchLastNormal.x +
                this.scratchNormal.y * this.scratchLastNormal.y +
                this.scratchNormal.z * this.scratchLastNormal.z;
              if (dot < 0) {
                this.scratchNormal.negate();
              }
            }
            normalX = this.scratchNormal.x;
            normalY = this.scratchNormal.y;
            normalZ = this.scratchNormal.z;
            this.scratchLastNormal.set(normalX, normalY, normalZ);
          }
        }
      }

      const offsetX = normalX * halfWidth;
      const offsetY = normalY * halfWidth;
      const offsetZ = normalZ * halfWidth;

      const pi = i * 6; // 2 verts × 3 floats
      // Top edge vertex (v = 0)
      this.positions[pi + 0] = curr.x + offsetX;
      this.positions[pi + 1] = curr.y + offsetY;
      this.positions[pi + 2] = curr.z + offsetZ;
      // Bottom edge vertex (v = 1)
      this.positions[pi + 3] = curr.x - offsetX;
      this.positions[pi + 4] = curr.y - offsetY;
      this.positions[pi + 5] = curr.z - offsetZ;

      // Per-vertex color (both edges share the same sample color)
      const ci = i * 6;
      this.colors[ci + 0] = sample.r;
      this.colors[ci + 1] = sample.g;
      this.colors[ci + 2] = sample.b;
      this.colors[ci + 3] = sample.r;
      this.colors[ci + 4] = sample.g;
      this.colors[ci + 5] = sample.b;

      // Age-based alpha. The newest sample is alpha = brightness; the
      // oldest samples fade to zero as they approach fadeDuration.
      const age = currentTime - sample.timestamp;
      const ageAlpha = Math.max(0, 1.0 - age / fadeDuration);
      const alpha = ageAlpha * brightness;
      this.alphas[i * 2 + 0] = alpha;
      this.alphas[i * 2 + 1] = alpha;

      // u along the ribbon length
      const u = i * uInvMax;
      this.uvs[i * 4 + 0] = u;
      this.uvs[i * 4 + 2] = u;
    }

    // Flag attributes dirty
    const positionAttr = this.geometry.getAttribute("position") as BufferAttribute;
    const colorAttr = this.geometry.getAttribute("color") as BufferAttribute;
    const alphaAttr = this.geometry.getAttribute("alpha") as BufferAttribute;
    const uvAttr = this.geometry.getAttribute("uv") as BufferAttribute;

    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;

    // Number of triangles to draw = 2 × (n - 1), 3 indices each.
    this.geometry.setDrawRange(0, (n - 1) * 6);
  }

  /** Hide the ribbon without disposing it. */
  hide(): void {
    this.geometry.setDrawRange(0, 0);
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
