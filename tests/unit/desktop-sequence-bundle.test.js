import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { verifyDesktopSequenceBundle } from "../../scripts/verify-desktop-sequence-bundle.mjs";

const require = createRequire(import.meta.url);
const {
  mapWithConcurrency,
  publishStagingBundle,
  writeStagingBundle,
} = require("../../scripts/export-deck-bundle.cjs");

const temporaryDirectories = [];

function createBundle() {
  const root = mkdtempSync(join(tmpdir(), "desktop-sequences-"));
  temporaryDirectories.push(root);
  const bundleDirectory = join(root, "sequences");
  mkdirSync(bundleDirectory);

  const decks = [
    { deckId: "alpha", filename: "alpha.json", count: 2 },
    { deckId: "beta", filename: "beta.json", count: 1 },
  ];
  writeFileSync(
    join(bundleDirectory, "_manifest.json"),
    JSON.stringify({
      decks,
      totalSequences: 3,
      exportedAt: "2026-08-31T12:00:00.000Z",
    })
  );
  for (const deck of decks) {
    writeFileSync(
      join(bundleDirectory, deck.filename),
      JSON.stringify({
        deckId: deck.deckId,
        metadata: { count: deck.count },
        sequences: Array.from({ length: deck.count }, (_, index) => ({
          id: `${deck.deckId}-${index}`,
        })),
      })
    );
  }

  return bundleDirectory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("verifyDesktopSequenceBundle", () => {
  it("accepts a complete, internally consistent bundle", () => {
    const bundleDirectory = createBundle();

    expect(verifyDesktopSequenceBundle(bundleDirectory)).toMatchObject({
      deckCount: 2,
      sequenceCount: 3,
      exportedAt: "2026-08-31T12:00:00.000Z",
    });
  });

  it("rejects a manifest that references a missing deck file", () => {
    const bundleDirectory = createBundle();
    rmSync(join(bundleDirectory, "beta.json"));

    expect(() => verifyDesktopSequenceBundle(bundleDirectory)).toThrow(
      "Manifest references a missing deck file: beta.json"
    );
  });

  it("rejects a deck count that disagrees with its content", () => {
    const bundleDirectory = createBundle();
    writeFileSync(
      join(bundleDirectory, "beta.json"),
      JSON.stringify({ deckId: "beta", metadata: { count: 1 }, sequences: [] })
    );

    expect(() => verifyDesktopSequenceBundle(bundleDirectory)).toThrow(
      "Deck file beta.json contains 0 sequences; manifest declares 1."
    );
  });

  it("rejects stale JSON files that are absent from the manifest", () => {
    const bundleDirectory = createBundle();
    writeFileSync(join(bundleDirectory, "stale.json"), "{}");

    expect(() => verifyDesktopSequenceBundle(bundleDirectory)).toThrow(
      "Bundle contains JSON files absent from the manifest: stale.json"
    );
  });

  it("rejects filenames that could escape the resource directory", () => {
    const bundleDirectory = createBundle();
    writeFileSync(
      join(bundleDirectory, "_manifest.json"),
      JSON.stringify({
        decks: [{ deckId: "alpha", filename: "../alpha.json", count: 2 }],
        totalSequences: 2,
        exportedAt: "2026-08-31T12:00:00.000Z",
      })
    );

    expect(() => verifyDesktopSequenceBundle(bundleDirectory)).toThrow(
      "Manifest deck 1 has an unsafe filename: ../alpha.json"
    );
  });
});

describe("desktop sequence export", () => {
  it("bounds Firestore work while preserving result order", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency(
      [0, 1, 2, 3, 4],
      2,
      async (value) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5 - value));
        active -= 1;
        return value * 2;
      }
    );

    expect(peak).toBe(2);
    expect(results).toEqual([0, 2, 4, 6, 8]);
  });

  it("replaces a prior bundle only after a complete staging snapshot exists", () => {
    const root = mkdtempSync(join(tmpdir(), "desktop-export-"));
    temporaryDirectories.push(root);
    const destination = join(root, "sequences");
    mkdirSync(destination);
    writeFileSync(join(destination, "old.json"), "old bundle");
    const exportedAt = "2026-08-31T12:00:00.000Z";
    const result = {
      filename: "alpha.json",
      manifestEntry: {
        deckId: "alpha",
        filename: "alpha.json",
        count: 1,
      },
      bundle: {
        deckId: "alpha",
        metadata: { count: 1 },
        sequences: [{ id: "alpha-1" }],
      },
    };
    const { stagingDirectory } = writeStagingBundle(root, [result], exportedAt);

    expect(existsSync(join(destination, "old.json"))).toBe(true);
    expect(verifyDesktopSequenceBundle(stagingDirectory).sequenceCount).toBe(1);
    publishStagingBundle(stagingDirectory, destination);

    expect(existsSync(join(destination, "old.json"))).toBe(false);
    expect(
      JSON.parse(readFileSync(join(destination, "alpha.json"), "utf8"))
    ).toMatchObject({
      deckId: "alpha",
    });
    expect(verifyDesktopSequenceBundle(destination).sequenceCount).toBe(1);
  });

  it("restores the prior bundle when the final directory swap fails", () => {
    const root = mkdtempSync(join(tmpdir(), "desktop-export-rollback-"));
    temporaryDirectories.push(root);
    const destination = join(root, "sequences");
    mkdirSync(destination);
    writeFileSync(join(destination, "old.json"), "old bundle");

    expect(() =>
      publishStagingBundle(join(root, "missing-staging-directory"), destination)
    ).toThrow();
    expect(readFileSync(join(destination, "old.json"), "utf8")).toBe(
      "old bundle"
    );
  });
});
