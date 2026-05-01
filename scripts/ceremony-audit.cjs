/**
 * Phase 0: Enterprise Ceremony Audit
 * Produces scripts/ceremony-audit.json — the manifest that drives all subsequent phases.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC = path.resolve(__dirname, '..', 'src');

function findFiles(pattern) {
  try {
    const result = execSync(`git ls-files "${pattern}"`, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(path.resolve(__dirname, '..', filePath), 'utf-8');
  } catch {
    return '';
  }
}

// 1. Find all interface files in contracts/ directories
const allTsFiles = findFiles('src/**/*.ts');
const contractFiles = allTsFiles.filter(f => f.includes('/contracts/') && path.basename(f).startsWith('I'));
const implFiles = allTsFiles.filter(f => f.includes('/implementations/'));
const getterFiles = allTsFiles.filter(f => /\/get[A-Z][^/]*\.ts$/.test(f) && !f.includes('/contracts/') && !f.includes('/implementations/'));

console.log(`Found ${contractFiles.length} interface files`);
console.log(`Found ${implFiles.length} implementation files`);
console.log(`Found ${getterFiles.length} getter files`);

const manifest = [];

for (const contractPath of contractFiles) {
  const content = readFile(contractPath);
  const basename = path.basename(contractPath, '.ts');
  const interfaceName = basename; // e.g. "IFooService"

  // Find exports beyond the main interface
  const exportMatches = content.match(/export\s+(interface|type|enum|class|const|function)\s+(\w+)/g) || [];
  const exports = exportMatches.map(m => {
    const match = m.match(/export\s+(interface|type|enum|class|const|function)\s+(\w+)/);
    return { kind: match[1], name: match[2] };
  });
  const mainExport = exports.find(e => e.name === interfaceName);
  const coExports = exports.filter(e => e.name !== interfaceName);

  // Find implementations that declare "implements IFoo"
  const implementations = [];
  for (const implPath of implFiles) {
    const implContent = readFile(implPath);
    // Match "implements IFoo" or "implements IFoo," or "implements OtherThing, IFoo"
    const implRegex = new RegExp(`implements\\s+[\\w\\s,]*\\b${interfaceName}\\b`);
    if (implRegex.test(implContent)) {
      // Check if stateless: no constructor params, no instance fields
      const hasConstructorParams = /constructor\s*\([^)]+\)/.test(implContent);
      const hasInstanceFields = /^\s+(private|protected|public|readonly)\s+(?!static\b)\w+\s*[:=]/m.test(implContent);
      // Also check for field declarations without access modifier but with type annotation at class level
      const hasFieldDeclarations = /^\s+\w+\s*:\s*\w+/m.test(implContent);

      // More precise: look for actual instance state
      // constructor params that create fields (TypeScript parameter properties)
      const hasParamProps = /constructor\s*\(\s*(private|protected|public|readonly)/.test(implContent);

      // Direct field assignments not in methods
      const classBody = implContent.replace(/constructor[^}]*}/s, ''); // rough

      const isStateless = !hasConstructorParams && !hasInstanceFields && !hasParamProps;

      const implClassName = path.basename(implPath, '.ts');
      implementations.push({
        path: implPath,
        className: implClassName,
        isStateless,
        hasConstructorParams,
        hasInstanceFields: hasInstanceFields || hasParamProps,
      });
    }
  }

  // Find getter file
  const expectedGetterName = 'get' + interfaceName.slice(1); // IFoo -> getFoo
  const getter = getterFiles.find(f => path.basename(f, '.ts') === expectedGetterName);

  // Count consumer imports (files that import the interface name, excluding contract/impl/getter)
  const selfPaths = new Set([contractPath]);
  implementations.forEach(i => selfPaths.add(i.path));
  if (getter) selfPaths.add(getter);

  let consumerImportCount = 0;
  const consumers = [];
  for (const tsFile of allTsFiles) {
    if (selfPaths.has(tsFile)) continue;
    const fileContent = readFile(tsFile);
    if (fileContent.includes(interfaceName)) {
      consumerImportCount++;
      consumers.push(tsFile);
    }
  }

  // Count co-export consumers
  let coExportConsumerCount = 0;
  for (const coExp of coExports) {
    for (const tsFile of allTsFiles) {
      if (selfPaths.has(tsFile)) continue;
      const fileContent = readFile(tsFile);
      if (fileContent.includes(coExp.name)) {
        coExportConsumerCount++;
        break; // just need to know if any consumer uses any co-export
      }
    }
  }

  manifest.push({
    interfaceName,
    contractPath,
    implementations: implementations.map(i => ({
      path: i.path,
      className: i.className,
      isStateless: i.isStateless,
      hasConstructorParams: i.hasConstructorParams,
      hasInstanceFields: i.hasInstanceFields,
    })),
    getterPath: getter || null,
    implCount: implementations.length,
    coExports: coExports.map(e => ({ kind: e.kind, name: e.name })),
    hasCoExports: coExports.length > 0,
    consumerImportCount,
    coExportConsumerCount,
    category: implementations.length === 0
      ? 'no-implements'
      : implementations.length >= 2
        ? 'polymorphic'
        : consumerImportCount === 0
          ? 'zero-consumer'
          : coExports.length > 0
            ? 'type-exporting'
            : 'pure-contract',
  });
}

// Summary
const categories = {};
for (const entry of manifest) {
  categories[entry.category] = (categories[entry.category] || 0) + 1;
}

const statelessCount = manifest
  .filter(e => e.implCount === 1 && e.implementations[0]?.isStateless)
  .length;

const summary = {
  totalInterfaces: manifest.length,
  categories,
  statelessClassCount: statelessCount,
  totalGetters: manifest.filter(e => e.getterPath).length,
  totalCoExporting: manifest.filter(e => e.hasCoExports).length,
};

const output = { summary, manifest };

const outPath = path.resolve(__dirname, 'ceremony-audit.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWritten to ${outPath}`);
console.log('\nSummary:', JSON.stringify(summary, null, 2));
