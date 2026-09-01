import { describe, expect, it } from "vitest";
import type { CollectedMandala } from "../mandala-collection-types";
import {
  createMandalaRevision,
  currentMandalaRevisionRef,
  mandalaRevisionPayload,
  prepareMandalaRevision,
} from "../mandala-revision";
import {
  createMandalaPublicRevision,
  mandalaPublicPayload,
} from "../mandala-public-revision";

function mandalaFixture(
  overrides: Partial<CollectedMandala> = {}
): CollectedMandala {
  return {
    id: "mandala-1",
    name: "Bloom",
    steps: [],
    variant: "both",
    leftPropType: "staff",
    rightPropType: "staff",
    createdAt: 123,
    ...overrides,
  };
}

describe("mandalaRevisionPayload", () => {
  it("omits absent optionals instead of writing undefined", () => {
    expect(Object.keys(mandalaRevisionPayload(mandalaFixture())).sort()).toEqual(
      ["leftPropType", "rightPropType", "steps", "variant"]
    );
  });

  it("excludes the name — a label around the work, not the work", () => {
    const payload = mandalaRevisionPayload(
      mandalaFixture({ name: "Renamed entirely" })
    );
    expect("name" in payload).toBe(false);
  });
});

describe("createMandalaRevision", () => {
  it("is deterministic for identical content", async () => {
    const a = await createMandalaRevision(mandalaFixture(), 1);
    const b = await createMandalaRevision(mandalaFixture(), 999);
    expect(a.revisionId).toBe(b.revisionId);
    expect(a.revisionId).toMatch(/^v1_[a-f0-9]{64}$/);
    expect(a.artifactType).toBe("mandala");
  });

  it("changes when digest-covered content changes", async () => {
    const a = await createMandalaRevision(mandalaFixture(), 1);
    const b = await createMandalaRevision(
      mandalaFixture({ variant: "left" }),
      1
    );
    expect(a.revisionId).not.toBe(b.revisionId);
  });

  it("does not change when only the name changes", async () => {
    const a = await createMandalaRevision(mandalaFixture(), 1);
    const b = await createMandalaRevision(mandalaFixture({ name: "Other" }), 1);
    expect(a.revisionId).toBe(b.revisionId);
  });
});

describe("prepareMandalaRevision", () => {
  it("stamps revision metadata a save can carry", async () => {
    const prepared = await prepareMandalaRevision(mandalaFixture());
    expect(prepared.currentRevisionId).toMatch(/^v1_[a-f0-9]{64}$/);
    expect(prepared.currentRevisionId).toBe(
      `v1_${prepared.currentContentDigest}`
    );
    expect(prepared.revisionDigestAlgorithm).toBe("SHA-256");
    expect(prepared.revisionDigestVersion).toBe(1);
    expect(prepared.currentRevisionCreatedAt).toBe(123);
  });

  it("reuses the previous revision id when content is unchanged", async () => {
    const first = await prepareMandalaRevision(mandalaFixture());
    const second = await prepareMandalaRevision(
      mandalaFixture({ name: "Renamed" }),
      first
    );
    expect(second.currentRevisionId).toBe(first.currentRevisionId);
    expect(second.currentRevisionCreatedAt).toBe(
      first.currentRevisionCreatedAt
    );
  });

  it("mints a new revision when content changes", async () => {
    const first = await prepareMandalaRevision(mandalaFixture());
    const second = await prepareMandalaRevision(
      mandalaFixture({ variant: "right" }),
      first
    );
    expect(second.currentRevisionId).not.toBe(first.currentRevisionId);
  });
});

describe("currentMandalaRevisionRef", () => {
  it("is null for a legacy entry with no revision metadata", () => {
    expect(currentMandalaRevisionRef(mandalaFixture())).toBeNull();
  });

  it("reconstructs the ref from the stamped fields", async () => {
    const prepared = await prepareMandalaRevision(mandalaFixture());
    expect(currentMandalaRevisionRef(prepared)).toEqual({
      artifactId: "mandala-1",
      revisionId: prepared.currentRevisionId,
      contentDigest: prepared.currentContentDigest,
      digestAlgorithm: "SHA-256",
      digestVersion: 1,
    });
  });
});

describe("mandalaPublicPayload", () => {
  it("never carries private lineage fields", () => {
    const payload = mandalaPublicPayload(
      mandalaFixture({
        source: "sequence",
        sourceWord: "ABAB",
        sourceSequenceId: "library-sequence-42",
      })
    );
    expect("sourceSequenceId" in payload).toBe(false);
    expect("source" in payload).toBe(false);
    expect(payload.sourceWord).toBe("ABAB");
    expect(JSON.stringify(payload)).not.toContain("library-sequence-42");
  });

  it("carries no poster — the guest view redraws from steps", () => {
    const payload = mandalaPublicPayload(mandalaFixture());
    expect("poster" in payload).toBe(false);
    expect(Object.keys(payload).sort()).toEqual([
      "leftPropType",
      "rightPropType",
      "steps",
      "variant",
    ]);
  });
});

describe("createMandalaPublicRevision", () => {
  it("is deterministic for identical public content", async () => {
    const a = await createMandalaPublicRevision(mandalaFixture());
    const b = await createMandalaPublicRevision(mandalaFixture());
    expect(a.revisionId).toBe(b.revisionId);
    expect(a.revisionId).toMatch(/^v1_[a-f0-9]{64}$/);
    expect(a.artifactType).toBe("mandala");
  });

  it("ignores private-only differences", async () => {
    const base = await createMandalaPublicRevision(mandalaFixture());
    const withLineage = await createMandalaPublicRevision(
      mandalaFixture({
        source: "sequence",
        sourceSequenceId: "library-sequence-42",
        currentRevisionId: `v1_${"a".repeat(64)}`,
        currentContentDigest: "a".repeat(64),
      })
    );
    expect(withLineage.revisionId).toBe(base.revisionId);
  });

  it("changes with public content", async () => {
    const a = await createMandalaPublicRevision(mandalaFixture());
    const b = await createMandalaPublicRevision(
      mandalaFixture({ pathShape: "linear" })
    );
    expect(a.revisionId).not.toBe(b.revisionId);
  });

  it("addresses a different payload than the private revision when private extras exist", async () => {
    const mandala = mandalaFixture({
      source: "sequence",
      sourceSequenceId: "library-sequence-42",
    });
    const privateRevision = await createMandalaRevision(
      mandala,
      mandala.createdAt
    );
    const publicRevision = await createMandalaPublicRevision(mandala);
    expect(publicRevision.contentDigest).not.toBe(
      privateRevision.contentDigest
    );
  });
});
