import {
  BoxGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  type Object3D,
} from "three";
import { QualityTier } from "../types";
import type { SmokeTipSource3D } from "../scene-effects/scene-effect-source-3d";
import { createSmokeVolumeMaterial3D } from "./smoke-volume-material-3d";
import {
  SMOKE_VOLUME_MAX_BRICKS,
  SmokeVolumeSolver3D,
  type SmokeVolumeDebugSnapshot3D,
} from "./smoke-volume-solver-3d";

export interface SmokeVolumeRendererDiagnostic3D extends SmokeVolumeDebugSnapshot3D {
  sourceCount: number;
  raySteps: number;
  simulationCpuMs: number;
}

export function resolveSmokeVolumeRaySteps3D(
  sources: readonly SmokeTipSource3D[]
): 24 | 28 | 40 | 56 {
  const performerCount = new Set(
    sources.map((source) => Math.floor(Math.max(0, source.sourceId - 1) / 4))
  ).size;
  const highTier = sources.some(
    (source) => source.qualityTier === QualityTier.HIGH
  );
  if (performerCount > 4) return highTier ? 28 : 24;
  return highTier ? 56 : 40;
}

function makeInstancedGeometry(): {
  geometry: InstancedBufferGeometry;
  center: InstancedBufferAttribute;
  halfExtent: InstancedBufferAttribute;
  atlasOffset: InstancedBufferAttribute;
  coreColor: InstancedBufferAttribute;
  edgeColor: InstancedBufferAttribute;
  optics: InstancedBufferAttribute;
  detail: InstancedBufferAttribute;
} {
  const box = new BoxGeometry(1, 1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = box.index;
  for (const [name, attribute] of Object.entries(box.attributes))
    geometry.setAttribute(name, attribute);
  const center = new InstancedBufferAttribute(
    new Float32Array(SMOKE_VOLUME_MAX_BRICKS * 3),
    3
  );
  const halfExtent = new InstancedBufferAttribute(
    new Float32Array(SMOKE_VOLUME_MAX_BRICKS * 3),
    3
  );
  const atlasOffset = new InstancedBufferAttribute(
    new Float32Array(SMOKE_VOLUME_MAX_BRICKS * 3),
    3
  );
  const coreColor = new InstancedBufferAttribute(
    new Float32Array(SMOKE_VOLUME_MAX_BRICKS * 3),
    3
  );
  const edgeColor = new InstancedBufferAttribute(
    new Float32Array(SMOKE_VOLUME_MAX_BRICKS * 3),
    3
  );
  const optics = new InstancedBufferAttribute(
    new Float32Array(SMOKE_VOLUME_MAX_BRICKS * 4),
    4
  );
  const detail = new InstancedBufferAttribute(
    new Float32Array(SMOKE_VOLUME_MAX_BRICKS * 3),
    3
  );
  geometry.setAttribute("aCenter", center);
  geometry.setAttribute("aHalfExtent", halfExtent);
  geometry.setAttribute("aAtlasOffset", atlasOffset);
  geometry.setAttribute("aCoreColor", coreColor);
  geometry.setAttribute("aEdgeColor", edgeColor);
  geometry.setAttribute("aOptics", optics);
  geometry.setAttribute("aDetail", detail);
  geometry.instanceCount = 0;
  box.dispose();
  return {
    geometry,
    center,
    halfExtent,
    atlasOffset,
    coreColor,
    edgeColor,
    optics,
    detail,
  };
}

/** One density atlas and one raymarch draw for every active Smoke performer. */
export class SmokeVolumeRenderer3D {
  private static readonly diagnosticListeners = new Set<
    (snapshot: SmokeVolumeRendererDiagnostic3D) => void
  >();
  private readonly solver = new SmokeVolumeSolver3D();
  private readonly geometryState = makeInstancedGeometry();
  private readonly material = createSmokeVolumeMaterial3D(this.solver.texture);
  private readonly mesh = new Mesh(this.geometryState.geometry, this.material);
  private readonly color = new Color();
  private parent: Object3D | null = null;
  private clock = 0;

  static observeDiagnostics(
    listener: (snapshot: SmokeVolumeRendererDiagnostic3D) => void
  ): () => void {
    this.diagnosticListeners.add(listener);
    return () => this.diagnosticListeners.delete(listener);
  }

  constructor() {
    this.mesh.name = "smoke-volume-renderer-3d";
    this.mesh.renderOrder = 101;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  initialize(parent: Object3D): void {
    if (this.parent === parent) return;
    if (this.parent) this.parent.remove(this.mesh);
    this.parent = parent;
    parent.add(this.mesh);
  }

  update(sources: readonly SmokeTipSource3D[], delta: number): void {
    const startedAt = performance.now();
    this.clock += Math.min(Math.max(delta, 0), 1 / 15);
    this.solver.update(sources, delta);
    const bricks = this.solver.getRenderBricks();
    this.geometryState.geometry.instanceCount = bricks.length;
    this.mesh.visible = bricks.length > 0;
    this.material.uniforms.uTime.value = this.clock;
    const raySteps = resolveSmokeVolumeRaySteps3D(sources);
    this.material.uniforms.uStepCount.value = raySteps;

    for (let index = 0; index < bricks.length; index++) {
      const brick = bricks[index]!;
      this.geometryState.center.setXYZ(
        index,
        brick.center.x,
        brick.center.y,
        brick.center.z
      );
      this.geometryState.halfExtent.setXYZ(
        index,
        brick.halfExtent.x,
        brick.halfExtent.y,
        brick.halfExtent.z
      );
      this.geometryState.atlasOffset.setXYZ(
        index,
        brick.atlasOffset.x,
        brick.atlasOffset.y,
        brick.atlasOffset.z
      );
      this.color.set(brick.coreColor);
      this.geometryState.coreColor.setXYZ(
        index,
        this.color.r,
        this.color.g,
        this.color.b
      );
      this.color.set(brick.edgeColor);
      this.geometryState.edgeColor.setXYZ(
        index,
        this.color.r,
        this.color.g,
        this.color.b
      );
      this.geometryState.optics.setXYZW(
        index,
        brick.densityScale,
        brick.extinction,
        brick.scattering,
        0
      );
      this.geometryState.detail.setXYZ(
        index,
        brick.detailWarp,
        brick.hueShift,
        brick.seed
      );
    }
    this.geometryState.center.needsUpdate = true;
    this.geometryState.halfExtent.needsUpdate = true;
    this.geometryState.atlasOffset.needsUpdate = true;
    this.geometryState.coreColor.needsUpdate = true;
    this.geometryState.edgeColor.needsUpdate = true;
    this.geometryState.optics.needsUpdate = true;
    this.geometryState.detail.needsUpdate = true;
    if (SmokeVolumeRenderer3D.diagnosticListeners.size > 0) {
      const snapshot: SmokeVolumeRendererDiagnostic3D = {
        ...this.solver.getDebugSnapshot(),
        sourceCount: sources.length,
        raySteps,
        simulationCpuMs: performance.now() - startedAt,
      };
      for (const listener of SmokeVolumeRenderer3D.diagnosticListeners)
        listener(snapshot);
    }
  }

  getDebugSnapshot(): SmokeVolumeDebugSnapshot3D {
    return this.solver.getDebugSnapshot();
  }

  clear(): void {
    this.solver.clear();
    this.geometryState.geometry.instanceCount = 0;
    this.mesh.visible = false;
  }

  dispose(): void {
    if (this.parent) this.parent.remove(this.mesh);
    this.parent = null;
    this.solver.dispose();
    this.geometryState.geometry.dispose();
    this.material.dispose();
  }
}
