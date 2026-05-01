/**
 * Comprehensive fix for all ceremony-related TypeScript errors.
 * Handles: duplicates, missing types, broken imports, missing exports.
 * Runs iteratively until errors stabilize.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function tscErrors() {
  const out = execSync('npx tsc --noEmit 2>&1 || true', {
    cwd: ROOT, encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024, timeout: 300000,
  });
  const errors = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)/);
    if (m) errors.push({ file: m[1], line: +m[2], col: +m[3], code: m[4], msg: m[5] });
  }
  return errors;
}

function getGit(p) {
  try { return execSync(`git show HEAD:"${p.replace(/\\/g, '/')}"`, { cwd: ROOT, encoding: 'utf-8' }); }
  catch { return null; }
}

// ==========================================
// Fix 1: Remove duplicate type definitions (TS2300, TS1361)
// ==========================================
function fixDuplicates(errors) {
  const dupeFiles = new Map();
  for (const e of errors) {
    if (e.code !== 'TS2300' && e.code !== 'TS1361') continue;
    const m = e.msg.match(/(?:Duplicate identifier|initializer of) '(\w+)'/);
    if (!m) continue;
    if (!dupeFiles.has(e.file)) dupeFiles.set(e.file, new Set());
    dupeFiles.get(e.file).add(m[1]);
  }

  let fixed = 0;
  for (const [file, names] of dupeFiles) {
    const fullPath = path.resolve(ROOT, file);
    let content;
    try { content = fs.readFileSync(fullPath, 'utf-8'); } catch { continue; }

    for (const name of names) {
      // Find all occurrences of this type/interface definition
      const pattern = new RegExp(
        `(export\\s+(?:interface|type|enum)\\s+${name}\\b[\\s\\S]*?^\\}|export\\s+type\\s+${name}\\s*=[^;]+;)`,
        'gm'
      );
      const matches = [...content.matchAll(pattern)];
      if (matches.length > 1) {
        // Keep the first (usually the more complete one), remove the rest
        for (let i = 1; i < matches.length; i++) {
          content = content.replace(matches[i][0], '');
        }
      }
    }

    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(fullPath, content);
    fixed++;
  }
  console.log(`  Duplicates: fixed ${fixed} files`);
}

// ==========================================
// Fix 2: Broken imports to deleted contracts (TS2307)
// ==========================================
function fixBrokenImports(errors) {
  const broken = new Map();
  for (const e of errors) {
    if (e.code !== 'TS2307') continue;
    const m = e.msg.match(/Cannot find module '([^']+)'/);
    if (!m || !m[1].includes('contracts')) continue;
    if (!broken.has(e.file)) broken.set(e.file, new Set());
    broken.get(e.file).add(m[1]);
  }

  let fixed = 0;
  for (const [file, modules] of broken) {
    const fullPath = path.resolve(ROOT, file);
    let content;
    try { content = fs.readFileSync(fullPath, 'utf-8'); } catch { continue; }

    for (const mod of modules) {
      const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Remove single and multi-line imports from this module
      content = content.replace(
        new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*\\}\\s*from\\s*['"]${escaped}['"];?\\n?`, 'gs'),
        ''
      );
      // Also remove implements for the interface
      const iface = path.basename(mod);
      content = content.replace(
        new RegExp(`\\s+implements\\s+${iface}(?:<[^>]*>)?`),
        ''
      );
    }

    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(fullPath, content);
    fixed++;
  }
  console.log(`  Broken imports: fixed ${fixed} files`);
}

// ==========================================
// Fix 3: Missing names (TS2304) - restore from git contract
// ==========================================
function fixMissingNames(errors) {
  const missing = new Map();
  for (const e of errors) {
    if (e.code !== 'TS2304') continue;
    const m = e.msg.match(/Cannot find name '(\w+)'/);
    if (!m) continue;
    if (!missing.has(e.file)) missing.set(e.file, new Set());
    missing.get(e.file).add(m[1]);
  }

  let fixed = 0;
  for (const [file, names] of missing) {
    const fullPath = path.resolve(ROOT, file);
    let content;
    try { content = fs.readFileSync(fullPath, 'utf-8'); } catch { continue; }

    // Get original file from git to find what was imported
    const original = getGit(file);
    if (!original) continue;

    // Find imports that existed in original but not in current
    const origImportLines = [];
    for (const m of original.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gs)) {
      const importedNames = m[1].split(',').map(n => n.trim()).filter(Boolean);
      const fromPath = m[2];
      origImportLines.push({ names: importedNames, from: fromPath, full: m[0] });
    }

    const addedTypes = new Set();

    for (const name of names) {
      if (addedTypes.has(name)) continue;
      // Already defined in current file?
      if (content.includes(`export interface ${name}`) || content.includes(`export type ${name}`) || content.includes(`interface ${name}`)) continue;

      // Find which original import had this name
      for (const imp of origImportLines) {
        if (!imp.names.includes(name)) continue;

        // Resolve the import path
        let resolvedPath;
        if (imp.from.startsWith('$lib/')) {
          resolvedPath = imp.from.replace('$lib/', 'src/lib/') + '.ts';
        } else {
          resolvedPath = path.posix.normalize(path.posix.join(path.dirname(file), imp.from)) + '.ts';
        }

        // Does the source file exist on disk?
        if (fs.existsSync(path.resolve(ROOT, resolvedPath))) {
          // Restore this import line if not already in the file
          if (!content.includes(imp.from)) {
            // Add just the needed name import
            const importLine = `import type { ${name} } from '${imp.from}';\n`;
            // Insert after last import
            const lastImportIdx = content.lastIndexOf('\nimport ');
            if (lastImportIdx >= 0) {
              const lineEnd = content.indexOf('\n', lastImportIdx + 1);
              // Find end of that import (might be multi-line)
              let insertAt = lineEnd;
              let searchFrom = lastImportIdx + 1;
              while (searchFrom < content.length) {
                const nextLine = content.indexOf('\n', searchFrom);
                if (nextLine === -1) break;
                const line = content.slice(searchFrom, nextLine);
                if (line.includes(' from ')) { insertAt = nextLine; break; }
                if (line.match(/^\s*\}\s*from/)) { insertAt = nextLine; break; }
                if (line.match(/^import\s/) || line.match(/^\s/) && !line.match(/^\s*$/)) {
                  searchFrom = nextLine + 1;
                  continue;
                }
                break;
              }
              content = content.slice(0, insertAt + 1) + importLine + content.slice(insertAt + 1);
            } else {
              content = importLine + content;
            }
          }
          addedTypes.add(name);
          break;
        }

        // Source was deleted — try to get the type from git
        const srcContent = getGit(resolvedPath);
        if (!srcContent) continue;

        // Extract type definition
        const typePattern = new RegExp(
          `(export\\s+(?:interface|type|enum)\\s+${name}\\b[\\s\\S]*?^\\})`,
          'm'
        );
        const typeMatch = srcContent.match(typePattern);
        if (!typeMatch) {
          // Try single-line type
          const singleLine = srcContent.match(new RegExp(`(export\\s+type\\s+${name}\\s*=[^;]+;)`));
          if (singleLine) {
            if (!content.includes(singleLine[1])) {
              // Insert after imports
              const lines = content.split('\n');
              let insertAt = 0;
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].match(/^import\s/) || lines[i].match(/^\s*\}\s*from/)) insertAt = i + 1;
              }
              lines.splice(insertAt, 0, '\n' + singleLine[1] + '\n');
              content = lines.join('\n');
            }
            addedTypes.add(name);
          }
          continue;
        }

        if (!content.includes(`export interface ${name}`) && !content.includes(`export type ${name}`)) {
          const lines = content.split('\n');
          let insertAt = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^import\s/) || lines[i].match(/^\s*\}\s*from/)) insertAt = i + 1;
          }
          lines.splice(insertAt, 0, '\n' + typeMatch[1] + '\n');
          content = lines.join('\n');
        }
        addedTypes.add(name);
        break;
      }
    }

    if (addedTypes.size > 0) {
      content = content.replace(/\n{3,}/g, '\n\n');
      fs.writeFileSync(fullPath, content);
      fixed++;
    }
  }
  console.log(`  Missing names: fixed ${fixed} files`);
}

// ==========================================
// Run fixes iteratively
// ==========================================
let lastCount = Infinity;
for (let iter = 0; iter < 5; iter++) {
  console.log(`\n--- Iteration ${iter + 1} ---`);
  const errors = tscErrors();
  const count = errors.length;
  console.log(`Total errors: ${count}`);
  if (count === 0 || count >= lastCount) break;
  lastCount = count;

  fixDuplicates(errors);
  fixBrokenImports(errors);
  fixMissingNames(errors);
}

// Final count
const final = tscErrors();
console.log(`\n=== Final: ${final.length} errors ===`);
const codes = {};
for (const e of final) codes[e.code] = (codes[e.code] || 0) + 1;
console.log(JSON.stringify(codes, null, 2));
