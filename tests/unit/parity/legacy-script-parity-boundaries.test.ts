import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(import.meta.url);

type RawSequence = {
  word: string;
  steps: unknown[];
  [key: string]: unknown;
};

type BuiltSequence = {
  id: string;
  data: Record<string, unknown>;
};

const importer = require(
  path.join(projectRoot, "scripts/import-sequence.cjs")
) as {
  detectLoop(raw: RawSequence): unknown;
  buildFirestoreDoc(
    raw: RawSequence,
    fieldValue: { serverTimestamp(): Date },
    loopInfo: unknown,
    options?: { visibility?: string }
  ): BuiltSequence;
};

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("legacy sequence script parity boundaries", () => {
  const cells = JSON.parse(
    readProjectFile("docs/research/spiroanim/eightstep-72-sequences.json")
  ) as RawSequence[];
  const raw = cells[0];
  const localClock = { serverTimestamp: () => new Date(0) };

  it("refuses script-side public imports", () => {
    expect(() =>
      importer.buildFirestoreDoc(raw, localClock, importer.detectLoop(raw), {
        visibility: "public",
      })
    ).toThrow(/owner, public projection, and hash claim commit together/);
  });

  it("runs private imports through the canonical persistence normalizer", async () => {
    const probe = String.raw`
      const { readFileSync } = require("node:fs");
      const importer = require("./scripts/import-sequence.cjs");
      const raw = JSON.parse(readFileSync(
        "./docs/research/spiroanim/eightstep-72-sequences.json",
        "utf8"
      ))[0];
      const clock = { serverTimestamp: () => new Date(0) };
      (async () => {
        const built = importer.buildFirestoreDoc(
          raw,
          clock,
          importer.detectLoop(raw),
          { visibility: "private" }
        );
        const normalized = await importer.normalizeFirestoreDoc(built);
        process.stdout.write(JSON.stringify({
          contentHash: normalized.contentHash,
          contentHashVersion: normalized.contentHashVersion,
          storedContentHash: normalized.data.contentHash,
          storedContentHashVersion: normalized.data.contentHashVersion,
          sequenceLength: normalized.data.sequenceLength,
          hydratedLength: normalized.hydrated.steps?.length,
          hasStoredSteps: "steps" in normalized.data,
        }));
      })().catch((error) => {
        console.error(error);
        process.exit(1);
      });
    `;
    const normalized = JSON.parse(
      execFileSync(process.execPath, ["-e", probe], {
        cwd: projectRoot,
        encoding: "utf8",
      })
    ) as {
      contentHash: string;
      contentHashVersion: number;
      storedContentHash: string;
      storedContentHashVersion: number;
      sequenceLength: number;
      hydratedLength: number;
      hasStoredSteps: boolean;
    };

    expect(normalized.contentHashVersion).toBe(2);
    expect(normalized.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(normalized.storedContentHash).toBe(normalized.contentHash);
    expect(normalized.storedContentHashVersion).toBe(2);
    expect(normalized.sequenceLength).toBe(raw.steps.length);
    expect(normalized.hydratedLength).toBe(raw.steps.length);
    expect(normalized.hasStoredSteps).toBe(false);
  });

  it("keeps owner-only repair scripts away from public sequences", () => {
    const loopBackfill = readProjectFile(
      "scripts/backfill-sequence-loop-type.cjs"
    );
    const startRepair = readProjectFile(
      "scripts/repair-broken-start-positions.cjs"
    );

    expect(loopBackfill).toContain('data.visibility === "public"');
    expect(startRepair).toContain('data.visibility === "public"');
  });

  it("keeps retired direct-public writers fail-closed", () => {
    const retiredSync = readProjectFile(
      "scripts/sync-missing-public-sequences.js"
    );
    const showSequence = readProjectFile("scripts/show-sequence.mjs");

    expect(retiredSync).not.toContain("firebase-admin");
    expect(retiredSync).toContain("publish-missing-public-mirrors.ts");
    expect(showSequence).toContain('visibility: "private"');
    expect(showSequence).not.toContain('visibility: "public"');
    expect(showSequence).not.toContain("await pubRef.set");
  });
});
