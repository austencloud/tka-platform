import {
  Group,
  BufferGeometry,
  BufferAttribute,
  Mesh,
  ShaderMaterial,
  Color,
  AdditiveBlending,
  FrontSide,
  DoubleSide,
} from "three";
import {
  Vec3,
  ParticleSystem,
  createDistanceConstraint,
  createAxisConstraint,
  createPointConstraint,
  type Constraint,
} from "$lib/shared/physics/verlet";
import {
  normalVert,
  bulbFrag,
  gelVert,
  gelFrag,
  tailFrag,
} from "./jellyfish-shaders";

// ── Inlined geometry-utils (only used by this file) ────────────────────────

const { sin, cos, PI, round, log, floor } = Math;

const Geometry = {
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

const Faces = {
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

const Links = {
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

// ── Types ──────────────────────────────────────────────────────────────────

const PI_HALF = PI * 0.5;

interface Rib {
  start: number;
  radius: number;
  radiusOuter?: number;
  radiusSpine?: number;
  yParam: number;
  yPos: number;
  outer?: Constraint & { setDistance: (min: number, max: number) => void };
  inner?: Constraint & { setDistance: (min: number, max: number) => void };
  spine?: Constraint & { setDistance: (min: number, max: number) => void };
}

interface TentacleSegment {
  start: number;
}

export interface MedusaeColors {
  hoodPrimary: number;
  hoodSecondary: number;
  hoodTertiary: number;
  tentacles: number;
  hoodContour: number;
  bellyPrimary: number;
  bellySecondary: number;
  mouthPrimary: number;
  mouthSecondary: number;
}

export const OCEAN_COLORS: MedusaeColors = {
  hoodPrimary: 0x88ccff,
  hoodSecondary: 0x1a3a5c,
  hoodTertiary: 0x4488cc,
  tentacles: 0x6699bb,
  hoodContour: 0xaaddff,
  bellyPrimary: 0x99ccee,
  bellySecondary: 0x0a1e3a,
  mouthPrimary: 0x88bbdd,
  mouthSecondary: 0x3366aa,
};

// ── Medusae class ──────────────────────────────────────────────────────────

// Startle decay: bell flash + contraction ease back to rest over this window.
const STARTLE_DURATION = 1.5;

export class Medusae {
  item: Group;
  animTime = 0;
  /** 0 at rest, 1 the instant a startle fires, decaying to 0 over STARTLE_DURATION. */
  startleEnergy = 0;

  private system!: ParticleSystem;
  private position!: BufferAttribute;

  private size = 40;
  private yOffset = 20;
  private segmentsCount = 4;
  private totalSegments: number;
  private ribsCount = 20;
  private ribRadius = 15;

  private tentacleGroupStart = 6;
  private tentacleGroupOffset = 4;
  private tentacleGroupCount = 2;
  private tentacleSegments = 30;
  private tentacleSegmentLength = 1.5;
  private tentacleWeightFactor = 0.6;

  private tailRibsCount = 15;
  private tailRibRadiusFactor = 20;
  private tailArmSegments = 100;
  private tailArmSegmentLength = 1;
  private tailArmWeight = 0.5;

  private pinTop = 0;
  private pinMid = 1;
  private pinBottom = 2;
  private pinTail = 3;
  private pinTentacle = 4;
  private indexTop = 5;
  private indexMid = 6;
  private indexBottom = 7;
  private topStart = 8;

  private posTop = 0;
  private posMid = 0;
  private posBottom = 0;
  private posTail = 0;
  private posTentacle = 0;

  private ribs: Rib[] = [];
  private tailRibs: Rib[] = [];
  private tentacles: TentacleSegment[][] = [];

  private verts: number[] = [];
  private uvs: number[] = [];
  private bulbFaces: number[] = [];
  private tailFaces: number[] = [];
  private mouthFaces: number[] = [];
  private queuedConstraints: (Constraint & { setDistance?: (min: number, max: number) => void })[] = [];
  private weights: number[] = [];

  private timeUniforms: { value: number }[] = [];
  private flashUniforms: { value: number }[] = [];

  constructor(colors: MedusaeColors = OCEAN_COLORS) {
    this.totalSegments = this.segmentsCount * 3 * 3;
    this.item = new Group();

    this.createGeometry();
    this.createSystem();
    this.createSceneItems(colors);

    this.verts = [];
    this.uvs = [];
    this.bulbFaces = [];
    this.tailFaces = [];
    this.mouthFaces = [];
    this.queuedConstraints = [];
    this.weights = [];
  }

  private createGeometry(): void {
    this.createCore();
    this.createBulb();
    this.createTail();
    this.createMouth();
    this.createTentaclesGeometry();
  }

  private createCore(): void {
    const verts = this.verts;
    const uvs = this.uvs;
    const segments = this.totalSegments;
    const size = this.size;

    const rangeTop: [number, number] = [0, size * 0.5];
    const rangeMid: [number, number] = [size * 0.5, size * 0.7];
    const rangeTopBottom: [number, number] = [size, size * 2];
    const rangeBottom: [number, number] = [0, size * 0.5];

    const spineA = createDistanceConstraint(rangeTop, [this.pinTop, this.indexTop]);
    const spineB = createDistanceConstraint(rangeMid, [this.indexTop, this.indexMid]);
    const spineC = createDistanceConstraint(rangeBottom, [this.pinBottom, this.indexBottom]);
    const spineD = createDistanceConstraint(rangeTopBottom, [this.indexTop, this.indexBottom]);
    const axis = createAxisConstraint(this.pinTop, this.pinMid, [this.indexTop, this.indexMid, this.indexBottom]);

    this.posTop = this.yOffset + size;
    this.posMid = this.yOffset;
    this.posBottom = this.yOffset - size;
    this.posTail = this.yOffset - this.tailArmSegments * this.tailArmSegmentLength;
    this.posTentacle = this.yOffset - this.tentacleSegments * this.tentacleSegmentLength * 1.5;

    const offsets = [
      this.posTop, this.posMid, this.posBottom, this.posTail, this.posTentacle,
      size * 1.5, -size * 0.5, -size,
    ];

    for (let i = 0; i < offsets.length; i++) {
      Geometry.point(0, offsets[i]!, 0, verts);
      uvs.push(0, 0);
    }

    this.queueConstraint(spineA, spineB, spineC, spineD, axis);
    Faces.radial(this.indexTop, this.topStart, segments, this.bulbFaces);
  }

  private createBulb(): void {
    for (let i = 0; i < this.ribsCount; i++) {
      this.createRib(i, this.ribsCount);
      if (i > 0) this.createSkin(i - 1, i);
    }
  }

  private createRib(index: number, total: number): void {
    const segments = this.totalSegments;
    const verts = this.verts;
    const uvs = this.uvs;
    const size = this.size;
    const yParam = index / total;
    const yPos = size + this.yOffset - yParam * size;

    const start = index * segments + this.topStart;
    const radiusT = sin(PI - PI * 0.55 * yParam * 1.8) + log(yParam * 100 + 2) / 3;
    const radius = radiusT * this.ribRadius;

    Geometry.circle(segments, radius, yPos, verts);
    this.ribUvs(yParam, segments, uvs);

    const ribIndices = Links.loop(start, segments, []);
    const outerLen = 2 * PI * radius / segments;
    const outerRib = createDistanceConstraint([outerLen * 0.9, outerLen], ribIndices);

    const innerLen = 2 * PI * radius / 3;
    const innerRib = this.createInnerRib(start, innerLen);

    const isTop = index === 0;
    const isBottom = index === total - 1;
    let spine: ReturnType<typeof createDistanceConstraint> | undefined;
    let radiusSpine: number | undefined;

    if (isTop || isBottom) {
      const spineCenter = isTop ? this.indexTop : this.indexBottom;
      radiusSpine = isTop ? radius * 1.25 : radius;
      spine = createDistanceConstraint(
        [radius * 0.5, radiusSpine],
        Links.radial(spineCenter, start, segments, []),
      );
      this.queueConstraint(spine);
    }

    this.queueConstraint(outerRib, innerRib);

    this.ribs.push({
      start,
      radius,
      radiusSpine,
      yParam,
      yPos,
      outer: outerRib as any,
      inner: innerRib as any,
      spine: spine as any,
    });
  }

  private createInnerRib(start: number, length: number): ReturnType<typeof createDistanceConstraint> {
    const segments = this.totalSegments;
    const indices: number[] = [];
    for (let i = 0; i < this.segmentsCount; i++) {
      const step = floor(segments / 3);
      for (let j = 0; j < 3; j++) {
        const a = i * 3 + step * j;
        const b = i * 3 + step * (j + 1);
        indices.push(start + a % segments, start + b % segments);
      }
    }
    return createDistanceConstraint([length * 0.8, length], indices);
  }

  private ribUvs(sv: number, count: number, buffer: number[]): void {
    for (let i = 1; i < count; i++) {
      const st = i / count;
      const su = (st <= 0.5 ? st : 1 - st) * 2;
      buffer.push(su, sv);
    }
    buffer.push(0, sv);
  }

  private createSkin(r0: number, r1: number): void {
    const segments = this.totalSegments;
    const rib0 = this.ribs[r0]!;
    const rib1 = this.ribs[r1]!;

    const dist = Vec3.distance(this.verts, rib0.start, rib1.start);
    const skin = createDistanceConstraint(
      [dist * 0.5, dist],
      Links.rings(rib0.start, rib1.start, segments, []),
    );

    this.queueConstraint(skin);
    Faces.rings(rib0.start, rib1.start, segments, this.bulbFaces);
  }

  private createTail(): void {
    for (let i = 0; i < this.tailRibsCount; i++) {
      this.createTailRib(i, this.tailRibsCount);
      this.createTailSkin(i - 1, i);
    }
  }

  private createTailRib(index: number, total: number): void {
    const lastRib = this.ribs[this.ribs.length - 1]!;
    const segments = this.totalSegments;
    const verts = this.verts;
    const uvs = this.uvs;
    const size = this.size;
    const yParam = index / total;
    const yPos = lastRib.yPos - yParam * size * 0.8;

    const start = verts.length / 3;
    const radiusT = sin(0.25 * yParam * PI + 0.5 * PI) * (1 - 0.9 * yParam);
    const radius = radiusT * lastRib.radius;
    const radiusOuter = radius + yParam * this.tailRibRadiusFactor;

    Geometry.circle(segments, radius, yPos, verts);
    this.ribUvs(yParam, segments, uvs);

    const mainIndices = Links.loop(start, segments, []);
    const mainLen = 2 * PI * radiusOuter / segments;
    const mainRib = createDistanceConstraint([mainLen * 0.9, mainLen * 1.5], mainIndices);

    const innerLen = 2 * PI * radius / 3;
    const innerRib = this.createInnerRib(start, innerLen);

    let spine: ReturnType<typeof createDistanceConstraint> | undefined;
    if (index === total - 1) {
      spine = createDistanceConstraint(
        [radius * 0.8, radius],
        Links.radial(this.indexMid, start, segments, []),
      );
      this.queueConstraint(spine);
    }

    this.queueConstraint(mainRib, innerRib);

    this.tailRibs.push({
      start,
      yParam: 1 - yParam,
      yPos,
      radius,
      radiusOuter,
      inner: innerRib as any,
      outer: mainRib as any,
      spine: spine as any,
    });
  }

  private createTailSkin(r0: number, r1: number): void {
    const segments = this.totalSegments;
    const rib0 = r0 < 0 ? this.ribs[this.ribs.length - 1]! : this.tailRibs[r0]!;
    const rib1 = this.tailRibs[r1]!;

    const dist = Vec3.distance(this.verts, rib0.start, rib1.start);
    const skin = createDistanceConstraint(
      [dist * 0.5, dist],
      Links.rings(rib0.start, rib1.start, segments, []),
    );

    this.queueConstraint(skin);
    Faces.rings(rib0.start, rib1.start, segments, this.tailFaces);
  }

  private ribAt(index: number): Rib {
    const tailRibs = this.tailRibs;
    return tailRibs[tailRibs.length - index - 1] ??
      this.ribs[this.ribs.length - index + tailRibs.length - 1]!;
  }

  private createMouth(): void {
    this.createMouthArmGroup(1.0, 0, 4, 3);
    this.createMouthArmGroup(0.8, 1, 8, 3, 3);
    this.createMouthArmGroup(0.5, 7, 9, 6);
  }

  private createMouthArmGroup(vScale: number, r0: number, r1: number, count: number, offset?: number): void {
    for (let i = 0; i < count; i++) {
      this.createMouthArm(vScale, r0, r1, i, count, offset);
    }
  }

  private createMouthArm(vScale: number, r0: number, r1: number, index: number, total: number, offset?: number): void {
    const tParam = index / total;
    const verts = this.verts;
    const uvs = this.uvs;
    const startOffset = this.posMid;

    const ribInner = this.ribAt(r0);
    const ribOuter = this.ribAt(r1);
    const ribSegments = this.totalSegments;
    const ribIndex = (round(ribSegments * tParam) + (offset || 0)) % ribSegments;

    const innerPin = ribInner.start + ribIndex;
    const outerPin = ribOuter.start + ribIndex;
    const scale = Vec3.distance(verts, innerPin, outerPin);

    const maxSegments = this.tailArmSegments;
    const segments = round(vScale * maxSegments);
    const innerSize = this.tailArmSegmentLength;
    const outerSize = innerSize * 2.4;
    const bottomPinMax = 20 + (maxSegments - segments) * this.tailArmSegmentLength;

    const innerStart = verts.length / 3;
    const innerEnd = innerStart + segments - 1;
    const outerStart = innerStart + segments;

    const innerIndices = Links.line(innerStart, segments, [innerPin, innerStart]);
    const outerIndices = Links.line(outerStart, segments, [outerPin, outerStart]);

    const linkConstraints: ReturnType<typeof createDistanceConstraint>[] = [];
    const braceIndices: number[] = [];
    const linkIndices: number[] = [];

    const outerAngle = PI * 2 * tParam;
    const baseX = cos(outerAngle);
    const baseZ = sin(outerAngle);

    let linkSize = 0;

    for (let i = 0; i < segments; i++) {
      Geometry.point(0, startOffset - i * innerSize, 0, verts);
      uvs.push(i / (segments - 1), 0);
    }

    for (let i = 0; i < segments; i++) {
      const t = i / (segments - 1);
      const innerIndex = innerStart + i;
      const outerIndex = outerStart + i;

      linkSize = scale *
        (sin(PI_HALF + 10 * t) * 0.25 + 0.75) *
        (sin(PI_HALF + 20 * t) * 0.25 + 0.75) *
        (sin(PI_HALF + 26 * t) * 0.15 + 0.85) *
        (sin(PI_HALF + PI * 0.45 * t));

      Geometry.point(baseX * linkSize, startOffset - i * innerSize, baseZ * linkSize, verts);
      uvs.push(t, 1);

      linkConstraints.push(createDistanceConstraint(linkSize, innerIndex, outerIndex));

      if (i > 10) braceIndices.push(innerIndex - 10, outerIndex);
      if (i > 1) linkIndices.push(innerIndex - 1, outerIndex);
      if (i > 1) Faces.quadDoubleSide(innerIndex - 1, outerIndex - 1, outerIndex, innerIndex, this.mouthFaces);
    }

    const inner = createDistanceConstraint([innerSize * 0.25, innerSize], innerIndices);
    const outer = createDistanceConstraint([outerSize * 0.25, outerSize], outerIndices);
    const brace = createDistanceConstraint([linkSize * 0.5, Infinity], braceIndices);
    const pin = createDistanceConstraint([0, bottomPinMax], [innerEnd, this.pinTail]);

    this.queueConstraint(inner, outer, brace, pin);
    for (const lc of linkConstraints) this.queueConstraint(lc);

    this.queueWeights(innerStart, segments * 2, this.tailArmWeight);
  }

  private createTentaclesGeometry(): void {
    for (let i = 0; i < this.tentacleGroupCount; i++) {
      this.createTentacleGroup(i);
    }
  }

  private createTentacleGroup(groupIndex: number): void {
    const ribIndex = this.tentacleGroupStart + this.tentacleGroupOffset * groupIndex;
    const rib = this.ribAt(ribIndex);
    const ratio = 1 - groupIndex / this.tentacleGroupCount;
    const count = this.tentacleSegments * ratio * 0.25 + this.tentacleSegments * 0.75;

    for (let i = 0; i < count; i++) {
      this.createTentacleSegment(groupIndex, i, count, rib);
      if (i > 0) this.linkTentacle(groupIndex, i - 1, i);
      else this.attachTentacles(groupIndex, rib);
    }
    this.attachTentaclesSpine(groupIndex);
  }

  private createTentacleSegment(groupIndex: number, index: number, total: number, rib: Rib): void {
    const segments = this.totalSegments;
    const verts = this.verts;
    const uvs = this.uvs;

    const radius = rib.radius * (0.25 * sin(index * 0.25) + 0.5);
    const yPos = -index * this.tentacleSegmentLength + this.yOffset;
    const start = verts.length / 3;
    const weight = Math.pow(index / total, 3) * this.tentacleWeightFactor;

    Geometry.circle(segments, radius, yPos, verts);
    for (let i = 0; i < segments; i++) uvs.push(0, 0);
    this.queueWeights(start, segments, weight);

    if (index === 0) this.tentacles.push([]);
    this.tentacles[groupIndex]!.push({ start });
  }

  private attachTentacles(groupIndex: number, rib: Rib): void {
    const tent = this.tentacles[groupIndex]![0]!;
    const segments = this.totalSegments;
    const dist = this.tentacleSegmentLength;

    const tentacle = createDistanceConstraint(
      [dist * 0.5, dist],
      Links.rings(rib.start, tent.start, segments, []),
    );

    this.queueConstraint(tentacle);
  }

  private attachTentaclesSpine(groupIndex: number): void {
    const group = this.tentacles[groupIndex]!;
    const tent = group[group.length - 1]!;
    const segments = this.totalSegments;
    const dist = this.tentacleSegments * this.tentacleSegmentLength;

    const spine = createDistanceConstraint(
      [dist * 0.5, dist],
      Links.radial(this.pinTentacle, tent.start, segments, []),
    );

    this.queueConstraint(spine);
  }

  private linkTentacle(groupIndex: number, i0: number, i1: number): void {
    const segments = this.totalSegments;
    const t0 = this.tentacles[groupIndex]![i0]!;
    const t1 = this.tentacles[groupIndex]![i1]!;
    const dist = this.tentacleSegmentLength;

    const tentacle = createDistanceConstraint(
      [dist * 0.5, dist],
      Links.rings(t0.start, t1.start, segments, []),
    );

    this.queueConstraint(tentacle);
  }

  private queueConstraint(...constraints: (Constraint & { setDistance?: (min: number, max: number) => void })[]): void {
    this.queuedConstraints.push(...constraints);
  }

  private queueWeights(start: number, count: number, weight: number): void {
    const end = start + count;
    while (this.weights.length < end) this.weights.push(1);
    for (let i = start; i < end; i++) this.weights[i] = weight;
  }

  private createSystem(): void {
    const system = this.system = new ParticleSystem(this.verts, 2);

    for (const c of this.queuedConstraints) system.addConstraint(c);
    for (let i = 0; i < this.weights.length; i++) {
      system.weights[i] = this.weights[i]!;
    }

    system.setWeight(this.pinTop, 0);
    system.setWeight(this.pinMid, 0);
    system.setWeight(this.pinBottom, 0);
    system.setWeight(this.pinTail, 0);

    system.addPinConstraint(createPointConstraint([0, this.posTop, 0], this.pinTop));
    system.addPinConstraint(createPointConstraint([0, this.posMid, 0], this.pinMid));
    system.addPinConstraint(createPointConstraint([0, this.posBottom, 0], this.pinBottom));
    system.addPinConstraint(createPointConstraint([0, this.posTail, 0], this.pinTail));
    system.addPinConstraint(createPointConstraint([0, this.posTentacle, 0], this.pinTentacle));
  }

  private createSceneItems(colors: MedusaeColors): void {
    this.position = new BufferAttribute(this.system.positions, 3);

    this.createBulbMesh(colors);
    this.createTailMesh(colors);
    this.createMouthMesh(colors);

    this.item.position.setY(20);
  }

  private createBulbMesh(colors: MedusaeColors): void {
    const geom = new BufferGeometry();
    geom.setAttribute("position", this.position);
    geom.setAttribute("uv", new BufferAttribute(new Float32Array(this.uvs), 2));
    geom.setIndex(new BufferAttribute(new Uint16Array(this.bulbFaces), 1));

    const timeUniform = { value: 0 };
    this.timeUniforms.push(timeUniform);

    const bulbFlash = { value: 0 };
    const faintFlash = { value: 0 };
    this.flashUniforms.push(bulbFlash, faintFlash);

    const bulb = new Mesh(
      geom,
      new ShaderMaterial({
        vertexShader: normalVert,
        fragmentShader: bulbFrag,
        uniforms: {
          diffuse: { value: new Color(colors.hoodPrimary) },
          diffuseB: { value: new Color(colors.hoodSecondary) },
          opacity: { value: 0.75 },
          time: timeUniform,
          flash: bulbFlash,
        },
        transparent: true,
        side: FrontSide,
        depthWrite: true,
      }),
    );
    bulb.scale.multiplyScalar(0.95);
    // Sole click/hover pick target: only the solid bell dome rings a jelly. The
    // faint additive glow halo (bulbFaint, 1.05× scale), the wispy DoubleSide
    // tail, and the long sprawling mouth arms are all excluded — otherwise their
    // near-invisible geometry projects a pick area far larger than the visible
    // bell, so clicks that only graze the halo/tentacles (or land in empty water
    // over a tentacle behind a panel) fire a false Ding.
    bulb.userData.jellyfishPickTarget = true;
    this.item.add(bulb);

    const bulbFaint = new Mesh(
      geom,
      new ShaderMaterial({
        vertexShader: gelVert,
        fragmentShader: gelFrag,
        uniforms: {
          diffuse: { value: new Color(colors.hoodTertiary) },
          opacity: { value: 0.25 },
          flash: faintFlash,
        },
        transparent: true,
        blending: AdditiveBlending,
        // depthTest ON so opaque structures (coral, arches, rocks) occlude the
        // bell's additive glow halo — without it the halo drew over everything
        // and jellyfish read as floating in front of solid geometry. depthWrite
        // stays OFF: an additive glow must not write depth or it occludes what's
        // behind it.
        depthTest: true,
        depthWrite: false,
      }),
    );
    bulbFaint.scale.multiplyScalar(1.05);
    this.item.add(bulbFaint);
  }

  private createTailMesh(colors: MedusaeColors): void {
    const geom = new BufferGeometry();
    geom.setAttribute("position", this.position);
    geom.setAttribute("uv", new BufferAttribute(new Float32Array(this.uvs), 2));
    geom.setIndex(new BufferAttribute(new Uint16Array(this.tailFaces), 1));

    const tail = new Mesh(
      geom,
      new ShaderMaterial({
        vertexShader: normalVert,
        fragmentShader: tailFrag,
        uniforms: {
          diffuse: { value: new Color(colors.bellyPrimary) },
          diffuseB: { value: new Color(colors.bellySecondary) },
          opacity: { value: 0.75 },
          scale: { value: 20 },
        },
        transparent: true,
        side: DoubleSide,
      }),
    );
    tail.scale.multiplyScalar(0.95);
    this.item.add(tail);
  }

  private createMouthMesh(colors: MedusaeColors): void {
    const geom = new BufferGeometry();
    geom.setAttribute("position", this.position);
    geom.setAttribute("uv", new BufferAttribute(new Float32Array(this.uvs), 2));
    geom.setIndex(new BufferAttribute(new Uint16Array(this.mouthFaces), 1));

    const mouth = new Mesh(
      geom,
      new ShaderMaterial({
        vertexShader: normalVert,
        fragmentShader: tailFrag,
        uniforms: {
          diffuse: { value: new Color(colors.mouthPrimary) },
          diffuseB: { value: new Color(colors.mouthSecondary) },
          opacity: { value: 0.65 },
          scale: { value: 3 },
        },
        transparent: true,
        side: DoubleSide,
      }),
    );
    this.item.add(mouth);
  }

  private timePhase(time: number): number {
    return (sin(time * PI - PI * 0.5) + 1) * 0.5;
  }

  /** Bell contracts up to 30% at peak startle, easing back as energy decays. */
  private startleContract(): number {
    return 1 - this.startleEnergy * 0.3;
  }

  private updateRibs(ribs: Rib[], phase: number): void {
    const radiusOffset = 15;
    const segments = this.totalSegments;
    const contract = this.startleContract();

    for (const rib of ribs) {
      const radius = (rib.radius + rib.yParam * phase * radiusOffset) * contract;
      const radiusOuter = ((rib.radiusOuter ?? rib.radius) + rib.yParam * phase * radiusOffset) * contract;
      const radiusSpine = ((rib.radiusSpine ?? rib.radius) + rib.yParam * phase * radiusOffset) * contract;

      if (rib.outer) {
        const outerLen = 2 * PI * radiusOuter / segments;
        rib.outer.setDistance(outerLen * 0.9, outerLen);
      }
      if (rib.inner) {
        const innerLen = 2 * PI * radius / 3;
        rib.inner.setDistance(innerLen * 0.8, innerLen);
      }
      if (rib.spine) {
        rib.spine.setDistance(radius * 0.8, radiusSpine);
      }
    }
  }

  /** Fire a startle: bell flashes, contracts, and (via the swarm) darts away. */
  triggerStartle(): void {
    this.startleEnergy = 1;
  }

  update(delta: number): void {
    const dtSec = delta * 0.001;
    const time = this.animTime += dtSec;
    const phase = this.timePhase(time);

    if (this.startleEnergy > 0) {
      this.startleEnergy = Math.max(0, this.startleEnergy - dtSec / STARTLE_DURATION);
    }

    this.updateRibs(this.ribs, phase);
    this.updateRibs(this.tailRibs, phase);
    this.system.tick(dtSec);

    this.position.needsUpdate = true;

    for (const u of this.timeUniforms) u.value = time;

    // Flash rides an ease-out of startle energy so the bloom peaks instantly on
    // click and tapers smoothly back to dark.
    const flash = this.startleEnergy * this.startleEnergy;
    for (const u of this.flashUniforms) u.value = flash;
  }

  dispose(): void {
    this.item.traverse((child) => {
      if ((child as Mesh).geometry) (child as Mesh).geometry.dispose();
      if ((child as Mesh).material) {
        const mat = (child as Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as ShaderMaterial).dispose();
      }
    });
  }
}
