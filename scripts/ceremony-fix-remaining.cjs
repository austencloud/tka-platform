/**
 * Fix remaining errors after Phase 1:
 * 1. Restore imports from still-existing contract files that were wrongly removed
 * 2. Inline missing types from deleted contracts
 * 3. Fix duplicate definitions
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Get the current file content and its original from git
function getOriginal(file) {
  try {
    return execSync(`git show HEAD:"${file.replace(/\\/g, '/')}"`, {
      cwd: ROOT, encoding: 'utf-8',
    });
  } catch { return null; }
}

// Parse all TS2304 errors (missing names)
const tscOutput = execSync('npx tsc --noEmit 2>&1 || true', {
  cwd: ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 300000,
});

// Collect files with issues
const errorFiles = new Map();
for (const line of tscOutput.split('\n')) {
  const m = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.+)/);
  if (!m) continue;
  if (!errorFiles.has(m[1])) errorFiles.set(m[1], []);
  errorFiles.get(m[1]).push({ code: m[2], msg: m[3] });
}

console.log(`${errorFiles.size} files with errors\n`);

let fixed = 0;

for (const [file, errors] of errorFiles) {
  const fullPath = path.resolve(ROOT, file);
  const original = getOriginal(file);
  if (!original) continue;

  let current = fs.readFileSync(fullPath, 'utf-8');

  // Find imports that exist in original but not in current
  const origImports = [];
  const origLines = original.split('\n');
  let collecting = false;
  let importBuf = '';
  for (const line of origLines) {
    if (line.match(/^import\s/)) {
      collecting = true;
      importBuf = line;
      if (line.includes('from ')) {
        origImports.push(importBuf);
        collecting = false;
        importBuf = '';
      }
    } else if (collecting) {
      importBuf += '\n' + line;
      if (line.includes('from ')) {
        origImports.push(importBuf);
        collecting = false;
        importBuf = '';
      }
    }
  }

  // For each missing name (TS2304), check if it was in an import we removed
  const missingNames = errors
    .filter(e => e.code === 'TS2304')
    .map(e => {
      const m = e.msg.match(/Cannot find name '(\w+)'/);
      return m ? m[1] : null;
    })
    .filter(Boolean);

  // For TS2552 (did you mean), extract the missing name
  const didYouMean = errors
    .filter(e => e.code === 'TS2552')
    .map(e => {
      const m = e.msg.match(/Cannot find name '(\w+)'/);
      return m ? m[1] : null;
    })
    .filter(Boolean);

  const allMissing = [...new Set([...missingNames, ...didYouMean])];

  for (const name of allMissing) {
    // Check if any original import contained this name
    for (const imp of origImports) {
      if (imp.includes(name)) {
        // Check if this import's source file still exists
        const fromMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
        if (!fromMatch) continue;
        const importPath = fromMatch[1];

        // Resolve path
        let resolvedPath;
        if (importPath.startsWith('$lib/')) {
          resolvedPath = importPath.replace('$lib/', 'src/lib/') + '.ts';
        } else {
          const dir = path.dirname(file).replace(/\\/g, '/');
          resolvedPath = path.posix.normalize(path.posix.join(dir, importPath)) + '.ts';
        }

        const exists = fs.existsSync(path.resolve(ROOT, resolvedPath));

        if (exists) {
          // Contract still exists — restore the import
          if (!current.includes(imp.trim())) {
            // Insert at top after existing imports
            const lines = current.split('\n');
            let lastImport = -1;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].match(/^import\s/) || (i > 0 && lines[i].match(/^\s*\}?\s*from\s/))) {
                lastImport = i;
              }
            }
            lines.splice(lastImport + 1, 0, imp);
            current = lines.join('\n');
          }
        } else {
          // Contract was deleted — need to find the type definition and inline it
          const contractContent = getOriginal(resolvedPath);
          if (contractContent) {
            // Extract the type def
            const typeRegex = new RegExp(`export\\s+(?:interface|type|enum)\\s+${name}\\b[\\s\\S]*?(?:^\\}|;)`, 'm');
            const typeMatch = contractContent.match(typeRegex);
            if (typeMatch && !current.includes(`export interface ${name}`) && !current.includes(`export type ${name}`)) {
              // Find end of imports
              const lines = current.split('\n');
              let lastImport = -1;
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].match(/^import\s/)) lastImport = i;
              }
              lines.splice(lastImport + 1, 0, '\n' + typeMatch[0]);
              current = lines.join('\n');
            }
          }
        }
        break;
      }
    }
  }

  // Fix duplicate identifiers (TS2300)
  const dupes = errors.filter(e => e.code === 'TS2300');
  if (dupes.length > 0) {
    // Remove duplicate type definitions (keep the first one)
    for (const dupe of dupes) {
      const m = dupe.msg.match(/Duplicate identifier '(\w+)'/);
      if (!m) continue;
      const name = m[1];
      // Find all occurrences and remove all but the first
      let firstFound = false;
      const lines = current.split('\n');
      const newLines = [];
      let skipUntilClose = false;
      let depth = 0;
      for (const line of lines) {
        if (skipUntilClose) {
          for (const ch of line) {
            if (ch === '{') depth++;
            if (ch === '}') depth--;
          }
          if (depth <= 0) skipUntilClose = false;
          continue;
        }
        if (line.match(new RegExp(`export\\s+(?:interface|type)\\s+${name}\\b`))) {
          if (firstFound) {
            // Skip this duplicate
            if (line.includes('{')) {
              skipUntilClose = true;
              depth = 0;
              for (const ch of line) {
                if (ch === '{') depth++;
                if (ch === '}') depth--;
              }
              if (depth <= 0) skipUntilClose = false;
            }
            continue;
          }
          firstFound = true;
        }
        newLines.push(line);
      }
      current = newLines.join('\n');
    }
  }

  // Clean up
  current = current.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(fullPath, current);
  fixed++;
  console.log(`  ${file}: processed (${allMissing.length} missing names, ${dupes.length} dupes)`);
}

console.log(`\nProcessed ${fixed} files`);
