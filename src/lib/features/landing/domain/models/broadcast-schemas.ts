import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";

const BroadcastHandSchema = z
  .object({
    motionType: z.string(),
    rotationDirection: z.string(),
    startLocation: z.string(),
    endLocation: z.string(),
    startOrientation: z.string().optional(),
    endOrientation: z.string().optional(),
  })
  .passthrough();

const BroadcastStepDataSchema = z
  .object({
    id: z.string(),
    letter: z.string(),
    startPosition: z.string(),
    endPosition: z.string(),
    timing: z.string(),
    direction: z.string(),
    blue: BroadcastHandSchema,
    red: BroadcastHandSchema,
    stepNumber: z.number().optional(),
  })
  .passthrough();

const BroadcastSequenceSchema = z
  .object({
    id: z.string(),
    word: z.string(),
    steps: z.array(BroadcastStepDataSchema),
    startPosition: z.string(),
    gridMode: z.string(),
    isCircular: z.boolean(),
    loopType: z.string(),
    period: z.string(),
    totalSteps: z.number(),
  })
  .passthrough();

export const BroadcastStateSchema = z
  .object({
    currentSequence: BroadcastSequenceSchema,
    sequenceNumber: z.number(),
    startedAt: firestoreDate,
    endsAt: firestoreDate,
    durationMs: z.number(),
    beatsPerMinute: z.number(),
    generatedAt: firestoreDate,
  })
  .passthrough();

export type BroadcastState = z.infer<typeof BroadcastStateSchema>;

export const BroadcastHistoryEntrySchema = z
  .object({
    id: z.string(),
    sequence: BroadcastSequenceSchema,
    sequenceNumber: z.number(),
    playedAt: firestoreDate,
  })
  .passthrough();

export type BroadcastHistoryEntryParsed = z.infer<typeof BroadcastHistoryEntrySchema>;
