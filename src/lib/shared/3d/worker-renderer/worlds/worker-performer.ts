import {
  Box3,
  Euler,
  Group,
  Quaternion,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Object3D,
  type Scene,
} from "three";
import {
  GripType,
  cmToUnits,
  createAvatarServices,
  createStaffObject,
  getAvatarModelPath,
  type AvatarServices,
  type PropState3D,
  type StaffObject,
} from "@austencloud/scene-3d/worker";
import type {
  WorkerPerformerSnapshot,
  WorkerPerformerPropType,
  WorkerPropSnapshot,
} from "../domain/worker-renderer-protocol";
import { isWorkerPerformerPropType } from "../domain/worker-renderer-protocol";
import { createPerformerBadgeTexture } from "../../rendering/performer-badge-texture";
import { WorkerPerformerLocomotion } from "./worker-performer-locomotion";

const STAFF_HORIZONTAL_QUATERNION = new Quaternion().setFromEuler(
  new Euler(0, 0, Math.PI / 2)
);

export interface WorkerPropObject {
  anchor: Group;
  correction: Group;
  visual: StaffObject | null;
  state: PropState3D;
  setSnapshot(snapshot: WorkerPropSnapshot | null): void;
  dispose(): void;
}

interface WorkerPerformerBadgeObject {
  key: string;
  sprite: Sprite;
  material: SpriteMaterial;
}

function propState(snapshot: WorkerPropSnapshot): PropState3D {
  return {
    centerPathAngle: snapshot.centerPathAngle,
    staffRotationAngle: snapshot.staffRotationAngle,
    plane: snapshot.plane as PropState3D["plane"],
    worldPosition: new Vector3().fromArray(snapshot.worldPosition),
    worldRotation: new Quaternion().fromArray(snapshot.worldRotation),
    gripType: snapshot.gripType as PropState3D["gripType"],
  };
}

function createCanonicalPropVisual(
  propType: WorkerPerformerPropType,
  side: "left" | "right",
  snapshot: WorkerPerformerSnapshot
): StaffObject | null {
  if (propType === "hand") return null;
  return createStaffObject({
    color: side === "left" ? "blue" : "red",
    length: snapshot.staffLength,
    thickness: snapshot.staffThickness,
  });
}

export function createWorkerPerformerProp(
  side: "left" | "right",
  snapshot: WorkerPerformerSnapshot
): WorkerPropObject {
  const propType =
    side === "left" ? snapshot.leftPropType : snapshot.rightPropType;
  if (!isWorkerPerformerPropType(propType)) {
    throw new Error(
      `Worker performer does not yet own exact ${propType} geometry`
    );
  }

  const anchor = new Group();
  anchor.name = `${side}-prop-anchor`;
  const correction = new Group();
  correction.name = `${side}-prop-correction`;
  anchor.add(correction);
  const visual = createCanonicalPropVisual(propType, side, snapshot);
  if (visual) correction.add(visual.root);

  const source = side === "left" ? snapshot.leftProp : snapshot.rightProp;
  const state = source
    ? propState(source)
    : {
        centerPathAngle: 0,
        staffRotationAngle: 0,
        plane: "wall" as PropState3D["plane"],
        worldPosition: new Vector3(),
        worldRotation: new Quaternion(),
      };

  const result: WorkerPropObject = {
    anchor,
    correction,
    visual,
    state,
    setSnapshot(next) {
      anchor.visible = next !== null;
      if (!next) return;
      state.centerPathAngle = next.centerPathAngle;
      state.staffRotationAngle = next.staffRotationAngle;
      state.plane = next.plane as PropState3D["plane"];
      state.worldPosition.fromArray(next.worldPosition);
      state.worldRotation.fromArray(next.worldRotation);
      state.gripType = next.gripType as PropState3D["gripType"];
      anchor.position.copy(state.worldPosition);
      visual?.setState(state);
    },
    dispose() {
      visual?.dispose();
      anchor.removeFromParent();
      anchor.clear();
    },
  };
  result.setSnapshot(source);
  return result;
}

/**
 * Worker-owned visual for one fully resolved Choreo performer.
 *
 * Choreography stays on the application thread. This class owns only the
 * heavyweight Three.js avatar, IK solve, finger pose, staff graph, and the
 * transforms needed to draw the immutable snapshot it most recently received.
 */
