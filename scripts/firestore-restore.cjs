/**
 * Restore Firestore from a previous export.
 *
 * Usage:
 *   node scripts/firestore-restore.cjs                  # List available backups
 *   node scripts/firestore-restore.cjs --backup=<uri>   # Restore from specific backup
 *   node scripts/firestore-restore.cjs --backup=<uri> --force  # Skip confirmation (scripted use)
 *
 * WARNING: Importing data overwrites existing documents with the same IDs.
 * It does NOT delete documents that aren't in the backup.
 *
 * Requires: gcloud CLI authenticated with the project.
 */

const { execSync } = require("child_process");
const readline = require("readline");

const PROJECT_ID = "the-kinetic-alphabet";
const BUCKET = "tka-firestore-backups";

function listBackups() {
  console.log("Available backups in gs://tka-firestore-backups/:\n");

  try {
    // List top-level "folders" in the bucket (each is one export)
    const output = execSync(
      `gcloud storage ls gs://${BUCKET}/ --project=${PROJECT_ID}`,
      { encoding: "utf-8" }
    );

    const folders = output.trim().split("\n").filter(Boolean);

    if (folders.length === 0) {
      console.log("No backups found.");
      return;
    }

    folders.forEach((folder, i) => {
      // Extract timestamp from folder name
      const name = folder
        .replace(`gs://${BUCKET}/`, "")
        .replace(/\/$/, "");
      console.log(`  [${i + 1}] ${name}`);
    });

    console.log();
    console.log("To restore, run:");
    console.log(
      '  node scripts/firestore-restore.cjs --backup="gs://tka-firestore-backups/<folder>"'
    );
    console.log();
    console.log(
      "WARNING: Import overwrites documents with matching IDs. " +
        "It does not delete documents absent from the backup."
    );
  } catch (error) {
    console.error("Failed to list backups. Check gcloud auth.");
    process.exit(1);
  }
}

/**
 * Prompts the user to type "RESTORE" to confirm. Returns a promise that
 * resolves to true if confirmed, false otherwise. This is a hard gate,
 * not a "press Ctrl+C" suggestion. This project has a history of
 * accidental data loss, so an explicit confirmation is non-negotiable.
 */
function confirmRestore(backupUri) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log();
    console.log(
      "╔══════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║  WARNING: This will overwrite documents in production   ║"
    );
    console.log(
      "║  Firestore that have matching IDs in the backup.        ║"
    );
    console.log(
      "║                                                         ║"
    );
    console.log(
      "║  This is NOT reversible without another backup.         ║"
    );
    console.log(
      "╚══════════════════════════════════════════════════════════╝"
    );
    console.log();
    console.log(`  Source: ${backupUri}`);
    console.log(`  Target: projects/${PROJECT_ID}/databases/(default)`);
    console.log();

    rl.question(
      "Type RESTORE to proceed (anything else cancels): ",
      (answer) => {
        rl.close();
        if (answer.trim() === "RESTORE") {
          resolve(true);
        } else {
          console.log("Cancelled.");
          resolve(false);
        }
      }
    );
  });
}

async function restoreFromBackup(backupUri, skipConfirmation) {
  // Validate the URI looks right
  if (!backupUri.startsWith("gs://tka-firestore-backups/")) {
    console.error(
      "Backup URI must start with gs://tka-firestore-backups/"
    );
    process.exit(1);
  }

  console.log(`Restoring from: ${backupUri}`);

  if (!skipConfirmation) {
    const confirmed = await confirmRestore(backupUri);
    if (!confirmed) {
      process.exit(0);
    }
  } else {
    console.log("(--force flag set, skipping confirmation)");
  }

  // Parse optional --collections flag
  const collectionsArg = process.argv.find((a) =>
    a.startsWith("--collections=")
  );
  const collections = collectionsArg ? collectionsArg.split("=")[1] : "";
  const collectionsFlag = collections
    ? `--collection-ids=${collections}`
    : "";

  const command = [
    "gcloud firestore import",
    `"${backupUri}"`,
    `--project=${PROJECT_ID}`,
    `--database="(default)"`,
    collectionsFlag,
  ]
    .filter(Boolean)
    .join(" ");

  try {
    execSync(command, { encoding: "utf-8", stdio: "inherit" });
    console.log();
    console.log("Import started. Monitor progress:");
    console.log(
      `  gcloud firestore operations list --project=${PROJECT_ID}`
    );
  } catch (error) {
    console.error("Import failed.");
    process.exit(1);
  }
}

// Main
const backupArg = process.argv.find((a) => a.startsWith("--backup="));
const forceFlag = process.argv.includes("--force");

if (backupArg) {
  const backupUri = backupArg
    .split("=")
    .slice(1)
    .join("=")
    .replace(/"/g, "");
  restoreFromBackup(backupUri, forceFlag);
} else {
  listBackups();
}
