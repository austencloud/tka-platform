/**
 * Remove stray semicolons left after import statement migrations
 */

const fs = require("fs");
const path = require("path");

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  // Remove lines that are just a semicolon
  content = content.replace(/\n;\n/g, "\n");

  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✓ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

function findFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findFiles(fullPath, files);
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

let totalFixed = 0;

for (const dir of targetDirs) {
  const fullPath = path.resolve(__dirname, "..", dir);

  if (!fs.existsSync(fullPath)) {
    continue;
  }

  const files = findFiles(fullPath);

  for (const file of files) {
    if (fixFile(file)) {
      totalFixed++;
    }
  }
}

console.log(`\n✅ Fixed ${totalFixed} files with stray semicolons`);
