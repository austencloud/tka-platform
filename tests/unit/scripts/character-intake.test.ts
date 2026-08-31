import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildPromotionPacket,
  intakeCharacter,
  parseArguments,
} from "../../../scripts/characters/character-intake.mjs";
import {
  REQUIRED_BODY_BONES,
  inspectCharacterGlb,
  normalizeRuntimeJointNames,
} from "../../../scripts/characters/character-glb.mjs";
import { validateCharacterProvenance } from "../../../scripts/characters/character-provenance.mjs";
import { buildCharacterOptimizationSteps } from "../../../scripts/lib/optimize-character-glb.mjs";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(resolve(tmpdir(), "tka-character-intake-"));
  temporaryDirectories.push(directory);
  return directory;
}

function validProvenance(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: "test-performer",
    displayName: "Test Performer",
    description: "Synthetic intake fixture",
    source: {
      provider: "Fixture Foundry",
      assetName: "Rigged Test Human",
      assetId: "fixture-1",
      creator: "TKA tests",
      url: "https://example.com/characters/fixture-1",
    },
    license: {
      name: "Fixture license",
      spdx: "CC0-1.0",
      url: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    rights: {
      commercialUse: "allowed",
      applicationRuntimeDistribution: "allowed",
      rawSourceRedistribution: "allowed",
      attributionRequired: false,
      restrictions: [],
    },
    evidence: [
      {
        url: "https://example.com/characters/fixture-1/license",
        retrievedAt: "2026-08-31",
        note: "Synthetic fixture rights",
      },
    ],
    acquiredAt: "2026-08-31T12:00:00.000Z",
    ...overrides,
  };
}

const FINGER_SEGMENTS = [
  "Thumb1",
  "Thumb2",
  "Thumb3",
  "Index1",
  "Index2",
  "Index3",
  "Middle1",
  "Middle2",
  "Middle3",
  "Ring1",
  "Ring2",
  "Ring3",
  "Pinky1",
  "Pinky2",
  "Pinky3",
];

function createFixtureGlb({
  weighted = true,
  mixamoNamespace = false,
  lastSkinOmitsFingers = false,
} = {}): Buffer {
  const jointNames = [
    ...REQUIRED_BODY_BONES,
    ...["Left", "Right"].flatMap((side) =>
      FINGER_SEGMENTS.map((segment) => `${side}Hand${segment}`)
    ),
  ];
  const jointNodes = jointNames.map((name) => ({
    name: mixamoNamespace ? `mixamorig12:${name}` : name,
  }));
  const meshNodeIndex = jointNodes.length;
  const lastMeshNodeIndex = meshNodeIndex + 1;
  const primitive = {
    attributes: {
      POSITION: 0,
      NORMAL: 1,
      TEXCOORD_0: 2,
      JOINTS_0: 3,
      ...(weighted ? { WEIGHTS_0: 4 } : {}),
    },
    indices: 5,
    material: 0,
  };
  const document = {
    asset: { version: "2.0", generator: "TKA synthetic fixture" },
    scene: 0,
    scenes: [
      {
        nodes: [
          0,
          meshNodeIndex,
          ...(lastSkinOmitsFingers ? [lastMeshNodeIndex] : []),
        ],
      },
    ],
    nodes: [
      ...jointNodes,
      { name: "CharacterMesh", mesh: 0, skin: 0 },
      ...(lastSkinOmitsFingers
        ? [{ name: "LastCharacterMesh", mesh: 1, skin: 1 }]
        : []),
    ],
    meshes: [
      {
        name: "CharacterMesh",
        primitives: [primitive],
      },
      ...(lastSkinOmitsFingers
        ? [{ name: "LastCharacterMesh", primitives: [primitive] }]
        : []),
    ],
    skins: [
      { joints: jointNames.map((_name, index) => index) },
      ...(lastSkinOmitsFingers
        ? [{ joints: REQUIRED_BODY_BONES.map((_name, index) => index) }]
        : []),
    ],
    accessors: [
      { count: 3 },
      { count: 3 },
      { count: 3 },
      { count: 3 },
      { count: 3 },
      { count: 3 },
    ],
    materials: [{ name: "Skin" }],
    textures: [{ source: 0 }],
    images: [{ bufferView: 0, mimeType: "image/png" }],
    buffers: [{ byteLength: 4 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
  };
  const json = Buffer.from(JSON.stringify(document), "utf8");
  const jsonPadding = (4 - (json.length % 4)) % 4;
  const paddedJson = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);
  const binary = Buffer.alloc(4);
  const totalLength = 12 + 8 + paddedJson.length + 8 + binary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(paddedJson.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, paddedJson, binaryHeader, binary]);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("character provenance gate", () => {
  it("accepts an evidenced runtime-distribution record", () => {
    const result = validateCharacterProvenance(validProvenance());

    expect(result.ok).toBe(true);
    expect(result.value?.id).toBe("test-performer");
  });

  it("rejects unknown rights before asset processing", () => {
    const provenance = validProvenance({
      rights: {
        commercialUse: "unknown",
        applicationRuntimeDistribution: "unknown",
        rawSourceRedistribution: "forbidden",
        attributionRequired: false,
      },
    });

    const result = validateCharacterProvenance(provenance);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "rights.commercialUse must be allowed before intake",
        "rights.applicationRuntimeDistribution must be allowed before intake",
      ])
    );
  });

  it("requires a credit line when attribution is required", () => {
    const provenance = validProvenance({
      rights: {
        commercialUse: "allowed",
        applicationRuntimeDistribution: "allowed",
        rawSourceRedistribution: "allowed",
        attributionRequired: true,
      },
    });

    expect(validateCharacterProvenance(provenance).errors).toContain(
      "rights.creditLine is required when attribution is required"
    );
  });

  it("rejects misspelled fields instead of silently dropping them", () => {
    const provenance = validProvenance({ commmercialUse: "allowed" });

    expect(validateCharacterProvenance(provenance).errors).toContain(
      "provenance.commmercialUse is not recognized"
    );
  });
});

