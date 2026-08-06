import { CircleGeometry, type Object3D, RingGeometry } from "three";
import {
  ParticleInstancePool3D,
  type ParticleInstanceWrite,
} from "../instancing/particle-instance-pool-3d";
import {
  setRgbFromHex,
  setRgbFromHsl,
  type MutableRgb,
} from "../instancing/particle-color";
import {
  isTrackedTip,
  type PulseTipSource3D,
} from "../scene-effects/scene-effect-source-3d";

const RING_CAPACITY = 512;
const INSTANCE_CAPACITY = 4096;
const HARMONIC_SPACING = 0.085;

export class PulseRenderer3D {
  private readonly ringPool = new ParticleInstancePool3D({
    capacity: INSTANCE_CAPACITY,
    geometry: new RingGeometry(0.86, 1, 48),
    billboard: true,
    additive: true,
    renderOrder: 118,
  });
  private readonly glowPool = new ParticleInstancePool3D({
    capacity: INSTANCE_CAPACITY,
    geometry: new CircleGeometry(1, 48),
    billboard: true,
    additive: true,
    renderOrder: 117,
  });
  private readonly active = new Uint8Array(RING_CAPACITY);
  private readonly x = new Float32Array(RING_CAPACITY);
  private readonly y = new Float32Array(RING_CAPACITY);
  private readonly z = new Float32Array(RING_CAPACITY);
  private readonly age = new Float32Array(RING_CAPACITY);
  private readonly lifetime = new Float32Array(RING_CAPACITY);
  private readonly maxRadius = new Float32Array(RING_CAPACITY);
  private readonly energy = new Float32Array(RING_CAPACITY);
  private readonly amplitude = new Float32Array(RING_CAPACITY);
  private readonly intensity = new Float32Array(RING_CAPACITY);
  private readonly velocityScale = new Float32Array(RING_CAPACITY);
  private readonly asymmetry = new Float32Array(RING_CAPACITY);
  private readonly chromatic = new Float32Array(RING_CAPACITY);
  private readonly flash = new Float32Array(RING_CAPACITY);
  private readonly thickness = new Float32Array(RING_CAPACITY);
  private readonly glowStyle = new Uint8Array(RING_CAPACITY);
  private readonly red = new Float32Array(RING_CAPACITY);
  private readonly green = new Float32Array(RING_CAPACITY);
  private readonly blue = new Float32Array(RING_CAPACITY);
  private readonly fadeRed = new Float32Array(RING_CAPACITY);
  private readonly fadeGreen = new Float32Array(RING_CAPACITY);
  private readonly fadeBlue = new Float32Array(RING_CAPACITY);
  private readonly hueShift = new Uint8Array(RING_CAPACITY);
  private readonly lastBeatIndex = new Map<number, number>();
  private readonly lastSpawn = new Map<number, number>();
  private readonly color: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly fadeColor: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly writeState: ParticleInstanceWrite = {
    x: 0,
    y: 0,
    z: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    red: 1,
    green: 1,
    blue: 1,
    alpha: 1,
  };
  private clock = 0;
  private cursor = 0;
  private frameIntensityScale = 1;

  initialize(parent: Object3D): void {
    this.ringPool.initialize(parent);
    this.glowPool.initialize(parent);
  }

  update(sources: readonly PulseTipSource3D[], delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 15);
    this.clock += dt;
    this.frameIntensityScale = 1 / Math.sqrt(Math.max(1, sources.length / 2));
    for (const source of sources) {
      if (!isTrackedTip(source.params.trackingMode, source.tipIndex)) continue;
      this.checkTrigger(source);
    }

