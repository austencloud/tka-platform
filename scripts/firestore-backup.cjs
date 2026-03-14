/**
 * Trigger an immediate Firestore export to the backup bucket.
 *
 * Usage:
 *   node scripts/firestore-backup.cjs
 *   node scripts/firestore-backup.cjs --collections=users,sequences
 *
 * Requires: gcloud CLI authenticated with the project.
 */

const { execSync } = require("child_process");

const PROJECT_ID = "the-kinetic-alphabet";
const BUCKET = "gs://tka-firestore-backups";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputUri = `${BUCKET}/manual/${timestamp}`;

// Parse optional --collections flag
const collectionsArg = process.argv.find((a) =>
  a.startsWith("--collections=")
);
const collections = collectionsArg ? collectionsArg.split("=")[1] : "";

const collectionsFlag = collections ? `--collection-ids=${collections}` : "";

// Check for in-progress exports before starting a new one.
// Overlapping exports waste resources and can produce garbled output.
try {
  const opsOutput = execSync(
    `gcloud firestore operations list --project=${PROJECT_ID} --database="(default)" --format=json`,
    { encoding: "utf-8" }
  );
  const ops = JSON.parse(opsOutput || "[]");
  const inProgress = ops.filter(
    (op) =>
      !op.done &&
      op.metadata &&
      op.metadata["@type"].includes("ExportDocuments")
  );
  if (inProgress.length > 0) {
    console.error("Another export is already in progress:");
    inProgress.forEach((op) => console.error(`  ${op.name}`));
    console.error("\nWait for it to finish or cancel it with:");
    console.error(
      `  gcloud firestore operations cancel <operation-name> --project=${PROJECT_ID}`
    );
    process.exit(1);
  }
} catch (error) {
  // If we can't check operations, warn but continue. The export API
  // itself will reject if there's a conflict.
  console.warn(
    "Could not check for in-progress exports. Proceeding anyway."
  );
}

const command = [
  "gcloud firestore export",
  `"${outputUri}"`,
  `--project=${PROJECT_ID}`,
  `--database="(default)"`,
  collectionsFlag,
]
  .filter(Boolean)
  .join(" ");

console.log(`Starting Firestore export...`);
console.log(`Destination: ${outputUri}`);
if (collections) {
  console.log(`Collections: ${collections}`);
} else {
  console.log(`Collections: ALL`);
}
console.log();

try {
  execSync(command, { encoding: "utf-8", stdio: "inherit" });
  console.log();
  console.log("Export started. Monitor progress:");
  console.log(
    `  gcloud firestore operations list --project=${PROJECT_ID}`
  );
} catch (error) {
  console.error("Export failed. Make sure gcloud is authenticated:");
  console.error(`  gcloud auth login`);
  console.error(`  gcloud config set project ${PROJECT_ID}`);
  process.exit(1);
}
