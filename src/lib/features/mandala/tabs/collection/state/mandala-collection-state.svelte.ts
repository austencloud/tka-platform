import { CollectionState } from "$lib/shared/collections/collection-state.svelte";
import { createFirebaseCollectionRepository } from "$lib/shared/collections/firebase-collection-repository";
import { LocalCollectionRepository } from "$lib/shared/collections/local-collection-repository";
import {
  CollectedMandalaSchema,
  MANDALA_COLLECTION_STORAGE_KEY,
  MANDALA_COLLECTION_SCHEMA_VERSION,
} from "../domain/mandala-collection-types";
import type { CollectedMandala } from "../domain/mandala-collection-types";

export const mandalaCollectionState = new CollectionState<CollectedMandala>(
  createFirebaseCollectionRepository("mandala-collection", CollectedMandalaSchema),
  new LocalCollectionRepository(MANDALA_COLLECTION_STORAGE_KEY, MANDALA_COLLECTION_SCHEMA_VERSION),
);
