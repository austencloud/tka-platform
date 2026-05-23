const { sin, cos, PI } = Math;

export const Geometry = {
  point(x: number, y: number, z: number, buffer: number[]): void {
    buffer.push(x, y, z);
  },

  circle(segments: number, radius: number, y: number, buffer: number[]): void {
    const step = PI * 2 / segments;
    let angle = 0;
    for (let i = 0; i < segments; i++) {
      buffer.push(cos(angle) * radius, y, sin(angle) * radius);
      angle += step;
    }
  },
};

export const Faces = {
  quad(a: number, b: number, c: number, d: number, buffer: number[]): void {
    buffer.push(a, b, c, c, d, a);
  },

  quadDoubleSide(a: number, b: number, c: number, d: number, buffer: number[]): void {
    buffer.push(a, b, c, c, d, a, d, c, b, b, a, d);
  },

  radial(center: number, index: number, count: number, buffer: number[]): void {
    for (let i = 0; i < count - 1; i++) {
      buffer.push(center, index + i + 1, index + i);
    }
    buffer.push(center, index, index + count - 1);
  },

  rings(index0: number, index1: number, count: number, buffer: number[]): void {
    for (let i = 0; i < count - 1; i++) {
      const a = index0 + i, b = index0 + i + 1;
      const c = index1 + i + 1, d = index1 + i;
      buffer.push(a, b, c, c, d, a);
    }
    const a = index0 + count - 1, b = index0;
    const c = index1, d = index1 + count - 1;
    buffer.push(a, b, c, c, d, a);
  },
};

export const Links = {
  line(index: number, count: number, buffer: number[]): number[] {
    for (let i = 0; i < count - 1; i++) {
      buffer.push(index + i, index + i + 1);
    }
    return buffer;
  },

  loop(index: number, count: number, buffer: number[]): number[] {
    for (let i = 0; i < count - 1; i++) {
      buffer.push(index + i, index + i + 1);
    }
    buffer.push(index + count - 1, index);
    return buffer;
  },

  rings(index0: number, index1: number, count: number, buffer: number[]): number[] {
    for (let i = 0; i < count; i++) {
      buffer.push(index0 + i, index1 + i);
    }
    return buffer;
  },

  radial(center: number, index: number, count: number, buffer: number[]): number[] {
    for (let i = 0; i < count; i++) {
      buffer.push(center, index + i);
    }
    return buffer;
  },
};
