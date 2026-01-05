/**
 * Release Script
 *
 * Automates version releases with proper branch workflow:
 *
 * Branch Workflow:
 * 1. Verify you're on develop branch (or main with --from-main flag)
 * 2. Stash any uncommitted changes
 * 3. Switch to main branch
 * 4. Merge develop into main
 * 5. Create release commit and tag on main
 * 6. Push main and tags
 * 7. Switch back to develop
 * 8. Restore stashed changes
 *
 * Feedback Mode (preferred):
 * - Check completed feedback count
 * - Determine version number from feedback types
 * - Generate changelog from feedback items
 * - Archive feedback and create version record in Firestore
 *
 * Git History Mode (fallback):
 * - Parse commits since last tag
 * - Determine version from conventional commit types
 * - Generate changelog from commit messages
 * - Skip Firestore operations
 *
 * Usage:
 *   node scripts/release.js                    - Interactive flow
 *   node scripts/release.js -p                 - Quick preview (for /fb workflow)
 *   node scripts/release.js --preview          - Quick preview (same as -p)
 *   node scripts/release.js --dry-run          - Full preview with details
 *   node scripts/release.js --show-last        - Show what was in the last release
 *   node scripts/release.js --last             - Show what was in the last release (same as --show-last)
 *   node scripts/release.js --version 0.2.0    - Manual version
 *   node scripts/release.js --confirm          - Execute release (requires prior preview)
 *   node scripts/release.js --changelog file.json - Use custom changelog entries (user-friendly)
 *   node scripts/release.js --highlights 1,3,4   - Select highlight indices (comma-separated, or "none")
 *   node scripts/release.js --from-main        - Release directly from main (skip branch workflow)
 */

import admin from "firebase-admin";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import * as readline from "readline";

// Load service account key
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * Create readline interface for user prompts
 */
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask user a question and wait for response
 */
function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt user to select highlights from changelog entries
 * @param {Array} changelogEntries - The changelog entries to suggest as highlights
 * @returns {Promise<string[]>} - Selected highlights (may be empty)
 */
async function promptForHighlights(changelogEntries) {
  // Get potential highlights (features and major improvements)
  const potentialHighlights = changelogEntries
    .filter((e) => e.category === "added" || e.category === "improved")
    .map((e) => e.text);

  if (potentialHighlights.length === 0) {
    console.log("\n📌 No feature/improvement entries to highlight.\n");
    return [];
  }

  console.log("\n" + "═".repeat(60));
  console.log("⭐ HIGHLIGHT SELECTION");
  console.log("═".repeat(60));
  console.log(
    '\nHighlights appear prominently at the top of the "What\'s New" modal.'
  );
  console.log("Only select items that are genuinely exciting for users.\n");

  console.log("Potential highlights from this release:\n");
  potentialHighlights.forEach((text, i) => {
    console.log(`  [${i + 1}] ${text}`);
  });
  console.log(`  [0] No highlights for this release`);
  console.log(`  [c] Enter custom highlight text\n`);

  const rl = createPrompt();

  try {
    const answer = await askQuestion(
      rl,
      "Select highlights (comma-separated numbers, 0 for none, or c for custom): "
    );

    if (answer === "0" || answer === "") {
      console.log("\n✓ No highlights selected.\n");
      return [];
    }

    if (answer.toLowerCase() === "c") {
      const customText = await askQuestion(rl, "Enter custom highlight text: ");
      if (customText) {
        console.log(`\n✓ Custom highlight: "${customText}"\n`);
        return [customText];
      }
      return [];
    }

    // Parse comma-separated numbers
    const selectedIndices = answer
      .split(",")
      .map((s) => parseInt(s.trim()) - 1)
      .filter((i) => i >= 0 && i < potentialHighlights.length);

    const selectedHighlights = selectedIndices.map(
      (i) => potentialHighlights[i]
    );

    if (selectedHighlights.length > 0) {
      console.log("\n✓ Selected highlights:");
      selectedHighlights.forEach((h) => console.log(`   • ${h}`));
      console.log("");
    } else {
      console.log("\n✓ No valid highlights selected.\n");
    }

    return selectedHighlights;
  } finally {
    rl.close();
  }
}

/**
 * Get completed feedback items ready for release
 */
