import { resolve, relative, basename, dirname, join } from 'path';
import { readdir, writeFile, readFile } from 'fs/promises';
import { Project } from 'ts-morph';

const SRC_ROOT = resolve('src');


function pascalToKebab(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function toKebabCase(filename) {
  const svelteTs = filename.match(/^(.+)\.svelte\.ts$/);
  if (svelteTs) return pascalToKebab(svelteTs[1]) + '.svelte.ts';
  const ext = filename.match(/\.ts$/)?.[0] || '';
  const stem = filename.slice(0, -ext.length);
  return pascalToKebab(stem) + ext;
}

function isPascalOrGetterCase(filename) {
  const stem = filename.replace(/\.svelte\.ts$/, '').replace(/\.ts$/, '');
  return /^[A-Z]/.test(stem) || /^get[A-Z]/.test(stem);
}

function getModuleName(filePath) {
  const rel = relative(SRC_ROOT, filePath).replace(/\\/g, '/');
  if (rel.startsWith('lib/features/')) return rel.split('/')[2];
  if (rel.startsWith('lib/shared/')) return 'shared/' + rel.split('/')[2];
  return 'other';
}


async function walkDir(dir, ext = '.ts') {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.svelte-kit' || entry.name === 'build') continue;
      results.push(...await walkDir(full, ext));
    } else if (entry.name.endsWith(ext) && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}


function classifyServiceFile(filePath) {
  const rel = filePath.replace(/\\/g, '/');
  if (!rel.includes('/services/')) return null;

  const project = new Project({ compilerOptions: { allowJs: true }, skipAddingFilesFromTsConfig: true });
  let sourceFile;
  try {
    sourceFile = project.addSourceFileAtPath(filePath);
  } catch {
    return { classification: 'parse-error', reason: 'Could not parse file' };
  }

  const classes = sourceFile.getClasses();
  if (classes.length === 0) {
    return { classification: 'not-a-class', reason: 'No class declaration found' };
  }

  const cls = classes[0];
  const className = cls.getName() || 'anonymous';
  const implementsClauses = cls.getImplements().map(i => i.getText());

  const ctor = cls.getConstructors()[0];
  const ctorParams = ctor?.getParameters() || [];

  const instanceProps = cls.getInstanceProperties();
  const ctorParamNames = new Set(ctorParams.map(p => p.getName()));
  const nonCtorInstanceFields = instanceProps.filter(p => !ctorParamNames.has(p.getName()));

  const allCtorParamsAreSingletonRefs = ctorParams.length > 0 && ctorParams.every(p => {
    let typeText;
    try { typeText = p.getType().getText(); } catch { return false; }
    return /^[A-Z]/.test(typeText) && !['String', 'Number', 'Boolean', 'Map', 'Set', 'Array'].includes(typeText);
  });

  const nonCtorFieldInfo = nonCtorInstanceFields.map(p => {
    try { return { name: p.getName(), type: p.getType().getText() }; }
    catch { return { name: p.getName(), type: 'unknown' }; }
  });

  const isCacheOnly = nonCtorFieldInfo.length > 0 && nonCtorFieldInfo.every(f =>
    /^Map</.test(f.type) || /^Set</.test(f.type) || f.type === 'WeakMap' || f.type === 'WeakSet'
  );

  if (ctorParams.length === 0 && nonCtorInstanceFields.length === 0) {
    return {
      classification: 'stateless',
      className,
      reason: 'Zero constructor params, zero instance fields',
      implementsClauses,
      methodCount: cls.getMethods().length,
    };
  }

  if (allCtorParamsAreSingletonRefs && nonCtorInstanceFields.length === 0) {
    return {
      classification: 'stateless-deps',
      className,
      reason: 'Only constructor fields are singleton service refs',
      implementsClauses,
      ctorParams: ctorParams.map(p => ({ name: p.getName(), type: (() => { try { return p.getType().getText(); } catch { return 'unknown'; } })() })),
      methodCount: cls.getMethods().length,
    };
  }

  if (ctorParams.length === 0 && isCacheOnly) {
    return {
      classification: 'stateless-cache',
      className,
      reason: 'Only instance fields are cache Maps/Sets',
      implementsClauses,
      cacheFields: nonCtorFieldInfo,
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
    fieldNames: nonCtorFieldInfo.map(f => f.name),
    methodCount: cls.getMethods().length,
  };
}


async function buildImportMap(files) {
  const importMap = new Map();
  for (const filePath of files) {
    let content;
    try { content = await readFile(filePath, 'utf8'); } catch { continue; }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/from\s+['"]([^'"]+)['"]/);
      if (!match) continue;
      const importPath = match[1];
      if (!importPath.startsWith('.') && !importPath.startsWith('$lib')) continue;

      let resolved;
      if (importPath.startsWith('$lib')) {
        resolved = resolve('src/lib', importPath.replace('$lib/', ''));
      } else {
        resolved = resolve(dirname(filePath), importPath);
      }
      if (!resolved.endsWith('.ts') && !resolved.endsWith('.svelte')) resolved += '.ts';
      const norm = resolved.replace(/\\/g, '/');

      if (!importMap.has(norm)) importMap.set(norm, []);
      importMap.get(norm).push({
        consumerFile: relative(resolve('.'), filePath).replace(/\\/g, '/'),
        importPath,
        lineNumber: i + 1,
      });
    }
  }
  return importMap;
}


