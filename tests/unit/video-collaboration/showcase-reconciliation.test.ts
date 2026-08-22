import { describe, expect, it } from "vitest";
import { buildShowcaseReviewManifest } from "../../../scripts/migrations/reconcile-showcase-video-associations";

describe("showcase video reconciliation", () => {
  it("blocks ambiguous consent even when the sequence and canonical asset match", () => {
    const [row] = buildShowcaseReviewManifest(
      [
        {
          id: "showcase-1",
          data: {
            videoUrl: "https://cdn/video.mp4",
            approved: false,
            linkedSequences: [{ id: "sequence-1", word: "ABCD" }],
          },
        },
      ],
      [
        {
          id: "canonical-1",
          data: { videoUrl: "https://cdn/video.mp4" },
        },
      ],
      new Set(["sequence-1"])
    );

    expect(row?.status).toBe("blocked-consent");
    expect(row?.proposedAssociations).toEqual([
      {
        subjectType: "sequence",
        subjectId: "sequence-1",
        relationship: "performance",
        subjectLabel: "ABCD",
      },
    ]);
  });

  it("allows only an approved, exact, uniquely matched record to update", () => {
    const [row] = buildShowcaseReviewManifest(
      [
        {
          id: "showcase-1",
          data: {
            storagePath: "showcase/video.mp4",
            approved: true,
            sequenceId: "sequence-1",
            sequenceWord: "ABCD",
            performers: [{ id: "ig:sky", displayName: "Sky" }],
          },
        },
      ],
      [
        {
          id: "canonical-1",
          data: { storagePath: "showcase/video.mp4" },
        },
      ],
      new Set(["sequence-1"])
    );

    expect(row).toMatchObject({
      status: "ready-update",
      canonicalVideoIds: ["canonical-1"],
      performers: [{ id: "ig:sky", displayName: "Sky" }],
    });
  });

  it("reports unresolved subjects instead of matching by word", () => {
    const [row] = buildShowcaseReviewManifest(
      [
        {
          id: "showcase-1",
          data: {
            videoUrl: "https://cdn/video.mp4",
            approved: true,
            linkedSequences: [{ id: "old-word", word: "ABCD" }],
          },
        },
      ],
      [{ id: "canonical-1", data: { videoUrl: "https://cdn/video.mp4" } }],
      new Set(["different-id"])
    );

    expect(row?.status).toBe("blocked-unresolved-subject");
    expect(row?.unresolvedSequenceIds).toEqual(["old-word"]);
  });
});
