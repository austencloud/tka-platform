import { describe, expect, it } from "vitest";
import {
  createCollaborativeVideo,
  createSequencePerformanceAssociation,
  createTunnelRealizationAssociation,
  mediaAssociationKey,
  normalizeMediaAssociations,
} from "$lib/shared/video-collaboration/domain/collaborative-video";

const base = {
  id: "video-1",
  videoUrl: "https://example.com/video.mp4",
  storagePath: "recordings/video.mp4",
  duration: 12,
  fileSize: 123,
  mimeType: "video/mp4",
  creatorId: "creator-1",
};

describe("video media associations", () => {
  it("hydrates a legacy sequence reference into a performance association", () => {
    const video = createCollaborativeVideo({
      ...base,
      sequenceId: "sequence-1",
      sequenceName: "ABCD",
    });

    expect(video.associations).toEqual([
      createSequencePerformanceAssociation("sequence-1", "ABCD"),
    ]);
    expect(mediaAssociationKey(video.associations[0]!)).toBe(
      "sequence:sequence-1"
    );
  });

  it("keeps a tunnel realization distinct from source-sequence lineage", () => {
    const association = createTunnelRealizationAssociation(
      "tunnel-1",
      "Prism tunnel",
      "sequence-1"
    );
    const video = createCollaborativeVideo({
      ...base,
      associations: [association],
    });

    expect(video.sequenceId).toBeUndefined();
    expect(video.associations).toEqual([association]);
    expect(mediaAssociationKey(video.associations[0]!)).toBe("tunnel:tunnel-1");
  });

  it("deduplicates legacy and typed references to the same performance", () => {
    expect(
      normalizeMediaAssociations({
        sequenceId: "sequence-1",
        associations: [
          createSequencePerformanceAssociation("sequence-1", "ABCD"),
        ],
      })
    ).toHaveLength(1);
  });

  it("requires every video to describe a subject", () => {
    expect(() => createCollaborativeVideo(base)).toThrow(
      "associated with a sequence or artwork"
    );
  });
});
