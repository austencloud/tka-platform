import { BufferAttribute, BufferGeometry, DynamicDrawUsage } from "three";
import type { Silk3DParams } from "$lib/shared/effects/translators/webgl3d-types";
import { setRgbFromHex, type MutableRgb } from "../instancing/particle-color";
import type { BoundedSourcePath3D } from "../scene-effects/bounded-source-path-3d";

const EPSILON = 1e-8;
const MAX_POINTS_PER_RIBBON = 320;

export interface SilkRibbonFrame3D {
  headSideX: number;
  headSideY: number;
  headSideZ: number;
  hasHeadSide: boolean;
}

/**
 * One allocation-free, indexed fabric surface shared by every active Silk
 * source. Each source writes a separate quad strip into the same buffers.
 */
export class SilkRibbonGeometry3D {
  readonly geometry = new BufferGeometry();

  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly bodyColors: Float32Array;
  private readonly edgeColors: Float32Array;
  private readonly alphas: Float32Array;
  private readonly ribbonEdges: Float32Array;
  private readonly progresses: Float32Array;
  private readonly emissives: Float32Array;
  private readonly indices: Uint32Array;

  private readonly centers = new Float32Array(MAX_POINTS_PER_RIBBON * 3);
  private readonly tangents = new Float32Array(MAX_POINTS_PER_RIBBON * 3);
  private readonly sides = new Float32Array(MAX_POINTS_PER_RIBBON * 3);
  private readonly body: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly bodyAlt: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly edge: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly edgeAlt: MutableRgb = { red: 1, green: 1, blue: 1 };
  private sampleCursor = 0;
  private indexCursor = 0;

  constructor(private readonly sampleCapacity: number) {
    const vertexCapacity = sampleCapacity * 2;
    this.positions = new Float32Array(vertexCapacity * 3);
    this.normals = new Float32Array(vertexCapacity * 3);
    this.bodyColors = new Float32Array(vertexCapacity * 3);
    this.edgeColors = new Float32Array(vertexCapacity * 3);
    this.alphas = new Float32Array(vertexCapacity);
    this.ribbonEdges = new Float32Array(vertexCapacity);
    this.progresses = new Float32Array(vertexCapacity);
    this.emissives = new Float32Array(vertexCapacity);
    this.indices = new Uint32Array(sampleCapacity * 6);

    this.setDynamicAttribute("position", this.positions, 3);
    this.setDynamicAttribute("normal", this.normals, 3);
    this.setDynamicAttribute("bodyColor", this.bodyColors, 3);
    this.setDynamicAttribute("edgeColor", this.edgeColors, 3);
    this.setDynamicAttribute("alpha", this.alphas, 1);
    this.setDynamicAttribute("ribbonEdge", this.ribbonEdges, 1);
    this.setDynamicAttribute("progress", this.progresses, 1);
    this.setDynamicAttribute("emissive", this.emissives, 1);
    const index = new BufferAttribute(this.indices, 1);
    index.setUsage(DynamicDrawUsage);
    this.geometry.setIndex(index);
    this.geometry.setDrawRange(0, 0);
  }

  beginFrame(): void {
    this.sampleCursor = 0;
    this.indexCursor = 0;
  }

  writeRibbon(
    path: BoundedSourcePath3D,
    params: Silk3DParams,
    currentTime: number,
    frame: SilkRibbonFrame3D
  ): void {
    const available = this.sampleCapacity - this.sampleCursor;
    const count = Math.min(
      path.count,
      params.maxPointsPerTip,
      MAX_POINTS_PER_RIBBON,
      available
    );
    if (count < 2) return;

    this.readCenters(path, count);
    this.writeTangents(count);
    this.writeTransportedSides(count, frame);
    this.resolveColors(params);

    const baseVertex = this.sampleCursor * 2;
    for (let sample = 0; sample < count; sample++) {
      this.writeSample(baseVertex, sample, count, path, params, currentTime);
    }
    for (let segment = 0; segment < count - 1; segment++) {
      const v0 = baseVertex + segment * 2;
      this.indices[this.indexCursor++] = v0;
      this.indices[this.indexCursor++] = v0 + 1;
      this.indices[this.indexCursor++] = v0 + 2;
      this.indices[this.indexCursor++] = v0 + 1;
      this.indices[this.indexCursor++] = v0 + 3;
      this.indices[this.indexCursor++] = v0 + 2;
    }
    this.sampleCursor += count;
  }

  commit(): void {
    const vertexCount = this.sampleCursor * 2;
    this.markUpdated("position", vertexCount * 3);
    this.markUpdated("normal", vertexCount * 3);
    this.markUpdated("bodyColor", vertexCount * 3);
    this.markUpdated("edgeColor", vertexCount * 3);
    this.markUpdated("alpha", vertexCount);
    this.markUpdated("ribbonEdge", vertexCount);
    this.markUpdated("progress", vertexCount);
    this.markUpdated("emissive", vertexCount);
    const index = this.geometry.index as BufferAttribute;
    index.clearUpdateRanges();
    if (this.indexCursor > 0) index.addUpdateRange(0, this.indexCursor);
    index.needsUpdate = true;
    this.geometry.setDrawRange(0, this.indexCursor);
  }