    this.ringPool.beginFrame();
    this.glowPool.beginFrame();
    for (let index = 0; index < RING_CAPACITY; index++) {
      if (this.active[index] === 0) continue;
      this.age[index]! += dt;
      if (this.age[index]! < 0) continue;
      if (this.age[index]! >= this.lifetime[index]!) {
        this.active[index] = 0;
        continue;
      }
      this.writeRing(index);
    }
    this.glowPool.commit();
    this.ringPool.commit();
  }

  clear(): void {
    this.active.fill(0);
    this.lastBeatIndex.clear();
    this.lastSpawn.clear();
    this.ringPool.clear();
    this.glowPool.clear();
  }

  dispose(): void {
    this.ringPool.dispose();
    this.glowPool.dispose();
  }

  private checkTrigger(source: PulseTipSource3D): void {
    const params = source.params;
    let shouldTrigger = false;
    if (params.trigger === "beat") {
      const beatIndex = Math.floor(source.currentStep / params.beatInterval);
      const previous = this.lastBeatIndex.get(source.sourceId) ?? -1;
      if (beatIndex !== previous) {
        this.lastBeatIndex.set(source.sourceId, beatIndex);
        shouldTrigger = true;
      }
    } else if (params.trigger === "velocity") {
      const threshold = params.velocityThreshold * params.motionReferenceSpeed;
      const previous = this.lastSpawn.get(source.sourceId) ?? -Infinity;
      if (source.speed > threshold && this.clock - previous > 0.1) {
        shouldTrigger = true;
      }
    } else {
      const normalizedSpeed = Math.min(
        2,
        source.speed / params.motionReferenceSpeed
      );
      const interval = 1 / (3 * (1 + normalizedSpeed));
      const previous = this.lastSpawn.get(source.sourceId) ?? -Infinity;
      if (this.clock - previous > interval) shouldTrigger = true;
    }
    if (!shouldTrigger) return;
    this.lastSpawn.set(source.sourceId, this.clock);
    this.resolveColor(source);
    const energy = Math.min(1, source.speed / params.motionReferenceSpeed);
    const harmonics = Math.round(params.harmonics * 3);
    for (let harmonic = 0; harmonic <= harmonics; harmonic++) {
      this.spawn(source, energy, harmonic);
    }
  }

  private resolveColor(source: PulseTipSource3D): void {
    const params = source.params;
    if (params.colorMode === "rainbow") {
      setRgbFromHsl(
        this.color,
        this.clock * 90 + source.sourceId * 53,
        0.88,
        0.62
      );
    } else if (params.colorMode === "prop-matched") {
      setRgbFromHex(this.color, source.propColor);
    } else if (params.colorMode === "solid") {
      setRgbFromHex(this.color, params.color);
    } else if (
      params.colorMode === "palette" &&
      params.colorPalette.length > 0
    ) {
      const index =
        Math.abs(Math.floor(this.clock * 7 + source.sourceId)) %
        params.colorPalette.length;
      setRgbFromHex(this.color, params.colorPalette[index]!);
    } else {
      setRgbFromHex(this.color, params.resolvedPalette.ring);
    }
    setRgbFromHex(this.fadeColor, params.resolvedPalette.fade);
  }

  private spawn(
    source: PulseTipSource3D,
    energy: number,
    harmonic: number
  ): void {
    const slot = this.takeSlot(source.params.poolSize);
    const amplitude = Math.max(0.1, 1 - harmonic * 0.22);
    this.active[slot] = 1;
    this.x[slot] = source.position.x;
    this.y[slot] = source.position.y;
    this.z[slot] = source.position.z;
    this.age[slot] = -harmonic * HARMONIC_SPACING;
    this.lifetime[slot] = source.params.lifetime;
    this.maxRadius[slot] = source.params.maxRadiusWorld;
    this.energy[slot] = energy;
    this.amplitude[slot] = amplitude;
    this.intensity[slot] = source.params.intensity * this.frameIntensityScale;
    this.velocityScale[slot] = source.params.velocityScale;
    this.asymmetry[slot] = source.params.asymmetry;
    this.chromatic[slot] = source.params.chromatic;
    this.flash[slot] = source.params.flash;
    this.thickness[slot] = source.params.ringThicknessRatio;
    this.glowStyle[slot] = source.params.style === "glow" ? 1 : 0;
    this.red[slot] = this.color.red;
    this.green[slot] = this.color.green;
    this.blue[slot] = this.color.blue;
    this.fadeRed[slot] = this.fadeColor.red;
    this.fadeGreen[slot] = this.fadeColor.green;
    this.fadeBlue[slot] = this.fadeColor.blue;
    this.hueShift[slot] = source.params.resolvedPalette.hueShift ? 1 : 0;
  }

  private writeRing(index: number): void {
    const progress = this.age[index]! / this.lifetime[index]!;
    const eased = 1 - Math.pow(1 - progress, 3);
    const energy = this.energy[index]!;
    const radius =
      this.maxRadius[index]! *
      (0.45 + 0.55 * this.velocityScale[index]! * energy) *
      this.amplitude[index]! *
      eased;
    if (radius < 0.008) return;
    const falloff = Math.pow(1 - progress, 2);
    const alpha =
      this.intensity[index]! *
      (0.45 + 0.55 * energy) *
      falloff *
      this.amplitude[index]!;
    const colorMix = this.hueShift[index] === 1 ? progress : progress * 0.35;
    const red =
      this.red[index]! + (this.fadeRed[index]! - this.red[index]!) * colorMix;
    const green =
      this.green[index]! +
      (this.fadeGreen[index]! - this.green[index]!) * colorMix;
    const blue =
      this.blue[index]! +
      (this.fadeBlue[index]! - this.blue[index]!) * colorMix;
    const deformation = this.asymmetry[index]! * (0.2 + 0.3 * energy);
    const scaleX = radius * (1 + deformation * 0.55);
    const scaleY = radius * (1 - deformation * 0.18);
    const normalizedThickness = Math.min(
      1,
      Math.max(0, (this.thickness[index]! - 0.035) / 0.215)
    );
    const copies = 1 + Math.round(normalizedThickness * 3);
    for (let copy = 0; copy < copies; copy++) {
      const inset = 1 - copy * 0.035;
      this.writeInstance(
        this.ringPool,
        index,
        scaleX * inset,
        scaleY * inset,
        red,
        green,
        blue,
        alpha / Math.sqrt(copies),
        0
      );
    }

    const fringe = this.chromatic[index]! * energy;
    if (fringe > 0.04) {
      const offset = radius * fringe * 0.028;
      this.writeInstance(
        this.ringPool,
        index,
        scaleX,
        scaleY,
        1,
        0.12,
        0.08,
        alpha * fringe * 0.45,
        offset
      );
      this.writeInstance(
        this.ringPool,
        index,
        scaleX,
        scaleY,
        0.08,
        0.55,
        1,
        alpha * fringe * 0.45,
        -offset
      );
    }

    const flashAlpha =
      this.flash[index]! * alpha * Math.pow(Math.max(0, 1 - progress * 5), 2);
    if (this.glowStyle[index] === 1 || flashAlpha > 0.004) {
      const glowScale =
        this.glowStyle[index] === 1 ? radius * 0.94 : radius * 0.38;
      this.writeInstance(
        this.glowPool,
        index,
        glowScale,
        glowScale,
        red,
        green,
        blue,
        this.glowStyle[index] === 1 ? alpha * 0.09 : flashAlpha * 0.5,
        0
      );
    }
  }

  private writeInstance(
    pool: ParticleInstancePool3D,
    index: number,
    scaleX: number,
    scaleY: number,
    red: number,
    green: number,
    blue: number,
    alpha: number,
    xOffset: number
  ): void {
    const write = this.writeState;
    write.x = this.x[index]! + xOffset;
    write.y = this.y[index]!;
    write.z = this.z[index]!;
    write.scaleX = scaleX;
    write.scaleY = scaleY;
    write.scaleZ = 1;
    write.red = red;
    write.green = green;
    write.blue = blue;
    write.alpha = alpha;
    pool.write(write);
  }

  private takeSlot(limit: number): number {
    const capacity = Math.max(1, Math.min(RING_CAPACITY, limit));
    for (let offset = 0; offset < capacity; offset++) {
      const index = (this.cursor + offset) % capacity;
      if (this.active[index] === 0) {
        this.cursor = (index + 1) % capacity;
        return index;
      }
    }
    const index = this.cursor % capacity;
    this.cursor = (index + 1) % capacity;
    return index;
  }
}
