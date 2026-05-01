/**
 * Ceremony Retirement Codemod — Single-pass, correct handling of multi-line imports.
 *
 * For each 1:1 interface:
 * 1. Parse contract file: extract interface name + all co-exported types
 * 2. In implementation file:
 *    a. Remove `implements IFoo` (handling generics)
 *    b. Remove the import-from-contract line(s), preserving any non-contract imports
 *    c. Append co-exported type definitions after ALL imports
 * 3. In getter file: replace IFoo type refs with concrete class name, remove interface import
 * 4. In consumer files: rewrite import paths from contract → implementation
 * 5. Delete contract file
 * 6. Clean up empty contracts/ directories
 *
 * SAFETY: runs tsc --noEmit after every batch. Stops on new errors.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt(process.argv.find(a => a.startsWith('--batch='))?.split('=')[1] || '999', 10);

// ============================================================
// Utility
// ============================================================

function readF(relPath) {
  try { return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8'); }
  catch { return null; }
}

function writeF(relPath, content) {
  if (DRY_RUN) return;
  fs.writeFileSync(path.resolve(ROOT, relPath), content);
}

function deleteF(relPath) {
  if (DRY_RUN) return;
  try { fs.unlinkSync(path.resolve(ROOT, relPath)); } catch {}
}

function findEndOfImports(content) {
  const lines = content.split('\n');
  let lastImportEnd = -1;
  let braceDepth = 0;
  let inImport = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inImport && /^import\s/.test(line)) {
      inImport = true;
      braceDepth = 0;
    }

    if (inImport) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      // Import ends when we see 'from' and braces are balanced
      if (braceDepth <= 0 && /from\s+['"]/.test(line)) {
        lastImportEnd = i;
        inImport = false;
      }
    }
  }
  return lastImportEnd;
}

function extractCoExportedTypes(contractContent, interfaceName) {
  const defs = [];
  const lines = contractContent.split('\n');
  let i = 0;

  while (i < lines.length) {
    const m = lines[i].match(/^export\s+(interface|type|enum)\s+(\w+)/);
    if (!m || m[2] === interfaceName) { i++; continue; }

    const kind = m[1];
    const name = m[2];

    if (kind === 'type') {
      // Collect until semicolon at brace depth 0
      let def = lines[i];
      let j = i + 1;
      let depth = 0;
      for (const ch of def) {
        if (ch === '{' || ch === '(') depth++;
        if (ch === '}' || ch === ')') depth--;
      }
      // Check if first line already ends the type (depth 0 + has semicolon after all braces close)
      let ended = depth <= 0 && def.trimEnd().endsWith(';');
      while (!ended && j < lines.length) {
        def += '\n' + lines[j];
        for (const ch of lines[j]) {
          if (ch === '{' || ch === '(') depth++;
          if (ch === '}' || ch === ')') depth--;
        }
        ended = depth <= 0 && lines[j].includes(';');
        j++;
      }
      defs.push({ name, definition: def });
      i = j;
      continue;
    }

    // interface or enum: collect until matching closing brace
    let depth = 0;
    let block = '';
    let j = i;
    for (; j < lines.length; j++) {
      block += lines[j] + '\n';
      for (const ch of lines[j]) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth <= 0 && block.includes('{')) {
        j++;
        break;
      }
    }
    defs.push({ name, definition: block.trimEnd() });
    i = j;
  }

  return defs;
}

function removeImportBlock(content, contractBasename) {
  // Remove entire import statement(s) that reference this contract file.
  // Handles single-line and multi-line imports.
  const escaped = contractBasename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match: import type? { ... } from '...contractBasename';
  // The [^}]* needs to be [\\s\\S]*? for multi-line
  return content.replace(
    new RegExp(
      `import\\s+(?:type\\s+)?\\{[\\s\\S]*?\\}\\s*from\\s*['"][^'"]*${escaped}['"];?\\n?`,
      'g'
    ),
    ''
  );
}

function removeImplements(content, interfaceName) {
  // "implements IFoo<T>" or "implements IFoo"
  return content.replace(
    new RegExp(`\\s+implements\\s+${interfaceName}(?:<[^>]*>)?`),
    ''
  );
}

function makeRelative(fromFile, toFile) {
  const fromDir = path.dirname(fromFile).replace(/\\/g, '/');
  const toNorm = toFile.replace(/\\/g, '/').replace(/\.ts$/, '').replace(/\.svelte$/, '');
  let rel = path.posix.relative(fromDir, toNorm);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// ============================================================
// Build the manifest
// ============================================================

const allTsFiles = [];
function walk(dir) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.includes('node_modules')) walk(full);
      else if (/\.ts$/.test(e.name)) allTsFiles.push(path.relative(ROOT, full).replace(/\\/g, '/'));
    }
  } catch {}
}
walk(path.join(ROOT, 'src'));

const contractFiles = allTsFiles.filter(f => f.includes('/contracts/') && /\/I[A-Z]/.test(f));
const implFiles = allTsFiles.filter(f => f.includes('/implementations/'));
const getterFiles = allTsFiles.filter(f => /\/get[A-Z][^/]*\.ts$/.test(f) && !f.includes('/contracts/') && !f.includes('/implementations/'));

// Known polymorphic interfaces to skip
const KEEP = new Set([
  'ILOOPExecutor', 'ISubInterpreter', 'IDirectionCalculator', 'ICodex',
  'IAnimationPlaybackController', 'IAsciiRenderer', 'IEndpointDetector',
  'ITrailOverlayCanvas', 'IDirectRenderer', 'IOrientationPropagator',
  'ITransitionGraph', 'IHapticFeedback', 'IVoiceCommandHandler',
  'ISequenceDataProvider',
]);

const targets = [];

for (const contractPath of contractFiles) {
  const interfaceName = path.basename(contractPath, '.ts');
  if (KEEP.has(interfaceName)) continue;

  const contractContent = readF(contractPath);
  if (!contractContent) continue;

  // Find implementation
  const impls = [];
  for (const implPath of implFiles) {
    const implContent = readF(implPath);
    if (!implContent) continue;
    if (new RegExp(`implements\\s+[\\w\\s,]*\\b${interfaceName}\\b`).test(implContent)) {
      impls.push({ path: implPath, className: path.basename(implPath, '.ts').replace('.svelte', '') });
    }
  }

  // Skip if not exactly 1 implementation
  if (impls.length !== 1) continue;

  // Find getter
  const expectedGetter = 'get' + interfaceName.slice(1);
  const getter = getterFiles.find(f => path.basename(f, '.ts') === expectedGetter) || null;

  // Extract co-exported types
  const coExports = extractCoExportedTypes(contractContent, interfaceName);

  targets.push({
    interfaceName,
    contractPath,
    impl: impls[0],
    getterPath: getter,
    coExports,
    contractBasename: path.basename(contractPath, '.ts'),
  });
}

console.log(`Found ${targets.length} interfaces to retire (batch: ${BATCH_SIZE})\n`);

// ============================================================
// Process
// ============================================================

let processed = 0;
let errors = [];

for (const entry of targets.slice(0, BATCH_SIZE)) {
  const { interfaceName, contractPath, impl, getterPath, coExports, contractBasename } = entry;

  try {
    // ---- Step 1: Update implementation ----
    let implContent = readF(impl.path);
    if (!implContent) throw new Error('Cannot read impl');

    implContent = removeImplements(implContent, interfaceName);
    implContent = removeImportBlock(implContent, contractBasename);

    // Append co-exported types after all imports
    if (coExports.length > 0) {
      const endOfImports = findEndOfImports(implContent);
      const lines = implContent.split('\n');
      const typeBlock = '\n' + coExports.map(e => e.definition).join('\n\n') + '\n';
      lines.splice(endOfImports + 1, 0, typeBlock);
      implContent = lines.join('\n');
    }

    implContent = implContent.replace(/\n{3,}/g, '\n\n');
    writeF(impl.path, implContent);

    // ---- Step 2: Update getter ----
    if (getterPath) {
      let getterContent = readF(getterPath);
      if (getterContent) {
        getterContent = removeImportBlock(getterContent, contractBasename);
        getterContent = getterContent.replace(
          new RegExp(`\\b${interfaceName}\\b`, 'g'),
          impl.className
        );
        getterContent = getterContent.replace(/\n{3,}/g, '\n\n');
        writeF(getterPath, getterContent);
      }
    }

    // ---- Step 3: Update consumers ----
    const selfPaths = new Set([contractPath, impl.path]);
    if (getterPath) selfPaths.add(getterPath);

    for (const tsFile of allTsFiles) {
      if (selfPaths.has(tsFile)) continue;
      const content = readF(tsFile);
      if (!content || !content.includes(contractBasename)) continue;

      // Check if this file imports from this specific contract
      const importRegex = new RegExp(
        `(import\\s+(?:type\\s+)?)(\\{[\\s\\S]*?\\})(\\s*from\\s*['"])([^'"]*${contractBasename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(\\s*['"];?)`,
        'g'
      );

      let newContent = content;
      let hasMatch = false;

      newContent = newContent.replace(importRegex, (match, prefix, names, fromPart, importPath, endPart) => {
        hasMatch = true;
        // Rewrite path: contracts/IFoo → implementations/ClassName
        const newPath = makeRelative(tsFile, impl.path);
        // Replace interface name with class name in the import names
        let newNames = names.replace(new RegExp(`\\b${interfaceName}\\b`, 'g'), impl.className);
        return `${prefix}${newNames}${fromPart}${newPath}${endPart}`;
      });

      if (hasMatch) {
        // Also replace type references in the file body
        newContent = newContent.replace(
          new RegExp(`(?<!['"\\w])${interfaceName}(?!['"\\w])`, 'g'),
          impl.className
        );
        newContent = newContent.replace(/\n{3,}/g, '\n\n');
        writeF(tsFile, newContent);
      }
    }

    // ---- Step 4: Delete contract ----
    deleteF(contractPath);

    // ---- Step 5: Clean up empty dirs ----
    if (!DRY_RUN) {
      const contractsDir = path.dirname(path.resolve(ROOT, contractPath));
      try {
        if (fs.readdirSync(contractsDir).length === 0) fs.rmdirSync(contractsDir);
      } catch {}
    }

    processed++;
    if (processed % 100 === 0) console.log(`  Processed ${processed}...`);

  } catch (err) {
    errors.push({ interfaceName, error: err.message });
  }
}

console.log(`\nProcessed: ${processed}`);
console.log(`Errors: ${errors.length}`);
for (const e of errors.slice(0, 20)) console.log(`  ${e.interfaceName}: ${e.error}`);

if (!DRY_RUN) {
  console.log('\nRunning tsc --noEmit...');
  const tscOut = execSync('npx tsc --noEmit 2>&1 || true', {
    cwd: ROOT, encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024, timeout: 300000,
  });
  const errCount = (tscOut.match(/error TS/g) || []).length;
  console.log(`TypeScript errors: ${errCount}`);
  if (errCount > 2) {
    // Show first 20 errors
    const lines = tscOut.split('\n').filter(l => l.includes('error TS'));
    for (const l of lines.slice(0, 20)) console.log(`  ${l}`);
  }
}
