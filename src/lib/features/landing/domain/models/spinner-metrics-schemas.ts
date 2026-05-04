import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";

export const SpinnerMetricsSchema = z
  .object({
    totalGenerated: z.number(),
    lastGeneratedAt: firestoreDate.nullable(),
  })
  .passthrough();

export type SpinnerMetrics = z.infer<typeof SpinnerMetricsSchema>;
