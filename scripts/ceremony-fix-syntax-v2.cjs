/**
 * Fix v2: For each file that was restored to git HEAD by fix-syntax.cjs,
 * re-apply the Phase 2 codemod changes (remove implements, strip contract import,
 * inline types properly).
 *
 * This time: find the contract content from git, extract types with COMPLETE
 * definitions, and insert them AFTER all imports are closed (not inside multi-line imports).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// These 32 files were restored from git HEAD by the previous script.
// They now have `implements IFoo` and import from deleted contracts.
// We need to re-apply the ceremony removal.

// Find all files that still reference deleted contracts
const allTs = [];
function walk(dir) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.includes('node_modules')) walk(full);
      else if (/\.tsx?$/.test(e.name) || e.name.endsWith('.svelte.ts')) allTs.push(full);
    }
  } catch {}
}
walk(path.join(ROOT, 'src'));

function getGit(p) {
  try { return execSync(`git show HEAD:"${p}"`, { cwd: ROOT, encoding: 'utf-8' }); }
  catch { return null; }
}

function extractTypes(content, excludeNames) {
  const defs = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^export\s+(interface|type|enum)\s+(\w+)/);
    if (m && !excludeNames.has(m[2])) {
      if (m[1] === 'type' && !lines[i].includes('{')) {
        let line = lines[i];
        while (!line.includes(';') && i + 1 < lines.length) { i++; line += '\n' + lines[i]; }
        defs.push(line);
        i++;
        continue;
      }
      let depth = 0;
      let block = '';
      for (let j = i; j < lines.length; j++) {
        block += lines[j] + '\n';
        for (const ch of lines[j]) { if (ch === '{') depth++; if (ch === '}') depth--; }
        if (depth <= 0 && block.includes('{')) { i = j + 1; break; }
      }
      defs.push(block.trimEnd());
      continue;
    }
    i++;
  }
  return defs;
}

let fixed = 0;

for (const tsFile of allTs) {
  const relPath = path.relative(ROOT, tsFile).replace(/\\/g, '/');
  let content = fs.readFileSync(tsFile, 'utf-8');

  // Find all contract imports
  const contractImports = [...content.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]*\/contracts\/I[^'"]+)['"]/gs
  )];

  if (contractImports.length === 0) continue;

  let changed = false;

  for (const imp of contractImports) {
    const importedNames = imp[1].split(',').map(n => n.trim()).filter(Boolean);
    const importPath = imp[2];
    const contractBasename = path.basename(importPath);

    // Resolve contract file
    let contractFile;
    if (importPath.startsWith('$lib/')) {
      contractFile = importPath.replace('$lib/', 'src/lib/') + '.ts';
    } else {
      const dir = path.dirname(relPath);
      contractFile = path.posix.normalize(path.posix.join(dir, importPath)) + '.ts';
    }

    // Check if contract still exists on disk
    if (fs.existsSync(path.resolve(ROOT, contractFile))) continue;

    // Contract was deleted — get content from git
    const contractContent = getGit(contractFile);
    if (!contractContent) continue;

    const interfaceName = contractBasename;

    // Get all co-exported type names from the contract
    const allExports = [...contractContent.matchAll(/export\s+(?:interface|type|enum)\s+(\w+)/g)]
      .map(m => m[1]);
    const coExportNames = allExports.filter(n => n !== interfaceName);

    // Which of the imported names are types (not the interface)?
    const typeNamesImported = importedNames.filter(n => n !== interfaceName && coExportNames.includes(n));
    const importsInterface = importedNames.includes(interfaceName);

    // Remove this entire import statement
    content = content.replace(imp[0], '');

    // Remove implements clause for this interface
    content = content.replace(
      new RegExp(`\\s+implements\\s+${interfaceName}(?:<[^>]*>)?`),
      ''
    );

    // Extract and inline type definitions that were imported
    if (typeNamesImported.length > 0) {
      const excludeSet = new Set([interfaceName]);
      const allTypeDefs = extractTypes(contractContent, excludeSet);
      const neededDefs = allTypeDefs.filter(def => {
        return typeNamesImported.some(name =>
          new RegExp(`export\\s+(?:interface|type|enum)\\s+${name}\\b`).test(def)
        );
      });

      if (neededDefs.length > 0) {
        // Find the end of all imports (handling multi-line)
        const lines = content.split('\n');
        let lastImportEnd = -1;
        let depth = 0;
        let inImport = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.match(/^import\s/)) {
            inImport = true;
            // Check if single-line
            if (line.includes(' from ')) {
              lastImportEnd = i;
              inImport = false;
            }
          } else if (inImport) {
            if (line.includes(' from ') || line.match(/^\s*\}\s*from/)) {
              lastImportEnd = i;
              inImport = false;
            }
          }
        }

        const block = '\n' + neededDefs.join('\n\n') + '\n';
        lines.splice(lastImportEnd + 1, 0, block);
        content = lines.join('\n');
      }
    }

    changed = true;
  }

  if (changed) {
    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(tsFile, content);
    fixed++;
  }
}

console.log(`Re-applied ceremony removal to ${fixed} files`);
