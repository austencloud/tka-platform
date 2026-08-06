import { BoxGeometry, type Object3D, Quaternion, Vector3 } from "three";
import {
  ParticleInstancePool3D,
  type ParticleInstanceWrite,
} from "../instancing/particle-instance-pool-3d";
import { setRgbFromHex, type MutableRgb } from "../instancing/particle-color";
import { BoundedSourcePath3D } from "../scene-effects/bounded-source-path-3d";
import {
  isTrackedTip,
  type SilkTipSource3D,
} from "../scene-effects/scene-effect-source-3d";
import type { Silk3DParams } from "$lib/shared/effects/translators/webgl3d-types";

const SEGMENT_CAPACITY = 6144;
const PATH_CAPACITY = 320;
const UP = new Vector3(0, 1, 0);
const FALLBACK_SIDE = new Vector3(1, 0, 0);

interface SilkState {
  path: BoundedSourcePath3D;
  params: Silk3DParams;
  lastSeen: number;
  seenEpoch: number;
}

export class SilkRenderer3D {
  private readonly normalPool = new ParticleInstancePool3D({
    capacity: SEGMENT_CAPACITY,
    geometry: new BoxGeometry(1, 1, 1),
    renderOrder: 108,
  });
  private readonly emissivePool = new ParticleInstancePool3D({
    capacity: SEGMENT_CAPACITY,
    geometry: new BoxGeometry(1, 1, 1),
    additive: true,
    renderOrder: 109,
  });
  private readonly states = new Map<number, SilkState>();
  private readonly direction = new Vector3();
  private readonly side = new Vector3();
  private readonly orientation = new Quaternion();
  private readonly body: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly bodyAlt: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly edge: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly edgeAlt: MutableRgb = { red: 1, green: 1, blue: 1 };
  private readonly mixed: MutableRgb = { red: 1, green: 1, blue: 1 };
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
  private epoch = 0;

  initialize(parent: Object3D): void {
    this.normalPool.initialize(parent);
    this.emissivePool.initialize(parent);
  }

  update(sources: readonly SilkTipSource3D[], delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 15);
    this.clock += dt;
    this.epoch++;
    for (const source of sources) {
      if (!isTrackedTip(source.params.trackingMode, source.tipIndex)) continue;
      let state = this.states.get(source.sourceId);
      if (!state) {
        state = {
          path: new BoundedSourcePath3D(PATH_CAPACITY),
          params: source.params,
          lastSeen: this.clock,
          seenEpoch: this.epoch,
        };
        this.states.set(source.sourceId, state);
      }
      state.params = source.params;
      state.lastSeen = this.clock;
      state.seenEpoch = this.epoch;
      state.path.push(source.position, this.clock, source.speed, 0.025);
    }

