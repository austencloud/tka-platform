/**
 * Fix TS1005 syntax errors from Phase 2+3.
 * For each broken file:
 * 1. Restore from git HEAD
 * 2. Properly remove contract import + implements
 * 3. Properly inline co-exported types with complete definitions
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Get list of broken files
const tscOutput = execSync('npx tsc --noEmit 2>&1 || true', {
  cwd: ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 300000,
});

const brokenFiles = new Set();
for (const line of tscOutput.split('\n')) {
  const m = line.match(/^(.+?)\(\d+,\d+\): error TS1005/);
  if (m) brokenFiles.add(m[1]);
}

console.log(`Fixing ${brokenFiles.size} files with syntax errors\n`);

function getFromGit(filePath) {
  try {
    return execSync(`git show HEAD:"${filePath.replace(/\\/g, '/')}"`, {
      cwd: ROOT, encoding: 'utf-8',
    });
  } catch { return null; }
}

function extractFullTypes(contractContent, excludeName) {
  const defs = [];
  const lines = contractContent.split('\n');
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^export\s+(interface|type|enum)\s+(\w+)/);
    if (m && m[2] !== excludeName) {
      // Collect the full definition
      if (m[1] === 'type' && !lines[i].includes('{')) {
        // Single-line type alias — collect until semicolon
        let typeLine = lines[i];
        while (!typeLine.includes(';') && i + 1 < lines.length) {
          i++;
          typeLine += '\n' + lines[i];
        }
        defs.push(typeLine);
        i++;
        continue;
      }
      // Multi-line with braces
      let depth = 0;
      let block = '';
      for (let j = i; j < lines.length; j++) {
        block += lines[j] + '\n';
        for (const ch of lines[j]) {
          if (ch === '{') depth++;
          if (ch === '}') depth--;
        }
        if (depth <= 0 && block.includes('{')) {
          i = j + 1;
          break;
        }
      }
      defs.push(block.trimEnd());
      continue;
    }
    i++;
  }
  return defs;
}

let fixed = 0;

for (const file of brokenFiles) {
  const relFile = file.replace(/\\/g, '/');

  // 1. Restore from git
  const original = getFromGit(relFile);
  if (!original) {
    console.log(`  SKIP ${relFile}: not in git HEAD`);
    continue;
  }

  // Write original back
  fs.writeFileSync(path.resolve(ROOT, relFile), original);

  // 2. Find which contract this imports from
  const contractImportMatch = original.match(/from\s+['"]([^'"]*\/contracts\/I[^'"]+)['"]/);
  if (!contractImportMatch) {
    console.log(`  SKIP ${relFile}: no contract import`);
    continue;
  }

  const importPath = contractImportMatch[1];
  const contractBasename = path.basename(importPath);
  const interfaceName = contractBasename; // e.g. "IAuditLogger"

  // Resolve contract path
  let contractFile;
  if (importPath.startsWith('$lib/')) {
    contractFile = importPath.replace('$lib/', 'src/lib/') + '.ts';
  } else {
    const dir = path.dirname(relFile);
    contractFile = path.posix.normalize(path.posix.join(dir, importPath)) + '.ts';
  }

  // Check if contract file still exists on disk
  const contractExists = fs.existsSync(path.resolve(ROOT, contractFile));

  if (contractExists) {
    // Contract still exists — this file shouldn't have been broken.
    // Just leave it restored from git.
    console.log(`  ${relFile}: restored (contract still exists)`);
    fixed++;
    continue;
  }

  // Contract was deleted — get its content from git
  const contractContent = getFromGit(contractFile);
  if (!contractContent) {
    console.log(`  WARN ${relFile}: contract ${contractFile} not in git`);
    fixed++;
    continue;
  }

  // Extract co-exported type definitions
  const typeDefs = extractFullTypes(contractContent, interfaceName);

  // Find the implementation class name
  let content = original;

  // Find all names imported from this contract
  const importNamesRegex = new RegExp(
    `import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s*from\\s*['"][^'"]*${contractBasename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
    'gs'
  );
  const importNamesMatch = importNamesRegex.exec(content);
  let importedNames = [];
  if (importNamesMatch) {
    importedNames = importNamesMatch[1].split(',').map(n => n.trim()).filter(Boolean);
  }

  // Remove the contract import line entirely
  content = content.replace(
    new RegExp(
      `import\\s+(?:type\\s+)?\\{[^}]*\\}\\s*from\\s*['"][^'"]*${contractBasename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"];?\\n?`,
      'gs'
    ),
    ''
  );

  // Remove implements clause
  content = content.replace(
    new RegExp(`\\s+implements\\s+${interfaceName}(?:<[^>]*>)?`),
    ''
  );

  // Insert type definitions after imports
  if (typeDefs.length > 0) {
    const lines = content.split('\n');
    let lastImportEnd = -1;
    let inImport = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s/)) inImport = true;
      if (inImport) {
        if (lines[i].includes(' from ') || (lines[i].match(/['"];?\s*$/) && !lines[i].match(/^import/))) {
          lastImportEnd = i;
          inImport = false;
        }
      }
    }

    const typeBlock = '\n' + typeDefs.join('\n\n') + '\n';
    lines.splice(lastImportEnd + 1, 0, typeBlock);
    content = lines.join('\n');
  }

  // Check if any other imported names (besides the interface) need their imports
  // updated to point to new locations
  // Non-interface imported names that are co-exported types should now be available
  // locally since we inlined them. Remove any remaining import references.

  content = content.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(path.resolve(ROOT, relFile), content);
  console.log(`  ${relFile}: fixed (${typeDefs.length} types inlined)`);
  fixed++;
}

console.log(`\nFixed ${fixed} files`);