describe("character GLB inspection", () => {
  it("uses the runtime skeleton mapper for all body and finger chains", () => {
    const directory = temporaryDirectory();
    const model = resolve(directory, "fixture.glb");
    writeFileSync(model, createFixtureGlb());

    const inspection = inspectCharacterGlb(model);

    expect(inspection.validGlb).toBe(true);
    expect(inspection.errors).toEqual([]);
    expect(inspection.mappedBodyBoneCount).toBe(22);
    expect(inspection.fingerChains).toBe(true);
    expect(inspection.skinnedMeshNodeCount).toBe(1);
    expect(inspection.triangleCount).toBe(1);
  });

  it("rejects a skinned primitive without weights", () => {
    const directory = temporaryDirectory();
    const model = resolve(directory, "unweighted.glb");
    writeFileSync(model, createFixtureGlb({ weighted: false }));

    expect(inspectCharacterGlb(model).errors).toContain(
      "1 skinned primitive(s) lack JOINTS_0 or WEIGHTS_0"
    );
  });

  it("removes Mixamo namespaces so canonical spine and fingers map", () => {
    const directory = temporaryDirectory();
    const model = resolve(directory, "mixamo.glb");
    writeFileSync(model, createFixtureGlb({ mixamoNamespace: true }));

    const before = inspectCharacterGlb(model);
    const changes = normalizeRuntimeJointNames(model);
    const after = inspectCharacterGlb(model);

    expect(before.fingerChains).toBe(false);
    expect(changes).toHaveLength(52);
    expect(after.mappedBodyBoneCount).toBe(22);
    expect(after.fingerChains).toBe(true);
    expect(after.errors).toEqual([]);
  });

  it("matches the runtime finger result from the last skinned mesh", () => {
    const directory = temporaryDirectory();
    const model = resolve(directory, "split-skins.glb");
    writeFileSync(model, createFixtureGlb({ lastSkinOmitsFingers: true }));

    const inspection = inspectCharacterGlb(model);

    expect(inspection.mappedBodyBoneCount).toBe(22);
    expect(inspection.runtimeSkeletonJointCount).toBe(22);
    expect(inspection.fingerChains).toBe(false);
  });

  it("reports malformed binaries instead of throwing", () => {
    const directory = temporaryDirectory();
    const model = resolve(directory, "broken.glb");
    writeFileSync(model, "not a glb", "utf8");

    const inspection = inspectCharacterGlb(model);

    expect(inspection.validGlb).toBe(false);
    expect(inspection.errors[0]).toContain("GLB is too short");
  });
});