async function getCompletedFeedback() {
  const snapshot = await db
    .collection("feedback")
    .where("status", "==", "completed")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Generate changelog entries from feedback items
 * @param {Array} items - All completed feedback items
 * @param {boolean} includeInternalOnly - Whether to include internal-only items (default: false)
 * @returns {Object} - { userFacing: [...], developerNotes: [...] }
 */
function generateChangelogFromFeedback(items, includeInternalOnly = false) {
  const userFacing = [];
  const developerNotes = [];

  items.forEach((item) => {
    let category;
    switch (item.type) {
      case "bug":
        category = "fixed";
        break;
      case "feature":
        category = "added";
        break;
      default:
        category = "improved";
    }

    let text =
      item.title || item.description?.substring(0, 100) || "Untitled change";

    // Add appropriate prefix if not already present
    const lowerText = text.toLowerCase();
    if (category === "fixed" && !lowerText.startsWith("fixed")) {
      text = "Fixed " + text.charAt(0).toLowerCase() + text.slice(1);
    } else if (
      category === "added" &&
      !lowerText.startsWith("added") &&
      !lowerText.startsWith("new")
    ) {
      text = "Added " + text.charAt(0).toLowerCase() + text.slice(1);
    }

    const entry = { category, text, feedbackId: item.id };

    // Separate user-facing from internal-only changes
    if (item.isInternalOnly) {
      developerNotes.push(entry);
    } else {
      userFacing.push(entry);
    }
  });

  return { userFacing, developerNotes };
}

/**
 * Get most recent git tag
 */
function getLatestTag() {
  try {
    const tag = execSync("git describe --tags --abbrev=0", {
      encoding: "utf8",
    }).trim();
    return tag.replace(/^v/, "");
  } catch (error) {
    // No tags exist
    return null;
  }
}

/**
 * Generate changelog entries from git commits since last tag
 */
function generateChangelogFromGitHistory() {
  const latestTag = getLatestTag();
  const range = latestTag ? `v${latestTag}..HEAD` : "HEAD";

  try {
    const commits = execSync(
      `git log ${range} --pretty=format:"%s" --no-merges`,
      {
        encoding: "utf8",
      }
    ).trim();

    if (!commits) return [];

    return commits.split("\n").map((commit) => {
      let category = "improved";
      let text = commit;

      // Parse conventional commit format
      const fixMatch = commit.match(/^fix(\(.+?\))?:\s*(.+)/i);
      const featMatch = commit.match(/^feat(\(.+?\))?:\s*(.+)/i);
      const refactorMatch = commit.match(/^refactor(\(.+?\))?:\s*(.+)/i);
      const styleMatch = commit.match(/^style(\(.+?\))?:\s*(.+)/i);
      const choreMatch = commit.match(/^chore(\(.+?\))?:\s*(.+)/i);

      if (fixMatch) {
        category = "fixed";
        text = fixMatch[2];
      } else if (featMatch) {
        category = "added";
        text = featMatch[2];
      } else if (refactorMatch || styleMatch || choreMatch) {
        category = "improved";
        text = refactorMatch?.[2] || styleMatch?.[2] || choreMatch?.[2] || text;
      }

      // Ensure proper capitalization
      text = text.charAt(0).toUpperCase() + text.slice(1);

      return { category, text, commit };
    });
  } catch (error) {
    console.error("Warning: Could not read git history:", error.message);
    return [];
  }
}

/**
 * Determine suggested version based on changelog entries
 *
 * Pre-1.0 versioning strategy:
 * - PATCH (0.1.x): Bug fixes and small improvements only
 * - MINOR (0.x.0): New features or significant changes
 *
 * Significant change indicators:
 * - New modules, major UI changes, architectural shifts
 * - Keywords: "new module", "major", "refactor", "redesign", "architecture"
 */
function suggestVersion(currentVersion, changelogEntries) {
  const parts = currentVersion.replace("-beta", "").split(".");
  const major = parseInt(parts[0]) || 0;
  const minor = parseInt(parts[1]) || 0;
  const patch = parseInt(parts[2]) || 0;

  // Check if any features exist
  const hasFeatures = changelogEntries.some(
    (entry) => entry.category === "added"
  );

  if (!hasFeatures) {
    // Only bugs/improvements → patch bump
    return `${major}.${minor}.${patch + 1}`;
  }

  // Analyze feature significance
  const significantKeywords = [
    "new module",
    "major",
    "refactor",
    "redesign",
    "architecture",
    "new tab",
    "new feature set",
    "migration",
    "overhaul",
  ];

  const allChangeText = changelogEntries
    .map((e) => e.text.toLowerCase())
    .join(" ");

  const hasSignificantChange = significantKeywords.some((keyword) =>
    allChangeText.includes(keyword)
  );

  if (hasSignificantChange) {
    // Significant feature → minor bump
    return `${major}.${minor + 1}.0`;
  }

  // Regular features but not significant → patch bump
  // (avoids version inflation from small features)
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Get current version from package.json
 */
function getCurrentVersion() {
  const packageJson = JSON.parse(readFileSync("./package.json", "utf8"));
  return packageJson.version;
}

/**
 * Update package.json version
 */
function updatePackageVersion(newVersion) {
  const packageJson = JSON.parse(readFileSync("./package.json", "utf8"));
  packageJson.version = newVersion;
  writeFileSync("./package.json", JSON.stringify(packageJson, null, 2) + "\n");
}

/**
 * Update service worker cache version
 * This ensures users get fresh assets after a release
 */
function updateServiceWorkerVersion(newVersion) {
  const swPath = "./static/sw.js";
  if (!existsSync(swPath)) {
    console.log("   ⚠️  No service worker found, skipping SW version update");
    return;
  }

  let swContent = readFileSync(swPath, "utf8");
  // Replace the CACHE_VERSION line
  swContent = swContent.replace(
    /const CACHE_VERSION = "[^"]+";/,
    `const CACHE_VERSION = "v${newVersion}";`
  );
  writeFileSync(swPath, swContent);
}

/**
 * Prepare release in Firestore
 * (archives completed feedback and creates version record)
 */
async function prepareFirestoreRelease(
  version,
  changelogEntries,
  feedbackItems,
  highlights = []
) {
  const batch = db.batch();

  // Calculate summary counts
  const summary = { bugs: 0, features: 0, general: 0 };
  feedbackItems.forEach((item) => {
    if (item.type === "bug") summary.bugs++;
    else if (item.type === "feature") summary.features++;
    else summary.general++;
  });

  // Update all completed feedback items
  feedbackItems.forEach((item) => {
    const ref = db.collection("feedback").doc(item.id);
    batch.update(ref, {
      fixedInVersion: version,
      status: "archived",
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // Create version document
  const versionRef = db.collection("versions").doc(version);
  const versionData = {
    version,
    feedbackCount: feedbackItems.length,
    feedbackSummary: summary,
    changelogEntries,
    releasedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Only include highlights if there are any (keeps data clean)
  if (highlights.length > 0) {
    versionData.highlights = highlights;
  }

  batch.set(versionRef, versionData);

  // Commit batch
  await batch.commit();
}

/**
 * Check git status
 */
function checkGitStatus() {
  try {
    const status = execSync("git status --porcelain", { encoding: "utf8" });
    return status.trim();
  } catch (error) {
    return "";
  }
}

/**
 * Get current git branch
 */
function getCurrentBranch() {
  try {
    return execSync("git branch --show-current", { encoding: "utf8" }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Switch to a git branch
 */
function switchToBranch(branch) {
  execSync(`git checkout ${branch}`, { stdio: "inherit" });
}

/**
 * Merge a branch into current branch
 */
function mergeBranch(sourceBranch) {
  execSync(`git merge ${sourceBranch} --no-edit`, { stdio: "inherit" });
}

/**
 * Stash changes if there are any
 * Returns true if changes were stashed
 */
function stashChanges() {
  const status = checkGitStatus();
  if (status) {
    execSync('git stash push -m "release-script-auto-stash"', {
      stdio: "inherit",
    });
    return true;
  }
  return false;
}

/**
 * Pop stashed changes
 */
function popStash() {
  try {
    execSync("git stash pop", { stdio: "inherit" });
  } catch (error) {
    console.log("⚠️  Could not restore stashed changes automatically.");
    console.log('   Run "git stash pop" manually if needed.');
  }
}

/**
 * Push branch and tags to remote
 */
function pushToRemote(branch) {
  execSync(`git push origin ${branch}`, { stdio: "inherit" });
  execSync("git push --tags", { stdio: "inherit" });
}

/**
 * Create git commit and tag
 */
function createGitRelease(version, changelog) {
  // Stage package.json (and sw.js only if it exists)
  execSync("git add package.json", { stdio: "inherit" });
  if (existsSync("./static/sw.js")) {
    execSync("git add static/sw.js", { stdio: "inherit" });
  }

  // Create commit message
  const changelogSummary = changelog
    .slice(0, 5)
    .map((e) => `- ${e.text}`)
    .join("\n");

  const commitMessage = `chore(release): v${version}

${changelogSummary}${changelog.length > 5 ? "\n..." : ""}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

  // Create commit
  execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
    stdio: "inherit",
  });

  // Create annotated tag
  const tagMessage = changelog.map((e) => `- ${e.text}`).join("\n");
  execSync(`git tag -a v${version} -m "Release v${version}\n\n${tagMessage}"`, {
    stdio: "inherit",
  });
}

/**
 * Create GitHub release
 */
function createGitHubRelease(version, changelog) {
  // Format release notes
  const fixed = changelog.filter((e) => e.category === "fixed");
  const added = changelog.filter((e) => e.category === "added");
  const improved = changelog.filter((e) => e.category === "improved");

  let releaseNotes = "";

  if (fixed.length > 0) {
    releaseNotes += "## 🐛 Bug Fixes\n\n";
    fixed.forEach((e) => {
      releaseNotes += `- ${e.text}\n`;
    });
    releaseNotes += "\n";
  }

  if (added.length > 0) {
    releaseNotes += "## ✨ New Features\n\n";
    added.forEach((e) => {
      releaseNotes += `- ${e.text}\n`;
    });
    releaseNotes += "\n";
  }

  if (improved.length > 0) {
    releaseNotes += "## 🔧 Improvements\n\n";
    improved.forEach((e) => {
      releaseNotes += `- ${e.text}\n`;
    });
    releaseNotes += "\n";
  }

  releaseNotes +=
    "\n---\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)";

  // Write release notes to temp file to handle special characters
  writeFileSync(".release-notes.tmp", releaseNotes);

  try {
    // Create GitHub release
    execSync(
      `gh release create v${version} --title "v${version}" --notes-file .release-notes.tmp`,
      {
        stdio: "inherit",
      }
    );
  } finally {
    // Clean up temp file
    try {
      execSync("rm .release-notes.tmp", { stdio: "ignore" });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Display changelog preview
 */
function displayChangelog(entries) {
  const fixed = entries.filter((e) => e.category === "fixed");
  const added = entries.filter((e) => e.category === "added");
  const improved = entries.filter((e) => e.category === "improved");

  console.log("\n📋 Changelog Preview:\n");

  if (fixed.length > 0) {
    console.log("  🐛 Fixed:");
    fixed.forEach((e) => console.log(`     - ${e.text}`));
    console.log("");
  }

  if (added.length > 0) {
    console.log("  ✨ Added:");
    added.forEach((e) => console.log(`     - ${e.text}`));
    console.log("");
  }

  if (improved.length > 0) {
    console.log("  🔧 Improved:");
    improved.forEach((e) => console.log(`     - ${e.text}`));
    console.log("");
  }
}

/**
 * Show what was released in the last version
 */
async function showLastRelease() {
  console.log("📦 Last Release Summary\n");
  console.log("=".repeat(70));

  try {
    // Get latest version from git tags
    const latestTag = getLatestTag();

    if (!latestTag) {
      console.log("\n⚠️  No releases found.");
      console.log("   Create your first release with /release\n");
      return;
    }

    const version = latestTag;
    console.log(`\n🏷️  Version: v${version}\n`);

    // Get tag date and message
    try {
      const tagInfo = execSync(`git tag -l -n99 v${version}`, {
        encoding: "utf8",
      }).trim();
      const tagDate = execSync(`git log -1 --format=%ai v${version}`, {
        encoding: "utf8",
      }).trim();

      console.log(`📅 Released: ${tagDate}\n`);
    } catch (e) {
      // Ignore if we can't get tag info
    }

    // Query Firestore for feedback items fixed in this version
    const snapshot = await db
      .collection("feedback")
      .where("fixedInVersion", "==", version)
      .get();

    if (snapshot.empty) {
      console.log("⚠️  No feedback items found for this version in Firestore.");
      console.log("   This might be a git-only release.\n");

      // Show git tag message as fallback
      try {
        const tagMessage = execSync(
          `git tag -l -n99 v${version} | tail -n +2`,
          { encoding: "utf8" }
        ).trim();
        if (tagMessage) {
          console.log("📋 Release Notes:\n");
          console.log(tagMessage);
          console.log("");
        }
      } catch (e) {
        // Ignore
      }
      return;
    }

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Group by type
    const bugs = items.filter((i) => i.type === "bug");
    const features = items.filter((i) => i.type === "feature");
    const general = items.filter((i) => i.type === "general");

    console.log(`✅ Shipped ${items.length} items:`);
    console.log(`   🐛 ${bugs.length} bug fixes`);
    console.log(`   ✨ ${features.length} new features`);
    console.log(`   🔧 ${general.length} improvements\n`);

    console.log("─".repeat(70));

    // Show details
    if (bugs.length > 0) {
      console.log("\n🐛 Bug Fixes:\n");
      bugs.forEach((item) => {
        const title =
          item.title || item.description?.substring(0, 60) || "Untitled";
        console.log(`   • ${title}${item.title ? "" : "..."}`);
        if (item.id) {
          console.log(`     └─ ID: ${item.id.substring(0, 8)}...`);
        }
      });
    }

    if (features.length > 0) {
      console.log("\n✨ New Features:\n");
      features.forEach((item) => {
        const title =
          item.title || item.description?.substring(0, 60) || "Untitled";
        console.log(`   • ${title}${item.title ? "" : "..."}`);
        if (item.id) {
          console.log(`     └─ ID: ${item.id.substring(0, 8)}...`);
        }
      });
    }

    if (general.length > 0) {
      console.log("\n🔧 Improvements:\n");
      general.forEach((item) => {
        const title =
          item.title || item.description?.substring(0, 60) || "Untitled";
        console.log(`   • ${title}${item.title ? "" : "..."}`);
        if (item.id) {
          console.log(`     └─ ID: ${item.id.substring(0, 8)}...`);
        }
      });
    }

    console.log("\n" + "─".repeat(70));
    console.log(`\n💡 View on GitHub: gh release view v${version}`);
    console.log(
      `💡 In app: "What's New" modal shows automatically on first login\n`
    );
  } catch (error) {
    console.error("❌ Error fetching last release:", error.message);
    process.exit(1);
  }
}

/**
 * Main release flow
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const quickPreview = args.includes("--preview") || args.includes("-p");
  const showLast = args.includes("--show-last") || args.includes("--last");
  const manualVersionIndex = args.indexOf("--version");
  const manualVersion =
    manualVersionIndex >= 0 ? args[manualVersionIndex + 1] : null;
  const changelogFileIndex = args.indexOf("--changelog");
  const changelogFile =
    changelogFileIndex >= 0 ? args[changelogFileIndex + 1] : null;
  const highlightsIndex = args.indexOf("--highlights");
  const highlightsArg =
    highlightsIndex >= 0 ? args[highlightsIndex + 1] : null;
  const fromMain = args.includes("--from-main");

  // Show last release mode
  if (showLast) {
    await showLastRelease();
    process.exit(0);
  }

  // Check current branch
  const startingBranch = getCurrentBranch();
  const isOnDevelop = startingBranch === "develop";
  const isOnMain = startingBranch === "main";

  // Quick preview mode - minimal output
  if (quickPreview) {
    console.log("🔍 Quick Release Preview\n");
  } else {
    console.log("📦 Starting release process...\n");
  }

  // Branch check (skip for preview modes)
  if (!dryRun && !quickPreview) {
    console.log(`🌿 Current branch: ${startingBranch}`);

    if (!isOnDevelop && !isOnMain) {
      console.error(`\n❌ You must be on 'develop' or 'main' to release.`);
      console.error(`   Currently on: ${startingBranch}`);
      console.error(`   Switch to develop: git checkout develop\n`);
      process.exit(1);
    }

    if (isOnMain && !fromMain) {
      console.log(`\n⚠️  You're on 'main' branch.`);
      console.log(`   Releases should typically be made from 'develop'.`);
      console.log(`   Add --from-main flag to release directly from main.\n`);
      process.exit(1);
    }

    if (isOnDevelop) {
      console.log(`   ✓ Will merge develop → main, then release on main\n`);
    }
  }

  // 1. Check completed feedback
  console.log("🔍 Checking completed feedback...");
  const feedbackItems = await getCompletedFeedback();

  let changelog;
  let useGitHistory = false;
  let useCustomChangelog = false;

  // Check if a custom changelog file was provided (user-friendly entries from Claude)
  if (changelogFile && existsSync(changelogFile)) {
    try {
      changelog = JSON.parse(readFileSync(changelogFile, "utf8"));
      useCustomChangelog = true;
      console.log(`✓ Using custom changelog from ${changelogFile}`);
      console.log(`  (${changelog.length} user-friendly entries)\n`);
    } catch (error) {
      console.error(`❌ Failed to parse changelog file: ${error.message}`);
      process.exit(1);
    }
  } else if (feedbackItems.length === 0) {
    console.log("⚠️  No completed feedback found.");
    console.log("📝 Using git commit history instead...\n");

    changelog = generateChangelogFromGitHistory();

    if (changelog.length === 0) {
      console.error("❌ No commits found to release.");
      console.error("   Either:");
      console.error("   1. Complete some feedback items, or");
      console.error("   2. Make some commits to include in the release");
      process.exit(1);
    }

    useGitHistory = true;
    console.log(`✓ Found ${changelog.length} commits since last release\n`);
  } else {
    const { userFacing, developerNotes } =
      generateChangelogFromFeedback(feedbackItems);

    // Count user-facing items only for summary
    const summary = { bugs: 0, features: 0, general: 0 };
    feedbackItems
      .filter((item) => !item.isInternalOnly)
      .forEach((item) => {
        if (item.type === "bug") summary.bugs++;
        else if (item.type === "feature") summary.features++;
        else summary.general++;
      });

    console.log(`✓ Found ${userFacing.length} completed items`);
    console.log(
      `  (${summary.bugs} bugs, ${summary.features} features, ${summary.general} general)\n`
    );

    if (developerNotes.length > 0) {
      console.log(
        `📝 ${developerNotes.length} internal-only items (excluded from user changelog)\n`
      );
    }

    // Use only user-facing items for changelog
    changelog = userFacing;
  }

  // 2. Determine version
  const currentVersion = getCurrentVersion();
  const suggestedVersion =
    manualVersion || suggestVersion(currentVersion, changelog);

  console.log(`📌 Current version: ${currentVersion}`);
  console.log(`📌 Suggested version: ${suggestedVersion}`);

  // Explain the bump type
  const parts = currentVersion.split(".");
  const currentMinor = parseInt(parts[1]) || 0;
  const suggestedParts = suggestedVersion.split(".");
  const suggestedMinor = parseInt(suggestedParts[1]) || 0;

  if (suggestedMinor > currentMinor) {
    console.log("   (minor bump - significant features detected)");
  } else {
    console.log("   (patch bump - regular changes)");
  }

  console.log("   💡 Override with: --version X.Y.Z");
  console.log("");

  // 3. Display changelog
  displayChangelog(changelog);

  // 4. Check git status
  const gitStatus = checkGitStatus();
  if (gitStatus) {
    console.log("⚠️  Warning: Working directory has uncommitted changes:");
    console.log(
      gitStatus
        .split("\n")
        .map((line) => `   ${line}`)
        .join("\n")
    );
    console.log("");
  }

  if (dryRun || quickPreview) {
    if (quickPreview) {
      console.log(
        "\n💡 Tip: Run /release to create this release interactively."
      );
    } else {
      console.log("🔍 Dry run complete. No changes made.");
    }
    process.exit(0);
  }

  // In actual use, Claude will handle confirmation via AskUserQuestion
  // For now, require --confirm flag
  if (!args.includes("--confirm")) {
    console.log("💡 This is a preview. Add --confirm to execute the release.");
    console.log("   Or use the /release slash command for interactive flow.");
    process.exit(0);
  }

  // 5. Get highlights (from CLI flag or interactive prompt)
  let selectedHighlights = [];
  if (!useGitHistory && feedbackItems.length > 0) {
    // Get potential highlights (features and major improvements)
    const potentialHighlights = changelog
      .filter((e) => e.category === "added" || e.category === "improved")
      .map((e) => e.text);

    if (highlightsArg !== null) {
      // Use CLI-provided highlights (non-interactive mode for Claude)
      if (highlightsArg === "none" || highlightsArg === "0") {
        console.log("✓ No highlights selected (via --highlights flag)\n");
        selectedHighlights = [];
      } else {
        // Parse comma-separated indices (1-based)
        const indices = highlightsArg
          .split(",")
          .map((s) => parseInt(s.trim()) - 1)
          .filter((i) => i >= 0 && i < potentialHighlights.length);

        selectedHighlights = indices.map((i) => potentialHighlights[i]);

        if (selectedHighlights.length > 0) {
          console.log("✓ Selected highlights (via --highlights flag):");
          selectedHighlights.forEach((h) => console.log(`   • ${h}`));
          console.log("");
        }
      }
    } else {
      // Interactive mode (fallback)
      selectedHighlights = await promptForHighlights(changelog);
    }
  }

  // 6. Execute release
  console.log("🚀 Executing release...\n");

  let didStash = false;

  // Branch workflow: stash, switch to main, merge develop
  if (isOnDevelop) {
    // Stash any uncommitted changes
    const gitStatus = checkGitStatus();
    if (gitStatus) {
      console.log("📦 Stashing uncommitted changes...");
      didStash = stashChanges();
    }

    // Switch to main
    console.log("🔀 Switching to main branch...");
    switchToBranch("main");

    // Pull latest main (in case remote has changes)
    try {
      console.log("⬇️  Pulling latest main...");
      execSync("git pull origin main --no-edit", { stdio: "inherit" });
    } catch (error) {
      console.log("   (No remote changes or not connected)");
    }

    // Merge develop into main
    console.log("🔀 Merging develop → main...");
    mergeBranch("develop");
  }

  // Update package.json
  console.log("✓ Updating package.json...");
  updatePackageVersion(suggestedVersion);

  // Update service worker cache version (forces cache bust for users)
  console.log("✓ Updating service worker cache version...");
  updateServiceWorkerVersion(suggestedVersion);

  // Prepare Firestore (only if using feedback or custom changelog with feedback)
  if (!useGitHistory && feedbackItems.length > 0) {
    console.log("✓ Archiving feedback in Firestore...");
    // Use custom changelog entries if provided, otherwise use generated ones
    // Include selected highlights (if any) in the version document
    await prepareFirestoreRelease(
      suggestedVersion,
      changelog,
      feedbackItems,
      selectedHighlights
    );
  } else if (useGitHistory) {
    console.log("⏭️  Skipping Firestore operations (git history mode)");
  }

  // Create git commit and tag
  console.log("✓ Creating git commit and tag...");
  createGitRelease(suggestedVersion, changelog);

  // Push main branch and tags
  console.log("✓ Pushing to remote...");
  pushToRemote("main");

  // Create GitHub release
  console.log("✓ Creating GitHub release...");
  createGitHubRelease(suggestedVersion, changelog);

  // Note: "What's New" modal is handled by WhatsNewChecker component
  // which reads from the 'versions' collection created above

  // Switch back to develop and restore stash
  if (isOnDevelop) {
    console.log("🔀 Switching back to develop...");
    switchToBranch("develop");

    // Merge main back to develop (so develop has the version bump)
    console.log("🔀 Syncing main → develop...");
    mergeBranch("main");

    // Push develop
    console.log("✓ Pushing develop...");
    execSync("git push origin develop", { stdio: "inherit" });

    // Restore stashed changes
    if (didStash) {
      console.log("📦 Restoring stashed changes...");
      popStash();
    }
  }

  console.log(`\n🎉 Release v${suggestedVersion} complete!\n`);
  console.log("   Summary:");
  console.log(`   - Version: v${suggestedVersion}`);
  console.log(`   - Branch: main (tagged and pushed)`);
  console.log(`   - Current branch: ${isOnDevelop ? "develop" : "main"}`);
  console.log("");
  console.log("   View the release:");
  console.log(`   - GitHub: gh release view v${suggestedVersion}`);
  console.log(
    '   - In app: "What\'s New" modal shows automatically on first login'
  );
  console.log("");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Release failed:", error.message);
  process.exit(1);
});
