/**
 * Migration script: Inversify to ITI
 * Converts resolve(TYPES.X) to container.items.x
 */

const fs = require("fs");
const path = require("path");

// Service name mappings from Inversify TYPES to ITI container.items
const SERVICE_MAPPINGS = {
  // Core services
  IDeviceDetector: "deviceDetector",
  IHapticFeedback: "hapticFeedback",
  IViewportManager: "viewportManager",

  // Community services
  IFollowingFeedProvider: "followingFeedProvider",
  IUserRepository: "userRepository",
  ILeaderboardManager: "leaderboardManager",

  // Analytics services
  IActivityLogger: "activityLogger",

  // Library services
  ICollectionManager: "collectionManager",
  ILibraryRepository: "libraryRepository",

  // Admin services
  IAnnouncementManager: "announcementManager",

  // Gallery services (assuming these are in gallery container, need to verify)
  IGalleryLayoutGenerator: "galleryLayoutGenerator",
  IExhibitLoader: "exhibitLoader",
  IGallerySessionManager: "gallerySessionManager",
  IGalleryPositionSyncer: "galleryPositionSyncer",
};

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // Replace import statement
  const oldImportPattern1 = /import\s+\{[^}]*resolve[^}]*\}\s+from\s+['"]\$lib\/shared\/inversify\/di['"]/g;
  const oldImportPattern2 = /import\s+\{[^}]*tryResolve[^}]*\}\s+from\s+['"]\$lib\/shared\/inversify\/di['"]/g;
  const oldImportPattern3 = /import\s+\{[^}]*TYPES[^}]*\}\s+from\s+['"]\$lib\/shared\/inversify\/types['"]/g;
  const oldImportPattern4 = /import\s+\{[^}]*TYPES[^}]*\}\s+from\s+['"]\$lib\/shared\/inversify\/types\/[^'"]+['"]/g;

  if (
    oldImportPattern1.test(content) ||
    oldImportPattern2.test(content) ||
    oldImportPattern3.test(content) ||
    oldImportPattern4.test(content)
  ) {
    // Check if container import already exists
    if (!content.includes('from "$lib/shared/di"')) {
      content = content.replace(
        oldImportPattern1,
        'import { container } from "$lib/shared/di"'
      );
      content = content.replace(
        oldImportPattern2,
        'import { container } from "$lib/shared/di"'
      );
    } else {
      // Just remove the old imports
      content = content.replace(oldImportPattern1, "");
      content = content.replace(oldImportPattern2, "");
    }

    // Remove TYPES imports
    content = content.replace(oldImportPattern3, "");
    content = content.replace(oldImportPattern4, "");

    modified = true;
  }

  // Replace resolve/tryResolve calls
  for (const [typesKey, containerKey] of Object.entries(SERVICE_MAPPINGS)) {
    const resolvePattern = new RegExp(
      `(try)?resolve<[^>]*>(TYPES\\.${typesKey})`,
      "g"
    );
    const replacement = `container.items.${containerKey}`;

    if (resolvePattern.test(content)) {
      content = content.replace(resolvePattern, replacement);
      modified = true;
    }
  }

  // Remove @injectable() decorator if present
  if (content.includes("@injectable()")) {
    content = content.replace(/@injectable\(\)\s*\n/g, "");
    modified = true;
  }

  // Remove inversify import if present
  if (content.includes('from "inversify"')) {
    content = content.replace(/import\s+\{[^}]*injectable[^}]*\}\s+from\s+"inversify";\s*\n/g, "");
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✓ Migrated: ${filePath}`);
    return true;
  }

  return false;
}

function findFilesToMigrate(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findFilesToMigrate(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".svelte"))) {
      files.push(fullPath);
    }
  }

  return files;
}

// Main execution
const targetDirs = [
  "src/lib/features/dashboard",
  "src/lib/features/gallery",
  "src/lib/features/mandala-generator",
  "src/lib/features/museum-navigator",
  "src/lib/features/background-builder",
];

let totalMigrated = 0;

for (const dir of targetDirs) {
  const fullPath = path.resolve(__dirname, "..", dir);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠ Directory not found: ${dir}`);
    continue;
  }

  console.log(`\n📁 Processing: ${dir}`);
  const files = findFilesToMigrate(fullPath);

  let dirMigrated = 0;
  for (const file of files) {
    if (migrateFile(file)) {
      dirMigrated++;
    }
  }

  console.log(`  → Migrated ${dirMigrated} files`);
  totalMigrated += dirMigrated;
}

console.log(`\n✅ Migration complete: ${totalMigrated} files migrated`);
