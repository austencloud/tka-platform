import { describe, expect, it } from "vitest";
import {
  formatMegabytes,
  loadStagedIntakeCandidates,
  parseCandidateId,
  parseIntakeManifest,
  parseLightingId,
  parseStressPoseId,
  resolveCandidate,
  stagedCandidate,
} from "./avatar-bakeoff-data";

const manifest = {
  schemaVersion: 1,
  updatedAt: "2026-09-05T10:00:00.000Z",
  candidates: [
    {
      id: "malcolm",
      label: "Malcolm",
      source: "Adobe Mixamo · Malcolm",
      file: "intake-malcolm.glb",
      bytes: 2_500_000,
      note: "22/22 body bones · fingers complete",
      stagedAt: "2026-09-05T10:00:00.000Z",
    },
    { id: "../escape", file: "intake-escape.glb" },
    { id: "kaya", file: "not-a-model.txt" },
    { id: "malcolm", file: "intake-duplicate.glb" },
    "garbage",
  ],
};

describe("avatar bake-off query parsing", () => {
  it("accepts known candidates and falls back from stale links", () => {
    expect(parseCandidateId("avatar-sdk")).toBe("avatar-sdk");
    expect(parseCandidateId("human-generator-trial")).toBe(
      "human-generator-trial"
    );
    expect(parseCandidateId("human-generator-parity")).toBe(
      "human-generator-parity"
    );
    expect(parseCandidateId("personal-metaperson")).toBe("personal-metaperson");
    expect(parseCandidateId("intake-current")).toBe("intake-current");
    expect(parseCandidateId("missing-vendor")).toBe("current-optimized");
  });

  it("accepts a staged intake only once the manifest lists it", () => {
    const staged = parseIntakeManifest(manifest).map(stagedCandidate);

    expect(parseCandidateId("intake-malcolm")).toBe("current-optimized");
    expect(parseCandidateId("intake-malcolm", staged)).toBe("intake-malcolm");
    expect(resolveCandidate("intake-malcolm", staged)).toMatchObject({
      id: "intake-malcolm",
      label: "Malcolm",
      modelUrl: "/models/avatars/bakeoff/intake-malcolm.glb",
      bytes: 2_500_000,
      continuity: "current",
    });
    expect(resolveCandidate("intake-gone", staged).id).toBe(
      "current-optimized"
    );
  });

  it("accepts known stress poses and defaults to the hardest comparison", () => {
    expect(parseStressPoseId("overhead")).toBe("overhead");
    expect(parseStressPoseId(null)).toBe("cross-body");
  });

  it("defaults to studio lighting so old links still match the old frames", () => {
    expect(parseLightingId("room")).toBe("room");
    expect(parseLightingId("disco")).toBe("studio");
    expect(parseLightingId(null)).toBe("studio");
  });

  it("labels the variable local intake without inventing a file size", () => {
    expect(formatMegabytes(null)).toBe("local staged file");
  });
});

describe("staged intake manifest", () => {
  it("keeps only entries that name a safe GLB and drops duplicates", () => {
    const entries = parseIntakeManifest(manifest);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "malcolm",
      file: "intake-malcolm.glb",
      note: "22/22 body bones · fingers complete",
    });
    expect(parseIntakeManifest(null)).toEqual([]);
    expect(parseIntakeManifest({ candidates: "nope" })).toEqual([]);
  });

  it("fills in a review note when the manifest has none", () => {
    expect(
      stagedCandidate({
        id: "kaya",
        label: "Kaya",
        source: "Adobe Mixamo · Kaya",
        file: "intake-kaya.glb",
        bytes: null,
        note: "",
        stagedAt: "",
      }).note
    ).toContain("Review every stress pose");
  });

  it("treats a missing or broken manifest as no staged intakes", async () => {
    const missing = await loadStagedIntakeCandidates(
      async () => new Response(null, { status: 404 })
    );
    const broken = await loadStagedIntakeCandidates(async () => {
      throw new Error("offline");
    });
    const present = await loadStagedIntakeCandidates(
      async () =>
        new Response(JSON.stringify(manifest), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );

    expect(missing).toEqual([]);
    expect(broken).toEqual([]);
    expect(present.map((candidate) => candidate.id)).toEqual([
      "intake-malcolm",
    ]);
  });
});
