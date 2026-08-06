import { Euler, Object3D, PlaneGeometry, Quaternion } from "three";
import {
  pickPetalSprite,
  pickPetalTint,
  rollEmberFlag,
} from "$lib/shared/effects/domain/petal-palettes";
import {
  ParticleInstancePool3D,
  type ParticleInstanceWrite,
} from "../instancing/particle-instance-pool-3d";
import { setRgbFromHex, type MutableRgb } from "../instancing/particle-color";
import {
  isTrackedTip,
  type PetalTipSource3D,
} from "../scene-effects/scene-effect-source-3d";
import {
  getPetalAtlasFrame,
  getPetalTextureAtlas,
} from "./petal-texture-atlas";

const CAPACITY = 2048;
const EMBER_MAX_AGE = 0.4;
const FADE_OUT_FRACTION = 0.2;
const FADE_IN_DURATION = 0.12;

export class PetalPoolRenderer3D {
  private readonly petalPool: ParticleInstancePool3D;
  private readonly emberPool: ParticleInstancePool3D;
  private readonly active = new Uint8Array(CAPACITY);
  private readonly x = new Float32Array(CAPACITY);
  private readonly y = new Float32Array(CAPACITY);
  private readonly z = new Float32Array(CAPACITY);
  private readonly vx = new Float32Array(CAPACITY);
  private readonly vy = new Float32Array(CAPACITY);
  private readonly vz = new Float32Array(CAPACITY);
  private readonly age = new Float32Array(CAPACITY);
  private readonly maxAge = new Float32Array(CAPACITY);
  private readonly size = new Float32Array(CAPACITY);
  private readonly rotationX = new Float32Array(CAPACITY);
  private readonly rotationY = new Float32Array(CAPACITY);
  private readonly rotationZ = new Float32Array(CAPACITY);
  private readonly rotationVelocityX = new Float32Array(CAPACITY);
  private readonly rotationVelocityY = new Float32Array(CAPACITY);
  private readonly rotationVelocityZ = new Float32Array(CAPACITY);
  private readonly phase = new Float32Array(CAPACITY);
  private readonly swayFrequency = new Float32Array(CAPACITY);
  private readonly swaySpeed = new Float32Array(CAPACITY);
  private readonly red = new Float32Array(CAPACITY);
  private readonly green = new Float32Array(CAPACITY);
  private readonly blue = new Float32Array(CAPACITY);
  private readonly ember = new Uint8Array(CAPACITY);
  private readonly emberRed = new Float32Array(CAPACITY);
  private readonly emberGreen = new Float32Array(CAPACITY);
  private readonly emberBlue = new Float32Array(CAPACITY);
  private readonly uvX = new Float32Array(CAPACITY);
  private readonly uvY = new Float32Array(CAPACITY);
  private readonly uvWidth = new Float32Array(CAPACITY);
  private readonly uvHeight = new Float32Array(CAPACITY);
  private readonly accumulators = new Map<number, number>();
  private readonly euler = new Euler();
  private readonly quaternion = new Quaternion();
  private readonly color: MutableRgb = { red: 1, green: 1, blue: 1 };
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
  private cursor = 0;
  private ambientAccumulator = 0;
  private clock = 0;

  constructor() {
    const atlas = getPetalTextureAtlas();
    this.petalPool = new ParticleInstancePool3D({
      capacity: CAPACITY,
      geometry: new PlaneGeometry(1, 1),
      texture: atlas,
      renderOrder: 103,
    });
    this.emberPool = new ParticleInstancePool3D({
      capacity: CAPACITY,
      geometry: new PlaneGeometry(1, 1),
      texture: atlas,
      additive: true,
      renderOrder: 102,
    });
  }

  initialize(parent: Object3D): void {
    this.petalPool.initialize(parent);
    this.emberPool.initialize(parent);
  }

  update(sources: readonly PetalTipSource3D[], delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 15);
    this.clock += dt;
    for (const source of sources) {
      if (isTrackedTip(source.params.trackingMode, source.tipIndex))
        this.emitMotion(source, dt);
    }
    if (sources.length > 0) this.emitAmbient(sources, dt);

