import { describe, expect, it } from "vitest";

import { validateCharacterProvenance } from "../../../scripts/characters/character-provenance.mjs";
import {
  MESHY_OWNERSHIP_ARTICLE_URL,
  buildMeshyProvenance,
  createMeshyRiggingBody,
  parseGeneratorArguments,
} from "../../../scripts/characters/meshy-character-generator.mjs";
import { createMeshyPreviewBody } from "../../../scripts/lib/meshy-text-generator.mjs";

const performer = {
  id: "juniper",
  displayName: "Juniper",
  description: "athletic feminine silhouette",
  heightMeters: 1.68,
  prompt: "woman in her late twenties",
  texturePrompt: "realistic skin",
};

describe("parseGeneratorArguments", () => {
  it("reads the manifest, output and optional selection", () => {
    expect(
      parseGeneratorArguments([
        "--",
        "--manifest",
        "scripts/characters/meshy-performers.json",
        "--output",
        "D:/Downloads/meshy-performers",
        "--only",
        "juniper",
        "--dry-run",
      ])
    ).toEqual({
      manifestPath: "scripts/characters/meshy-performers.json",
      outputDirectory: "D:/Downloads/meshy-performers",
      only: "juniper",
      dryRun: true,
      force: false,
    });
  });

  it("refuses an unknown flag and a missing output", () => {
    expect(() =>
      parseGeneratorArguments(["--manifest", "m", "--yolo"])
    ).toThrow("Unknown argument: --yolo");
    expect(() => parseGeneratorArguments(["--manifest", "m"])).toThrow(
      "--output is required"
    );
  });
});

describe("createMeshyPreviewBody for performers", () => {
  it("asks Meshy for a rig-ready pose only when the manifest sets one", () => {
    const manifest = { stylePrefix: "photorealistic", poseMode: "a-pose" };
    expect(createMeshyPreviewBody(manifest, performer)).toMatchObject({
      mode: "preview",
      prompt: "photorealistic woman in her late twenties",
      pose_mode: "a-pose",
    });
    expect(
      createMeshyPreviewBody({ stylePrefix: "tree" }, { prompt: "pine" })
    ).not.toHaveProperty("pose_mode");
  });
});

describe("createMeshyRiggingBody", () => {
  it("chains the refine task and passes the performer height", () => {
    expect(createMeshyRiggingBody(performer, "refine-id")).toEqual({
      input_task_id: "refine-id",
      height_meters: 1.68,
    });
    expect(createMeshyRiggingBody({ id: "x" }, "r").height_meters).toBe(1.7);
  });
});

describe("buildMeshyProvenance", () => {
  it("produces a record the intake gate accepts", () => {
    const provenance = buildMeshyProvenance({
      asset: performer,
      taskIds: { previewId: "p1", refineId: "r1", rigId: "g1" },
      retrievedAt: "2026-09-05",
      acquiredAt: "2026-09-05T20:00:00.000Z",
    });
    const validation = validateCharacterProvenance(provenance);
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
    expect(provenance.source.provider).toBe("Meshy");
    expect(provenance.source.assetId).toBe("preview p1; refine r1; rig g1");
    expect(provenance.evidence[0].url).toBe(MESHY_OWNERSHIP_ARTICLE_URL);
    expect(provenance.rights.restrictions[0]).toMatch(/Meshy Community/);
  });
});
