# Enterprise Ceremony Flattening + Kebab-Case Rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten all `implementations/` and empty `contracts/` directories, rename 1,389 PascalCase `.ts` files to kebab-case, convert stateless classes to function modules, and simplify getters — eliminating ~500-700 files and ~15,000-25,000 lines of ceremony.

**Architecture:** Two-phase approach. Phase A (today): build an inventory script that produces a per-module manifest and dry-run report — zero file changes. Phase B (May 9): subagents execute the manifest wave-by-wave, each owning 2-5 modules, with typecheck gates between waves.

**Tech Stack:** Node.js (inventory script with TypeScript AST parsing via `ts-morph`), ESLint (validation), `npm run check` (typecheck gate)

---

## Phase A: Inventory Script (May 6 — today)

### Task 1: Install ts-morph for AST analysis

**Files:**
- Modify: `package.json` (devDependency)

- [ ] **Step 1: Install ts-morph**

```bash
npm install -D ts-morph
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('ts-morph'); console.log('ts-morph OK')"
```

Expected: `ts-morph OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ts-morph for ceremony inventory script"
```

---

### Task 2: Build the file walker and PascalCase detector

**Files:**
- Create: `scripts/ceremony-inventory.mjs`

This task builds the skeleton: walk `src/`, find all `.ts` files, detect PascalCase filenames, compute kebab-case targets, and categorize by module.

- [ ] **Step 1: Create the inventory script skeleton**

```javascript
// scripts/ceremony-inventory.mjs
import { resolve, relative, basename, dirname, join } from 'path';
import { readdir, stat, writeFile, readFile } from 'fs/promises';

const SRC_ROOT = resolve('src');
const FEATURES_ROOT = resolve('src/lib/features');
const SHARED_ROOT = resolve('src/lib/shared');

// ── Helpers ──────────────────────────────────────────────────────────

function toKebabCase(filename) {
  // Handle .svelte.ts files: strip both extensions, convert, re-add
  const svelteTs = filename.match(/^(.+)\.svelte\.ts$/);
  if (svelteTs) {
    return pascalToKebab(svelteTs[1]) + '.svelte.ts';
  }
  const ext = filename.match(/\.ts$/)?.[0] || '';
  const stem = filename.slice(0, -ext.length);
  return pascalToKebab(stem) + ext;
}

function pascalToKebab(str) {
  return str
    // Insert hyphen before uppercase letters that follow lowercase letters or digits
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    // Insert hyphen between consecutive uppercase letters followed by lowercase
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function isPascalCase(filename) {
  const stem = filename.replace(/\.svelte\.ts$/, '').replace(/\.ts$/, '');
  // PascalCase: starts with uppercase, or is camelCase starting with lowercase (like getFoo)
  return /^[A-Z]/.test(stem) || /^get[A-Z]/.test(stem);
}

function getModuleName(filePath) {
  const rel = relative(SRC_ROOT, filePath).replace(/\\/g, '/');
  if (rel.startsWith('lib/features/')) {
    const parts = rel.split('/');
    // features can have nested modules like browse/shared, create/spell
    return parts.slice(2, 3).join('/');
  }
  if (rel.startsWith('lib/shared/')) {
    const parts = rel.split('/');
    return 'shared/' + parts[2];
  }
  return 'other';
}

// ── Walker ───────────────────────────────────────────────────────────

async function walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.svelte-kit') continue;
      results.push(...await walkDir(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Walking src/ for .ts files...');
  const allFiles = await walkDir(SRC_ROOT);
  console.log(`Found ${allFiles.length} .ts files`);

  const pascalFiles = allFiles.filter(f => isPascalCase(basename(f)));
  console.log(`${pascalFiles.length} have PascalCase or camelCase getter names`);

  // Categorize
  const byModule = new Map();
  for (const f of pascalFiles) {
    const mod = getModuleName(f);
    if (!byModule.has(mod)) byModule.set(mod, []);
    byModule.get(mod).push({
      absolutePath: f,
      relativePath: relative(resolve('.'), f).replace(/\\/g, '/'),
      filename: basename(f),
      kebabFilename: toKebabCase(basename(f)),
      inImplementations: f.replace(/\\/g, '/').includes('/implementations/'),
      inContracts: f.replace(/\\/g, '/').includes('/contracts/'),
      isGetter: /^get[A-Z]/.test(basename(f)),
    });
  }

  console.log(`\nPascalCase files by module:`);
  for (const [mod, files] of [...byModule.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(files.length).padStart(4)}  ${mod}`);
  }

  return { allFiles, pascalFiles, byModule };
}

main().catch(console.error);
```

- [ ] **Step 2: Run to verify it walks correctly**

```bash
node scripts/ceremony-inventory.mjs
```

Expected: prints file counts and per-module breakdown. Should show ~1,389 PascalCase files.

- [ ] **Step 3: Commit**

```bash
git add scripts/ceremony-inventory.mjs
git commit -m "feat(scripts): ceremony inventory — file walker + PascalCase detector"
```

---

### Task 3: Add AST-based class classification

**Files:**
- Modify: `scripts/ceremony-inventory.mjs`

Add `ts-morph` analysis to classify each service class as stateless, stateless-deps, stateless-cache, stateful, or polymorphic.

- [ ] **Step 1: Add the classifier function**

Append to `scripts/ceremony-inventory.mjs`, before the `main()` function:

```javascript
import { Project, SyntaxKind } from 'ts-morph';