export class WorkerPerformer {
  readonly root = new Group();
  readonly id: string;

  private readonly services: AvatarServices;
  private readonly left: WorkerPropObject;
  private readonly right: WorkerPropObject;
  private readonly leftTarget = new Vector3();
  private readonly rightTarget = new Vector3();
  private readonly rigWorldQuaternion = new Quaternion();
  private readonly leftOrientation = new Quaternion();
  private readonly rightOrientation = new Quaternion();
  private snapshot: WorkerPerformerSnapshot;
  private avatarRoot: Object3D | null = null;
  private badge: WorkerPerformerBadgeObject | null = null;
  private readonly locomotion: WorkerPerformerLocomotion | null;
  private disposed = false;

  private constructor(snapshot: WorkerPerformerSnapshot) {
    this.snapshot = snapshot;
    this.id = snapshot.id;
    this.root.name = `worker-performer-${snapshot.id}`;
    const enableLocomotion = snapshot.locomotion != null;
    this.services = createAvatarServices({
      enableLocomotion,
      enableRootMotion: false,
      enableFootPlanting: enableLocomotion,
    });
    this.locomotion = enableLocomotion
      ? new WorkerPerformerLocomotion(this.services)
      : null;
    this.left = createWorkerPerformerProp("left", snapshot);
    this.right = createWorkerPerformerProp("right", snapshot);
    this.root.add(this.left.anchor, this.right.anchor);
  }

  static async create(
    snapshot: WorkerPerformerSnapshot
  ): Promise<WorkerPerformer> {
    const performer = new WorkerPerformer(snapshot);
    try {
      await performer.loadAvatar();
      performer.setSnapshot(snapshot);
      return performer;
    } catch (error) {
      performer.dispose();
      throw error;
    }
  }

  matchesConfiguration(snapshot: WorkerPerformerSnapshot): boolean {
    return (
      snapshot.id === this.snapshot.id &&
      snapshot.avatarId === this.snapshot.avatarId &&
      snapshot.avatarHeightCm === this.snapshot.avatarHeightCm &&
      snapshot.leftPropType === this.snapshot.leftPropType &&
      snapshot.rightPropType === this.snapshot.rightPropType &&
      snapshot.staffLength === this.snapshot.staffLength &&
      snapshot.staffThickness === this.snapshot.staffThickness &&
      (snapshot.locomotion != null) === (this.snapshot.locomotion != null)
    );
  }

  private async loadAvatar(): Promise<void> {
    await this.services.skeleton.loadModel(
      getAvatarModelPath(this.snapshot.avatarId)
    );
    if (this.disposed) return;

    this.services.skeleton.setHeight(cmToUnits(this.snapshot.avatarHeightCm));
    this.avatarRoot = this.services.skeleton.getRoot();
    if (!this.avatarRoot) {
      throw new Error(`Avatar ${this.snapshot.avatarId} loaded without a root`);
    }
    this.avatarRoot.name = `worker-avatar-${this.snapshot.avatarId}`;
    this.avatarRoot.traverse((child) => {
      const renderable = child as Object3D & {
        isMesh?: boolean;
        castShadow?: boolean;
      };
      if (renderable.isMesh) renderable.castShadow = true;
    });
    this.root.add(this.avatarRoot);

    const fingerChains = this.services.skeleton.getState().fingerChains;
    if (fingerChains) this.services.fingers.initialize(fingerChains);
    if (this.locomotion) await this.locomotion.initialize(this.avatarRoot);
  }

  setSnapshot(snapshot: WorkerPerformerSnapshot): void {
    if (snapshot.id !== this.snapshot.id) return;
    if (!this.matchesConfiguration(snapshot)) {
      throw new Error(
        "Worker performer configuration changed without a replacement"
      );
    }
    this.snapshot = snapshot;
    this.root.position.fromArray(snapshot.position);
    this.root.rotation.set(0, snapshot.facingAngle, 0);
    this.root.updateMatrixWorld(true);

    const feetOffset = this.services.skeleton.getFeetOffset();
    if (this.avatarRoot)
      this.avatarRoot.position.y = snapshot.groundY - feetOffset;

    this.applyPropSnapshot(this.left, snapshot.leftProp);
    this.applyPropSnapshot(this.right, snapshot.rightProp);
    this.applyBadgeSnapshot(snapshot);
  }

