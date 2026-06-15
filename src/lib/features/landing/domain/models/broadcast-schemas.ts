import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";
import { LOOPType, Period } from "$lib/shared/foundation/domain/models/generation/circular-models";

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
    // Parse straight to the domain enums so the inferred type matches
    // BroadcastSequence (shared model) — keeps subscribeToHistory cast-free.
    loopType: z.nativeEnum(LOOPType),
    period: z.nativeEnum(Period),
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
