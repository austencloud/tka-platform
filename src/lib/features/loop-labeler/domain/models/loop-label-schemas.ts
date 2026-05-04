import { z } from "zod";

const LOOPDesignationSchema = z
  .object({
    components: z.array(z.string()),
    loopType: z.string().nullable(),
    period: z.string().nullable().optional(),
  })
  .passthrough();

const SectionDesignationSchema = z
  .object({
    steps: z.array(z.number()),
    components: z.array(z.string()),
    loopType: z.string().nullable(),
    period: z.string().nullable().optional(),
  })
  .passthrough();

const StepPairRelationshipSchema = z
  .object({
    keyStep: z.number(),
    correspondingStep: z.number(),
    detectedTransformations: z.array(z.string()),
  })
  .passthrough();

export const LabeledSequenceSchema = z
  .object({
    word: z.string(),
    designations: z.array(LOOPDesignationSchema),
    sections: z.array(SectionDesignationSchema).optional(),
    stepPairs: z.array(StepPairRelationshipSchema).optional(),
    isFreeform: z.boolean(),
    isUnknown: z.boolean().optional(),
    needsVerification: z.boolean().optional(),
    autoLabeled: z.boolean().optional(),
    labeledAt: z.string(),
    notes: z.string(),
  })
  .passthrough();

export type LabeledSequence = z.infer<typeof LabeledSequenceSchema>;