function classifyServiceFile(filePath) {
  // Only classify files in services/ directories
  const rel = filePath.replace(/\\/g, '/');
  if (!rel.includes('/services/')) return null;

  const project = new Project({ compilerOptions: { allowJs: true } });
  let sourceFile;
  try {
    sourceFile = project.addSourceFileAtPath(filePath);
  } catch {
    return { classification: 'parse-error', reason: 'Could not parse file' };
  }

  const classes = sourceFile.getClasses();
  if (classes.length === 0) {
    // Not a class file — might be a function module already (already converted)
    return { classification: 'not-a-class', reason: 'No class declaration found' };
  }

  const cls = classes[0]; // Take the first (usually only) exported class
  const className = cls.getName() || 'anonymous';

  // Check for polymorphic interfaces (2+ implementations across codebase)
  const implementsClauses = cls.getImplements().map(i => i.getText());

  // Get constructor
  const ctor = cls.getConstructors()[0];
  const ctorParams = ctor?.getParameters() || [];

  // Get instance properties (fields)
  const instanceProps = cls.getInstanceProperties();

  // Filter out constructor parameter properties (they're also counted as instance props)
  const ctorParamNames = new Set(ctorParams.map(p => p.getName()));
  const nonCtorInstanceFields = instanceProps.filter(p => {
    const name = p.getName();
    return !ctorParamNames.has(name);
  });

  // Check if all constructor params are service injections (typed as interfaces/classes)
  const allCtorParamsAreSingletonRefs = ctorParams.every(p => {
    const typeText = p.getType().getText();
    // Heuristic: if param type starts with uppercase and isn't a primitive, it's likely a service ref
    return /^[A-Z]/.test(typeText) && !['String', 'Number', 'Boolean', 'Map', 'Set', 'Array'].includes(typeText);
  });

  // Check if non-ctor fields are only caches (Map, Set, or simple primitives for caching)
  const nonCtorFieldTypes = nonCtorInstanceFields.map(p => {
    try {
      return { name: p.getName(), type: p.getType().getText(), isReadonly: p.isReadonly?.() ?? false };
    } catch {
      return { name: p.getName(), type: 'unknown', isReadonly: false };
    }
  });

  const isCacheOnly = nonCtorFieldTypes.length > 0 && nonCtorFieldTypes.every(f =>
    /^Map</.test(f.type) || /^Set</.test(f.type) || f.type === 'WeakMap' || f.type === 'WeakSet'
  );

  // Classification logic
  if (ctorParams.length === 0 && nonCtorInstanceFields.length === 0) {
    return {
      classification: 'stateless',
      className,
      reason: 'Zero constructor params, zero instance fields',
      implementsClauses,
      methodCount: cls.getMethods().length,
    };
  }

  if (ctorParams.length > 0 && allCtorParamsAreSingletonRefs && nonCtorInstanceFields.length === 0) {
    return {
      classification: 'stateless-deps',
      className,
      reason: 'Only constructor fields are singleton service refs',
      implementsClauses,
      ctorParams: ctorParams.map(p => ({ name: p.getName(), type: p.getType().getText() })),
      methodCount: cls.getMethods().length,
    };
  }

  if (ctorParams.length === 0 && isCacheOnly) {
    return {
      classification: 'stateless-cache',
      className,
      reason: 'Only instance fields are cache Maps/Sets',
      implementsClauses,
      cacheFields: nonCtorFieldTypes,
      methodCount: cls.getMethods().length,
    };
  }

  return {
    classification: 'stateful',
    className,
    reason: 'Has real instance state',
    implementsClauses,
    ctorParamCount: ctorParams.length,
    instanceFieldCount: nonCtorInstanceFields.length,
    fieldNames: nonCtorFieldTypes.map(f => f.name),
    methodCount: cls.getMethods().length,
  };
}
```

- [ ] **Step 2: Wire classifier into main()**

In the `main()` function, after categorization, add classification for service files:

```javascript
  // Classify service classes
  console.log('\nClassifying service classes...');
  let classifiedCount = 0;
  for (const [mod, files] of byModule) {
    for (const file of files) {
      if (file.relativePath.includes('/services/') && !file.isGetter && !file.inContracts) {
        file.classification = classifyServiceFile(file.absolutePath);
        if (file.classification) classifiedCount++;
      }
    }
  }
  console.log(`Classified ${classifiedCount} service files`);

  // Summary counts
  const counts = { stateless: 0, 'stateless-deps': 0, 'stateless-cache': 0, stateful: 0, 'not-a-class': 0, 'parse-error': 0 };
  for (const [, files] of byModule) {
    for (const f of files) {
      if (f.classification?.classification) {
        counts[f.classification.classification] = (counts[f.classification.classification] || 0) + 1;
      }
    }
  }
  console.log('\nClassification summary:');
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }
```

- [ ] **Step 3: Run and review classification output**

```bash
node scripts/ceremony-inventory.mjs
```

Expected: classification summary showing counts per category. Verify stateless count is in the 200-400 range.

- [ ] **Step 4: Commit**

```bash
git add scripts/ceremony-inventory.mjs
git commit -m "feat(scripts): ceremony inventory — AST class classifier"
```

---

### Task 4: Add import consumer mapping

**Files:**
- Modify: `scripts/ceremony-inventory.mjs`

For each PascalCase file, find every file that imports from it. This drives the import rewrite plan.

- [ ] **Step 1: Add import scanner**

Append before `main()`:

```javascript
async function buildImportMap(allFiles) {
  console.log('Building import map...');
  const importMap = new Map(); // target file -> [{ consumerFile, importPath, lineNumber }]

  for (const filePath of allFiles) {
    let content;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match: import ... from '...' or import ... from "..."
      const match = line.match(/from\s+['"]([^'"]+)['"]/);
      if (!match) continue;

      const importPath = match[1];
      // We only care about relative and $lib imports
      if (!importPath.startsWith('.') && !importPath.startsWith('$lib')) continue;

      // Resolve to absolute path
      let resolved;
      if (importPath.startsWith('$lib')) {
        resolved = resolve('src/lib', importPath.replace('$lib/', ''));
      } else {
        resolved = resolve(dirname(filePath), importPath);
      }

      // Try with .ts extension if not already present
      if (!resolved.endsWith('.ts')) {
        resolved += '.ts';
      }

      const normalizedResolved = resolved.replace(/\\/g, '/');
      if (!importMap.has(normalizedResolved)) {
        importMap.set(normalizedResolved, []);
      }
      importMap.get(normalizedResolved).push({
        consumerFile: relative(resolve('.'), filePath).replace(/\\/g, '/'),
        importPath,
        lineNumber: i + 1,
      });
    }
  }

  console.log(`Mapped imports for ${importMap.size} target files`);
  return importMap;
}
```

- [ ] **Step 2: Wire into main() and attach consumer counts**

```javascript
  // Build import map
  const importMap = await buildImportMap(allFiles);

  // Attach consumer info to each PascalCase file
  for (const [, files] of byModule) {
    for (const file of files) {
      const normalized = file.absolutePath.replace(/\\/g, '/');
      file.consumers = importMap.get(normalized) || [];
      file.consumerCount = file.consumers.length;
    }
  }

  // Also scan .svelte files for imports
  const svelteFiles = await walkDirWithExt(SRC_ROOT, '.svelte');
  console.log(`Also scanning ${svelteFiles.length} .svelte files for imports...`);
  const svelteImportMap = await buildImportMap(svelteFiles);
  for (const [, files] of byModule) {
    for (const file of files) {
      const normalized = file.absolutePath.replace(/\\/g, '/');
      const svelteConsumers = svelteImportMap.get(normalized) || [];
      file.consumers.push(...svelteConsumers);
      file.consumerCount = file.consumers.length;
    }
  }
