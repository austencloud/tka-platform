// src/lib/shared/3d/scene-composer/types.ts

import type { Intersection, Mesh, Object3D, Quaternion, Vector3 } from "three";
import type { ObjectDefinition } from "../procedural-engine/objects/object-catalog";
import type { PlacementPersistence } from "./persistence/types";

export interface SceneComposerPlugin {
  sceneId: string;
  displayName: string;
  catalog: ComposerCatalog;
  surfaceRules: SurfaceRules;
  getDefaults(): ComposerPlacement[];
  constraints?: PlacementConstraints;
  nativeObjects?: SceneObjectAdapter;
  persistence?: PlacementPersistence;
}

export interface ComposerCatalog {
  categories: CatalogCategory[];
  getDefinition(key: string): ObjectDefinition | undefined;
  allItems(): ObjectDefinition[];
}

export interface CatalogCategory {
  id: string;
  label: string;
  icon: string;
  items: ObjectDefinition[];
}

export interface SurfaceRules {
  isSurface(mesh: Mesh): boolean;
  orientationMode: "upright" | "surface-normal" | "custom";
  orientFromNormal?(normal: Vector3): Quaternion;
  gridSize: number | null;
  surfaceOffset: number;
}

export interface PlacementConstraints {
  maxObjects?: number;
  maxPerType?: Record<string, number>;
  minSpacing?: number;
  exclusionZones?: ExclusionZone[];
  validate?(
    placement: ComposerPlacement,
    existing: ComposerPlacement[]
  ): string | null;
}

export interface ExclusionZone {
  center: [number, number, number];
  radius: number;
  reason: string;
}

export interface ComposerPlacement {
  id: string;
  objectKey: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  source?: "catalog" | "native";
  locked?: boolean;
  visible?: boolean;
}

export interface SceneObjectHandle {
  id: string;
  objectKey: string;
  label: string;
  kind: "object" | "instance";
  locked: boolean;
  object: Object3D;
  instanceId?: number;
  members?: SceneObjectMember[];
}

export interface SceneObjectMember {
  object: Object3D;
  instanceId?: number;
}

export interface SceneObjectAdapter {
  enumerate(root: Object3D): SceneObjectHandle[];
  resolveHit(hit: Intersection<Object3D>): SceneObjectHandle | null;
  read(handle: SceneObjectHandle): ComposerPlacement;
  createTransformTarget(handle: SceneObjectHandle): Object3D;
  previewTransform(handle: SceneObjectHandle, target: Object3D): void;
  applyPlacement(
    handle: SceneObjectHandle,
    placement: ComposerPlacement,
    target?: Object3D
  ): void;
  disposeTransformTarget(handle: SceneObjectHandle, target: Object3D): void;
}

export interface SceneObjectDescriptor {
  id: string;
  objectKey: string;
  label?: string;
  locked?: boolean;
  object?: Object3D;
}
