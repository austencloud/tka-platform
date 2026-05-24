import {
  Data3DTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  RedFormat,
  Vector3,
} from 'three';

export interface ObstacleSphere {
  x: number;
  y: number;
  z: number;
  r: number;
}

export interface SceneSDFResult {
  texture: Data3DTexture;
  inverseMatrix: Matrix4;
}

export function bakeSceneSDF(
  spheres: ObstacleSphere[],
  boundsMin: Vector3,
  boundsMax: Vector3,
  resolution = 64,
): SceneSDFResult {
  const size = new Vector3().subVectors(boundsMax, boundsMin);
  const dim = resolution;
  const data = new Float32Array(dim * dim * dim);

  const invX = dim / size.x;
  const invY = dim / size.y;
  const invZ = dim / size.z;

  for (let iz = 0; iz < dim; iz++) {
    const wz = boundsMin.z + (iz + 0.5) / invZ;
    for (let iy = 0; iy < dim; iy++) {
      const wy = boundsMin.y + (iy + 0.5) / invY;
      for (let ix = 0; ix < dim; ix++) {
        const wx = boundsMin.x + (ix + 0.5) / invX;

        let minDist = 999.0;
        for (let si = 0; si < spheres.length; si++) {
          const s = spheres[si]!;
          const dx = wx - s.x;
          const dy = wy - s.y;
          const dz = wz - s.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) - s.r;
          if (dist < minDist) minDist = dist;
        }

        data[iz * dim * dim + iy * dim + ix] = minDist;
      }
    }
  }

  const halfData = float32ToHalf(data);

  const texture = new Data3DTexture(halfData, dim, dim, dim);
  texture.format = RedFormat;
  texture.type = HalfFloatType;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const inverseMatrix = new Matrix4();
  inverseMatrix.set(
    1 / size.x, 0, 0, -boundsMin.x / size.x,
    0, 1 / size.y, 0, -boundsMin.y / size.y,
    0, 0, 1 / size.z, -boundsMin.z / size.z,
    0, 0, 0, 1,
  );

  return { texture, inverseMatrix };
}

function float32ToHalf(f32: Float32Array): Uint16Array {
  const len = f32.length;
  const out = new Uint16Array(len);
  const view = new DataView(new ArrayBuffer(4));

  for (let i = 0; i < len; i++) {
    view.setFloat32(0, f32[i]!, false);
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
      const ne = exp - 127 + 15;
      if (ne >= 0x1f) { halfExp = 0x1f; halfMantissa = 0; }
      else if (ne <= 0) { halfExp = 0; halfMantissa = 0; }
      else { halfExp = ne; halfMantissa = mantissa >> 13; }
    }

    out[i] = halfSign | (halfExp << 10) | halfMantissa;
  }
  return out;
}
