export const Vec3 = {
  create(count = 1): Float32Array {
    return new Float32Array(count * 3);
  },

  set(b: Float32Array, i: number, x: number | number[], y?: number, z?: number): void {
    const ix = i * 3;
    if (Array.isArray(x)) {
      b[ix] = x[0]!;
      b[ix + 1] = x[1]!;
      b[ix + 2] = x[2]!;
    } else {
      b[ix] = x;
      b[ix + 1] = y!;
      b[ix + 2] = z!;
    }
  },

  copy(b: Float32Array, ai: number, out: Float32Array): Float32Array {
    const aix = ai * 3;
    out[0] = b[aix]!;
    out[1] = b[aix + 1]!;
    out[2] = b[aix + 2]!;
    return out;
  },

  distance(b: number[] | Float32Array, ai: number, bi: number): number {
    const aix = ai * 3, bix = bi * 3;
    const dx = b[aix]! - b[bix]!;
    const dy = b[aix + 1]! - b[bix + 1]!;
    const dz = b[aix + 2]! - b[bix + 2]!;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  normalize(b: Float32Array, ai: number): void {
    const aix = ai * 3;
    const x = b[aix]!, y = b[aix + 1]!, z = b[aix + 2]!;
    const lenInv = 1 / Math.sqrt(x * x + y * y + z * z);
    b[aix] = x * lenInv;
    b[aix + 1] = y * lenInv;
    b[aix + 2] = z * lenInv;
  },
};

export interface Constraint {
  indices: Uint16Array;
  _count: number;
  _itemSize: number;
  _offset: number;
  _isGlobal?: boolean;
  applyConstraint(index: number, p0: Float32Array, p1: Float32Array): void;
}

export function createDistanceConstraint(
  distance: number | [number, number],
  a: number | number[],
  b?: number,
): Constraint {
  const indices = Array.isArray(a) ? a : b !== undefined ? [a, b] : [a];
  const size = indices.length;
  const ii = new Uint16Array(size);
  for (let i = 0; i < size; i++) ii[i] = indices[i]!;

  let _min2: number, _max2: number;
  if (Array.isArray(distance)) {
    _min2 = distance[0] * distance[0];
    _max2 = distance[1] * distance[1];
  } else {
    _min2 = _max2 = distance * distance;
  }

  return {
    indices: ii,
    _count: size / 2,
    _itemSize: 2,
    _offset: 0,
    setDistance(min: number, max: number) {
      _min2 = min * min;
      _max2 = max * max;
    },
    applyConstraint(index: number, p0: Float32Array) {
      const ai = ii[index]!, bi = ii[index + 1]!;
      const ax = ai * 3, ay = ax + 1, az = ax + 2;
      const bx = bi * 3, by = bx + 1, bz = bx + 2;

      let dx = p0[bx]! - p0[ax]!;
      let dy = p0[by]! - p0[ay]!;
      let dz = p0[bz]! - p0[az]!;

      if (!(dx || dy || dz)) dx = dy = dz = 0.1;

      const dist2 = dx * dx + dy * dy + dz * dz;
      if (dist2 < _max2 && dist2 > _min2) return;

      const target2 = dist2 < _min2 ? _min2 : _max2;
      const diff = target2 / (dist2 + target2) - 0.5;

      p0[ax] = p0[ax]! - dx * diff;
      p0[ay] = p0[ay]! - dy * diff;
      p0[az] = p0[az]! - dz * diff;
      p0[bx] = p0[bx]! + dx * diff;
      p0[by] = p0[by]! + dy * diff;
      p0[bz] = p0[bz]! + dz * diff;
    },
  } as Constraint & { setDistance: (min: number, max: number) => void };
}

export function createAxisConstraint(
  axisA: number,
  axisB: number,
  indices: number[],
): Constraint {
  const size = indices.length;
  const ii = new Uint16Array(size + 2);
  ii[0] = axisA;
  ii[1] = axisB;
  for (let i = 0; i < size; i++) ii[i + 2] = indices[i]!;

  return {
    indices: ii,
    _count: size,
    _itemSize: 1,
    _offset: 2,
    applyConstraint(index: number, p0: Float32Array) {
      const ai = ii[0]!, bi = ii[index + 2]!, ci = ii[1]!;
      const aix = ai * 3, bix = bi * 3, cix = ci * 3;

      const acX = p0[cix]! - p0[aix]!;
      const acY = p0[cix + 1]! - p0[aix + 1]!;
      const acZ = p0[cix + 2]! - p0[aix + 2]!;

      const acLen = Math.sqrt(acX * acX + acY * acY + acZ * acZ);
      const acLenInv = 1 / acLen;
      const acuX = acX * acLenInv;
      const acuY = acY * acLenInv;
      const acuZ = acZ * acLenInv;

      const abX = p0[bix]! - p0[aix]!;
      const abY = p0[bix + 1]! - p0[aix + 1]!;
      const abZ = p0[bix + 2]! - p0[aix + 2]!;

      const pt = acuX * abX + acuY * abY + acuZ * abZ;

      p0[bix] = p0[aix]! + acuX * pt;
      p0[bix + 1] = p0[aix + 1]! + acuY * pt;
      p0[bix + 2] = p0[aix + 2]! + acuZ * pt;
    },
  };
}

export function createPointConstraint(
  position: [number, number, number],
  indices: number | number[],
): Constraint {
  const idxArr = Array.isArray(indices) ? indices : [indices];
  const size = idxArr.length;
  const ii = new Uint16Array(size);
  for (let i = 0; i < size; i++) ii[i] = idxArr[i]!;

  const buf = Vec3.create(1);
  Vec3.set(buf, 0, position[0], position[1], position[2]);

  return {
    indices: ii,
    _count: size,
    _itemSize: 1,
    _offset: 0,
    applyConstraint(index: number, p0: Float32Array, p1: Float32Array) {
      const ai = ii[index]!;
      const ix = ai * 3;
      p0[ix] = p1[ix] = buf[0]!;
      p0[ix + 1] = p1[ix + 1] = buf[1]!;
      p0[ix + 2] = p1[ix + 2] = buf[2]!;
    },
    setPosition(x: number, y: number, z: number) {
      buf[0] = x;
      buf[1] = y;
      buf[2] = z;
    },
  } as Constraint & { setPosition: (x: number, y: number, z: number) => void };
}

export class ParticleSystem {
  positions: Float32Array;
  positionsPrev: Float32Array;
  accumulatedForces: Float32Array;
  weights: Float32Array;

  private _iterations: number;
  private _count: number;
  private _localConstraints: Constraint[] = [];
  private _pinConstraints: Constraint[] = [];
  private _forces: { applyForce: (ix: number, f0: Float32Array, p0: Float32Array, p1: Float32Array) => void }[] = [];

  constructor(verts: number[], iterations = 2) {
    const length = verts.length;
    const count = length / 3;

    this.positions = new Float32Array(verts);
    this.positionsPrev = new Float32Array(verts);
    this.accumulatedForces = new Float32Array(length);
    this.weights = new Float32Array(count);
    this.weights.fill(1);

    this._iterations = iterations;
    this._count = count;
  }

  setWeight(i: number, w: number): void {
    this.weights[i] = w;
  }

  addConstraint(c: Constraint): void {
    this._localConstraints.push(c);
  }

  addPinConstraint(c: Constraint): void {
    this._pinConstraints.push(c);
  }

  addForce(force: { applyForce: (ix: number, f0: Float32Array, p0: Float32Array, p1: Float32Array) => void }): void {
    this._forces.push(force);
  }

  tick(delta: number): void {
    this.accumulateForces();
    this.integrate(delta);
    this.satisfyConstraints();
  }

  private accumulateForces(): void {
    const f0 = this.accumulatedForces;
    const p0 = this.positions;
    const p1 = this.positionsPrev;
    const forces = this._forces;

    for (let i = 0, il = this._count; i < il; i++) {
      const ix = i * 3;
      f0[ix] = f0[ix + 1] = f0[ix + 2] = 0;
      for (let j = 0; j < forces.length; j++) {
        forces[j]!.applyForce(ix, f0, p0, p1);
      }
    }
  }

  private integrate(delta: number): void {
    const d2 = delta * delta;
    const p0 = this.positions;
    const p1 = this.positionsPrev;
    const f0 = this.accumulatedForces;
    const w0 = this.weights;

    for (let i = 0, il = this._count; i < il; i++) {
      const weight = w0[i]!;
      const ix = i * 3;
      for (let k = 0; k < 3; k++) {
        const idx = ix + k;
        const pt = p0[idx]!;
        p0[idx] = pt + (pt - p1[idx]!) + f0[idx]! * weight * d2;
        p1[idx] = pt;
      }
    }
  }

  private satisfyConstraints(): void {
    const local = this._localConstraints;
    const pins = this._pinConstraints;
    const p0 = this.positions;
    const p1 = this.positionsPrev;

    for (let iter = 0; iter < this._iterations; iter++) {
      for (let i = 0; i < local.length; i++) {
        const c = local[i]!;
        for (let j = 0; j < c._count; j++) {
          c.applyConstraint(j * c._itemSize, p0, p1);
        }
      }
      for (let i = 0; i < pins.length; i++) {
        const c = pins[i]!;
        for (let j = 0; j < c._count; j++) {
          c.applyConstraint(j * c._itemSize, p0, p1);
        }
      }
    }
  }
}
