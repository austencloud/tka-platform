import { firestoreList, firestoreSet, firestoreDelete } from "$lib/shared/firestore/firestore-crud";
import { getUserTunnelCollectionPath } from "./firestore-paths";
import { CollectedTunnelSchema } from "../domain/tunnel-collection-types";
import type { CollectedTunnel } from "../domain/tunnel-collection-types";

export async function loadTunnels(userId: string): Promise<CollectedTunnel[]> {
  const path = getUserTunnelCollectionPath(userId);
  // firestoreList runs each row through CollectedTunnelSchema, so the result is
  // validated at this boundary. The schema's inferred row type and the domain
  // CollectedTunnel diverge only in nested StepData inference (e.g. motion
  // gridMode), so a single assertion re-attaches the domain type — no
  // `as unknown` double-cast needed.
  const results = await firestoreList(path, CollectedTunnelSchema, {
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
  return results as CollectedTunnel[];
}

export async function saveTunnel(userId: string, tunnel: CollectedTunnel): Promise<void> {
  const path = getUserTunnelCollectionPath(userId);
  const { id, ...data } = tunnel;
  await firestoreSet(path, id, data as Record<string, unknown>);
}

export async function removeTunnel(userId: string, tunnelId: string): Promise<void> {
  const path = getUserTunnelCollectionPath(userId);
  await firestoreDelete(path, tunnelId);
}
