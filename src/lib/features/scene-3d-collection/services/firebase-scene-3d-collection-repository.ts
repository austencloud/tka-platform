import { firestoreList, firestoreSet, firestoreDelete } from "$lib/shared/firestore/firestore-crud";
import { getUserScene3DCollectionPath } from "./firestore-paths";
import { Collected3DSceneSchema } from "../domain/scene-3d-collection-types";
import type { Collected3DScene } from "../domain/scene-3d-collection-types";

export async function loadScenes(userId: string): Promise<Collected3DScene[]> {
  const path = getUserScene3DCollectionPath(userId);
  const results = await firestoreList(path, Collected3DSceneSchema, {
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
  return results as Collected3DScene[];
}

export async function saveScene(userId: string, scene: Collected3DScene): Promise<void> {
  const path = getUserScene3DCollectionPath(userId);
  const { id, ...data } = scene;
  await firestoreSet(path, id, data as Record<string, unknown>);
}

export async function removeScene(userId: string, sceneId: string): Promise<void> {
  const path = getUserScene3DCollectionPath(userId);
  await firestoreDelete(path, sceneId);
}
