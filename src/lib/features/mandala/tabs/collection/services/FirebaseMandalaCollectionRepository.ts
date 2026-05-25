import { firestoreList, firestoreSet, firestoreDelete } from "$lib/shared/firestore/firestore-crud";
import { getUserMandalaCollectionPath } from "./firestore-paths";
import { CollectedMandalaSchema } from "../domain/mandala-collection-types";
import type { CollectedMandala } from "../domain/mandala-collection-types";

export async function loadMandalas(userId: string): Promise<CollectedMandala[]> {
  const path = getUserMandalaCollectionPath(userId);
  const results = await firestoreList(path, CollectedMandalaSchema, {
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
  return results as unknown as CollectedMandala[];
}

export async function saveMandala(userId: string, mandala: CollectedMandala): Promise<void> {
  const path = getUserMandalaCollectionPath(userId);
  const { id, ...data } = mandala;
  await firestoreSet(path, id, data as Record<string, unknown>);
}

export async function removeMandala(userId: string, mandalaId: string): Promise<void> {
  const path = getUserMandalaCollectionPath(userId);
  await firestoreDelete(path, mandalaId);
}