  private applyBadgeSnapshot(snapshot: WorkerPerformerSnapshot): void {
    const badge = snapshot.badge;
    if (!badge) {
      this.disposeBadge();
      return;
    }
    const key = `${badge.index}:${badge.color}:${badge.selected}`;
    if (!this.badge || this.badge.key !== key) {
      this.disposeBadge();
      if (typeof OffscreenCanvas === "undefined") return;
      const texture = createPerformerBadgeTexture(
        badge.index,
        badge.color,
        badge.selected,
        (width, height) => new OffscreenCanvas(width, height)
      );
      const material = new SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: badge.opacity,
        depthTest: false,
      });
      const sprite = new Sprite(material);
      sprite.name = `worker-performer-badge-${badge.index}`;
      sprite.scale.set(0.22, 0.22, 1);
      sprite.renderOrder = 999;
      this.root.add(sprite);
      this.badge = { key, sprite, material };
    }
    this.badge.material.opacity = badge.opacity;
    this.badge.sprite.position.set(0, -snapshot.groundY + 0.15, 0);
  }

  private disposeBadge(): void {
    if (!this.badge) return;
    this.root.remove(this.badge.sprite);
    this.badge.material.map?.dispose();
    this.badge.material.dispose();
    this.badge = null;
  }

  private applyPropSnapshot(
    target: WorkerPropObject,
    snapshot: WorkerPropSnapshot | null
  ): void {
    target.setSnapshot(snapshot);
  }

  update(deltaSeconds: number): void {
    if (this.disposed || !this.avatarRoot) return;
    this.root.updateMatrixWorld(true);

    if (this.locomotion && this.snapshot.locomotion) {
      const frame = this.locomotion.update(
        deltaSeconds,
        this.snapshot.locomotion,
        this.root,
        this.snapshot.facingAngle,
        cmToUnits(this.snapshot.avatarHeightCm),
        this.snapshot.groundY
      );
      this.root.position.set(
        this.snapshot.position[0] + frame.offset[0],
        this.snapshot.position[1] + frame.offset[1],
        this.snapshot.position[2] + frame.offset[2]
      );
      this.root.rotation.set(0, frame.facingAngle, 0);
      this.root.updateMatrixWorld(true);
    }

    const leftState = this.snapshot.leftProp ? this.left.state : null;
    const rightState = this.snapshot.rightProp ? this.right.state : null;
    const leftWorld = this.worldProp(this.left, leftState, this.leftTarget);
    const rightWorld = this.worldProp(this.right, rightState, this.rightTarget);
    this.root.getWorldQuaternion(this.rigWorldQuaternion);

    this.leftOrientation
      .copy(this.rigWorldQuaternion)
      .multiply(this.left.state.worldRotation)
      .multiply(STAFF_HORIZONTAL_QUATERNION);
    this.rightOrientation
      .copy(this.rigWorldQuaternion)
      .multiply(this.right.state.worldRotation)
      .multiply(STAFF_HORIZONTAL_QUATERNION);

    this.services.animator.setPropsAndBlend(leftWorld, rightWorld, undefined, {
      blue: leftWorld ? this.leftOrientation : null,
      red: rightWorld ? this.rightOrientation : null,
    });
    this.services.animator.setExternalSpinePitch(
      this.snapshot.spinePitchOffset
    );
    this.services.animator.setStanceYaw?.(this.snapshot.stanceYaw);
    this.services.animator.setStanceYawSegments?.(this.snapshot.stanceSegments);
    this.services.animator.setHeadDodgeEnabled(true);

    if (this.services.fingers.isReady()) {
      this.services.fingers.setGrips(
        leftWorld ? GripType.SQUARE : GripType.IDLE,
        rightWorld ? GripType.SQUARE : GripType.IDLE
      );
      this.services.fingers.update(deltaSeconds);
    }
    this.services.animator.update(deltaSeconds);
    this.services.skeleton.updateMatrices();
  }

  getDiagnostics(): {
    renderables: number;
    visibleRenderables: number;
    effectivelyVisibleRenderables: number;
    layerMasks: readonly number[];
    rootVisible: boolean;
    rootLayerMask: number;
    materialOpacity: readonly [number, number] | null;
    boundsCenter: readonly [number, number, number];
    boundsSize: readonly [number, number, number];
  } {
    this.root.updateMatrixWorld(true);
    let renderables = 0;
    let visibleRenderables = 0;
    let effectivelyVisibleRenderables = 0;
    const layerMasks = new Set<number>();
    let minOpacity = Infinity;
    let maxOpacity = -Infinity;
    this.root.traverse((object) => {
      const mesh = object as Object3D & {
        isMesh?: boolean;
        material?:
          | { opacity?: number; visible?: boolean }
          | Array<{ opacity?: number; visible?: boolean }>;
      };
      if (!mesh.isMesh) return;
      renderables += 1;
      layerMasks.add(object.layers.mask);
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      if (
        object.visible &&
        materials.some((material) => material.visible !== false)
      ) {
        visibleRenderables += 1;
        let cursor: Object3D | null = object;
        let effectivelyVisible = true;
        while (cursor) {
          if (!cursor.visible) {
            effectivelyVisible = false;
            break;
          }
          cursor = cursor.parent;
        }
        if (effectivelyVisible) effectivelyVisibleRenderables += 1;
      }
      for (const material of materials) {
        const opacity = material.opacity ?? 1;
        minOpacity = Math.min(minOpacity, opacity);
        maxOpacity = Math.max(maxOpacity, opacity);
      }
    });
    const bounds = new Box3().setFromObject(this.root);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    return {
      renderables,
      visibleRenderables,
      effectivelyVisibleRenderables,
      layerMasks: [...layerMasks].sort((left, right) => left - right),
      rootVisible: this.root.visible,
      rootLayerMask: this.root.layers.mask,
      materialOpacity:
        Number.isFinite(minOpacity) && Number.isFinite(maxOpacity)
          ? [minOpacity, maxOpacity]
          : null,
      boundsCenter: center.toArray(),
      boundsSize: size.toArray(),
    };
  }

  private worldProp(
    prop: WorkerPropObject,
    state: PropState3D | null,
    out: Vector3
  ): PropState3D | null {
    if (!state) return null;
    prop.anchor.updateWorldMatrix(true, false);
    prop.anchor.getWorldPosition(out);
    return { ...state, worldPosition: out };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeBadge();
    this.left.dispose();
    this.right.dispose();
    this.locomotion?.dispose();
    this.services.fingers.dispose();
    this.services.skeleton.dispose();
    this.root.removeFromParent();
    this.root.clear();
    this.avatarRoot = null;
  }
}

