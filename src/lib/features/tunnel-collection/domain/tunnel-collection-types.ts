import { z } from "zod";
import { StepDataSchema } from "$lib/shared/foundation/domain/schemas";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { TunnelSnapshotSchema, type TunnelSnapshot } from "$lib/shared/sequence-viewer/tunnel/tunnel-snapshot";

export interface CollectedTunnel {
  id: string;
  name: string;
  steps: StepData[];
  snapshot: TunnelSnapshot;
  poster: string; // ~200px WebP data URL
  createdAt: number;
  source?: "viewer" | "default";
}

export const CollectedTunnelSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  steps: z.array(StepDataSchema),
  snapshot: TunnelSnapshotSchema,
  poster: z.string(),
  // createdAt is always the client's Date.now() number (saveTunnel passes an
  // explicit id, so firestoreSet preserves it). updatedAt is a SERVER timestamp
  // firestoreSet stamps on every write — an object on read, hence z.any().
  createdAt: z.number(),
  updatedAt: z.any().optional(),
  source: z.enum(["viewer", "default"]).optional(),
});

export const TUNNEL_COLLECTION_STORAGE_KEY = "tka:tunnel-collection";
export const TUNNEL_COLLECTION_SCHEMA_VERSION = 1;
