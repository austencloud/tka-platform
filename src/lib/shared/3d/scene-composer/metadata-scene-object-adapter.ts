import { Matrix4, type InstancedMesh, type Object3D } from "three";
import { SceneGraphObjectAdapter } from "./scene-graph-object-adapter";
import type { SceneObjectDescriptor } from "./types";

interface SceneMetadataAdapterOptions {
  sceneId: string;
  editableRoles: ReadonlySet<string>;
  lockedRoles: ReadonlySet<string>;
  roleObjectKeys?: Readonly<Record<string, string>>;
  editableNamePatterns?: readonly RegExp[];
  lockedNamePatterns?: readonly RegExp[];
  editableInstancePatterns?: readonly RegExp[];
  lockedInstancePatterns?: readonly RegExp[];
  instanceIdentityName?: (object: Object3D, geometryName: string) => string;
  instanceDescriptorsByMatrixKey?: Readonly<
    Record<string, SceneObjectDescriptor>
  >;
}

function normalizedName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function roleOf(object: Object3D): string | undefined {
  const role = object.userData?.tka_role;
  return typeof role === "string" ? role : undefined;
}

function matches(name: string, patterns: readonly RegExp[] | undefined) {
  return patterns?.some((pattern) => pattern.test(name)) ?? false;
}

export function stableComposerMatrixKey(matrix: Matrix4): string {
  let hash = 2166136261;
  for (const value of matrix.elements) {
    const text = value.toFixed(4);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return (hash >>> 0).toString(36);
}

function ensureDerivedInstanceIds(
  sceneId: string,
  object: InstancedMesh,
  baseName: string
): string[] {
  const existing = object.userData?.composerInstanceIds;
  if (Array.isArray(existing)) return existing;

  const matrix = new Matrix4();
  const ids = Array.from({ length: object.count }, (_, instanceId) => {
    object.getMatrixAt(instanceId, matrix);
    return `${sceneId}:instance:${normalizedName(baseName)}:${stableComposerMatrixKey(matrix)}`;
  });
  object.userData.composerInstanceIds = ids;
  return ids;
}

function instanceDescriptor(
  sceneId: string,
  object: Object3D,
  instanceId: number | undefined,
  editablePatterns: readonly RegExp[] | undefined,
  lockedPatterns: readonly RegExp[] | undefined,
  identityName?: (object: Object3D, geometryName: string) => string,
  descriptorsByMatrixKey?: Readonly<Record<string, SceneObjectDescriptor>>
): SceneObjectDescriptor | null {
  if (instanceId === undefined) return null;
  const matrix = new Matrix4();
  (object as InstancedMesh).getMatrixAt(instanceId, matrix);
  const mappedDescriptor =
    descriptorsByMatrixKey?.[stableComposerMatrixKey(matrix)];
  if (mappedDescriptor) return mappedDescriptor;
  const geometryName =
    "geometry" in object
      ? String((object as InstancedMesh).geometry?.name ?? "")
      : "";
  const baseName =
    identityName?.(object, geometryName) || object.name || geometryName;
  const hasAuthoredIds = Array.isArray(object.userData?.composerInstanceIds);
  const editable = matches(baseName, editablePatterns);
  const lockedByPattern = matches(baseName, lockedPatterns);
  if (!hasAuthoredIds && !editable && !lockedByPattern) return null;

  const ids = ensureDerivedInstanceIds(
    sceneId,
    object as InstancedMesh,
    baseName || "unnamed-batch"
  );
  if (!Array.isArray(ids) || typeof ids[instanceId] !== "string") return null;
  const objectKeys = object.userData?.composerInstanceObjectKeys;
  const labels = object.userData?.composerInstanceLabels;
  const locked = object.userData?.composerInstanceLocked;
  return {
    id: ids[instanceId],
    objectKey:
      (Array.isArray(objectKeys) && typeof objectKeys[instanceId] === "string"
        ? objectKeys[instanceId]
        : object.userData?.composerObjectKey) ?? normalizedName(baseName),
    label:
      Array.isArray(labels) && typeof labels[instanceId] === "string"
        ? labels[instanceId]
        : object.name || "Scene prop",
    locked:
      (Array.isArray(locked) && locked[instanceId] === true) ||
      object.userData?.composerLocked === true ||
      lockedByPattern,
  };
}

export function createMetadataSceneObjectAdapter({
  sceneId,
  editableRoles,
  lockedRoles,
  roleObjectKeys = {},
  editableNamePatterns,
  lockedNamePatterns,
  editableInstancePatterns,
  lockedInstancePatterns,
  instanceIdentityName,
  instanceDescriptorsByMatrixKey,
}: SceneMetadataAdapterOptions): SceneGraphObjectAdapter {
  return new SceneGraphObjectAdapter((object, instanceId) => {
    const instance = instanceDescriptor(
      sceneId,
      object,
      instanceId,
      editableInstancePatterns,
      lockedInstancePatterns,
      instanceIdentityName,
      instanceDescriptorsByMatrixKey
    );
    if (instance) return instance;

    const role = roleOf(object);
    const name = object.name ?? "";
    const locked =
      (role ? lockedRoles.has(role) : false) ||
      matches(name, lockedNamePatterns);
    const editable =
      (role ? editableRoles.has(role) : false) ||
      matches(name, editableNamePatterns);
    if (!locked && !editable) return null;

    const authoredId = object.userData?.tka_composer_id;
    const stableName = normalizedName(name);
    if (typeof authoredId !== "string" && !stableName) return null;

    let target = object;
    if (typeof authoredId === "string") {
      while (
        target.parent &&
        target.parent.userData?.tka_composer_id === authoredId
      ) {
        target = target.parent;
      }
    }

    return {
      id:
        typeof authoredId === "string"
          ? authoredId
          : `${sceneId}:${normalizedName(role ?? "object")}:${stableName}`,
      objectKey:
        (typeof object.userData?.tka_composer_object_key === "string"
          ? object.userData.tka_composer_object_key
          : undefined) ||
        (role && roleObjectKeys[role]) ||
        normalizedName(role ?? name),
      label: name || role || "Scene object",
      locked: object.userData?.tka_composer_locked === true || locked,
      object: target,
    };
  });
}
