/**
 * Phase 2+3: Remove all remaining single-implementation interfaces.
 *
 * For each interface with 1 implementation:
 * 1. Move co-exported types into the implementation file
 * 2. Remove `implements IFoo` from implementation
 * 3. Update ALL consumer imports:
 *    - Interface type imports → concrete class type imports
 *    - Co-exported type imports → point to implementation file
 * 4. Update getter to use concrete type
 * 5. Delete contract file
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifest = require('./ceremony-audit.json');

const targets = manifest.manifest.filter(e =>
  e.category === 'has-consumers' ||
  e.category === 'zero-consumer-coexport' ||
  e.category === 'zero-consumer-safe'
);

console.log(`Phase 2+3: Processing ${targets.length} interfaces\n`);

let deleted = 0;
let errors = [];

function readF(relPath) {
  try { return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8'); }
  catch { return null; }
}

function writeF(relPath, content) {
  fs.writeFileSync(path.resolve(ROOT, relPath), content);
}

function resolveImportPath(fromFile, importSpec) {
  if (importSpec.startsWith('$lib/')) {
    return importSpec.replace('$lib/', 'src/lib/') + '.ts';
  }
  const dir = path.dirname(fromFile).replace(/\\/g, '/');
  return path.posix.normalize(path.posix.join(dir, importSpec)) + '.ts';
}

function makeRelativeImport(fromFile, toFile) {
  const fromDir = path.dirname(fromFile).replace(/\\/g, '/');
  const toNorm = toFile.replace(/\\/g, '/').replace(/\.ts$/, '');
  let rel = path.posix.relative(fromDir, toNorm);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

for (const entry of targets) {
  const { interfaceName, contractPath, implementations, getterPath, coExports } = entry;
  if (!implementations || implementations.length !== 1) continue;

  const impl = implementations[0];
  const implPath = impl.path;
  const className = impl.className;
  const contractContent = readF(contractPath);
  if (!contractContent) continue;

  try {
    // =============================================
    // Step 1: Extract co-exported types from contract
    // =============================================
    let coExportBlock = '';
    if (coExports && coExports.length > 0) {
      const coExportNames = new Set(coExports.map(e => e.name));
      const lines = contractContent.split('\n');
      let i = 0;
      while (i < lines.length) {
        const m = lines[i].match(/^export\s+(interface|type|enum)\s+(\w+)/);
        if (m && coExportNames.has(m[2])) {
          // Collect full definition
          if (m[1] === 'type' && !lines[i].includes('{')) {
            coExportBlock += lines[i] + '\n\n';
            i++;
            continue;
          }
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
          coExportBlock += block + '\n';
          continue;
        }
        i++;
      }
    }

    // =============================================
    // Step 2: Update implementation file
    // =============================================
    let implContent = readF(implPath);
    if (!implContent) { errors.push({ interfaceName, error: 'impl not readable' }); continue; }

    // Remove implements clause
    implContent = implContent.replace(
      new RegExp(`\\s+implements\\s+${interfaceName}(?:<[^>]*>)?`),
      ''
    );

    // Remove import of the interface from contracts
    // Handle single-line and multi-line imports
    const contractImportPath = contractPath.replace(/\.ts$/, '');

    // Remove entire import line if it only imports the interface name
    implContent = implContent.replace(
      new RegExp(`import\\s+(?:type\\s+)?\\{\\s*${interfaceName}\\s*\\}\\s*from\\s*['"][^'"]*['"];?\\n?`, 'g'),
      ''
    );

    // If part of multi-import, remove just the name
    implContent = implContent.replace(
      new RegExp(`(import\\s+(?:type\\s+)?\\{[^}]*)\\b${interfaceName}\\s*,\\s*`, 'g'),
      '$1'
    );
    implContent = implContent.replace(
      new RegExp(`(import\\s+(?:type\\s+)?\\{[^}]*),\\s*${interfaceName}\\s*`, 'g'),
      '$1'
    );

    // Also remove any multi-line import that references the contract path and only imports the interface
    const contractBasename = path.basename(contractPath, '.ts');
    implContent = implContent.replace(
      new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*\\}\\s*from\\s*['"][^'"]*${contractBasename}['"];?\\n?`, 'gs'),
      (match) => {
        // Only remove if the import ONLY contains the interface name (and maybe whitespace/newlines)
        const namesInImport = match.match(/\{([^}]*)\}/s);
        if (namesInImport) {
          const names = namesInImport[1].split(',').map(n => n.trim()).filter(Boolean);
          const nonInterfaceNames = names.filter(n => n !== interfaceName);
          if (nonInterfaceNames.length === 0) return ''; // Only had the interface, remove whole import
          // Has other names - keep them, just remove the interface name
          const cleaned = nonInterfaceNames.join(', ');
          return match.replace(namesInImport[1], ' ' + cleaned + ' ');
        }
        return match;
      }
    );

    // Add co-exported types to implementation file (after imports)
    if (coExportBlock.trim()) {
      // Check if types already exist in impl
      const existingTypes = new Set();
      for (const co of (coExports || [])) {
        if (implContent.includes(`export interface ${co.name}`) ||
            implContent.includes(`export type ${co.name}`) ||
            implContent.includes(`export enum ${co.name}`)) {
          existingTypes.add(co.name);
        }
      }

      // Filter out already-existing types from the block
      if (existingTypes.size < (coExports || []).length) {
        const lines = implContent.split('\n');
        let lastImport = -1;
        let inImport = false;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^import\s/)) inImport = true;
          if (inImport && (lines[i].includes(' from ') || lines[i].match(/['"];?\s*$/))) {
            lastImport = i;
            if (lines[i].includes(' from ')) inImport = false;
          }
        }
        // Filter coExportBlock to only include types not already present
        let filteredBlock = coExportBlock;
        for (const name of existingTypes) {
          // Remove the definition for this name from the block
          filteredBlock = filteredBlock.replace(
            new RegExp(`export\\s+(?:interface|type|enum)\\s+${name}\\b[\\s\\S]*?(?:^\\}|;)\\n*`, 'm'),
            ''
          );
        }
        if (filteredBlock.trim()) {
          lines.splice(lastImport + 1, 0, '\n' + filteredBlock.trim() + '\n');
          implContent = lines.join('\n');
        }
      }
    }

    implContent = implContent.replace(/\n{3,}/g, '\n\n');
    writeF(implPath, implContent);

    // =============================================
    // Step 3: Update ALL consumer files
    // =============================================
    const consumerFiles = entry.consumerFiles || [];
    // Also scan all TS files for any reference we might have missed
    // (the manifest only stores first 10 consumers)

    // Build the relative import path consumers should use
    // Consumers currently import from: contracts/IFoo
    // They should import from: implementations/ClassName (for the class type)
    // or from implementations/ClassName (for co-exported types too, since we moved them there)

    // Find ALL files that reference the interface name
    const allTsFiles = [];
    function walk(dir) {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.includes('node_modules')) walk(full);
          else if (entry.name.endsWith('.ts') || entry.name.endsWith('.svelte.ts')) allTsFiles.push(full);
        }
      } catch {}
    }
    walk(path.resolve(ROOT, 'src'));

    const contractBasenameNoExt = path.basename(contractPath, '.ts');
    const selfPaths = new Set([
      path.resolve(ROOT, contractPath),
      path.resolve(ROOT, implPath),
    ]);
    if (getterPath) selfPaths.add(path.resolve(ROOT, getterPath));

    for (const tsFile of allTsFiles) {
      if (selfPaths.has(tsFile)) continue;
      const relTsFile = path.relative(ROOT, tsFile).replace(/\\/g, '/');
      let content = readF(relTsFile);
      if (!content || !content.includes(contractBasenameNoExt)) continue;

      // Find import from this contract and rewrite it
      const importRegex = new RegExp(
        `(import\\s+(?:type\\s+)?)(\\{[^}]*\\})(\\s*from\\s*['"])([^'"]*${contractBasenameNoExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(['"];?)`,
        'gs'
      );

      let changed = false;
      content = content.replace(importRegex, (match, prefix, names, fromPart, importPath, endQuote) => {
        // Verify this actually points to our contract
        const resolved = resolveImportPath(relTsFile, importPath);
        if (!resolved.includes('/contracts/')) return match; // not a contract import

        // Build new import path to the implementation file
        const newPath = makeRelativeImport(relTsFile, implPath);

        // Replace interface name with class name in the import names
        let newNames = names.replace(new RegExp(`\\b${interfaceName}\\b`, 'g'), className);

        changed = true;
        return `${prefix}${newNames}${fromPart}${newPath}${endQuote}`;
      });

      // Also replace any type references in the file body
      if (changed) {
        // Replace IFoo with ClassName in type positions
        // Be careful not to replace in strings or comments
        content = content.replace(
          new RegExp(`\\b${interfaceName}\\b`, 'g'),
          (match, offset) => {
            // Skip if in a string or comment (rough check)
            const before = content.slice(Math.max(0, offset - 50), offset);
            if (before.includes('//') || before.includes("'") || before.includes('"')) {
              // More careful check
              const lineStart = content.lastIndexOf('\n', offset);
              const line = content.slice(lineStart + 1, offset);
              if (line.includes('//')) return match; // in comment
            }
            return className;
          }
        );
      }

      if (changed) {
        content = content.replace(/\n{3,}/g, '\n\n');
        writeF(relTsFile, content);
      }
    }

    // =============================================
    // Step 4: Update getter
    // =============================================
    if (getterPath) {
      let getterContent = readF(getterPath);
      if (getterContent) {
        // Remove interface import
        getterContent = getterContent.replace(
          new RegExp(`import\\s+(?:type\\s+)?\\{\\s*${interfaceName}\\s*\\}\\s*from\\s*['"][^'"]*['"];?\\n?`, 'g'),
          ''
        );
        // Replace IFoo with ClassName
        getterContent = getterContent.replace(
          new RegExp(`\\b${interfaceName}\\b`, 'g'),
          className
        );
        getterContent = getterContent.replace(/\n{3,}/g, '\n\n');
        writeF(getterPath, getterContent);
      }
    }

    // =============================================
    // Step 5: Delete contract file
    // =============================================
    const contractFullPath = path.resolve(ROOT, contractPath);
    fs.unlinkSync(contractFullPath);
    deleted++;

    // Clean up empty contracts dir
    const contractsDir = path.dirname(contractFullPath);
    try {
      if (fs.readdirSync(contractsDir).length === 0) fs.rmdirSync(contractsDir);
    } catch {}

    if (deleted % 50 === 0) console.log(`  Progress: ${deleted} deleted...`);

  } catch (err) {
    errors.push({ interfaceName, error: err.message });
  }
}

console.log(`\nResults:`);
console.log(`  Contracts deleted: ${deleted}`);
console.log(`  Errors: ${errors.length}`);
for (const e of errors.slice(0, 10)) {
  console.log(`    ${e.interfaceName}: ${e.error}`);
}
