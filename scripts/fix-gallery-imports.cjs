/**
 * Fix gallery service files that still use @inject decorators
 * Restore the necessary inversify imports
 */

const fs = require("fs");
const path = require("path");

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // Check if file uses @inject decorator
  if (content.includes("@inject(")) {
    // Check if inversify imports are missing
    if (!content.includes('from "inversify"') && !content.includes("from 'inversify'")) {
      // Add inject import after the last import
      const lastImportMatch = content.match(/^import .*?;$/gm);
      if (lastImportMatch && lastImportMatch.length > 0) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport) + lastImport.length;

        content = content.slice(0, lastImportIndex) +
          '\nimport { inject } from "inversify";' +
          content.slice(lastImportIndex);

        modified = true;
      }
    }

    // Check if TYPES import is missing
    if (content.includes("TYPES.") && !content.includes('TYPES } from "$lib/shared/inversify/types"')) {
      // Add TYPES import after inject import
      const injectImportMatch = content.match(/import \{ inject \} from "inversify";/);
      if (injectImportMatch) {
        const injectImportIndex = content.indexOf(injectImportMatch[0]) + injectImportMatch[0].length;
        content = content.slice(0, injectImportIndex) +
          '\nimport { TYPES } from "$lib/shared/inversify/types";' +
          content.slice(injectImportIndex);
        modified = true;
      }
    }
  }

  // Remove stray semicolons after imports
  content = content.replace(/import type .+?;(\s*);/g, (match) => match.slice(0, -2));
  if (content !== fs.readFileSync(filePath, "utf8")) {
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✓ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

function findFilesToFix(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findFilesToFix(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

// Main execution
const galleryServicesDir = path.resolve(__dirname, "..", "src/lib/features/gallery/services");

console.log(`\n📁 Fixing gallery service files...`);
const files = findFilesToFix(galleryServicesDir);

let totalFixed = 0;
for (const file of files) {
  if (fixFile(file)) {
    totalFixed++;
  }
}

console.log(`\n✅ Fixed ${totalFixed} files`);