  clear(): void {
    this.beginFrame();
    this.commit();
  }

  dispose(): void {
    this.geometry.dispose();
  }

  private readCenters(path: BoundedSourcePath3D, count: number): void {
    for (let sample = 0; sample < count; sample++) {
      const pathIndex = path.indexFromNewest(sample);
      const i3 = sample * 3;
      this.centers[i3] = path.xAt(pathIndex);
      this.centers[i3 + 1] = path.yAt(pathIndex);
      this.centers[i3 + 2] = path.zAt(pathIndex);
    }
  }

  private writeTangents(count: number): void {
    for (let sample = 0; sample < count; sample++) {
      const previous = Math.max(0, sample - 1) * 3;
      const next = Math.min(count - 1, sample + 1) * 3;
      const i3 = sample * 3;
      let tx = this.centers[next]! - this.centers[previous]!;
      let ty = this.centers[next + 1]! - this.centers[previous + 1]!;
      let tz = this.centers[next + 2]! - this.centers[previous + 2]!;
      let length = Math.hypot(tx, ty, tz);
      if (length < EPSILON && sample > 0) {
        tx = this.tangents[i3 - 3]!;
        ty = this.tangents[i3 - 2]!;
        tz = this.tangents[i3 - 1]!;
        length = 1;
      } else if (length < EPSILON) {
        tx = 0;
        ty = -1;
        tz = 0;
        length = 1;
      }
      this.tangents[i3] = tx / length;
      this.tangents[i3 + 1] = ty / length;
      this.tangents[i3 + 2] = tz / length;
    }
  }

  private writeTransportedSides(count: number, frame: SilkRibbonFrame3D): void {
    const tx = this.tangents[0]!;
    const ty = this.tangents[1]!;
    const tz = this.tangents[2]!;
    let sx = frame.hasHeadSide ? frame.headSideX : -tz;
    let sy = frame.hasHeadSide ? frame.headSideY : 0;
    let sz = frame.hasHeadSide ? frame.headSideZ : tx;
    let along = sx * tx + sy * ty + sz * tz;
    sx -= tx * along;
    sy -= ty * along;
    sz -= tz * along;
    let length = Math.hypot(sx, sy, sz);
    if (length < EPSILON) {
      sx = ty;
      sy = -tx;
      sz = 0;
      length = Math.hypot(sx, sy, sz) || 1;
    }
    sx /= length;
    sy /= length;
    sz /= length;
    this.sides[0] = sx;
    this.sides[1] = sy;
    this.sides[2] = sz;
    frame.headSideX = sx;
    frame.headSideY = sy;
    frame.headSideZ = sz;
    frame.hasHeadSide = true;

    for (let sample = 1; sample < count; sample++) {
      const i3 = sample * 3;
      const currentTx = this.tangents[i3]!;
      const currentTy = this.tangents[i3 + 1]!;
      const currentTz = this.tangents[i3 + 2]!;
      along = sx * currentTx + sy * currentTy + sz * currentTz;
      let nextSx = sx - currentTx * along;
      let nextSy = sy - currentTy * along;
      let nextSz = sz - currentTz * along;
      length = Math.hypot(nextSx, nextSy, nextSz);
      if (length < EPSILON) {
        nextSx = -currentTz;
        nextSy = 0;
        nextSz = currentTx;
        length = Math.hypot(nextSx, nextSy, nextSz) || 1;
      }
      sx = nextSx / length;
      sy = nextSy / length;
      sz = nextSz / length;
      this.sides[i3] = sx;
      this.sides[i3 + 1] = sy;
      this.sides[i3 + 2] = sz;
    }
  }

  private resolveColors(params: Silk3DParams): void {
    setRgbFromHex(this.body, params.resolvedPalette.body);
    setRgbFromHex(
      this.bodyAlt,
      params.resolvedPalette.bodyAlt ?? params.resolvedPalette.body
    );
    setRgbFromHex(this.edge, params.resolvedPalette.edge);
    setRgbFromHex(
      this.edgeAlt,
      params.resolvedPalette.edgeAlt ?? params.resolvedPalette.edge
    );
  }