    this.petalPool.beginFrame();
    this.emberPool.beginFrame();
    for (let index = 0; index < CAPACITY; index++) {
      if (this.active[index] === 0) continue;
      this.age[index]! += dt;
      if (this.age[index]! >= this.maxAge[index]!) {
        this.active[index] = 0;
        continue;
      }
      const oscillation = this.clock * this.swayFrequency[index]! * Math.PI * 2;
      const swayX =
        Math.sin(this.phase[index]! + oscillation) * this.swaySpeed[index]!;
      const swayZ =
        Math.cos(this.phase[index]! * 1.3 + oscillation) *
        this.swaySpeed[index]! *
        0.5;
      this.x[index]! += (this.vx[index]! + swayX) * dt;
      this.y[index]! += this.vy[index]! * dt;
      this.z[index]! += (this.vz[index]! + swayZ) * dt;
      this.rotationX[index]! += this.rotationVelocityX[index]! * dt;
      this.rotationY[index]! += this.rotationVelocityY[index]! * dt;
      this.rotationZ[index]! += this.rotationVelocityZ[index]! * dt;
      this.euler.set(
        this.rotationX[index]!,
        this.rotationY[index]!,
        this.rotationZ[index]!
      );
      this.quaternion.setFromEuler(this.euler);

      const life = this.age[index]! / this.maxAge[index]!;
      const fadeIn =
        this.age[index]! < FADE_IN_DURATION
          ? this.age[index]! / FADE_IN_DURATION
          : 1;
      const fadeOut =
        life > 1 - FADE_OUT_FRACTION ? (1 - life) / FADE_OUT_FRACTION : 1;
      const write = this.writeState;
      write.x = this.x[index]!;
      write.y = this.y[index]!;
      write.z = this.z[index]!;
      write.scaleX = this.size[index]! * 2;
      write.scaleY = this.size[index]! * 2;
      write.scaleZ = 1;
      write.quaternionX = this.quaternion.x;
      write.quaternionY = this.quaternion.y;
      write.quaternionZ = this.quaternion.z;
      write.quaternionW = this.quaternion.w;
      write.red = this.red[index]!;
      write.green = this.green[index]!;
      write.blue = this.blue[index]!;
      write.alpha = Math.max(0, fadeIn * fadeOut);
      write.uvX = this.uvX[index]!;
      write.uvY = this.uvY[index]!;
      write.uvWidth = this.uvWidth[index]!;
      write.uvHeight = this.uvHeight[index]!;
      this.petalPool.write(write);

      if (this.ember[index] === 1 && this.age[index]! < EMBER_MAX_AGE) {
        write.scaleX = this.size[index]! * 2.2;
        write.scaleY = this.size[index]! * 2.2;
        write.red = this.emberRed[index]!;
        write.green = this.emberGreen[index]!;
        write.blue = this.emberBlue[index]!;
        write.alpha = (1 - this.age[index]! / EMBER_MAX_AGE) * 0.54;
        this.emberPool.write(write);
      }
    }
    this.petalPool.commit();
    this.emberPool.commit();
  }

  clear(): void {
    this.active.fill(0);
    this.accumulators.clear();
    this.ambientAccumulator = 0;
    this.petalPool.clear();
    this.emberPool.clear();
  }

  dispose(): void {
    this.petalPool.dispose();
    this.emberPool.dispose();
  }

  private emitMotion(source: PetalTipSource3D, dt: number): void {
    const params = source.params;
    const speedScalar =
      params.motionReferenceSpeed > 0
        ? Math.min(1, source.speed / params.motionReferenceSpeed)
        : 0;
    const rate = params.motionEmission * speedScalar * params.motionTipRate;
    let accumulator = (this.accumulators.get(source.sourceId) ?? 0) + dt * rate;
    while (accumulator >= 1) {
      if (
        !this.spawn(
          source,
          source.position.x,
          source.position.y,
          source.position.z,
          false
        )
      )
        break;
      accumulator -= 1;
    }
    this.accumulators.set(source.sourceId, accumulator);
  }

  private emitAmbient(sources: readonly PetalTipSource3D[], dt: number): void {
    const params = sources[0]!.params;
    this.ambientAccumulator +=
      dt * params.ambientEmission * params.ambientAboveRate;
    let centerX = 0;
    let centerY = 0;
    let centerZ = 0;
    for (const source of sources) {
      centerX += source.position.x;
      centerY += source.position.y;
      centerZ += source.position.z;
    }
    centerX /= sources.length;
    centerY /= sources.length;
    centerZ /= sources.length;
    while (this.ambientAccumulator >= 1) {
      const source = sources[0]!;
      const x = centerX + (Math.random() - 0.5) * 4;
      const y = centerY + 3 + Math.random() * 0.5;
      const z = centerZ + (Math.random() - 0.5) * 4;
      if (!this.spawn(source, x, y, z, true)) break;
      this.ambientAccumulator -= 1;
    }
  }

  private spawn(
    source: PetalTipSource3D,
    x: number,
    y: number,
    z: number,
    ambient: boolean
  ): boolean {
    const slot = this.takeSlot();
    if (slot < 0) return false;
    const params = source.params;
    const palette = params.resolvedPalette;
    const shape = pickPetalSprite(palette);
    const frame = getPetalAtlasFrame(shape);
    const baseSize = params.baseSize * (0.7 + 0.9 * params.intensity);
    const fall = params.fallBaseSpeed * (0.3 + 0.7 * params.fallSpeed);
    this.active[slot] = 1;
    this.x[slot] = ambient ? x : x + (Math.random() - 0.5) * 0.08;
    this.y[slot] = ambient ? y : y + (Math.random() - 0.5) * 0.06;
    this.z[slot] = ambient ? z : z + (Math.random() - 0.5) * 0.08;
    this.vx[slot] = (Math.random() - 0.5) * (ambient ? 0.25 : 0.3);
    this.vy[slot] = -fall * (0.8 + Math.random() * 0.4);
    this.vz[slot] = (Math.random() - 0.5) * (ambient ? 0.25 : 0.3);
    this.age[slot] = 0;
    this.maxAge[slot] = params.lifetime * (0.8 + Math.random() * 0.4);
    this.size[slot] = baseSize * (0.7 + Math.random() * 0.6);
    this.rotationVelocityX[slot] = (Math.random() - 0.5) * 2;
    this.rotationVelocityY[slot] = (Math.random() - 0.5) * 2.5;
    this.rotationVelocityZ[slot] = (Math.random() - 0.5) * 2;
    this.rotationX[slot] = Math.random() * Math.PI * 2;
    this.rotationY[slot] = Math.random() * Math.PI * 2;
    this.rotationZ[slot] = Math.random() * Math.PI * 2;
    this.phase[slot] = Math.random() * Math.PI * 2;
    this.swayFrequency[slot] = params.swayFrequency;
    this.swaySpeed[slot] = params.swayBaseSpeed * params.swayAmplitude;
    setRgbFromHex(this.color, pickPetalTint(palette));
    this.red[slot] = this.color.red;
    this.green[slot] = this.color.green;
    this.blue[slot] = this.color.blue;
    this.ember[slot] = rollEmberFlag(palette) ? 1 : 0;
    setRgbFromHex(this.color, palette.emberEdge?.color ?? "#ff6020");
    this.emberRed[slot] = this.color.red;
    this.emberGreen[slot] = this.color.green;
    this.emberBlue[slot] = this.color.blue;
    this.uvX[slot] = frame.x;
    this.uvY[slot] = frame.y;
    this.uvWidth[slot] = frame.width;
    this.uvHeight[slot] = frame.height;
    return true;
  }

  private takeSlot(): number {
    for (let offset = 0; offset < CAPACITY; offset++) {
      const index = (this.cursor + offset) % CAPACITY;
      if (this.active[index] === 0) {
        this.cursor = (index + 1) % CAPACITY;
        return index;
      }
    }
    return -1;
  }
}
