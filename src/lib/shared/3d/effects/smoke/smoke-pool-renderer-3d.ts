import { PlaneGeometry, type Object3D } from "three";
import {
  ParticleInstancePool3D,
  type ParticleInstanceWrite,
} from "../instancing/particle-instance-pool-3d";
import {
  isTrackedTip,
  type SmokeTipSource3D,
} from "../scene-effects/scene-effect-source-3d";
import { SampledCurlGrid2D } from "./smoke-curl-field";
import {
  getSmokeAtlasFrame,
  getSmokeTextureAtlas,
  SMOKE_ATLAS_FRAME_COUNT,
} from "./smoke-texture-atlas";

const CAPACITY = 2048;
const FADE_OUT_FRACTION = 0.3;
const FADE_IN_DURATION = 0.15;
const CURL_BASE_METRES_PER_SECOND = 1.2;

export class SmokePoolRenderer3D {
  private readonly pool: ParticleInstancePool3D;
  private readonly active = new Uint8Array(CAPACITY);
  private readonly x = new Float32Array(CAPACITY);
  private readonly y = new Float32Array(CAPACITY);
  private readonly z = new Float32Array(CAPACITY);
  private readonly vx = new Float32Array(CAPACITY);
  private readonly vy = new Float32Array(CAPACITY);
  private readonly vz = new Float32Array(CAPACITY);
  private readonly age = new Float32Array(CAPACITY);
  private readonly maxAge = new Float32Array(CAPACITY);
  private readonly radiusStart = new Float32Array(CAPACITY);
  private readonly radiusEnd = new Float32Array(CAPACITY);
  private readonly phase = new Float32Array(CAPACITY);
  private readonly peakAlpha = new Float32Array(CAPACITY);
  private readonly curlStrength = new Float32Array(CAPACITY);
  private readonly curlScale = new Float32Array(CAPACITY);
  private readonly uvX = new Float32Array(CAPACITY);
  private readonly uvWidth = new Float32Array(CAPACITY);
  private readonly accumulators = new Map<number, number>();
  private readonly curlField = new SampledCurlGrid2D(64, 16, 1 / 3);
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
  private clock = 0;

  constructor() {
    const texture = getSmokeTextureAtlas();
    this.pool = new ParticleInstancePool3D({
      capacity: CAPACITY,
      geometry: new PlaneGeometry(1, 1),
      billboard: true,
      texture,
      renderOrder: 101,
      nearFadeStart: 0.08,
      nearFadeEnd: 0.3,
      farFadeStart: 12,
      farFadeEnd: 28,
      farFadeOpacity: 0.68,
      farSoftness: 0.45,
      fog: true,
      colorManaged: true,
      contrastAdaptation: {
        backdropLuminance: 0.18,
        minimumSurfaceLuminance: 0.12,
        maximumSurfaceLuminance: 0.66,
        strength: 0.48,
        edgeStrength: 0.42,
      },
    });
  }

  initialize(parent: Object3D): void {
    this.pool.initialize(parent);
  }

  update(sources: readonly SmokeTipSource3D[], delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 15);
    this.clock += dt;
    for (const source of sources) {
      if (isTrackedTip(source.params.trackingMode, source.tipIndex))
        this.emit(source, dt);
    }

