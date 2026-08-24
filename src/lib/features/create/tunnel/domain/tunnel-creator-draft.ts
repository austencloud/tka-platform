import { z } from "zod";
import {
  TunnelCompositionSchema,
  type TunnelComposition,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { TunnelRelationshipRule } from "./tunnel-relationship-rule";

export const TUNNEL_CREATOR_DRAFT_VERSION = 3;

export type TunnelSourceOrigin = "picked" | "generated";
export type TunnelWorkspacePanel = "settings" | "pairing" | "generation" | null;

export interface TunnelWorkspaceDraft {
  activePanel: TunnelWorkspacePanel;
  generationTargetId: string | null;
}

export interface TunnelSourceHistoryEntry {
  sequence: SequenceData;
  origin: TunnelSourceOrigin;
}

export interface TunnelPerformerSourceDraft {
  performerId: string;
  label: string;
  independentSequence: SequenceData | null;
  origin: TunnelSourceOrigin | null;
  previous: TunnelSourceHistoryEntry[];
}

export interface TunnelCreatorDraft {
  version: typeof TUNNEL_CREATOR_DRAFT_VERSION;
  mode: "separate" | "linked";
  composition: TunnelComposition | null;
  relationship: TunnelRelationshipRule;
  sourceStates: TunnelPerformerSourceDraft[];
  workspace: TunnelWorkspaceDraft;
  editingTunnel: { id: string; name: string } | null;
}

const SequenceSnapshotSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    word: z.string(),
    steps: z.array(z.any()),
  })
  .passthrough();

const RelationshipSchema = z.object({
  rotationSteps: z.number().finite(),
  reflect: z.enum(["none", "mirror", "flip"]),
  invert: z.boolean(),
  rewind: z.boolean(),
});

const EditingTunnelSchema = z
  .object({ id: z.string().min(1), name: z.string().min(1) })
  .nullable();

const WorkspaceSchema = z.object({
  activePanel: z.enum(["settings", "pairing", "generation"]).nullable(),
  generationTargetId: z.string().min(1).nullable(),
});

const SourceStatesSchema = z.array(
  z.object({
    performerId: z.string().min(1),
    label: z.string().min(1),
    independentSequence: SequenceSnapshotSchema.nullable(),
    origin: z.enum(["picked", "generated"]).nullable(),
    previous: z.array(
      z.object({
        sequence: SequenceSnapshotSchema,
        origin: z.enum(["picked", "generated"]),
      })
    ),
  })
);

const TunnelCreatorDraftSchema = z.object({
  version: z.literal(TUNNEL_CREATOR_DRAFT_VERSION),
  mode: z.enum(["separate", "linked"]),
  composition: TunnelCompositionSchema.nullable(),
  relationship: RelationshipSchema,
  sourceStates: SourceStatesSchema,
  workspace: WorkspaceSchema,
  editingTunnel: EditingTunnelSchema,
});

const VersionTwoTunnelCreatorDraftSchema = z.object({
  version: z.literal(2),
  mode: z.enum(["separate", "linked"]),
  composition: TunnelCompositionSchema.nullable(),
  relationship: RelationshipSchema,
  sourceStates: SourceStatesSchema,
  editingTunnel: EditingTunnelSchema,
});

const VersionOneTunnelCreatorDraftSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["separate", "linked"]),
  composition: TunnelCompositionSchema.nullable(),
  relationship: RelationshipSchema,
  editingTunnel: EditingTunnelSchema,
});

/**
 * A stale or partially written draft should open as an empty creator, never as
 * a plausible-looking tunnel with missing performers or malformed transforms.
 */
export function parseTunnelCreatorDraft(
  value: unknown
): TunnelCreatorDraft | null {
  const parsed = TunnelCreatorDraftSchema.safeParse(value);
  if (parsed.success) return parsed.data as unknown as TunnelCreatorDraft;

  const versionTwo = VersionTwoTunnelCreatorDraftSchema.safeParse(value);
  if (versionTwo.success) {
    return {
      ...versionTwo.data,
      version: TUNNEL_CREATOR_DRAFT_VERSION,
      workspace: { activePanel: null, generationTargetId: null },
    } as unknown as TunnelCreatorDraft;
  }

  const versionOne = VersionOneTunnelCreatorDraftSchema.safeParse(value);
  if (!versionOne.success) return null;

  return {
    ...versionOne.data,
    version: TUNNEL_CREATOR_DRAFT_VERSION,
    sourceStates: [],
    workspace: { activePanel: null, generationTargetId: null },
  } as unknown as TunnelCreatorDraft;
}
