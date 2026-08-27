import {
  BoxGeometry,
  type Camera,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  type Object3D,
  Vector4,
  type WebGLRenderer,
} from "three";
import {
  getSceneColorSnapshot3D,
  requestSceneColorSnapshot3D,
} from "../post-processing/scene-color-snapshot-3d";
import { QualityTier } from "../types";
import {
  isTrackedTip,
  type SmokeTipSource3D,
} from "../scene-effects/scene-effect-source-3d";
import { createSmokeVolumeMaterial3D } from "./smoke-volume-material-3d";
import {
  SMOKE_VOLUME_MAX_BRICKS,
  SmokeVolumeSolver3D,
  type SmokeVolumeBrickRenderState3D,
  type SmokeVolumeDebugSnapshot3D,
} from "./smoke-volume-solver-3d";

export interface SmokeVolumeRendererDiagnostic3D extends SmokeVolumeDebugSnapshot3D {
  sourceCount: number;
  sourceMotionAlignment: number;
  wakeDistance: number;
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
  private readonly viewport = new Vector4();
  private readonly trackedSources: SmokeTipSource3D[] = [];
  private renderBricks: SmokeVolumeBrickRenderState3D[] = [];
  private parent: Object3D | null = null;
  private clock = 0;
  private lastDiagnosticAt = Number.NEGATIVE_INFINITY;

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
    this.mesh.onBeforeRender = (renderer, _scene, camera) => {
      this.bindSceneDepth(renderer, camera);
      this.sortBricksBackToFront(camera);
    };
  }

  initialize(parent: Object3D): void {
    if (this.parent === parent) return;
    if (this.parent) this.parent.remove(this.mesh);
    this.parent = parent;
    parent.add(this.mesh);
  }

  update(sources: readonly SmokeTipSource3D[], delta: number): void {
    const startedAt = performance.now();
    this.trackedSources.length = 0;
    for (const source of sources) {
      if (isTrackedTip(source.params.trackingMode, source.tipIndex))
        this.trackedSources.push(source);
    }
    this.clock += Math.min(Math.max(delta, 0), 1 / 15);
    this.solver.update(this.trackedSources, delta);
    this.renderBricks = this.solver.getRenderBricks();
    this.geometryState.geometry.instanceCount = this.renderBricks.length;
    this.mesh.visible = this.renderBricks.length > 0;
    this.material.uniforms.uTime.value = this.clock;
    const raySteps = resolveSmokeVolumeRaySteps3D(this.trackedSources);
    this.material.uniforms.uStepCount.value = raySteps;
    this.writeBricks(this.renderBricks);
    const diagnosticNow = performance.now();
    if (
      SmokeVolumeRenderer3D.diagnosticListeners.size > 0 &&
      diagnosticNow - this.lastDiagnosticAt >= 180
    ) {
      this.lastDiagnosticAt = diagnosticNow;
      const simulationCpuMs = diagnosticNow - startedAt;
      const solverSnapshot = this.solver.getDebugSnapshot();
      const wake = this.computeWakeMetrics(this.trackedSources, solverSnapshot);
      const snapshot: SmokeVolumeRendererDiagnostic3D = {
        ...solverSnapshot,
        sourceCount: this.trackedSources.length,
        sourceMotionAlignment: wake.alignment,
        wakeDistance: wake.distance,
        raySteps,
        simulationCpuMs,
      };
      for (const listener of SmokeVolumeRenderer3D.diagnosticListeners)
        listener(snapshot);
    }
  }

  private writeBricks(bricks: readonly SmokeVolumeBrickRenderState3D[]): void {
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
  }

  private sortBricksBackToFront(camera: Camera): void {
    if (this.renderBricks.length <= 1) return;
    const view = camera.matrixWorldInverse.elements;
    this.renderBricks.sort((left, right) => {
      const leftDepth =
        view[2]! * left.center.x +
        view[6]! * left.center.y +
        view[10]! * left.center.z +
        view[14]!;
      const rightDepth =
        view[2]! * right.center.x +
        view[6]! * right.center.y +
        view[10]! * right.center.z +
        view[14]!;
      return leftDepth - rightDepth || left.slot - right.slot;
    });
    this.writeBricks(this.renderBricks);
  }

  private bindSceneDepth(renderer: WebGLRenderer, camera: Camera): void {
    requestSceneColorSnapshot3D(renderer);
    renderer.getCurrentViewport(this.viewport);
    this.material.uniforms.uViewport.value.copy(this.viewport);
    const snapshot = getSceneColorSnapshot3D(renderer);
    this.material.uniforms.uSceneDepth.value = snapshot?.depthTexture ?? null;
    this.material.uniforms.uSceneDepthReady.value =
      snapshot?.depthTexture == null ? 0 : 1;
    const depthCamera = camera as Camera & { near?: number; far?: number };
    this.material.uniforms.uCameraNear.value = depthCamera.near ?? 0.1;
    this.material.uniforms.uCameraFar.value = depthCamera.far ?? 1000;
  }

  private computeWakeMetrics(
    sources: readonly SmokeTipSource3D[],
    snapshot: SmokeVolumeDebugSnapshot3D
  ): { alignment: number; distance: number } {
    let sourceX = 0;
    let sourceY = 0;
    let sourceZ = 0;
    let positionX = 0;
    let positionY = 0;
    let positionZ = 0;
    for (const source of sources) {
      sourceX += source.velocity.x;
      sourceY += source.velocity.y;
      sourceZ += source.velocity.z;
      positionX += source.position.x;
      positionY += source.position.y;
      positionZ += source.position.z;
    }
    if (!snapshot.densityCentroid || sources.length === 0)
      return { alignment: 0, distance: 0 };
    const inverseSourceCount = 1 / sources.length;
    const wakeX = snapshot.densityCentroid.x - positionX * inverseSourceCount;
    const wakeY = snapshot.densityCentroid.y - positionY * inverseSourceCount;
    const wakeZ = snapshot.densityCentroid.z - positionZ * inverseSourceCount;
    const sourceLength = Math.hypot(sourceX, sourceY, sourceZ);
    const wakeLength = Math.hypot(wakeX, wakeY, wakeZ);
    const alignment =
      sourceLength < 1e-5 || wakeLength < 1e-5
        ? 0
        : Math.max(
            -1,
            Math.min(
              1,
              (-sourceX * wakeX - sourceY * wakeY - sourceZ * wakeZ) /
                (sourceLength * wakeLength)
            )
          );
    return { alignment, distance: wakeLength };
  }

  getDebugSnapshot(): SmokeVolumeDebugSnapshot3D {
    return this.solver.getDebugSnapshot();
  }

  clear(): void {
    this.solver.clear();
    this.trackedSources.length = 0;
    this.renderBricks = [];
    this.geometryState.geometry.instanceCount = 0;
    this.mesh.visible = false;
  }

  dispose(): void {
    if (this.parent) this.parent.remove(this.mesh);
    this.parent = null;
    this.mesh.onBeforeRender = () => {};
    this.trackedSources.length = 0;
    this.renderBricks = [];
    this.solver.dispose();
    this.geometryState.geometry.dispose();
    this.material.dispose();
  }
}