async function inventoryDirectories(root) {
  const implDirs = [];
  const contractDirs = [];

  async function scan(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
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
        contractDirs.push({
          path: relative(resolve('.'), full).replace(/\\/g, '/'),
          fileCount: tsFiles.length,
          files: tsFiles.map(e => e.name),
          isEmpty: tsFiles.length === 0,
          hasInterfaces,
          hasTypesOnly: tsFiles.length > 0 && !hasInterfaces,
        });
      }

      await scan(full);
    }
  }

  await scan(root);
  return { implDirs, contractDirs };
}


async function detectEdgeCases(allFiles) {
  const edgeCases = {
    dynamicImports: [],
    storedServiceRefs: [],
    serviceAsArgument: [],
    reactiveServiceState: [],
  };

  for (const filePath of allFiles) {
    let content;
    try { content = await readFile(filePath, 'utf8'); } catch { continue; }
    const rel = relative(resolve('.'), filePath).replace(/\\/g, '/');

    for (const m of content.matchAll(/import\(\s*['"]([^'"]*[A-Z][^'"]*)['"]\s*\)/g)) {
      edgeCases.dynamicImports.push({ file: rel, importPath: m[1] });
    }

    for (const m of content.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(get[A-Z]\w+)\(\)/g)) {
      edgeCases.storedServiceRefs.push({ file: rel, variable: m[1], getter: m[2] });
    }

    for (const m of content.matchAll(/\w+\(\s*(get[A-Z]\w+)\(\)\s*[,)]/g)) {
      const idx = content.indexOf(m[0]);
      const before = content.slice(Math.max(0, idx - 40), idx);
      if (!/(?:const|let|var)\s+\w+\s*=\s*$/.test(before)) {
        edgeCases.serviceAsArgument.push({ file: rel, getter: m[1] });
      }
    }

    for (const m of content.matchAll(/\$state<[^>]*I[A-Z]\w*[^>]*>/g)) {
      edgeCases.reactiveServiceState.push({ file: rel, pattern: m[0] });
    }
  }

  return edgeCases;
}


async function main() {
  const t0 = Date.now();

  // Walk files
  console.log('Walking src/ for .ts files...');
  const allTsFiles = await walkDir(SRC_ROOT, '.ts');
  console.log(`Found ${allTsFiles.length} .ts files`);

  console.log('Walking src/ for .svelte files...');
  const allSvelteFiles = await walkDir(SRC_ROOT, '.svelte');
  console.log(`Found ${allSvelteFiles.length} .svelte files`);

  const allSourceFiles = [...allTsFiles, ...allSvelteFiles];

  // PascalCase detection
  const pascalFiles = allTsFiles.filter(f => isPascalOrGetterCase(basename(f)));
  console.log(`\n${pascalFiles.length} PascalCase/getter .ts files`);

  // Post-flatten fix: the May-28 flatten kebab-renamed service files, so the
  // class targets no longer have PascalCase *filenames* — but classifyServiceFile
  // works on any /services/ path. Index ALL /services/ .ts (union with pascalFiles)
  // so kebab-named service classes are classified, not just PascalCase ones.
  const serviceFiles = allTsFiles.filter(f => {
    const rel = f.replace(/\\/g, '/');
    return rel.includes('/services/') && !rel.endsWith('.d.ts');
  });
  const filesToIndex = Array.from(new Set([...pascalFiles, ...serviceFiles]));
  console.log(`${serviceFiles.length} /services/ .ts files; ${filesToIndex.length} total indexed (union)`);

  // Categorize by module
  const byModule = new Map();
  for (const f of filesToIndex) {
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

  // Classify service classes
  console.log('\nClassifying service classes (AST analysis)...');
  let classifiedCount = 0;
  for (const [, files] of byModule) {
    for (const file of files) {
      if (file.relativePath.includes('/services/') && !file.isGetter && !file.inContracts) {
        file.classification = classifyServiceFile(file.absolutePath);
        if (file.classification) classifiedCount++;
      }
    }
  }
  console.log(`Classified ${classifiedCount} service files`);

  const counts = {};
  for (const [, files] of byModule) {
    for (const f of files) {
      if (f.classification?.classification) {
        const c = f.classification.classification;
        counts[c] = (counts[c] || 0) + 1;
      }
    }
  }
  console.log('\nClassification summary:');
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }

  // Import map
  console.log('\nBuilding import map...');
  const importMap = await buildImportMap(allSourceFiles);
  console.log(`Mapped imports for ${importMap.size} target files`);

  for (const [, files] of byModule) {
    for (const file of files) {
      const norm = file.absolutePath.replace(/\\/g, '/');
      file.consumers = importMap.get(norm) || [];
      file.consumerCount = file.consumers.length;
    }
  }

  // Directory inventory
  const { implDirs, contractDirs } = await inventoryDirectories(SRC_ROOT);
  console.log(`\nDirectory inventory:`);
  console.log(`  ${implDirs.length} implementations/ directories (${implDirs.reduce((s, d) => s + d.fileCount, 0)} files)`);
  console.log(`  ${contractDirs.length} contracts/ directories`);
  console.log(`    ${contractDirs.filter(d => d.isEmpty).length} empty (delete)`);
  console.log(`    ${contractDirs.filter(d => d.hasTypesOnly).length} types-only (move types.ts up)`);
  console.log(`    ${contractDirs.filter(d => d.hasInterfaces).length} with interfaces (keep)`);

  // Edge cases
  console.log('\nDetecting edge cases...');
  const edgeCases = await detectEdgeCases(allSourceFiles);
  console.log(`  ${edgeCases.dynamicImports.length} dynamic imports with PascalCase paths`);
  console.log(`  ${edgeCases.storedServiceRefs.length} stored service references`);
  console.log(`  ${edgeCases.serviceAsArgument.length} services passed as arguments`);
  console.log(`  ${edgeCases.reactiveServiceState.length} reactive state with interface types`);

  // ── Write manifest ─────────────────────────────────────────────────

  const manifest = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPascalFiles: pascalFiles.length,
      totalModules: byModule.size,
      classifications: counts,
      implDirsCount: implDirs.length,
      contractDirsCount: contractDirs.length,
      emptyContractDirs: contractDirs.filter(d => d.isEmpty).length,
      typesOnlyContractDirs: contractDirs.filter(d => d.hasTypesOnly).length,
      interfaceContractDirs: contractDirs.filter(d => d.hasInterfaces).length,
    },
    edgeCases,
    directories: { implDirs, contractDirs },
    modules: Object.fromEntries(
      [...byModule.entries()].map(([mod, files]) => [mod, files.map(f => ({
        relativePath: f.relativePath,
        filename: f.filename,
        kebabFilename: f.kebabFilename,
        inImplementations: f.inImplementations,
        inContracts: f.inContracts,
        isGetter: f.isGetter,
        classification: f.classification || null,
        consumerCount: f.consumerCount,
        consumers: f.consumers.map(c => ({ file: c.consumerFile, importPath: c.importPath, line: c.lineNumber })),
      }))])
    ),
  };

  await writeFile('scripts/ceremony-manifest.json', JSON.stringify(manifest, null, 2));
  console.log('\n✓ Manifest written to scripts/ceremony-manifest.json');

  // ── Write dry-run report ───────────────────────────────────────────

  let r = '# Ceremony Flattening — Dry Run Report\n\n';
  r += `Generated: ${new Date().toISOString()}\n\n`;

  r += `## Summary\n\n`;
  r += `| Metric | Count |\n|---|---|\n`;
  r += `| PascalCase .ts files | ${pascalFiles.length} |\n`;
  r += `| Feature modules | ${[...byModule.keys()].filter(k => !k.startsWith('shared/') && k !== 'other').length} |\n`;
  r += `| Shared modules | ${[...byModule.keys()].filter(k => k.startsWith('shared/')).length} |\n`;
  r += `| implementations/ dirs | ${implDirs.length} |\n`;
  r += `| contracts/ dirs (empty) | ${contractDirs.filter(d => d.isEmpty).length} |\n`;
  r += `| contracts/ dirs (types-only) | ${contractDirs.filter(d => d.hasTypesOnly).length} |\n`;
  r += `| contracts/ dirs (interfaces) | ${contractDirs.filter(d => d.hasInterfaces).length} |\n`;
  r += `| Stateless classes | ${counts.stateless || 0} |\n`;
  r += `| Stateless-deps classes | ${counts['stateless-deps'] || 0} |\n`;
  r += `| Stateless-cache classes | ${counts['stateless-cache'] || 0} |\n`;
  r += `| Stateful classes | ${counts.stateful || 0} |\n`;
  r += `| Not-a-class (already functions) | ${counts['not-a-class'] || 0} |\n`;
  r += `| Parse errors | ${counts['parse-error'] || 0} |\n\n`;

  r += `## Edge Cases\n\n`;
  r += `| Category | Count | Risk |\n|---|---|---|\n`;
  r += `| Dynamic imports (PascalCase) | ${edgeCases.dynamicImports.length} | Agent handles manually |\n`;
  r += `| Stored service refs | ${edgeCases.storedServiceRefs.length} | Must unwrap each method call |\n`;
  r += `| Service passed as argument | ${edgeCases.serviceAsArgument.length} | Receiver param type needs update |\n`;
  r += `| Reactive state with interface type | ${edgeCases.reactiveServiceState.length} | Needs restructuring |\n\n`;

  if (edgeCases.dynamicImports.length > 0) {
    r += `### Dynamic Imports\n\n`;
    for (const e of edgeCases.dynamicImports) {
      r += `- \`${e.file}\`: \`import('${e.importPath}')\`\n`;
    }
    r += '\n';
  }

  if (edgeCases.storedServiceRefs.length > 0) {
    r += `### Stored Service References (top 30)\n\n`;
    for (const e of edgeCases.storedServiceRefs.slice(0, 30)) {
      r += `- \`${e.file}\`: \`${e.variable} = ${e.getter}()\`\n`;
    }
    if (edgeCases.storedServiceRefs.length > 30) {
      r += `- _...and ${edgeCases.storedServiceRefs.length - 30} more_\n`;
    }
    r += '\n';
  }

  if (edgeCases.serviceAsArgument.length > 0) {
    r += `### Services Passed as Arguments (top 20)\n\n`;
    for (const e of edgeCases.serviceAsArgument.slice(0, 20)) {
      r += `- \`${e.file}\`: \`...(${e.getter}())\`\n`;
    }
    if (edgeCases.serviceAsArgument.length > 20) {
      r += `- _...and ${edgeCases.serviceAsArgument.length - 20} more_\n`;
    }
    r += '\n';
  }

  if (edgeCases.reactiveServiceState.length > 0) {
    r += `### Reactive State with Interface Types\n\n`;
    for (const e of edgeCases.reactiveServiceState) {
      r += `- \`${e.file}\`: \`${e.pattern}\`\n`;
    }
    r += '\n';
  }

  r += `## Per-Module Breakdown\n\n`;
  for (const [mod, files] of [...byModule.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const inImpl = files.filter(f => f.inImplementations).length;
    const stateless = files.filter(f => ['stateless', 'stateless-deps', 'stateless-cache'].includes(f.classification?.classification)).length;
    const stateful = files.filter(f => f.classification?.classification === 'stateful').length;
    const getters = files.filter(f => f.isGetter).length;
    const totalConsumers = files.reduce((s, f) => s + f.consumerCount, 0);

    r += `### ${mod} (${files.length} files)\n\n`;
    r += `| In impl/ | Stateless | Stateful | Getters | Consumers |\n|---|---|---|---|---|\n`;
    r += `| ${inImpl} | ${stateless} | ${stateful} | ${getters} | ${totalConsumers} |\n\n`;

    // Show renames
    const renames = files.filter(f => f.kebabFilename !== f.filename);
    if (renames.length > 0) {
      r += `**Renames:**\n`;
      for (const f of renames.slice(0, 10)) {
        const prefix = f.inImplementations ? '(+flatten) ' : '';
        r += `- ${prefix}\`${f.filename}\` → \`${f.kebabFilename}\``;
        if (f.classification?.classification?.startsWith('stateless')) r += ` *(convert to functions)*`;
        r += '\n';
      }
      if (renames.length > 10) r += `- _...and ${renames.length - 10} more_\n`;
      r += '\n';
    }
  }

  await writeFile('scripts/ceremony-dry-run.md', r);
  console.log('✓ Dry-run report written to scripts/ceremony-dry-run.md');

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
