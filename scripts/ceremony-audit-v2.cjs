/**
 * Phase 0 v2: Filesystem-based audit (not git ls-files).
 * Produces scripts/ceremony-audit.json from actual files on disk.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function findFilesOnDisk(dir, pattern) {
  const results = [];
  function walk(d) {
    try {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (pattern.test(full.replace(/\\/g, '/'))) results.push(full);
      }
    } catch {}
  }
  walk(dir);
  return results.map(f => path.relative(ROOT, f).replace(/\\/g, '/'));
}

const allTsFiles = findFilesOnDisk(SRC, /\.ts$/);
const contractFiles = allTsFiles.filter(f => f.includes('/contracts/') && /\/I[A-Z]/.test(f));
const implFiles = allTsFiles.filter(f => f.includes('/implementations/'));
const getterFiles = allTsFiles.filter(f => /\/get[A-Z][^/]*\.ts$/.test(f) && !f.includes('/contracts/') && !f.includes('/implementations/'));

console.log(`Disk: ${contractFiles.length} interfaces, ${implFiles.length} impls, ${getterFiles.length} getters`);

// Build a file content cache for perf
const contentCache = new Map();
function readFile(filePath) {
  if (contentCache.has(filePath)) return contentCache.get(filePath);
  try {
    const c = fs.readFileSync(path.resolve(ROOT, filePath), 'utf-8');
    contentCache.set(filePath, c);
    return c;
  } catch {
    contentCache.set(filePath, '');
    return '';
  }
}

// Keep list maintained
const KEEP_INTERFACES = new Set([
  'ILOOPExecutor', 'ISubInterpreter', 'IDirectionCalculator', 'ICodex',
  'IAnimationPlaybackController', 'IAsciiRenderer', 'IEndpointDetector',
  'ITrailOverlayCanvas', 'IDirectRenderer', 'IOrientationPropagator',
  'ITransitionGraph', 'IHapticFeedback', 'IVoiceCommandHandler',
]);

const manifest = [];

for (const contractPath of contractFiles) {
  const content = readFile(contractPath);
  const interfaceName = path.basename(contractPath, '.ts');

  if (KEEP_INTERFACES.has(interfaceName)) {
    manifest.push({ interfaceName, contractPath, category: 'keep-polymorphic', implCount: -1 });
    continue;
  }

  // Exports
  const exportMatches = content.match(/export\s+(interface|type|enum|class|const|function)\s+(\w+)/g) || [];
  const exports = exportMatches.map(m => {
    const match = m.match(/export\s+(interface|type|enum|class|const|function)\s+(\w+)/);
    return { kind: match[1], name: match[2] };
  });
  const coExports = exports.filter(e => e.name !== interfaceName);

  // Find implementations
  const implementations = [];
  for (const implPath of implFiles) {
    const implContent = readFile(implPath);
    const implRegex = new RegExp(`implements\\s+[\\w\\s,]*\\b${interfaceName}\\b`);
    if (implRegex.test(implContent)) {
      const hasConstructorParams = /constructor\s*\([^)]+\)/.test(implContent);
      const hasParamProps = /constructor\s*\(\s*(private|protected|public|readonly)/.test(implContent);
      const hasInstanceFields = /^\s+(private|protected|public|readonly)\s+(?!static\b)\w+\s*[:=]/m.test(implContent);
      implementations.push({
        path: implPath,
        className: path.basename(implPath, '.ts').replace('.svelte', ''),
        isStateless: !hasConstructorParams && !hasInstanceFields && !hasParamProps,
      });
    }
  }

  // Find getter
  const expectedGetterName = 'get' + interfaceName.slice(1);
  const getter = getterFiles.find(f => path.basename(f, '.ts') === expectedGetterName);

  // Count consumer imports (outside triad)
  const selfPaths = new Set([contractPath, ...implementations.map(i => i.path)]);
  if (getter) selfPaths.add(getter);

  let consumerCount = 0;
  const consumerFiles = [];
  for (const tsFile of allTsFiles) {
    if (selfPaths.has(tsFile)) continue;
    const c = readFile(tsFile);
    if (c.includes(interfaceName)) {
      consumerCount++;
      consumerFiles.push(tsFile);
    }
  }

  // Co-export consumer count
  let coExportConsumers = 0;
  for (const coExp of coExports) {
    for (const tsFile of allTsFiles) {
      if (selfPaths.has(tsFile)) continue;
      if (readFile(tsFile).includes(coExp.name)) { coExportConsumers++; break; }
    }
  }

  manifest.push({
    interfaceName,
    contractPath,
    implementations: implementations.map(i => ({ path: i.path, className: i.className, isStateless: i.isStateless })),
    getterPath: getter || null,
    implCount: implementations.length,
    coExports,
    hasCoExports: coExports.length > 0,
    consumerCount,
    consumerFiles: consumerFiles.slice(0, 10),
    coExportConsumers,
    category:
      implementations.length === 0 ? 'no-implements' :
      implementations.length >= 2 ? 'polymorphic' :
      consumerCount === 0 && coExportConsumers === 0 ? 'zero-consumer-safe' :
      consumerCount === 0 && coExportConsumers > 0 ? 'zero-consumer-coexport' :
      'has-consumers',
  });
}

const cats = {};
for (const e of manifest) cats[e.category] = (cats[e.category] || 0) + 1;

const summary = {
  totalOnDisk: contractFiles.length,
  categories: cats,
  statelessImpls: manifest.filter(e => e.implCount === 1 && e.implementations?.[0]?.isStateless).length,
};

fs.writeFileSync(path.join(__dirname, 'ceremony-audit.json'), JSON.stringify({ summary, manifest }, null, 2));
console.log('\nSummary:', JSON.stringify(summary, null, 2));
