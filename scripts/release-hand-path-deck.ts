/**
 * Release the six universal Timing & Direction hand-path reference cards.
 *
 * Usage:
 *   npm run deck:release:hand-path -- --dry-run
 *   npm run deck:release:hand-path
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  HAND_PATH_REFERENCE_CARD_DEFINITIONS,
  HAND_PATH_REFERENCE_CARD_VERSION,
  getHandPathReferenceDefinitionNotes,
} from "../src/lib/features/choreo-card/domain/hand-path-reference-card-manifest";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NAME = "Timing & Direction Hand Paths";
const DESCRIPTION =
  "Six universal, prop-free cards for learning the Timing & Direction relationships.";
const NOTES = "Hand Path Reference Deck · Version 1";

function serviceAccountPath(): string {
  const localPath = resolve(REPO_ROOT, "serviceAccountKey.json");
  if (existsSync(localPath)) return localPath;

  const commonGitDirectory = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  ).trim();
  const sharedCheckoutPath = resolve(
    dirname(commonGitDirectory),
    "serviceAccountKey.json"
  );
  if (existsSync(sharedCheckoutPath)) return sharedCheckoutPath;

  throw new Error(
    "serviceAccountKey.json was not found in the task or shared checkout."
  );
}

function printComposition(): void {
  console.log("=== Hand Path Deck Release ===");
  console.log(`Deck: ${NAME}`);
  console.log(`Reference-card version: ${HAND_PATH_REFERENCE_CARD_VERSION}`);
  console.log(`Cards: ${HAND_PATH_REFERENCE_CARD_DEFINITIONS.length}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log("\nComposition:");
  for (const [
    index,
    referenceCard,
  ] of HAND_PATH_REFERENCE_CARD_DEFINITIONS.entries()) {
    console.log(
      `  ${index + 1}. ${referenceCard.cardTitle} — ${getHandPathReferenceDefinitionNotes(referenceCard)}`
    );
  }
  console.log("\nBreakdown:");
  for (const timing of ["Together", "Split", "Quarter"] as const) {
    const count = HAND_PATH_REFERENCE_CARD_DEFINITIONS.filter(
      (referenceCard) => referenceCard.timing === timing
    ).length;
    console.log(`  ${timing}: ${count}`);
  }
  console.log("  Same direction: 3");
  console.log("  Opposite direction: 3");
}

async function main(): Promise<void> {
  printComposition();
  if (DRY_RUN) {
    console.log("\n[DRY RUN] No Firestore records were written.");
    return;
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath(), "utf8"));
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  const db = getFirestore();

  const existing = await db
    .collection("deckReleases/counter/manifests")
    .where("handPathCards.version", "==", HAND_PATH_REFERENCE_CARD_VERSION)
    .limit(1)
    .get();
  if (!existing.empty && !FORCE) {
    const snapshot = existing.docs[0]!;
    console.log(
      `\nVersion ${HAND_PATH_REFERENCE_CARD_VERSION} is already released as Deck #${snapshot.id}.`
    );
    console.log(
      "Use --force only when a second physical edition is intentional."
    );
    return;
  }

  const counterRef = db.doc("deckReleases/counter");
  const release = await db.runTransaction(async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const deckNumber = counterSnapshot.exists
      ? ((counterSnapshot.data()?.next as number | undefined) ?? 1)
      : 1;
    const manifest = {
      deckNumber,
      createdAt: new Date().toISOString(),
      name: NAME,
      description: DESCRIPTION,
      theme: "cosmic",
      cardCount: HAND_PATH_REFERENCE_CARD_DEFINITIONS.length,
      notes: NOTES,
      sequences: [],
      stepCountDistribution: {
        4: HAND_PATH_REFERENCE_CARD_DEFINITIONS.length,
      },
      handPathCards: {
        version: HAND_PATH_REFERENCE_CARD_VERSION,
        cardIds: HAND_PATH_REFERENCE_CARD_DEFINITIONS.map(
          (referenceCard) => referenceCard.id
        ),
      },
    };
    const manifestId = String(deckNumber).padStart(3, "0");
    transaction.set(
      db.doc(`deckReleases/counter/manifests/${manifestId}`),
      manifest
    );
    transaction.set(counterRef, { next: deckNumber + 1 }, { merge: true });
    return { manifestId, manifest };
  });

  const verification = await db
    .doc(`deckReleases/counter/manifests/${release.manifestId}`)
    .get();
  const saved = verification.data();
  if (
    !verification.exists ||
    saved?.cardCount !== HAND_PATH_REFERENCE_CARD_DEFINITIONS.length ||
    saved?.sequences?.length !== 0 ||
    saved?.handPathCards?.version !== HAND_PATH_REFERENCE_CARD_VERSION ||
    saved?.handPathCards?.cardIds?.length !==
      HAND_PATH_REFERENCE_CARD_DEFINITIONS.length
  ) {
    throw new Error(
      "The saved hand-path manifest failed read-back verification."
    );
  }

  console.log(`\nDeck #${release.manifestId} released and verified.`);
  console.log(`Manifest: deckReleases/counter/manifests/${release.manifestId}`);
  console.log("Physical count: 6 cards (no insert, no QR identities)");
}

main().catch((error: unknown) => {
  console.error("Fatal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