    this.normalPool.beginFrame();
    this.emissivePool.beginFrame();
    for (const [sourceId, state] of this.states) {
      state.path.trimBefore(this.clock - state.params.lifetimeSeconds);
      this.writeRibbon(state);
      if (
        state.seenEpoch !== this.epoch &&
        state.path.count === 0 &&
        this.clock - state.lastSeen > state.params.lifetimeSeconds
      ) {
        this.states.delete(sourceId);
      }
    }
    this.normalPool.commit();
    this.emissivePool.commit();
  }

  clear(): void {
    this.states.clear();
    this.normalPool.clear();
    this.emissivePool.clear();
  }

  dispose(): void {
    this.normalPool.dispose();
    this.emissivePool.dispose();
  }

  private writeRibbon(state: SilkState): void {
    const { path, params } = state;
    if (path.count < 2) return;
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
    const pool = params.resolvedPalette.emissive
      ? this.emissivePool
      : this.normalPool;
    const segmentCount = Math.min(path.count - 1, params.maxPointsPerTip - 1);

    for (let offset = 0; offset < segmentCount; offset++) {
      const newer = path.indexFromNewest(offset);
      const older = path.indexFromNewest(offset + 1);
      let ax = path.xAt(older);
      let ay = path.yAt(older);
      let az = path.zAt(older);
      let bx = path.xAt(newer);
      let by = path.yAt(newer);
      let bz = path.zAt(newer);
      this.direction.set(bx - ax, by - ay, bz - az);
      const length = this.direction.length();
      if (length < 1e-5) continue;
      this.direction.multiplyScalar(1 / length);
      this.side.crossVectors(this.direction, UP);
      if (this.side.lengthSq() < 1e-6) this.side.copy(FALLBACK_SIDE);
      else this.side.normalize();

      const age = this.clock - path.birthAt(newer);
      const life = Math.min(1, age / params.lifetimeSeconds);
      const flutterPhase = this.clock * 7.5 + offset * 0.72;
      const flutterOffset =
        Math.sin(flutterPhase) * params.flutter * 0.12 * (0.25 + life * 0.75);
      ax += this.side.x * flutterOffset;
      ay += this.side.y * flutterOffset;
      az += this.side.z * flutterOffset;
      const nextFlutter =
        Math.sin(flutterPhase + 0.72) *
        params.flutter *
        0.12 *
        (0.25 + Math.max(0, life - 0.02) * 0.75);
      bx += this.side.x * nextFlutter;
      by += this.side.y * nextFlutter;
      bz += this.side.z * nextFlutter;

      const speedScale = Math.min(
        1,
        path.speedAt(newer) / params.motionReferenceSpeed
      );
      const halfWidth =
        params.baseHalfWidthWorld *
        (0.4 + params.intensity * 0.6) *
        (1 - params.tautness * speedScale * 0.72) *
        (1 - life * 0.45);
      const alpha = params.intensity * Math.pow(1 - life, 0.72);
      const colorMix = params.resolvedPalette.hueShift ? life : 0;

      this.mixColor(this.body, this.bodyAlt, colorMix);
      this.writeBox(
        pool,
        ax,
        ay,
        az,
        bx,
        by,
        bz,
        halfWidth * 2,
        0.018,
        this.mixed,
        alpha
      );
      this.mixColor(this.edge, this.edgeAlt, colorMix);
      const railOffset = halfWidth * 0.88;
      this.writeBox(
        pool,
        ax + this.side.x * railOffset,
        ay + this.side.y * railOffset,
        az + this.side.z * railOffset,
        bx + this.side.x * railOffset,
        by + this.side.y * railOffset,
        bz + this.side.z * railOffset,
        Math.max(0.012, halfWidth * 0.14),
        0.022,
        this.mixed,
        alpha * 0.92
      );
      this.writeBox(
        pool,
        ax - this.side.x * railOffset,
        ay - this.side.y * railOffset,
        az - this.side.z * railOffset,
        bx - this.side.x * railOffset,
        by - this.side.y * railOffset,
        bz - this.side.z * railOffset,
        Math.max(0.012, halfWidth * 0.14),
        0.022,
        this.mixed,
        alpha * 0.92
      );
    }
  }

  private mixColor(a: MutableRgb, b: MutableRgb, amount: number): void {
    this.mixed.red = a.red + (b.red - a.red) * amount;
    this.mixed.green = a.green + (b.green - a.green) * amount;
    this.mixed.blue = a.blue + (b.blue - a.blue) * amount;
  }

  private writeBox(
    pool: ParticleInstancePool3D,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    width: number,
    depth: number,
    color: MutableRgb,
    alpha: number
  ): void {
    this.direction.set(bx - ax, by - ay, bz - az);
    const length = this.direction.length();
    if (length < 1e-5 || alpha < 0.004) return;
    this.direction.multiplyScalar(1 / length);
    this.orientation.setFromUnitVectors(UP, this.direction);
    const write = this.writeState;
    write.x = (ax + bx) * 0.5;
    write.y = (ay + by) * 0.5;
    write.z = (az + bz) * 0.5;
    write.scaleX = width;
    write.scaleY = length;
    write.scaleZ = depth;
    write.quaternionX = this.orientation.x;
    write.quaternionY = this.orientation.y;
    write.quaternionZ = this.orientation.z;
    write.quaternionW = this.orientation.w;
    write.red = color.red;
    write.green = color.green;
    write.blue = color.blue;
    write.alpha = alpha;
    pool.write(write);
  }
}