```

Add the `.svelte` walker helper near the existing `walkDir`:

```javascript
async function walkDirWithExt(dir, ext) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.svelte-kit') continue;
      results.push(...await walkDirWithExt(full, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}
```

- [ ] **Step 3: Run and verify consumer mapping**

```bash
node scripts/ceremony-inventory.mjs
```

Expected: prints import map size. High-consumer files (animation engine, foundation) should show 20+ consumers.

- [ ] **Step 4: Commit**

```bash
git add scripts/ceremony-inventory.mjs
git commit -m "feat(scripts): ceremony inventory — import consumer mapping"
```

---

### Task 5: Add directory inventory (contracts/ and implementations/)

**Files:**
- Modify: `scripts/ceremony-inventory.mjs`

Scan for `contracts/` and `implementations/` directories, classify as empty, types-only, or has-interfaces.

- [ ] **Step 1: Add directory scanner**

Append before `main()`:

```javascript
async function inventoryDirectories(root) {
  const implDirs = [];
  const contractDirs = [];

  async function scan(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === '.svelte-kit') continue;

      if (entry.name === 'implementations') {
        const contents = await readdir(full, { withFileTypes: true });
        const tsFiles = contents.filter(e => e.isFile() && e.name.endsWith('.ts'));
        const subdirs = contents.filter(e => e.isDirectory());
        implDirs.push({
          path: relative(resolve('.'), full).replace(/\\/g, '/'),
          fileCount: tsFiles.length,
          files: tsFiles.map(e => e.name),
          subdirCount: subdirs.length,
          subdirs: subdirs.map(e => e.name),
        });
      }

      if (entry.name === 'contracts') {
        const contents = await readdir(full, { withFileTypes: true });
        const tsFiles = contents.filter(e => e.isFile() && e.name.endsWith('.ts'));
        const hasInterfaces = tsFiles.some(e => /^I[A-Z]/.test(e.name));
        const hasTypesOnly = tsFiles.length > 0 && !hasInterfaces;
        contractDirs.push({
          path: relative(resolve('.'), full).replace(/\\/g, '/'),
          fileCount: tsFiles.length,
          files: tsFiles.map(e => e.name),
          isEmpty: tsFiles.length === 0,
          hasInterfaces,
          hasTypesOnly,
        });
      }

      await scan(full);
    }
  }

  await scan(root);
  return { implDirs, contractDirs };
}
```

- [ ] **Step 2: Wire into main()**

```javascript
  // Directory inventory
  const { implDirs, contractDirs } = await inventoryDirectories(SRC_ROOT);
  console.log(`\nDirectory inventory:`);
  console.log(`  ${implDirs.length} implementations/ directories (${implDirs.reduce((s, d) => s + d.fileCount, 0)} files)`);
  console.log(`  ${contractDirs.length} contracts/ directories`);
  console.log(`    ${contractDirs.filter(d => d.isEmpty).length} empty (delete)`);
  console.log(`    ${contractDirs.filter(d => d.hasTypesOnly).length} types-only (move types.ts up)`);
  console.log(`    ${contractDirs.filter(d => d.hasInterfaces).length} with interfaces (keep — polymorphic)`);
