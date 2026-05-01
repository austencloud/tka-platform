/**
 * Fix: Remove remaining imports from deleted contract files.
 * Handles multi-line imports, various import styles.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Get all TS2307 errors pointing to contracts/
const tscOutput = execSync('npx tsc --noEmit 2>&1 || true', {
  cwd: ROOT,
  encoding: 'utf-8',
  maxBuffer: 10 * 1024 * 1024,
  timeout: 300000,
});

const errorRegex = /^(.+?)\(\d+,\d+\): error TS2307: Cannot find module '([^']*contracts[^']*)'/gm;
const filesToFix = new Map();

let match;
while ((match = errorRegex.exec(tscOutput)) !== null) {
  const file = match[1];
  const modulePath = match[2];
  if (!filesToFix.has(file)) filesToFix.set(file, new Set());
  filesToFix.get(file).add(modulePath);
}

console.log(`Found ${filesToFix.size} files with broken contract imports\n`);

let fixed = 0;
for (const [file, modules] of filesToFix) {
  const fullPath = path.resolve(ROOT, file);
  let content = fs.readFileSync(fullPath, 'utf-8');

  for (const mod of modules) {
    // Remove single-line imports: import type { X } from 'path';
    // Also handle multi-line imports that span several lines
    const escapedMod = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Single-line: import type { ... } from '...contracts/...';
    const singleLine = new RegExp(
      `import\\s+(?:type\\s+)?\\{[^}]*\\}\\s*from\\s*['"]${escapedMod}['"];?\\n?`,
      'g'
    );

    // Multi-line: import type {\n  X,\n  Y,\n} from '...contracts/...';
    const multiLine = new RegExp(
      `import\\s+(?:type\\s+)?\\{[^}]*\\}\\s*from\\s*['"]${escapedMod}['"];?\\n?`,
      'gs'
    );

    content = content.replace(multiLine, '');
  }

  // Also remove any remaining "implements IXxx" that reference removed interfaces
  // Only if the interface was deleted (i.e., no contracts/ file exists for it)
  content = content.replace(/\s+implements\s+I[A-Z]\w+(?:<[^>]+>)?/g, (match) => {
    const iface = match.trim().replace(/^implements\s+/, '').replace(/<.*>$/, '');
    // Check if this interface file still exists
    const found = execSync(`git ls-files "src/**/contracts/${iface}.ts" 2>/dev/null || true`, {
      cwd: ROOT,
      encoding: 'utf-8',
    }).trim();
    if (found) return match; // interface still exists, keep it
    return ''; // interface deleted, remove implements
  });

  // Clean up multiple blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(fullPath, content);
  fixed++;
}

console.log(`Fixed ${fixed} files`);
