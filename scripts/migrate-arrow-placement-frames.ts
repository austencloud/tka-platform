/**
 * Replace display-grid ownership in arrow-placement documents with authored
 * placement frames. Diamond and Box both become "canonical"; Skewed remains
 * "skewed" because it is not a rigid presentation rotation.
 *
 * Dry run: pnpm exec tsx scripts/migrate-arrow-placement-frames.ts
 * Apply:   pnpm exec tsx scripts/migrate-arrow-placement-frames.ts --apply
 */

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, type DocumentData } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_COUNTS = {
  default_arrow_adjustments: 5,
  special_arrow_placements: 4,
  global_arrow_adjustments: 99,
  prop_geometry_adjustments: 0,
} as const;

type CollectionName = keyof typeof EXPECTED_COUNTS;
type PlacementFrame = "canonical" | "skewed";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes("--apply");

function placementFrameFor(value: unknown): PlacementFrame {
  if (value === "skewed") return "skewed";
  if (value === "canonical" || value === "diamond" || value === "box") {
    return "canonical";
  }
  throw new Error(`Unsupported placement owner: ${String(value)}`);
}

function identityPrefix(collectionName: CollectionName, id: string): string {
  return collectionName === "default_arrow_adjustments"
    ? (id.split("_")[0] ?? "")
    : (id.split("|")[0] ?? "");
}

function migratedId(
  collectionName: CollectionName,
  id: string,
  placementFrame: PlacementFrame
): string {
  const separator = collectionName === "default_arrow_adjustments" ? "_" : "|";
  const parts = id.split(separator);
  if (parts.length < 2) {
    throw new Error(`${collectionName}/${id} has no composite identity`);
  }
  parts[0] = placementFrame;
  return parts.join(separator);
}

function migratedData(
  data: DocumentData,
  placementFrame: PlacementFrame
): DocumentData {
  const next = { ...data, placementFrame };
  delete next.gridMode;
  // Active placement data is public-read so guests and signed-in users render
  // identically. Personal audit identity remains in the admin-only histories.
  if (typeof next.updatedBy === "string" && next.updatedBy.includes("@")) {
    next.updatedBy = "admin";
  }
  return next;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function main(): Promise<void> {
  const serviceAccountPath = path.resolve(
    __dirname,
    "../firebase-service-account.json"
  );
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error("Missing firebase-service-account.json in project root");
  }

  initializeApp({
    credential: cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))),
  });
  const db = getFirestore();
  const migrations: Array<{
    collectionName: CollectionName;
    sourceId: string;
    targetId: string;
    data: DocumentData;
  }> = [];

  for (const collectionName of Object.keys(
    EXPECTED_COUNTS
  ) as CollectionName[]) {
    const snapshot = await db.collection(collectionName).get();
    const expected = EXPECTED_COUNTS[collectionName];
    if (snapshot.size !== expected) {
      throw new Error(
        `${collectionName}: expected ${expected} documents from the verified backup, found ${snapshot.size}`
      );
    }

    const targetOwners = new Map<string, string>();
    for (const document of snapshot.docs) {
      const data = document.data();
      const owner =
        data.placementFrame ??
        data.gridMode ??
        identityPrefix(collectionName, document.id);
      const placementFrame = placementFrameFor(owner);
      const targetId = migratedId(collectionName, document.id, placementFrame);
      const nextData = migratedData(data, placementFrame);

      const priorSource = targetOwners.get(targetId);
      if (priorSource && priorSource !== document.id) {
        throw new Error(
          `${collectionName}: ${priorSource} and ${document.id} both map to ${targetId}`
        );
      }
      targetOwners.set(targetId, document.id);

      const existingTarget = snapshot.docs.find(
        (candidate) => candidate.id === targetId
      );
      if (
        existingTarget &&
        existingTarget.id !== document.id &&
        stableJson(migratedData(existingTarget.data(), placementFrame)) !==
          stableJson(nextData)
      ) {
        throw new Error(
          `${collectionName}: target ${targetId} already exists with different data`
        );
      }

      migrations.push({
        collectionName,
        sourceId: document.id,
        targetId,
        data: nextData,
      });
    }

    console.log(
      `${collectionName}: ${snapshot.size} documents validated for migration`
    );
  }

  if (!apply) {
    console.log(
      `Dry run complete: ${migrations.length} documents are safe to migrate.`
    );
    return;
  }

  const batch = db.batch();
  for (const migration of migrations) {
    const collection = db.collection(migration.collectionName);
    batch.set(collection.doc(migration.targetId), migration.data);
    if (migration.sourceId !== migration.targetId) {
      batch.delete(collection.doc(migration.sourceId));
    }
  }
  await batch.commit();

  for (const collectionName of Object.keys(
    EXPECTED_COUNTS
  ) as CollectionName[]) {
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.size !== EXPECTED_COUNTS[collectionName]) {
      throw new Error(
        `${collectionName}: document count changed after migration`
      );
    }
    for (const document of snapshot.docs) {
      const data = document.data();
      const placementFrame = placementFrameFor(data.placementFrame);
      if ("gridMode" in data) {
        throw new Error(`${collectionName}/${document.id} retained gridMode`);
      }
      if (typeof data.updatedBy === "string" && data.updatedBy.includes("@")) {
        throw new Error(`${collectionName}/${document.id} exposes an email`);
      }
      if (identityPrefix(collectionName, document.id) !== placementFrame) {
        throw new Error(
          `${collectionName}/${document.id} does not match ${placementFrame}`
        );
      }
    }
    console.log(
      `${collectionName}: verified ${snapshot.size} migrated documents`
    );
  }

  console.log(`Migration complete: ${migrations.length} documents verified.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
