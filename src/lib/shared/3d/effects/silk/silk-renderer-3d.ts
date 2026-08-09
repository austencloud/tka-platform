import { Mesh, type Object3D } from "three";
import { BoundedSourcePath3D } from "../scene-effects/bounded-source-path-3d";
import {
  isTrackedTip,
  type SilkTipSource3D,
} from "../scene-effects/scene-effect-source-3d";
import type { Silk3DParams } from "$lib/shared/effects/translators/webgl3d-types";
import {
  SilkRibbonGeometry3D,
  type SilkRibbonFrame3D,
} from "./silk-ribbon-geometry-3d";
import { createSilkRibbonMaterial3D } from "./silk-ribbon-material-3d";

const SAMPLE_CAPACITY = 6144;
const PATH_CAPACITY = 320;

interface SilkState extends SilkRibbonFrame3D {
  path: BoundedSourcePath3D;
  params: Silk3DParams;
  lastSeen: number;
  seenEpoch: number;
}

export class SilkRenderer3D {
  private readonly ribbon = new SilkRibbonGeometry3D(SAMPLE_CAPACITY);
  private readonly fabricMaterial = createSilkRibbonMaterial3D(false);
  private readonly glintMaterial = createSilkRibbonMaterial3D(true);
  private readonly fabricMesh = new Mesh(
    this.ribbon.geometry,
    this.fabricMaterial
  );
  private readonly glintMesh = new Mesh(
    this.ribbon.geometry,
    this.glintMaterial
  );
  private readonly states = new Map<number, SilkState>();
  private parent: Object3D | null = null;
  private clock = 0;
  private epoch = 0;

  constructor() {
    this.fabricMesh.frustumCulled = false;
    this.fabricMesh.renderOrder = 108;
    this.glintMesh.frustumCulled = false;
    this.glintMesh.renderOrder = 109;
  }

  initialize(parent: Object3D): void {
    if (this.parent === parent) return;
    if (this.parent) {
      this.parent.remove(this.fabricMesh);
      this.parent.remove(this.glintMesh);
    }
    this.parent = parent;
    parent.add(this.fabricMesh, this.glintMesh);
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
          headSideX: 1,
          headSideY: 0,
          headSideZ: 0,
          hasHeadSide: false,
        };
        this.states.set(source.sourceId, state);
      }
      state.params = source.params;
      state.lastSeen = this.clock;
      state.seenEpoch = this.epoch;
      state.path.push(source.position, this.clock, source.speed, 0.025);
    }

    this.ribbon.beginFrame();
    for (const [sourceId, state] of this.states) {
      state.path.trimBefore(this.clock - state.params.lifetimeSeconds);
      this.ribbon.writeRibbon(state.path, state.params, this.clock, state);
      if (
        state.seenEpoch !== this.epoch &&
        state.path.count === 0 &&
        this.clock - state.lastSeen > state.params.lifetimeSeconds
      ) {
        this.states.delete(sourceId);
      }
    }
    this.ribbon.commit();
  }

  clear(): void {
    this.states.clear();
    this.ribbon.clear();
  }

  dispose(): void {
    this.clear();
    this.parent?.remove(this.fabricMesh);
    this.parent?.remove(this.glintMesh);
    this.parent = null;
    this.ribbon.dispose();
    this.fabricMaterial.dispose();
    this.glintMaterial.dispose();
  }
}
