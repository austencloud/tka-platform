import {
  Material,
  Object3D,
  Scene,
  Texture,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";
import type {
  WorkerEnvironmentKey,
  WorkerPerformerSnapshot,
  WorkerRendererProgressMessage,
} from "../domain/worker-renderer-protocol";

export interface WorkerEnvironmentWorld {
  environment: WorkerEnvironmentKey;
  scene: Scene;
  /** False when the environment owns its complete production light rig. */
  useViewerBaseLighting?: boolean;
  update(deltaSeconds: number, elapsedSeconds: number): void;
  setPerformers?(performers: readonly WorkerPerformerSnapshot[]): void;
  pointerMove?(ndcX: number, ndcY: number): boolean;
  pointerLeave?(): void;
  pointerDown?(
    ndcX: number,
    ndcY: number
  ): { frequencyHz: number; pan: number } | null;
  dispose(): void;
}

export interface WorkerWorldContext {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  performers: readonly WorkerPerformerSnapshot[];
  requestId: number;
  reportProgress(
    phase: WorkerRendererProgressMessage["phase"],
    fraction: number
  ): void;
}

export interface WorkerWorldFactory {
  (context: WorkerWorldContext): Promise<WorkerEnvironmentWorld>;
}

function disposeTexture(value: unknown, disposed: Set<Texture>): void {
  if (!(value instanceof Texture) || disposed.has(value)) return;
  disposed.add(value);
  value.dispose();
}

function disposeMaterial(
  material: Material,
  disposedMaterials: Set<Material>,
  disposedTextures: Set<Texture>
): void {
  if (disposedMaterials.has(material)) return;
  disposedMaterials.add(material);
  for (const value of Object.values(material)) {
    disposeTexture(value, disposedTextures);
  }
  material.dispose();
}

export function disposeWorkerWorldTree(root: Object3D): void {
  const geometries = new Set<{ dispose(): void }>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    const renderable = object as Object3D & {
      geometry?: { dispose(): void };
      material?: Material | Material[];
    };
    if (renderable.geometry && !geometries.has(renderable.geometry)) {
      geometries.add(renderable.geometry);
      renderable.geometry.dispose();
    }
    const values = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];
    for (const material of values) {
      disposeMaterial(material, materials, textures);
    }
  });

  root.clear();
}
