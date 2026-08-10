import { InstancedMesh, Matrix4, Object3D, type Intersection } from "three";
import type {
  ComposerPlacement,
  SceneObjectAdapter,
  SceneObjectDescriptor,
  SceneObjectHandle,
  SceneObjectMember,
} from "./types";

export type DescribeSceneObject = (
  object: Object3D,
  instanceId?: number
) => SceneObjectDescriptor | null;

function isInstancedMesh(object: Object3D): object is InstancedMesh {
  return "isInstancedMesh" in object && object.isInstancedMesh === true;
}

function normalizedComponent(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function tuple3(x: number, y: number, z: number): [number, number, number] {
  return [
    normalizedComponent(x),
    normalizedComponent(y),
    normalizedComponent(z),
  ];
}

function placementFromObject(
  handle: SceneObjectHandle,
  object: Object3D
): ComposerPlacement {
  return {
    id: handle.id,
    objectKey: handle.objectKey,
    position: tuple3(object.position.x, object.position.y, object.position.z),
    rotation: [
      normalizedComponent(object.quaternion.x),
      normalizedComponent(object.quaternion.y),
      normalizedComponent(object.quaternion.z),
      normalizedComponent(object.quaternion.w),
    ],
    scale: tuple3(object.scale.x, object.scale.y, object.scale.z),
    source: "native",
    locked: handle.locked || undefined,
    visible: object.visible,
  };
}

/**
 * Adapts scene-owned Three.js objects to the shared composer contract. Scene
 * plugins provide identity and locking rules; this owner handles transforms,
 * instance proxies, visibility, and matrix updates the same way everywhere.
 */
export class SceneGraphObjectAdapter implements SceneObjectAdapter {
  private readonly hiddenInstanceMatrices = new Map<string, Matrix4>();
  private readonly handlesById = new Map<string, SceneObjectHandle>();

  constructor(private readonly describe: DescribeSceneObject) {}

  enumerate(root: Object3D): SceneObjectHandle[] {
    this.handlesById.clear();

    root.traverse((object) => {
      if (isInstancedMesh(object)) {
        for (let instanceId = 0; instanceId < object.count; instanceId += 1) {
          const handle = this.createHandle(object, instanceId);
          if (handle) this.rememberHandle(handle);
        }
        return;
      }

      const handle = this.createHandle(object);
      if (handle) this.rememberHandle(handle);
    });

    return [...this.handlesById.values()];
  }

  resolveHit(hit: Intersection<Object3D>): SceneObjectHandle | null {
    let current: Object3D | null = hit.object;
    while (current) {
      const instanceId = current === hit.object ? hit.instanceId : undefined;
      const handle = this.createHandle(current, instanceId);
      if (handle) return this.handlesById.get(handle.id) ?? handle;
      current = current.parent;
    }
    return null;
  }

  read(handle: SceneObjectHandle): ComposerPlacement {
    if (handle.kind === "instance") {
      const target = this.createDetachedInstanceTarget(handle);
      const placement = placementFromObject(handle, target);
      placement.visible = !this.hiddenInstanceMatrices.has(handle.id);
      return placement;
    }
    return placementFromObject(handle, handle.object);
  }

  createTransformTarget(handle: SceneObjectHandle): Object3D {
    if (handle.kind === "object") return handle.object;

    const target = this.createDetachedInstanceTarget(handle);
    target.name = `ComposerProxy_${handle.id}`;
    target.userData.__isComposerProxy = true;
    handle.object.add(target);
    return target;
  }

  previewTransform(handle: SceneObjectHandle, target: Object3D): void {
    this.assertEditable(handle);
    for (const member of this.membersOf(handle)) {
      if (member.instanceId === undefined) continue;
      this.writeInstanceTarget(member, target);
    }
  }

  applyPlacement(
    handle: SceneObjectHandle,
    placement: ComposerPlacement,
    target?: Object3D
  ): void {
    this.assertEditable(handle);
    const destination =
      target ??
      (handle.kind === "instance"
        ? this.createDetachedInstanceTarget(handle)
        : handle.object);
    destination.position.set(...placement.position);
    destination.quaternion.set(...placement.rotation);
    destination.scale.set(...placement.scale);

    if (handle.kind === "instance") {
      destination.updateMatrix();

      if (placement.visible === false) {
        if (!this.hiddenInstanceMatrices.has(handle.id)) {
          this.hiddenInstanceMatrices.set(
            handle.id,
            destination.matrix.clone()
          );
        }
        const hidden = new Matrix4().set(
          0,
          0,
          0,
          destination.position.x,
          0,
          0,
          0,
          destination.position.y,
          0,
          0,
          0,
          destination.position.z,
          0,
          0,
          0,
          1
        );
        for (const member of this.membersOf(handle)) {
          if (member.instanceId === undefined) continue;
          const instance = member.object as InstancedMesh;
          instance.setMatrixAt(member.instanceId, hidden);
          instance.instanceMatrix.needsUpdate = true;
        }
      } else {
        this.hiddenInstanceMatrices.delete(handle.id);
        for (const member of this.membersOf(handle)) {
          if (member.instanceId === undefined) continue;
          const instance = member.object as InstancedMesh;
          instance.setMatrixAt(member.instanceId, destination.matrix);
          instance.instanceMatrix.needsUpdate = true;
        }
      }
      return;
    }

    for (const member of this.membersOf(handle)) {
      if (member.instanceId !== undefined) continue;
      member.object.position.copy(destination.position);
      member.object.quaternion.copy(destination.quaternion);
      member.object.scale.copy(destination.scale);
      member.object.visible = placement.visible !== false;
    }
  }

  disposeTransformTarget(handle: SceneObjectHandle, target: Object3D): void {
    if (handle.kind === "instance") target.removeFromParent();
  }

  private createHandle(
    object: Object3D,
    instanceId?: number
  ): SceneObjectHandle | null {
    const descriptor = this.describe(object, instanceId);
    if (!descriptor) return null;
    const target = descriptor.object ?? object;
    const isInstance = isInstancedMesh(target) && instanceId !== undefined;
    return {
      id: descriptor.id,
      objectKey: descriptor.objectKey,
      label: descriptor.label ?? descriptor.objectKey,
      kind: isInstance ? "instance" : "object",
      locked: descriptor.locked ?? false,
      object: target,
      instanceId: isInstance ? instanceId : undefined,
      members: [
        {
          object: target,
          instanceId: isInstance ? instanceId : undefined,
        },
      ],
    };
  }

  private rememberHandle(handle: SceneObjectHandle): void {
    const existing = this.handlesById.get(handle.id);
    if (!existing) {
      this.handlesById.set(handle.id, handle);
      return;
    }
    for (const member of handle.members ?? []) {
      if (
        !(existing.members ?? []).some(
          (candidate) =>
            candidate.object === member.object &&
            candidate.instanceId === member.instanceId
        )
      ) {
        existing.members?.push(member);
      }
    }
    existing.locked ||= handle.locked;
  }

  private membersOf(handle: SceneObjectHandle): SceneObjectMember[] {
    return (
      handle.members ?? [
        { object: handle.object, instanceId: handle.instanceId },
      ]
    );
  }

  private createDetachedInstanceTarget(handle: SceneObjectHandle): Object3D {
    const instance = handle.object as InstancedMesh;
    const matrix = new Matrix4();
    const hiddenMatrix = this.hiddenInstanceMatrices.get(handle.id);
    if (hiddenMatrix) matrix.copy(hiddenMatrix);
    else instance.getMatrixAt(this.requireInstanceId(handle), matrix);
    const target = new Object3D();
    matrix.decompose(target.position, target.quaternion, target.scale);
    return target;
  }

  private writeInstanceTarget(
    member: SceneObjectMember,
    target: Object3D
  ): void {
    const instance = member.object as InstancedMesh;
    target.updateMatrix();
    if (member.instanceId === undefined) return;
    instance.setMatrixAt(member.instanceId, target.matrix);
    instance.instanceMatrix.needsUpdate = true;
  }

  private requireInstanceId(handle: SceneObjectHandle): number {
    if (handle.instanceId === undefined) {
      throw new Error(`Instance handle ${handle.id} has no instanceId`);
    }
    return handle.instanceId;
  }

  private assertEditable(handle: SceneObjectHandle): void {
    if (handle.locked) {
      throw new Error(`Scene object ${handle.id} is locked`);
    }
  }
}
