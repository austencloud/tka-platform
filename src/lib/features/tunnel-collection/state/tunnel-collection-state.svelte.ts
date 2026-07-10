import { CollectionState } from "$lib/shared/collections/collection-state.svelte";
import { createFirebaseCollectionRepository } from "$lib/shared/collections/firebase-collection-repository";
import { LocalCollectionRepository } from "$lib/shared/collections/local-collection-repository";
import {
  CollectedTunnelSchema,
  TUNNEL_COLLECTION_STORAGE_KEY,
  TUNNEL_COLLECTION_SCHEMA_VERSION,
} from "../domain/tunnel-collection-types";
import type { CollectedTunnel } from "../domain/tunnel-collection-types";

export const tunnelCollectionState = new CollectionState<CollectedTunnel>(
  createFirebaseCollectionRepository("tunnel-collection", CollectedTunnelSchema),
  new LocalCollectionRepository(TUNNEL_COLLECTION_STORAGE_KEY, TUNNEL_COLLECTION_SCHEMA_VERSION),
);