    this.pool.beginFrame();
    for (let index = 0; index < CAPACITY; index++) {
      if (this.active[index] === 0) continue;
      this.age[index]! += dt;
      if (this.age[index]! >= this.maxAge[index]!) {
        this.active[index] = 0;
        continue;
      }
      const curl = this.curlField.sample(
        this.x[index]! * this.curlScale[index]! + this.phase[index]!,
        this.z[index]! * this.curlScale[index]!,
        this.clock
      );
      const curlX =
        curl.vx * this.curlStrength[index]! * CURL_BASE_METRES_PER_SECOND;
      const curlZ =
        curl.vy * this.curlStrength[index]! * CURL_BASE_METRES_PER_SECOND;
      this.x[index]! += (this.vx[index]! + curlX) * dt;
      this.y[index]! += this.vy[index]! * dt;
      this.z[index]! += (this.vz[index]! + curlZ) * dt;
      const drag = Math.pow(0.4, dt);
      this.vx[index]! *= drag;
      this.vz[index]! *= drag;

      const life = this.age[index]! / this.maxAge[index]!;
      const fadeIn =
        this.age[index]! < FADE_IN_DURATION
          ? this.age[index]! / FADE_IN_DURATION
          : 1;
      const fadeOut =
        life > 1 - FADE_OUT_FRACTION ? (1 - life) / FADE_OUT_FRACTION : 1;
      const radius =
        this.radiusStart[index]! +
        (this.radiusEnd[index]! - this.radiusStart[index]!) * life;

      const write = this.writeState;
      write.x = this.x[index]!;
      write.y = this.y[index]!;
      write.z = this.z[index]!;
      write.scaleX = radius * 2 * (1.08 + Math.sin(this.phase[index]!) * 0.12);
      write.scaleY = radius * 2 * (1.2 + life * 0.28);
      write.scaleZ = 1;
      write.red = 1;
      write.green = 1;
      write.blue = 1;
      write.alpha = Math.max(0, fadeIn * fadeOut * this.peakAlpha[index]!);
      write.uvX = this.uvX[index]!;
      write.uvY =
        Math.min(
          SMOKE_ATLAS_FRAME_COUNT - 1,
          Math.floor(life * SMOKE_ATLAS_FRAME_COUNT)
        ) / SMOKE_ATLAS_FRAME_COUNT;
      write.uvWidth = this.uvWidth[index]!;
      write.uvHeight = 1 / SMOKE_ATLAS_FRAME_COUNT;
      this.pool.write(write);
    }
    this.pool.commit();
  }

  clear(): void {
    this.active.fill(0);
    this.accumulators.clear();
    this.pool.clear();
  }

  dispose(): void {
    this.pool.dispose();
  }

  private emit(source: SmokeTipSource3D, dt: number): void {
    const params = source.params;
    const atlasFrame = getSmokeAtlasFrame(params.resolvedPalette);
    if (!atlasFrame) return;
    const speedScalar =
      params.motionReferenceSpeed > 0
        ? Math.min(1, source.speed / params.motionReferenceSpeed)
        : 0;
    const rate =
      params.ambientEmission * params.ambientSpawnRate +
      params.motionEmission * speedScalar * params.motionSpawnRate;
    let accumulator = (this.accumulators.get(source.sourceId) ?? 0) + dt * rate;
    const baseRadius = params.baseRadius * (0.7 + 0.9 * params.intensity);
    while (accumulator >= 1) {
      const slot = this.takeSlot();
      if (slot < 0) break;
      const radius = baseRadius * (0.8 + Math.random() * 0.4);
      this.active[slot] = 1;
      this.x[slot] = source.position.x + (Math.random() - 0.5) * 0.06;
      this.y[slot] = source.position.y + (Math.random() - 0.5) * 0.04;
      this.z[slot] = source.position.z + (Math.random() - 0.5) * 0.06;
      this.vx[slot] = (Math.random() - 0.5) * 0.08;
      this.vy[slot] = params.resolvedRiseSpeed * (0.85 + Math.random() * 0.3);
      this.vz[slot] = (Math.random() - 0.5) * 0.08;
      this.age[slot] = 0;
      this.maxAge[slot] = params.lifetimeSeconds * (0.8 + Math.random() * 0.4);
      this.radiusStart[slot] = radius;
      this.radiusEnd[slot] = radius * 3 * (0.8 + Math.random() * 0.4);
      this.phase[slot] = Math.random() * Math.PI * 2;
      this.peakAlpha[slot] = 0.25 + 0.45 * params.intensity;
      this.curlStrength[slot] = params.resolvedCurlStrength;
      this.curlScale[slot] = 1 / Math.max(1e-3, params.noiseScale);
      this.uvX[slot] = atlasFrame.x;
      this.uvWidth[slot] = atlasFrame.width;
      accumulator -= 1;
    }
    this.accumulators.set(source.sourceId, accumulator);
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