describe("character preparation", () => {
  it("keeps the deployed skinning-safe optimization sequence", () => {
    const commands = buildCharacterOptimizationSteps(
      "source.glb",
      "output.glb",
      "temporary"
    );
    const commandText = commands.flat().join(" ");

    expect(commands.map(([command]) => command)).toEqual([
      "resize",
      "webp",
      "resample",
      "prune",
      "dedup",
    ]);
    expect(commandText).not.toMatch(/weld|simplify|join|draco|meshopt/);
  });

  it("emits a deterministic promotion packet with five pending poses", () => {
    const provenance = validateCharacterProvenance(validProvenance()).value!;
    const inspection = {
      errors: [],
      mappedBodyBoneCount: 22,
      fingerChains: true,
    };

    const packet = buildPromotionPacket({
      provenance,
      normalizedInspection: inspection,
      optimizedInspection: inspection,
      thumbnailFile: "thumbnails/test-performer.webp",
      stagedForBakeoff: true,
      generatedAt: "2026-08-31T13:00:00.000Z",
    });

    expect(packet.status).toBe("needs-visual-review");
    expect(packet.review.poses).toHaveLength(5);
    expect(
      packet.review.poses.every(({ status }) => status === "pending")
    ).toBe(true);
    expect(packet.promotionEligible).toBe(false);
  });

  it("runs a no-tool fixture intake and records immutable hashes", async () => {
    const directory = temporaryDirectory();
    const source = resolve(directory, "source.glb");
    const provenanceFile = resolve(directory, "provenance.json");
    const output = resolve(directory, "output");
    writeFileSync(source, createFixtureGlb());
    writeFileSync(provenanceFile, JSON.stringify(validProvenance()));

    const result = await intakeCharacter({
      source,
      provenanceFile,
      outputDirectory: output,
      skipOptimization: true,
      skipThumbnail: true,
      now: () => "2026-08-31T13:00:00.000Z",
    });
    const report = JSON.parse(
      readFileSync(
        resolve(output, "test-performer", "character-intake-report.json"),
        "utf8"
      )
    );

    expect(result.status).toBe("needs-visual-review");
    expect(report.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.normalized.sha256).toBe(report.optimized.sha256);
    expect(report.bakeoff.poses).toHaveLength(5);
  });

  it("refuses replacement when it would delete the source model", async () => {
    const directory = temporaryDirectory();
    const output = resolve(directory, "output");
    const target = resolve(output, "test-performer");
    const source = resolve(target, "source.glb");
    const provenanceFile = resolve(directory, "provenance.json");
    mkdirSync(target, { recursive: true });
    writeFileSync(source, createFixtureGlb());
    writeFileSync(provenanceFile, JSON.stringify(validProvenance()));

    await expect(
      intakeCharacter({
        source,
        provenanceFile,
        outputDirectory: output,
        replace: true,
        skipOptimization: true,
        skipThumbnail: true,
      })
    ).rejects.toThrow(
      "Source model and provenance record must stay outside the generated intake directory"
    );
    expect(existsSync(source)).toBe(true);
  });

  it("parses the operational CLI without positional ambiguity", () => {
    expect(
      parseArguments([
        "--source",
        "human.fbx",
        "--provenance",
        "human.json",
        "--output",
        "intake",
        "--stage-bakeoff",
      ])
    ).toMatchObject({
      source: "human.fbx",
      provenanceFile: "human.json",
      outputDirectory: "intake",
      stageBakeoff: true,
    });
  });
});
