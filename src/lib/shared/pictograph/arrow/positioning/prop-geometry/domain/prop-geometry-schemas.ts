import { z } from "zod";
// Worker-safe leaf (no auth/firebase-client): the barrel pulls authState → $app/navigation.
import { firestoreDate } from "$lib/shared/firestore/firestore-date";

export const PropGeometryAdjustmentSchema = z
  .object({
    gridMode: z.string(),
    propType: z.string(),
    otherPropType: z.string(),
    positionType: z.string(),
    endOrientation: z.string(),
    otherEndOrientation: z.string(),
    motionType: z.string(),
    turns: z.string(),
    arrowColor: z.string(),
    adjustmentX: z.number(),
    adjustmentY: z.number(),
    updatedAt: firestoreDate,
    updatedBy: z.string(),
  })
  .passthrough();

export type PropGeometryAdjustmentParsed = z.infer<typeof PropGeometryAdjustmentSchema>;
