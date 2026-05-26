import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";
import type { Timestamp } from "firebase/firestore";

export interface SpecialArrowPlacement {
  readonly key: string;
  readonly gridMode: string;
  readonly oriFolder: string;
  readonly letter: string;
  readonly turnsTuple: string;
  readonly motionType: string;
  readonly adjustmentX: number;
  readonly adjustmentY: number;
  readonly originalX: number;
  readonly originalY: number;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

export interface SpecialArrowPlacementInput {
  readonly gridMode: string;
  readonly oriFolder: string;
  readonly letter: string;
  readonly turnsTuple: string;
  readonly motionType: string;
  readonly adjustmentX: number;
  readonly adjustmentY: number;
  readonly originalX: number;
  readonly originalY: number;
}

export const SpecialArrowPlacementSchema = z
  .object({
    key: z.string(),
    gridMode: z.string(),
    oriFolder: z.string(),
    letter: z.string(),
    turnsTuple: z.string(),
    motionType: z.string(),
    adjustmentX: z.number(),
    adjustmentY: z.number(),
    originalX: z.number(),
    originalY: z.number(),
    updatedAt: firestoreDate,
    updatedBy: z.string(),
  })
  .passthrough();

export function generateSpecialOverrideKey(input: {
  gridMode: string;
  oriFolder: string;
  letter: string;
  turnsTuple: string;
  motionType: string;
}): string {
  return `${input.gridMode}|${input.oriFolder}|${input.letter}|${input.turnsTuple}|${input.motionType}`;
}

export function parseSpecialOverrideKey(key: string): {
  gridMode: string;
  oriFolder: string;
  letter: string;
  turnsTuple: string;
  motionType: string;
} | null {
  const parts = key.split("|");
  if (parts.length !== 5) return null;
  const [gridMode, oriFolder, letter, turnsTuple, motionType] = parts;
  if (!gridMode || !oriFolder || !letter || !turnsTuple || !motionType) return null;
  return { gridMode, oriFolder, letter, turnsTuple, motionType };
}

export function extractOriFolderFromPath(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length >= 3) return parts[2] ?? "from_layer1";
  return "from_layer1";
}