interface WorkerPerformerLike {
  readonly id: string;
  readonly root: Group;
  matchesConfiguration(snapshot: WorkerPerformerSnapshot): boolean;
  setSnapshot(snapshot: WorkerPerformerSnapshot): void;
  update(deltaSeconds: number): void;
  getDiagnostics?(): {
    renderables: number;
    visibleRenderables: number;
    effectivelyVisibleRenderables: number;
    layerMasks: readonly number[];
    rootVisible: boolean;
    rootLayerMask: number;
    materialOpacity: readonly [number, number] | null;
    boundsCenter: readonly [number, number, number];
    boundsSize: readonly [number, number, number];
  };
  dispose(): void;
}

type CreateWorkerPerformer = (
  snapshot: WorkerPerformerSnapshot
) => Promise<WorkerPerformerLike>;

export class WorkerPerformerStage {
  private readonly scene: Scene;
  private readonly createPerformer: CreateWorkerPerformer;
  private performers = new Map<string, WorkerPerformerLike>();
  private pending = new Map<string, Promise<void>>();
  private snapshots = new Map<string, WorkerPerformerSnapshot>();
  private disposed = false;

  constructor(
    scene: Scene,
    createPerformer: CreateWorkerPerformer = WorkerPerformer.create
  ) {
    this.scene = scene;
    this.createPerformer = createPerformer;
  }

  async setSnapshots(next: readonly WorkerPerformerSnapshot[]): Promise<void> {
    if (this.disposed) return;
    const byId = new Map(next.map((snapshot) => [snapshot.id, snapshot]));
    this.snapshots = byId;

    for (const [id, performer] of this.performers) {
      if (byId.has(id)) continue;
      performer.dispose();
      this.performers.delete(id);
      this.snapshots.delete(id);
    }

    for (const snapshot of next) {
      const performer = this.performers.get(snapshot.id);
      if (performer && !performer.matchesConfiguration(snapshot)) {
        performer.dispose();
        this.performers.delete(snapshot.id);
      }
    }

    await Promise.all(next.map((snapshot) => this.ensurePerformer(snapshot)));
    if (this.disposed) return;
    this.applyLatest();
  }

