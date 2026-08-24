import { describe, expect, it } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  createIndependentTunnelPerformer,
  createTunnelComposition,
} from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
import {
  parseTunnelCreatorDraft,
  TUNNEL_CREATOR_DRAFT_VERSION,
  type TunnelCreatorDraft,
} from "./tunnel-creator-draft";

const sequence = {
  id: "sequence-1",
  name: "AAAA",
  word: "AAAA",
  steps: [{ id: "step-1" }],
} as unknown as SequenceData;

describe("tunnel creator draft", () => {
  it("round-trips a partial separate-mode draft", () => {
    const draft: TunnelCreatorDraft = {
      version: TUNNEL_CREATOR_DRAFT_VERSION,
      mode: "separate",
      composition: createTunnelComposition([
        createIndependentTunnelPerformer(sequence, 0, "Performer 1"),
      ]),
      relationship: {
        rotationSteps: 3,
        reflect: "mirror",
        invert: true,
        rewind: false,
      },
      sourceStates: [],
      workspace: {
        activePanel: "generation",
        generationTargetId: "performer-1",
      },
      editingTunnel: { id: "tunnel-1", name: "Saved tunnel" },
    };

    expect(parseTunnelCreatorDraft(JSON.parse(JSON.stringify(draft)))).toEqual(
      draft
    );
  });

  it("migrates a version-one draft without losing its composition", () => {
    const legacy = {
      version: 1,
      mode: "linked",
      composition: createTunnelComposition([
        createIndependentTunnelPerformer(sequence, 0, "Performer 1"),
      ]),
      relationship: {
        rotationSteps: 0,
        reflect: "none",
        invert: false,
        rewind: false,
      },
      editingTunnel: null,
    };

    const migrated = parseTunnelCreatorDraft(legacy);

    expect(migrated?.version).toBe(TUNNEL_CREATOR_DRAFT_VERSION);
    expect(migrated?.composition).toEqual(legacy.composition);
    expect(migrated?.sourceStates).toEqual([]);
    expect(migrated?.workspace).toEqual({
      activePanel: null,
      generationTargetId: null,
    });
  });

  it("migrates a version-two draft with a closed workspace", () => {
    const legacy = {
      version: 2,
      mode: "separate",
      composition: null,
      relationship: {
        rotationSteps: 0,
        reflect: "none",
        invert: false,
        rewind: false,
      },
      sourceStates: [],
      editingTunnel: null,
    };

    expect(parseTunnelCreatorDraft(legacy)?.workspace).toEqual({
      activePanel: null,
      generationTargetId: null,
    });
  });

  it("rejects malformed drafts instead of partially restoring them", () => {
    expect(
      parseTunnelCreatorDraft({
        version: TUNNEL_CREATOR_DRAFT_VERSION,
        mode: "linked",
        composition: { performers: [] },
        relationship: {},
        editingTunnel: null,
      })
    ).toBeNull();
  });
});
