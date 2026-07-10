import { CollectionState } from "$lib/shared/collections/collection-state.svelte";
import { createFirebaseCollectionRepository } from "$lib/shared/collections/firebase-collection-repository";
import { LocalCollectionRepository } from "$lib/shared/collections/local-collection-repository";
import {
  Collected3DSceneSchema,
  SCENE_3D_COLLECTION_STORAGE_KEY,
  SCENE_3D_COLLECTION_SCHEMA_VERSION,
} from "../domain/scene-3d-collection-types";
import type { Collected3DScene } from "../domain/scene-3d-collection-types";

export const scene3dCollectionState = new CollectionState<Collected3DScene>(
  createFirebaseCollectionRepository("scene-3d-collection", Collected3DSceneSchema),
  new LocalCollectionRepository(
    SCENE_3D_COLLECTION_STORAGE_KEY,
    SCENE_3D_COLLECTION_SCHEMA_VERSION,
  ),
);
