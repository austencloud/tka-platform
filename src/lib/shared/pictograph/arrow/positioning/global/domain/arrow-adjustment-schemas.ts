import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";

export const GlobalArrowAdjustmentSchema = z
  .object({
    gridMode: z.string(),
    oriKey: z.string(),
    letter: z.string(),
    turnsTuple: z.string(),
    arrowKey: z.string(),
    propType: z.string().optional(),
    otherPropType: z.string().optional(),
    adjustmentX: z.number(),
    adjustmentY: z.number(),
    updatedAt: firestoreDate,
    updatedBy: z.string(),
  })
  .passthrough();

export type GlobalArrowAdjustmentParsed = z.infer<typeof GlobalArrowAdjustmentSchema>;