```

- [ ] **Step 3: Run and verify counts**

```bash
node scripts/ceremony-inventory.mjs
```

Expected: ~121 implementations/ dirs, ~85 contracts/ dirs matching the audit numbers.

- [ ] **Step 4: Commit**

```bash
git add scripts/ceremony-inventory.mjs
git commit -m "feat(scripts): ceremony inventory — directory scanner"
```

---

### Task 6: Generate manifest JSON and dry-run report

**Files:**
- Modify: `scripts/ceremony-inventory.mjs`
- Create (generated): `scripts/ceremony-manifest.json`
- Create (generated): `scripts/ceremony-dry-run.md`

- [ ] **Step 1: Add planned actions generator**

Append before `main()`:

```javascript
function computePlannedActions(file, implDirs, contractDirs) {
  const actions = [];
  const rel = file.relativePath;

  // Action 1: Flatten (if in implementations/)
  if (file.inImplementations) {
    const parentServices = dirname(dirname(rel)); // services/implementations/X.ts -> services/
    const newPath = join(parentServices, file.filename).replace(/\\/g, '/');
    actions.push({ type: 'MOVE', from: rel, to: newPath });
  }

  // Action 2: Rename to kebab
  if (isPascalCase(file.filename)) {
    const currentDir = file.inImplementations
      ? dirname(dirname(file.relativePath)) // after flattening
      : dirname(file.relativePath);
    const newFilename = file.kebabFilename;
    if (newFilename !== file.filename) {
      actions.push({ type: 'RENAME', from: file.filename, to: newFilename });
    }
  }

  // Action 3: Convert (if classified as stateless*)
  if (file.classification) {
    const cls = file.classification.classification;
    if (cls === 'stateless' || cls === 'stateless-deps' || cls === 'stateless-cache') {
      actions.push({ type: 'CONVERT_TO_FUNCTIONS', classification: cls });
      // Find and mark getter for deletion
      actions.push({ type: 'DELETE_GETTER' });
    } else if (cls === 'stateful') {
      actions.push({ type: 'SIMPLIFY_GETTER' });
    }
  }

  // Action 4: Rewrite imports
  if (file.consumerCount > 0) {
    actions.push({ type: 'REWRITE_IMPORTS', consumerCount: file.consumerCount });
  }

  return actions;
}
```

- [ ] **Step 2: Add manifest and dry-run writers to main()**

```javascript
  // Compute planned actions
  for (const [, files] of byModule) {
    for (const file of files) {
      file.plannedActions = computePlannedActions(file, implDirs, contractDirs);
    }
  }

  // Write manifest JSON
  const manifest = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPascalFiles: pascalFiles.length,
      totalModules: byModule.size,
      classifications: counts,
      implDirsCount: implDirs.length,
      contractDirsCount: contractDirs.length,
      emptyContractDirs: contractDirs.filter(d => d.isEmpty).length,
    },
    directories: { implDirs, contractDirs },
    modules: Object.fromEntries(
      [...byModule.entries()].map(([mod, files]) => [mod, files.map(f => ({
        relativePath: f.relativePath,
        kebabFilename: f.kebabFilename,
        inImplementations: f.inImplementations,
        inContracts: f.inContracts,
        isGetter: f.isGetter,
        classification: f.classification || null,
        consumerCount: f.consumerCount,
        consumers: f.consumers,
        plannedActions: f.plannedActions,
      }))])
    ),
  };

  await writeFile('scripts/ceremony-manifest.json', JSON.stringify(manifest, null, 2));
  console.log('\nManifest written to scripts/ceremony-manifest.json');

  // Write dry-run report
  let report = '# Ceremony Flattening — Dry Run Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `| Metric | Count |\n|---|---|\n`;
  report += `| PascalCase .ts files | ${pascalFiles.length} |\n`;
  report += `| Feature modules | ${[...byModule.keys()].filter(k => !k.startsWith('shared/')).length} |\n`;
  report += `| Shared modules | ${[...byModule.keys()].filter(k => k.startsWith('shared/')).length} |\n`;
  report += `| implementations/ dirs | ${implDirs.length} |\n`;
  report += `| contracts/ dirs (empty) | ${contractDirs.filter(d => d.isEmpty).length} |\n`;
  report += `| contracts/ dirs (types-only) | ${contractDirs.filter(d => d.hasTypesOnly).length} |\n`;
  report += `| contracts/ dirs (interfaces) | ${contractDirs.filter(d => d.hasInterfaces).length} |\n`;
  report += `| Stateless classes | ${counts.stateless || 0} |\n`;
  report += `| Stateless-deps classes | ${counts['stateless-deps'] || 0} |\n`;
  report += `| Stateless-cache classes | ${counts['stateless-cache'] || 0} |\n`;
  report += `| Stateful classes | ${counts.stateful || 0} |\n`;
  report += `| Not-a-class (already functions) | ${counts['not-a-class'] || 0} |\n`;
  report += `| Parse errors | ${counts['parse-error'] || 0} |\n\n`;

  report += `## Per-Module Breakdown\n\n`;
  for (const [mod, files] of [...byModule.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const inImpl = files.filter(f => f.inImplementations).length;
    const statelessCount = files.filter(f => ['stateless', 'stateless-deps', 'stateless-cache'].includes(f.classification?.classification)).length;
    const getterCount = files.filter(f => f.isGetter).length;
    const totalConsumers = files.reduce((s, f) => s + f.consumerCount, 0);

    report += `### ${mod} (${files.length} files)\n\n`;
    report += `| Metric | Count |\n|---|---|\n`;
    report += `| In implementations/ | ${inImpl} |\n`;
    report += `| Stateless (convertible) | ${statelessCount} |\n`;
    report += `| Getters | ${getterCount} |\n`;
    report += `| Total import consumers | ${totalConsumers} |\n\n`;

    report += `**Planned actions:**\n`;
    for (const f of files) {
      for (const a of f.plannedActions) {
        if (a.type === 'MOVE') report += `- MOVE \`${a.from}\` → \`${a.to}\`\n`;
        else if (a.type === 'RENAME') report += `- RENAME \`${f.relativePath}\`: \`${a.from}\` → \`${a.to}\`\n`;
        else if (a.type === 'CONVERT_TO_FUNCTIONS') report += `- CONVERT \`${f.relativePath}\` to function module (${a.classification})\n`;
        else if (a.type === 'DELETE_GETTER') report += `- DELETE getter for \`${f.relativePath}\`\n`;
        else if (a.type === 'SIMPLIFY_GETTER') report += `- SIMPLIFY getter for \`${f.relativePath}\`\n`;
        else if (a.type === 'REWRITE_IMPORTS') report += `- REWRITE ${a.consumerCount} imports of \`${f.relativePath}\`\n`;
      }
    }
    report += '\n';
  }

  // Edge cases section
  report += `## Edge Cases Requiring Manual Review\n\n`;

  // Dynamic imports
  report += `### Dynamic Imports\n\n`;
  report += `Files using \`import()\` that reference PascalCase paths need manual attention:\n\n`;
  // This gets populated if we add dynamic import detection (Task 7 enhancement)
  report += `_(Run with --detect-dynamic-imports to populate)_\n\n`;

  // Cross-package references
  report += `### Cross-Package References\n\n`;
  report += `Files in packages/ that import from src/ — these are hard stops for subagents:\n\n`;
  report += `_(None found in audit — packages/render-composition is self-contained)_\n\n`;

  await writeFile('scripts/ceremony-dry-run.md', report);
  console.log('Dry-run report written to scripts/ceremony-dry-run.md');
```

- [ ] **Step 3: Run full inventory**

```bash
node scripts/ceremony-inventory.mjs
```

Expected: both `scripts/ceremony-manifest.json` and `scripts/ceremony-dry-run.md` generated. Review the dry-run report for sanity.

- [ ] **Step 4: Verify manifest structure**

```bash
node -e "const m = require('./scripts/ceremony-manifest.json'); console.log('Modules:', Object.keys(m.modules).length); console.log('Summary:', JSON.stringify(m.summary, null, 2))"
```

Expected: module count matches audit (~50-60 including shared), summary counts align with earlier audit.

- [ ] **Step 5: Commit**

```bash
git add scripts/ceremony-inventory.mjs scripts/ceremony-manifest.json scripts/ceremony-dry-run.md
git commit -m "feat(scripts): ceremony inventory — manifest + dry-run report generation"
```

---

### Task 7: Add edge case detection

**Files:**
- Modify: `scripts/ceremony-inventory.mjs`

Detect patterns that subagents need to handle carefully: dynamic imports, stored service references, services passed as arguments.

- [ ] **Step 1: Add edge case scanner**

Append before `main()`:

```javascript
async function detectEdgeCases(allFiles, svelteFiles) {
  const edgeCases = {
    dynamicImports: [],        // import() with PascalCase paths
    storedServiceRefs: [],     // const svc = getSomeService(); svc.method()
    serviceAsArgument: [],     // doSomething(getSomeService())
    reactiveServiceState: [],  // $state<ISomeService>
  };

  const allSources = [...allFiles, ...svelteFiles];
  for (const filePath of allSources) {
    let content;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    const rel = relative(resolve('.'), filePath).replace(/\\/g, '/');

    // Dynamic imports
    const dynamicMatches = content.matchAll(/import\(\s*['"]([^'"]*[A-Z][^'"]*)['"]\s*\)/g);
    for (const m of dynamicMatches) {
      edgeCases.dynamicImports.push({ file: rel, importPath: m[1] });
    }

    // Stored service refs: const/let x = getSomething();\n ... x.method()
    const storedMatches = content.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(get[A-Z]\w+)\(\)/g);
    for (const m of storedMatches) {
      edgeCases.storedServiceRefs.push({ file: rel, variable: m[1], getter: m[2] });
    }

    // Service passed as argument: someFunction(getSomething())
    const argMatches = content.matchAll(/\w+\(\s*(get[A-Z]\w+)\(\)\s*[,)]/g);
    for (const m of argMatches) {
      // Exclude the common pattern of assignment: const x = getX()
      if (!/(?:const|let|var)\s+\w+\s*=\s*$/.test(content.slice(Math.max(0, content.indexOf(m[0]) - 30), content.indexOf(m[0])))) {
        edgeCases.serviceAsArgument.push({ file: rel, getter: m[1] });
      }
    }

    // Reactive state holding service type
    const reactiveMatches = content.matchAll(/\$state<[^>]*I[A-Z]\w*[^>]*>/g);
    for (const m of reactiveMatches) {
      edgeCases.reactiveServiceState.push({ file: rel, pattern: m[0] });
    }
  }

  return edgeCases;
}
```

- [ ] **Step 2: Wire into main() and add to report**

```javascript
  // Edge case detection
  const svelteFiles = await walkDirWithExt(SRC_ROOT, '.svelte');
  const edgeCases = await detectEdgeCases(allFiles, svelteFiles);

  console.log('\nEdge cases:');
  console.log(`  ${edgeCases.dynamicImports.length} dynamic imports with PascalCase paths`);
  console.log(`  ${edgeCases.storedServiceRefs.length} stored service references`);
  console.log(`  ${edgeCases.serviceAsArgument.length} services passed as arguments`);
  console.log(`  ${edgeCases.reactiveServiceState.length} reactive state with interface types`);

  // Add to manifest
  manifest.edgeCases = edgeCases;
```

Update the dry-run report's edge cases section to use actual data instead of placeholders:

```javascript
  report += `## Edge Cases Requiring Manual Review\n\n`;

  report += `### Dynamic Imports (${edgeCases.dynamicImports.length})\n\n`;
  if (edgeCases.dynamicImports.length === 0) {
    report += `None found.\n\n`;
  } else {
    for (const e of edgeCases.dynamicImports) {
      report += `- \`${e.file}\`: \`import('${e.importPath}')\`\n`;
    }
    report += '\n';
  }

  report += `### Stored Service References (${edgeCases.storedServiceRefs.length})\n\n`;
  report += `These store a getter result in a variable and call methods on it later. `;
  report += `Stateless conversion must unwrap each method call individually.\n\n`;
  for (const e of edgeCases.storedServiceRefs.slice(0, 20)) {
    report += `- \`${e.file}\`: \`${e.variable} = ${e.getter}()\`\n`;
  }
  if (edgeCases.storedServiceRefs.length > 20) {
    report += `- _...and ${edgeCases.storedServiceRefs.length - 20} more_\n`;
  }
  report += '\n';

  report += `### Services Passed as Arguments (${edgeCases.serviceAsArgument.length})\n\n`;
  report += `These pass a service instance as a function argument. The receiving function's `;
  report += `parameter type needs updating when the service is converted.\n\n`;
  for (const e of edgeCases.serviceAsArgument.slice(0, 20)) {
    report += `- \`${e.file}\`: \`...(${e.getter}())\`\n`;
  }
  if (edgeCases.serviceAsArgument.length > 20) {
    report += `- _...and ${edgeCases.serviceAsArgument.length - 20} more_\n`;
  }
  report += '\n';

  report += `### Reactive State with Interface Types (${edgeCases.reactiveServiceState.length})\n\n`;
  for (const e of edgeCases.reactiveServiceState) {
    report += `- \`${e.file}\`: \`${e.pattern}\`\n`;
  }
  report += '\n';
```

- [ ] **Step 3: Run and review edge cases**

```bash
node scripts/ceremony-inventory.mjs
```

Expected: edge case counts printed. Stored service refs will be the largest category — these are the main complexity for stateless conversion.

- [ ] **Step 4: Commit**

```bash
git add scripts/ceremony-inventory.mjs scripts/ceremony-manifest.json scripts/ceremony-dry-run.md
git commit -m "feat(scripts): ceremony inventory — edge case detection"
```

---

### Task 8: Review dry-run report with user

**Files:**
- Read: `scripts/ceremony-dry-run.md`

- [ ] **Step 1: Open and review the dry-run report**

```bash
cat scripts/ceremony-dry-run.md | head -100
```

Review the summary table. Verify:
- PascalCase count aligns with ESLint's 1,389
- Classification counts make sense (stateless should be 200-400 range)
- Edge case counts are manageable
- No modules show anomalous numbers

- [ ] **Step 2: Spot-check 3 modules in the manifest**

Pick one small (archive), one medium (browse), one large (create) and review their planned actions:

```bash
node -e "const m = require('./scripts/ceremony-manifest.json'); console.log(JSON.stringify(m.modules['archive'], null, 2))"
node -e "const m = require('./scripts/ceremony-manifest.json'); console.log(JSON.stringify(m.modules['browse']?.slice(0, 5), null, 2))"
node -e "const m = require('./scripts/ceremony-manifest.json'); const c = m.modules['create']; console.log('create:', c?.length, 'files'); console.log('stateless:', c?.filter(f => f.classification?.classification === 'stateless').length)"
```

- [ ] **Step 3: Report findings to user**

Present: total scope, classification breakdown, edge case count, any surprises. This is the decision point for May 9th execution confidence.

---

## Phase B: Subagent Execution (May 9)

### Task 9: Pre-execution setup

**Files:**
- None (git state verification)

- [ ] **Step 1: Verify clean git state**

```bash
git status
```

Expected: clean working tree, no uncommitted changes. If dirty, commit or stash everything first.

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run check
```

Expected: zero errors. Warnings OK (they're what we're fixing).

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: clean build. This is the baseline.

- [ ] **Step 4: Re-run inventory to verify manifest is current**

```bash
node scripts/ceremony-inventory.mjs
```

Expected: numbers match or are close to May 6 run. If significantly different (>5% drift), review what changed.

---

### Task 10: Wave 1 — Small isolated feature modules

**Modules (2 batches of ~5):**
- Batch A: archive, arena, assemble-lab, fuse, gallery-generator
- Batch B: hall-of-shame, moderation, poi, store, landing-preview

Each batch is dispatched to one subagent. Each subagent receives:

1. The module paths from the manifest
2. The transformation rules from the spec
3. The subagent protocol (read → flatten → rename → convert → rewrite → typecheck → commit)

- [ ] **Step 1: Dispatch Batch A subagent**

Subagent prompt (adapt for each batch):

```
You are executing the enterprise ceremony flattening for these feature modules:
- src/lib/features/archive/
- src/lib/features/arena/
- src/lib/features/assemble-lab/
- src/lib/features/fuse/
- src/lib/features/gallery-generator/

Read scripts/ceremony-manifest.json for the planned actions per file.
Read docs/superpowers/specs/2026-05-06-ceremony-flattening-kebab-rename-design.md for full transformation rules.

For each module, in order:
1. FLATTEN: Move files from services/implementations/ up to services/. Delete empty implementations/ and contracts/ dirs. Move contracts/types.ts to services/types.ts if contracts/ has no interfaces.
2. RENAME: All PascalCase .ts files to kebab-case (including .svelte.ts files). Factory getters too.
3. CONVERT: Stateless classes → function modules. Delete their getters. Verify classification by reading the class first.
4. SIMPLIFY: Stateful class getters → return concrete type instead of interface type.
5. REWRITE IMPORTS: Grep for all consumers of each moved/renamed file. Update import paths in .ts and .svelte files.
6. TYPECHECK: Run `npm run check` after completing each module. Fix any errors before proceeding.
7. COMMIT: One commit per module: `refactor(<module>): flatten dirs + kebab rename + convert stateless classes`

Hard stops: typecheck unfixable after 2 attempts, runtime side effects in constructor, consumer patterns you can't handle, cross-package imports. Report these back.
```

- [ ] **Step 2: Dispatch Batch B subagent (in parallel with Batch A)**

Same prompt, different module list.

- [ ] **Step 3: Review results from both batches**

Check each commit. Run:

```bash
npm run check
npm run build
```

Both must pass before proceeding to Wave 2.

---

### Task 11: Wave 2 — Medium feature modules

**Modules (3 batches of ~4):**
- Batch C: browse, community, connect, feedback
- Batch D: compose, learn, levels, library
- Batch E: choreo-card, hand-paths, lab, sticker-lab

- [ ] **Step 1: Dispatch Batch C, D, E subagents (in parallel)**

Same subagent prompt template, different module lists per batch.

- [ ] **Step 2: Review results**

```bash
npm run check
npm run build
```

Both must pass before Wave 3.

---

### Task 12: Wave 3 — Large/complex feature modules

**Modules (3 batches):**
- Batch F: create (269 .ts files — solo agent, largest module)
- Batch G: museum, village, landing, retro, write, watch
- Batch H: tika, voice-sessions, train, video, skel2tka, loop-labeler, festivals

- [ ] **Step 1: Dispatch Batch F, G, H subagents (in parallel)**

Batch F (create) gets extra instruction:

```
create/ is the largest module (269 .ts files). It has nested submodules:
assemble, construct, edit, generate, record, shared, spell.
Process each submodule as a unit. Typecheck after each submodule, not just after the whole module.
Commit per submodule: `refactor(create/<submodule>): flatten dirs + kebab rename + convert stateless`
```

- [ ] **Step 2: Review results**

```bash
npm run check
npm run build
```

Both must pass before Wave 4.

---

### Task 13: Wave 4 — Shared infrastructure

**Modules (2 batches):**
- Batch I: shared/animation-engine (173 files), shared/3d (193 files), shared/effects (55 files)
- Batch J: All remaining shared/ modules + non-module PascalCase files

This is the highest-risk wave. Shared files are imported by every feature module. Renaming them means updating imports across the entire codebase.

- [ ] **Step 1: Dispatch Batch I subagent**

Extra instruction for shared modules:

```
CRITICAL: Shared modules are imported by feature modules across the entire codebase.
When you rename a file in shared/, you MUST grep the entire src/ directory for imports
of that file — not just within the shared module itself.

Use: grep -r "from.*<old-path-fragment>" src/ --include="*.ts" --include="*.svelte"

The ESLint boundary rule prevents shared/ from importing features/, so you won't
break feature internals. But features import from shared/ extensively.

Process the largest modules first (animation-engine, 3d) so the most cross-cutting
changes land early and subsequent modules can build on them.
```

- [ ] **Step 2: Dispatch Batch J subagent (after Batch I commits)**

Batch J handles the remaining shared modules. Batch J runs AFTER Batch I because some smaller shared modules may import from animation-engine or 3d.

- [ ] **Step 3: Full verification**

```bash
npm run check
npm run build
```

Both must pass clean.

---

### Task 14: Phase C — Final verification

- [ ] **Step 1: Full typecheck**

```bash
npm run check
```

Expected: zero errors.

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 3: ESLint filename check**

```bash
npx eslint --max-warnings 9999 -f json src/ 2>nul | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);let c=0;j.forEach(f=>f.messages.filter(m=>m.ruleId==='check-file/filename-naming-convention').forEach(()=>c++));console.log('Filename warnings remaining:',c)})"
```

Expected: 0 (or very close — polymorphic interface files may still be PascalCase if kept).

- [ ] **Step 4: Grep for orphaned directories**

```bash
find src -type d -name implementations 2>/dev/null
find src -type d -name contracts 2>/dev/null
```

Expected: implementations/ = 0. contracts/ = only those with polymorphic interfaces (~5-11).

- [ ] **Step 4b: Verify contracts/types.ts migration**

```bash
find src -path "*/contracts/types.ts" 2>/dev/null
```

Expected: only in directories that also contain polymorphic interface files. All others should have been moved to `services/types.ts`.

- [ ] **Step 5: Grep for stale PascalCase imports**

```bash
grep -r "from.*implementations/" src/ --include="*.ts" --include="*.svelte" | head -20
```

Expected: zero results.

- [ ] **Step 6: Spot-check converted stateless services**

Pick 5 services that were converted from class → functions. Verify:
- The function module exports the right functions
- No `this` references remain
- Consumer call sites use direct function imports, not getters
- Module-scoped caches (if any) are initialized correctly

- [ ] **Step 7: Commit verification results**

```bash
git add -A
git commit -m "chore: ceremony flattening complete — verification clean"
```

- [ ] **Step 8: Update ESLint config if needed**

If the filename-naming-convention rule now has exceptions that should be formalized (e.g., polymorphic interface files that intentionally stay PascalCase), update `eslint.config.js` to ignore those specific paths.

---

## Appendix: Module Assignment Reference

**Wave 1 — Small (10 modules, 2 agents)**

| Batch | Modules | Est. Files |
|---|---|---|
| A | archive (4), arena (11), assemble-lab (10), fuse (6), gallery-generator (6) | 37 |
| B | hall-of-shame (10), moderation (17), poi (15), store (7), landing-preview (7) | 56 |

**Wave 2 — Medium (12 modules, 3 agents)**

| Batch | Modules | Est. Files |
|---|---|---|
| C | browse (36), community (11), connect (13), feedback (36) | 96 |
| D | compose (66), learn (57), levels (15), library (23) | 161 |
| E | choreo-card (35), hand-paths (6), lab (62), sticker-lab (15) | 118 |

**Wave 3 — Large (13 modules, 3 agents)**

| Batch | Modules | Est. Files |
|---|---|---|
| F | create (269) | 269 |
| G | museum (63), village (34), landing (9), retro (35), write (6), watch (17) | 164 |
| H | tika (34), voice-sessions (12), train (29), video (18), skel2tka (15), loop-labeler (61), festivals (18) | 187 |

**Wave 4 — Shared (all shared/ modules, 2 agents)**

| Batch | Modules | Est. Files |
|---|---|---|
| I | shared/animation-engine (173), shared/3d (193), shared/effects (55) | 421 |
| J | All other shared/ (~30 modules, ~500 files) | ~500 |

**Total: ~2,009 .ts files across 10 subagent batches in 4 waves**