  private writeSample(
    baseVertex: number,
    sample: number,
    count: number,
    path: BoundedSourcePath3D,
    params: Silk3DParams,
    currentTime: number
  ): void {
    const i3 = sample * 3;
    const pathIndex = path.indexFromNewest(sample);
    const life = clamp(
      (currentTime - path.birthAt(pathIndex)) / params.lifetimeSeconds,
      0,
      1
    );
    const tailEnvelope = smoothstep(life, 0.04, 0.94);
    const speedScale = clamp(
      path.speedAt(pathIndex) / params.motionReferenceSpeed,
      0,
      1
    );
    const flutterStrength =
      params.flutter * (1 - params.tautness * 0.62) * tailEnvelope;
    const phase = currentTime * (2.1 + params.flutter * 1.7) - sample * 0.38;

    const tx = this.tangents[i3]!;
    const ty = this.tangents[i3 + 1]!;
    const tz = this.tangents[i3 + 2]!;
    const sx = this.sides[i3]!;
    const sy = this.sides[i3 + 1]!;
    const sz = this.sides[i3 + 2]!;
    let nx = ty * sz - tz * sy;
    let ny = tz * sx - tx * sz;
    let nz = tx * sy - ty * sx;

    // Twist the cloth around its transported frame. The wave grows toward the
    // free tail, stays proportional to ribbon width, and never moves the live
    // prop endpoint away from its tracked position.
    const twist = Math.sin(phase) * flutterStrength * 0.2;
    let widthX = sx + nx * twist;
    let widthY = sy + ny * twist;
    let widthZ = sz + nz * twist;
    const widthLength = Math.hypot(widthX, widthY, widthZ) || 1;
    widthX /= widthLength;
    widthY /= widthLength;
    widthZ /= widthLength;
    nx = ty * widthZ - tz * widthY;
    ny = tz * widthX - tx * widthZ;
    nz = tx * widthY - ty * widthX;
    const normalLength = Math.hypot(nx, ny, nz) || 1;
    nx /= normalLength;
    ny /= normalLength;
    nz /= normalLength;

    const widthTaper = 1 - Math.pow(life, 1.45) * 0.62;
    const motionTightening = 1 - params.tautness * speedScale * 0.32;
    const halfWidth =
      params.baseHalfWidthWorld *
      (0.68 + params.intensity * 0.42) *
      widthTaper *
      motionTightening;
    const flutterOffset =
      Math.sin(phase * 0.73 + 0.8) * halfWidth * flutterStrength * 0.2;
    const gravitySag =
      params.baseHalfWidthWorld *
      params.flutter *
      (1 - params.tautness) *
      life *
      life *
      0.34;
    const centerX = this.centers[i3]! + nx * flutterOffset;
    const centerY = this.centers[i3 + 1]! + ny * flutterOffset - gravitySag;
    const centerZ = this.centers[i3 + 2]! + nz * flutterOffset;
    const colorMix = params.resolvedPalette.hueShift ? life : life * 0.08;
    const bodyRed = mix(this.body.red, this.bodyAlt.red, colorMix);
    const bodyGreen = mix(this.body.green, this.bodyAlt.green, colorMix);
    const bodyBlue = mix(this.body.blue, this.bodyAlt.blue, colorMix);
    const edgeRed = mix(this.edge.red, this.edgeAlt.red, colorMix);
    const edgeGreen = mix(this.edge.green, this.edgeAlt.green, colorMix);
    const edgeBlue = mix(this.edge.blue, this.edgeAlt.blue, colorMix);
    const alpha = params.intensity * Math.pow(1 - life, 0.58);
    const emissive = params.resolvedPalette.emissive ? 1 : 0;

    for (let edgeIndex = 0; edgeIndex < 2; edgeIndex++) {
      const sign = edgeIndex === 0 ? -1 : 1;
      const vertex = baseVertex + sample * 2 + edgeIndex;
      const v3 = vertex * 3;
      this.positions[v3] = centerX + widthX * halfWidth * sign;
      this.positions[v3 + 1] = centerY + widthY * halfWidth * sign;
      this.positions[v3 + 2] = centerZ + widthZ * halfWidth * sign;
      this.normals[v3] = nx;
      this.normals[v3 + 1] = ny;
      this.normals[v3 + 2] = nz;
      this.bodyColors[v3] = bodyRed;
      this.bodyColors[v3 + 1] = bodyGreen;
      this.bodyColors[v3 + 2] = bodyBlue;
      this.edgeColors[v3] = edgeRed;
      this.edgeColors[v3 + 1] = edgeGreen;
      this.edgeColors[v3 + 2] = edgeBlue;
      this.alphas[vertex] = alpha;
      this.ribbonEdges[vertex] = sign;
      this.progresses[vertex] = life;
      this.emissives[vertex] = emissive;
    }
  }

  private setDynamicAttribute(
    name: string,
    array: Float32Array,
    itemSize: number
  ): void {
    const attribute = new BufferAttribute(array, itemSize);
    attribute.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute(name, attribute);
  }

  private markUpdated(name: string, componentCount: number): void {
    const attribute = this.geometry.getAttribute(name) as BufferAttribute;
    attribute.clearUpdateRanges();
    if (componentCount > 0) attribute.addUpdateRange(0, componentCount);
    attribute.needsUpdate = true;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep(value: number, minimum: number, maximum: number): number {
  const t = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}
