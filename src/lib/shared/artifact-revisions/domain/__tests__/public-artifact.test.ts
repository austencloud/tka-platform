import { describe, expect, it } from "vitest";
import { createArtifactRevisionRef } from "../artifact-revision";
import {
  ARTIFACT_PUBLICATION_SCHEMA_VERSION,
  canOwnerTransition,
  canReviewerTransition,
  isArtifactPublicationRequest,
  isPublicArtifactEnvelope,
  publicationRequestId,
  type ArtifactPublicationRequest,
  type ArtifactPublicationStatus,
  type PublicArtifactEnvelope,
} from "../public-artifact";

const digest = "a".repeat(64);
const revisionId = `v1_${digest}`;

function envelopeFixture(
  overrides: Partial<PublicArtifactEnvelope> = {}
): PublicArtifactEnvelope {
  return {
    artifactId: "tunnel-1",
    artifactType: "tunnel",
    ownerId: "owner-1",
    ownerDisplayName: "Austen",
    title: "My Tunnel",
    currentRevisionId: revisionId,
    currentContentDigest: digest,
    publishedAt: new Date(0),
    updatedAt: new Date(0),
    schemaVersion: ARTIFACT_PUBLICATION_SCHEMA_VERSION,
    ...overrides,
  };
}

function requestFixture(
  overrides: Partial<ArtifactPublicationRequest> = {}
): ArtifactPublicationRequest {
  return {
    requestId: publicationRequestId("tunnel-1", revisionId),
    artifactId: "tunnel-1",
    artifactType: "tunnel",
    ownerId: "owner-1",
    ownerDisplayName: "Austen",
    title: "My Tunnel",
    revisionId,
    contentDigest: digest,
    digestAlgorithm: "SHA-256",
    digestVersion: 1,
    payload: { steps: [] },
    sourceRevision: createArtifactRevisionRef("tunnel-1", "b".repeat(64)),
    status: "published",
    requestedAt: new Date(0),
    schemaVersion: ARTIFACT_PUBLICATION_SCHEMA_VERSION,
    ...overrides,
  };
}

describe("publicationRequestId", () => {
  it("joins artifact and revision ids", () => {
    expect(publicationRequestId("tunnel-1", revisionId)).toBe(
      `tunnel-1_${revisionId}`
    );
  });

  it("rejects blank components", () => {
    expect(() => publicationRequestId("", revisionId)).toThrow();
    expect(() => publicationRequestId("tunnel-1", " ")).toThrow();
  });
});

describe("publication status machine", () => {
  const all: ArtifactPublicationStatus[] = [
    "published",
    "withdrawn",
    "removed",
  ];

  it("owners may withdraw and republish, nothing else — removed is terminal", () => {
    const allowed = new Set(["published>withdrawn", "withdrawn>published"]);
    for (const from of all) {
      for (const to of all) {
        expect(canOwnerTransition(from, to)).toBe(allowed.has(`${from}>${to}`));
      }
    }
  });

  it("reviewers may only take down published content", () => {
    const allowed = new Set(["published>removed"]);
    for (const from of all) {
      for (const to of all) {
        expect(canReviewerTransition(from, to)).toBe(
          allowed.has(`${from}>${to}`)
        );
      }
    }
  });
});

describe("isPublicArtifactEnvelope", () => {
  it("accepts a well-formed envelope", () => {
    expect(isPublicArtifactEnvelope(envelopeFixture())).toBe(true);
  });

  it("rejects a revision id that does not address the digest", () => {
    expect(
      isPublicArtifactEnvelope(
        envelopeFixture({ currentRevisionId: `v1_${"f".repeat(64)}` })
      )
    ).toBe(false);
  });

  it("rejects unknown artifact types and missing owners", () => {
    expect(
      isPublicArtifactEnvelope(
        envelopeFixture({ artifactType: "poster" as never })
      )
    ).toBe(false);
    expect(isPublicArtifactEnvelope(envelopeFixture({ ownerId: "" }))).toBe(
      false
    );
  });
});

describe("isArtifactPublicationRequest", () => {
  it("accepts a well-formed request", () => {
    expect(isArtifactPublicationRequest(requestFixture())).toBe(true);
  });

  it("rejects a request id that does not match its parts", () => {
    expect(
      isArtifactPublicationRequest(requestFixture({ requestId: "tunnel-1_v1_x" }))
    ).toBe(false);
  });

  it("rejects a malformed source revision", () => {
    expect(
      isArtifactPublicationRequest(
        requestFixture({
          sourceRevision: {
            ...createArtifactRevisionRef("tunnel-1", "b".repeat(64)),
            revisionId: "v1_wrong",
          },
        })
      )
    ).toBe(false);
  });

  it("rejects unknown statuses", () => {
    expect(
      isArtifactPublicationRequest(
        requestFixture({ status: "archived" as never })
      )
    ).toBe(false);
  });
});
