import { firestoreList, firestoreSet, firestoreDelete } from "$lib/shared/firestore/firestore-crud";
import { getUserMandalaCollectionPath } from "./firestore-paths";
import { CollectedMandalaSchema } from "../domain/mandala-collection-types";
import type { CollectedMandala } from "../domain/mandala-collection-types";

export async function loadMandalas(userId: string): Promise<CollectedMandala[]> {
  const path = getUserMandalaCollectionPath(userId);
  // firestoreList runs each row through CollectedMandalaSchema, so the result is
  // validated at this boundary. The schema's inferred row type and the domain
  // CollectedMandala diverge only in nested StepData inference (e.g. motion
  // gridMode), so a single assertion re-attaches the domain type — no
  // `as unknown` double-cast needed.
  const results = await firestoreList(path, CollectedMandalaSchema, {
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
  return results as CollectedMandala[];
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
