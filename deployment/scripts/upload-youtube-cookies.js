#!/usr/bin/env node

/**
 * Upload YouTube Cookies to Firebase Storage
 *
 * This script helps upload exported YouTube cookies to Cloud Storage
 * for use by the YouTube audio extraction Cloud Function.
 *
 * Usage:
 *   node upload-youtube-cookies.js <cookies-file-path>
 *
 * Example:
 *   node upload-youtube-cookies.js ~/Downloads/youtube-cookies.txt
 */

const { exec } = require("child_process");
const { existsSync } = require("fs");
const path = require("path");

const cookiesFilePath = process.argv[2];

if (!cookiesFilePath) {
  console.error("❌ Error: Please provide the path to your cookies file");
  console.log("\nUsage:");
  console.log("  node upload-youtube-cookies.js <cookies-file-path>");
  console.log("\nExample:");
  console.log(
    "  node upload-youtube-cookies.js ~/Downloads/youtube-cookies.txt"
  );
  process.exit(1);
}

const resolvedPath = path.resolve(cookiesFilePath);

if (!existsSync(resolvedPath)) {
  console.error(`❌ Error: File not found: ${resolvedPath}`);
  process.exit(1);
}

console.log("📤 Uploading YouTube cookies to Firebase Storage...");
console.log(`   File: ${resolvedPath}`);
console.log("");

const command = `firebase storage:upload "${resolvedPath}" youtube-cookies.txt --project the-kinetic-alphabet`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error("❌ Upload failed:");
    console.error(stderr || error.message);
    process.exit(1);
  }

  console.log(stdout);
  console.log("✅ YouTube cookies uploaded successfully!");
  console.log("\n📝 Next steps:");
  console.log("  1. Deploy the updated Cloud Function:");
  console.log("     cd deployment && firebase deploy --only functions");
  console.log("  2. Try extracting audio again in the app");
  console.log("\n💡 Note: Cookies may expire after a few months.");
  console.log(
    "   If extraction fails again, re-export and upload fresh cookies."
  );
});