  private ensurePerformer(snapshot: WorkerPerformerSnapshot): Promise<void> {
    if (this.performers.has(snapshot.id)) return Promise.resolve();
    const inFlight = this.pending.get(snapshot.id);
    if (inFlight) return inFlight;

    let loading!: Promise<void>;
    loading = this.createPerformer(snapshot)
      .then(async (performer) => {
        const latest = this.snapshots.get(snapshot.id);
        if (this.disposed || !latest) {
          performer.dispose();
          return;
        }
        if (!performer.matchesConfiguration(latest)) {
          performer.dispose();
          this.pending.delete(snapshot.id);
          await this.ensurePerformer(latest);
          return;
        }
        this.performers.set(snapshot.id, performer);
        this.scene.add(performer.root);
        performer.setSnapshot(latest);
      })
      .finally(() => {
        if (this.pending.get(snapshot.id) === loading) {
          this.pending.delete(snapshot.id);
        }
      });
    this.pending.set(snapshot.id, loading);
    return loading;
  }

  private applyLatest(): void {
    for (const [id, snapshot] of this.snapshots) {
      this.performers.get(id)?.setSnapshot(snapshot);
    }
  }

  update(deltaSeconds: number): void {
    this.applyLatest();
    for (const performer of this.performers.values()) {
      performer.update(deltaSeconds);
    }
  }

  getDiagnostics(): {
    count: number;
    renderables: number;
    visibleRenderables: number;
    effectivelyVisibleRenderables: number;
    layerMasks: readonly number[];
    rootVisible: boolean;
    rootLayerMask: number;
    materialOpacity: readonly [number, number] | null;
    boundsCenter: readonly [number, number, number] | null;
    boundsSize: readonly [number, number, number] | null;
  } {
    let renderables = 0;
    let visibleRenderables = 0;
    let effectivelyVisibleRenderables = 0;
    const layerMasks = new Set<number>();
    let rootVisible = true;
    let rootLayerMask = 1;
    let minOpacity = Infinity;
    let maxOpacity = -Infinity;
    const bounds = new Box3();
    for (const performer of this.performers.values()) {
      const diagnostics = performer.getDiagnostics?.();
      if (diagnostics) {
        renderables += diagnostics.renderables;
        visibleRenderables += diagnostics.visibleRenderables;
        effectivelyVisibleRenderables +=
          diagnostics.effectivelyVisibleRenderables;
        for (const mask of diagnostics.layerMasks) layerMasks.add(mask);
        rootVisible = rootVisible && diagnostics.rootVisible;
        rootLayerMask = diagnostics.rootLayerMask;
        if (diagnostics.materialOpacity) {
          minOpacity = Math.min(minOpacity, diagnostics.materialOpacity[0]);
          maxOpacity = Math.max(maxOpacity, diagnostics.materialOpacity[1]);
        }
      }
      performer.root.updateMatrixWorld(true);
      bounds.expandByObject(performer.root);
    }
    if (bounds.isEmpty()) {
      return {
        count: this.performers.size,
        renderables,
        visibleRenderables,
        effectivelyVisibleRenderables,
        layerMasks: [...layerMasks].sort((left, right) => left - right),
        rootVisible,
        rootLayerMask,
        materialOpacity: null,
        boundsCenter: null,
        boundsSize: null,
      };
    }
    return {
      count: this.performers.size,
      renderables,
      visibleRenderables,
      effectivelyVisibleRenderables,
      layerMasks: [...layerMasks].sort((left, right) => left - right),
      rootVisible,
      rootLayerMask,
      materialOpacity:
        Number.isFinite(minOpacity) && Number.isFinite(maxOpacity)
          ? [minOpacity, maxOpacity]
          : null,
      boundsCenter: bounds.getCenter(new Vector3()).toArray(),
      boundsSize: bounds.getSize(new Vector3()).toArray(),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const performer of this.performers.values()) performer.dispose();
    this.performers.clear();
    this.pending.clear();
    this.snapshots.clear();
  }
}
