/**
 * Async SDF texture generator for reef obstacle avoidance.
 *
 * Merges child meshes → BVH → samples signed distance on a 3D voxel grid,
 * yielding to the main thread between Z-slices so the scene stays interactive.
 */

import {
  Box3,
  BufferGeometry,
  Data3DTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  Object3D,
  RedFormat,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';

export interface SDFResult {
  texture: Data3DTexture;
  inverseMatrix: Matrix4;
  bounds: Box3;
}

export interface SDFGeneratorOptions {
  resolution?: number;
  padding?: number;
}

function yieldFrame(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

export async function generateSDFTexture(
  object: Object3D,
  options: SDFGeneratorOptions = {},
): Promise<SDFResult> {
  const resolution = options.resolution ?? 64;
  const padding = options.padding ?? 1.5;

  object.updateMatrixWorld(true);

  const geometries: BufferGeometry[] = [];
  object.traverse((child) => {
    if (!(child as Mesh).isMesh) return;
    const mesh = child as Mesh;
    if (!mesh.geometry) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    const posAttr = geo.getAttribute('position');
    const indexAttr = geo.getIndex();
    const stripped = new BufferGeometry();
    stripped.setAttribute('position', posAttr);
    if (indexAttr) stripped.setIndex(indexAttr);
    geometries.push(stripped);
  });

  if (geometries.length === 0) {
    throw new Error('[sdf-generator] No meshes found in the provided Object3D');
  }

  const merged = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, false);
  if (!merged) {
    throw new Error('[sdf-generator] mergeGeometries returned null');
  }

  const bvh = new MeshBVH(merged);

  const bounds = new Box3();
  bvh.getBoundingBox(bounds);
  bounds.expandByScalar(padding);

  const size = new Vector3();
  bounds.getSize(size);
  const origin = bounds.min.clone();

  const inverseMatrix = new Matrix4();
  inverseMatrix.set(
    1 / size.x, 0, 0, -origin.x / size.x,
    0, 1 / size.y, 0, -origin.y / size.y,
    0, 0, 1 / size.z, -origin.z / size.z,
    0, 0, 0, 1,
  );

  const dim = resolution;
  const sdfData = new Float32Array(dim * dim * dim);
  const samplePoint = new Vector3();
  const hitTarget = { point: new Vector3(), distance: 0, faceIndex: 0 };
  const stepX = size.x / dim;
  const stepY = size.y / dim;
  const stepZ = size.z / dim;

  const positionAttr = merged.getAttribute('position');
  const indexArr = merged.getIndex();
  const triA = new Vector3(), triB = new Vector3(), triC = new Vector3();
  const edgeAB = new Vector3(), edgeAC = new Vector3(), faceNormal = new Vector3();
  const toPoint = new Vector3();
  const fallbackDist = size.length();

  function getTriangleNormal(faceIndex: number): Vector3 {
    let i0: number, i1: number, i2: number;
    if (indexArr) {
      i0 = indexArr.getX(faceIndex * 3);
      i1 = indexArr.getX(faceIndex * 3 + 1);
      i2 = indexArr.getX(faceIndex * 3 + 2);
    } else {
      i0 = faceIndex * 3;
      i1 = faceIndex * 3 + 1;
      i2 = faceIndex * 3 + 2;
    }
    triA.fromBufferAttribute(positionAttr, i0);
    triB.fromBufferAttribute(positionAttr, i1);
    triC.fromBufferAttribute(positionAttr, i2);
    edgeAB.subVectors(triB, triA);
    edgeAC.subVectors(triC, triA);
    faceNormal.crossVectors(edgeAB, edgeAC).normalize();
    return faceNormal;
  }

  // Process Z-slices, yielding between each so the main thread stays responsive
  for (let z = 0; z < dim; z++) {
    const wz = origin.z + (z + 0.5) * stepZ;
    for (let y = 0; y < dim; y++) {
      const wy = origin.y + (y + 0.5) * stepY;
      for (let x = 0; x < dim; x++) {
        const wx = origin.x + (x + 0.5) * stepX;
        samplePoint.set(wx, wy, wz);

        const hit = bvh.closestPointToPoint(samplePoint, hitTarget, 0, Infinity);
        if (!hit) {
          sdfData[z * dim * dim + y * dim + x] = fallbackDist;
          continue;
        }

        const normal = getTriangleNormal(hit.faceIndex);
        toPoint.subVectors(samplePoint, hit.point);
        const sign = toPoint.dot(normal) >= 0 ? 1 : -1;
        sdfData[z * dim * dim + y * dim + x] = hit.distance * sign;
      }
    }
    // Yield every 4 slices to balance throughput vs responsiveness
    if (z % 4 === 3) await yieldFrame();
  }

  const halfData = float32ToHalf(sdfData);

  const texture = new Data3DTexture(halfData, dim, dim, dim);
  texture.format = RedFormat;
  texture.type = HalfFloatType;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return { texture, inverseMatrix, bounds };
}

function float32ToHalf(float32Array: Float32Array): Uint16Array {
  const len = float32Array.length;
  const result = new Uint16Array(len);
  const view = new DataView(new ArrayBuffer(4));

  for (let i = 0; i < len; i++) {
    view.setFloat32(0, float32Array[i]!, false);
    const bits = view.getUint32(0, false);

    const sign = (bits >>> 31) & 0x1;
    const exp = (bits >>> 23) & 0xff;
    const mantissa = bits & 0x7fffff;

    let halfSign = sign << 15;
    let halfExp: number;
    let halfMantissa: number;

    if (exp === 0) {
      halfExp = 0;
      halfMantissa = 0;
    } else if (exp === 0xff) {
      halfExp = 0x1f;
      halfMantissa = mantissa ? 0x200 : 0;
    } else {
      const newExp = exp - 127 + 15;
      if (newExp >= 0x1f) {
        halfExp = 0x1f;
        halfMantissa = 0;
      } else if (newExp <= 0) {
        halfExp = 0;
        halfMantissa = 0;
      } else {
        halfExp = newExp;
        halfMantissa = mantissa >> 13;
      }
    }

    result[i] = halfSign | (halfExp << 10) | halfMantissa;
  }

  return result;
}
