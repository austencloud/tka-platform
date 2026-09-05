import {
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  formatBatchTable,
  intakeBatch,
  pairBatchSources,
  parseBatchArguments,
  summarizeIntakeResult,
} from "../../../scripts/characters/character-intake-batch.mjs";
import {
  buildMixamoProvenance,
  kebabCase,
  parseStampArguments,
  provenancePathForSource,
  stampProvenance,
} from "../../../scripts/characters/character-provenance-stamp.mjs";
import { validateCharacterProvenance } from "../../../scripts/characters/character-provenance.mjs";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(resolve(tmpdir(), "tka-character-batch-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function reviewableResult(id: string) {
  return {
    status: "needs-visual-review",
    targetDirectory: `/intake/${id}`,
    report: {
      characterId: id,
      normalized: {
        materialSummary: { maxTextureSide: 4096 },
      },
      optimized: {
        bytes: 2_500_000,
        mappedBodyBoneCount: 22,
        fingerChains: true,
        materialSummary: {
          skinnedMaterialCount: 3,
          withNormalTexture: 3,
          withMetallicRoughnessTexture: 0,
          alphaModes: { OPAQUE: 3, MASK: 0, BLEND: 0 },
          maxTextureSide: 2048,
        },
      },
    },
  };
}

describe("batch intake pairing", () => {
  it("pairs each model with the sidecar that shares its stem", () => {
    const pairing = pairBatchSources([
      "Malcolm.fbx",
      "Malcolm.provenance.json",
      "Michelle.glb",
      "Michelle.provenance.json",
      "Kaya.fbx",
      "Orphan.provenance.json",
      "Vanguard.fbx",
      "Vanguard.glb",
      "Vanguard.provenance.json",
      "notes.txt",
    ]);

    expect(pairing.pairs).toEqual([
      {
        stem: "Malcolm",
        source: "Malcolm.fbx",
        provenance: "Malcolm.provenance.json",
      },
      {
        stem: "Michelle",
        source: "Michelle.glb",
        provenance: "Michelle.provenance.json",
      },
    ]);
    expect(pairing.sourcesWithoutProvenance).toEqual(["Kaya.fbx"]);
    expect(pairing.provenanceWithoutSource).toEqual(["Orphan.provenance.json"]);
    expect(pairing.ambiguous).toEqual([
      { stem: "Vanguard", files: ["Vanguard.fbx", "Vanguard.glb"] },
    ]);
  });

  it("parses the batch CLI and stages by default", () => {
    expect(
      parseBatchArguments(["--downloads", "D:/mixamo", "--output", "D:/intake"])
    ).toEqual({
      downloadsDirectory: "D:/mixamo",
      outputDirectory: "D:/intake",
      replace: false,
      skipOptimization: false,
      skipThumbnail: false,
      stageBakeoff: true,
      textureSize: 1024,
    });
    expect(
      parseBatchArguments([
        "--downloads",
        "in",
        "--output",
        "out",
        "--no-stage",
        "--replace",
        "--texture-size",
        "2048",
      ])
    ).toMatchObject({ stageBakeoff: false, replace: true, textureSize: 2048 });
    expect(() => parseBatchArguments(["--downloads", "in"])).toThrow(
      "--output is required"
    );
    expect(() => parseBatchArguments(["--bogus"])).toThrow("Unknown argument");
  });

  it("runs every pair, records failures, and prints one table", async () => {
    const downloads = temporaryDirectory();
    for (const name of [
      "Malcolm.fbx",
      "Malcolm.provenance.json",
      "Broken.fbx",
      "Broken.provenance.json",
      "Loose.fbx",
    ]) {
      writeFileSync(resolve(downloads, name), "fixture");
    }
    const calls: string[] = [];
    const logs: string[] = [];

    const { rows } = await intakeBatch(
      {
        downloadsDirectory: downloads,
        outputDirectory: resolve(downloads, "out"),
        replace: false,
        skipOptimization: true,
        skipThumbnail: true,
        stageBakeoff: true,
        textureSize: 1024,
      },
      {
        intake: async (options: { source: string; textureSize: number }) => {
          calls.push(options.source);
          expect(options.textureSize).toBe(1024);
          if (options.source.endsWith("Broken.fbx")) {
            throw new Error("Blender is required");
          }
          return reviewableResult("malcolm");
        },
        log: (line: string) => logs.push(line),
      }
    );

    expect(calls).toEqual([
      resolve(downloads, "Broken.fbx"),
      resolve(downloads, "Malcolm.fbx"),
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      "failed",
      "needs-visual-review",
    ]);
    expect(rows[1]).toMatchObject({
      id: "malcolm",
      bodyBones: "22/22",
      fingers: "30/30",
      normalMaps: "3/3",
      roughnessTextures: "0/3",
      blendMaterials: 0,
      sourceTexture: "4096px",
      deliveredTexture: "2048px",
      mebibytes: "2.38",
      review: "/test/avatar-bakeoff?candidate=intake-malcolm&pose=overhead",
    });
    expect(logs.join("\n")).toContain("Skipping Loose.fbx");

    const table = formatBatchTable(rows);
    expect(table).toContain("Character");
    expect(table).toContain("malcolm");
    expect(table).toContain("Broken: Blender is required");
  });

  it("summarizes a rejected intake with its reason", () => {
    expect(
      summarizeIntakeResult("Kaya", {
        status: "rejected",
        report: {
          characterId: "kaya",
          reason: "Static character gates failed",
        },
      })
    ).toEqual({
      stem: "Kaya",
      id: "kaya",
      status: "rejected",
      detail: "Static character gates failed",
    });
  });
});

describe("Mixamo provenance stamping", () => {
  it("kebab-cases catalog names into character ids", () => {
    expect(kebabCase("Paladin J Nordstrom")).toBe("paladin-j-nordstrom");
    expect(kebabCase("Exo Gray")).toBe("exo-gray");
    expect(kebabCase("Ély  (Test)")).toBe("ely-test");
  });

  it("requires the human rights assertion and a way to name the character", () => {
    expect(() =>
      parseStampArguments([
        "--source",
        "Malcolm.fbx",
        "--evidence-note",
        "read",
      ])
    ).toThrow("--commercial-use is required");
    expect(() =>
      parseStampArguments([
        "--source",
        "Malcolm.fbx",
        "--commercial-use",
        "yes",
        "--runtime-distribution",
        "allowed",
        "--evidence-note",
        "read",
      ])
    ).toThrow("--commercial-use must be one of");
    expect(() =>
      parseStampArguments([
        "--source",
        "Malcolm.fbx",
        "--commercial-use",
        "allowed",
        "--runtime-distribution",
        "allowed",
        "--evidence-note",
        "read",
      ])
    ).toThrow("--id is required when --slot is not given");
    expect(
      parseStampArguments([
        "--source",
        "Malcolm.fbx",
        "--slot",
        "1",
        "--commercial-use",
        "allowed",
        "--runtime-distribution",
        "allowed",
        "--evidence-note",
        "read",
      ])
    ).toMatchObject({ slot: 1, id: null, replace: false });
  });

  it("builds a record that passes the intake gate only when rights are allowed", () => {
    const base = {
      id: "malcolm",
      displayName: "Malcolm",
      assetName: "Malcolm",
      evidenceNote: "Mixamo FAQ read on 2026-09-05",
      retrievedAt: "2026-09-05",
      acquiredAt: "2026-09-05T10:00:00.000Z",
    };

    const allowed = buildMixamoProvenance({
      ...base,
      commercialUse: "allowed",
      applicationRuntimeDistribution: "allowed",
    });
    const unknown = buildMixamoProvenance({
      ...base,
      commercialUse: "unknown",
      applicationRuntimeDistribution: "unknown",
    });

    expect(validateCharacterProvenance(allowed).ok).toBe(true);
    expect(allowed.source.provider).toBe("Adobe Mixamo");
    expect(allowed.rights.rawSourceRedistribution).toBe("forbidden");
    expect(validateCharacterProvenance(unknown).ok).toBe(false);
  });

  it("writes the sidecar beside the download and fills a queue slot", () => {
    const directory = temporaryDirectory();
    const source = resolve(directory, "Vanguard By T. Choonyung.fbx");
    const queue = resolve(directory, "queue.json");
    writeFileSync(source, "fbx");
    utimesSync(
      source,
      new Date("2026-09-04T18:30:00Z"),
      new Date("2026-09-04T18:30:00Z")
    );
    writeFileSync(
      queue,
      JSON.stringify({
        slots: [
          {
            priority: 4,
            suggestedName: "Vanguard",
            role: "armored heroic silhouette",
          },
        ],
      })
    );

    const result = stampProvenance(
      {
        ...parseStampArguments([
          "--source",
          source,
          "--slot",
          "4",
          "--queue",
          queue,
          "--commercial-use",
          "allowed",
          "--runtime-distribution",
          "allowed",
          "--evidence-note",
          "Mixamo FAQ read on 2026-09-05",
        ]),
      },
      { now: () => new Date("2026-09-05T12:00:00Z") }
    );
    const written = JSON.parse(readFileSync(result.outputPath, "utf8"));

    expect(result.outputPath).toBe(provenancePathForSource(source));
    expect(result.outputPath).toBe(
      resolve(directory, "Vanguard By T. Choonyung.provenance.json")
    );
    expect(result.validation.ok).toBe(true);
    expect(written).toMatchObject({
      id: "vanguard",
      displayName: "Vanguard",
      description: "armored heroic silhouette",
      source: { assetName: "Vanguard" },
      acquiredAt: "2026-09-04T18:30:00.000Z",
    });
    expect(written.evidence[0].retrievedAt).toBe("2026-09-05");
    expect(() =>
      stampProvenance(
        parseStampArguments([
          "--source",
          source,
          "--slot",
          "4",
          "--queue",
          queue,
          "--commercial-use",
          "allowed",
          "--runtime-distribution",
          "allowed",
          "--evidence-note",
          "again",
        ])
      )
    ).toThrow("Provenance already exists");
  });
});
