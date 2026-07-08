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
  createdAt: z.any(),
  updatedAt: z.any().optional(),
  source: z.enum(["viewer", "default"]).optional(),
});

export const TUNNEL_COLLECTION_STORAGE_KEY = "tka:tunnel-collection";
export const TUNNEL_COLLECTION_SCHEMA_VERSION = 1;
