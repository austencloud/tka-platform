/**
 * Phase 1: Remove zero-consumer pure contracts with no co-export consumers.
 *
 * For each qualifying interface:
 * 1. Remove `implements IFoo` from implementation class
 * 2. Remove import of IFoo from implementation class
 * 3. Update getter to import/return concrete type instead of IFoo
 * 4. Remove import of IFoo from getter
 * 5. Delete the contract file
 * 6. Delete empty contracts/ directories
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifest = require('./ceremony-audit.json');

const targets = manifest.manifest.filter(e =>
  e.category === 'zero-consumer' &&
  e.coExportConsumerCount === 0 &&
  e.implCount === 1
);

console.log(`Phase 1: Processing ${targets.length} zero-consumer pure contracts\n`);

let deleted = 0;
let implsUpdated = 0;
let gettersUpdated = 0;
let dirsDeleted = 0;
let errors = [];

for (const entry of targets) {
  const { interfaceName, contractPath, implementations, getterPath } = entry;
  const impl = implementations[0];
  if (!impl) continue;

  const implFullPath = path.resolve(ROOT, impl.path);
  const contractFullPath = path.resolve(ROOT, contractPath);
  const className = impl.className;

  try {
    // 1. Update implementation: remove `implements IFoo` and its import
    let implContent = fs.readFileSync(implFullPath, 'utf-8');

    // Remove "implements IFoo" (possibly with other interfaces)
    // Pattern: "implements IFoo" when it's the only one
    implContent = implContent.replace(
      new RegExp(`\\s+implements\\s+${interfaceName}\\b`),
      ''
    );
    // Pattern: "implements IFoo, IBar" -> "implements IBar"
    implContent = implContent.replace(
      new RegExp(`implements\\s+${interfaceName}\\s*,\\s*`),
      'implements '
    );
    // Pattern: "implements IBar, IFoo" -> "implements IBar"
    implContent = implContent.replace(
      new RegExp(`,\\s*${interfaceName}\\b`),
      ''
    );

    // Remove import of the interface (type import or regular)
    // Handle: import type { IFoo } from '../contracts/IFoo';
    // Handle: import type { IFoo, OtherType } from '../contracts/IFoo';
    // Handle: import { IFoo } from '../contracts/IFoo';

    // If it's the only import from that file, remove the whole line
    const soleImportRegex = new RegExp(
      `import\\s+(?:type\\s+)?\\{\\s*${interfaceName}\\s*\\}\\s*from\\s*['"][^'"]*['"];?\\n?`,
      'g'
    );
    const multiImportRegex = new RegExp(
      `(import\\s+(?:type\\s+)?\\{[^}]*)\\b${interfaceName}\\b\\s*,?\\s*`,
      'g'
    );

    if (soleImportRegex.test(implContent)) {
      implContent = implContent.replace(soleImportRegex, '');
    } else {
      // It's part of a multi-import — remove just the name
      implContent = implContent.replace(multiImportRegex, (match, prefix) => {
        // Clean up trailing comma if needed
        return prefix;
      });
      // Clean up any resulting ", }" or "{, "
      implContent = implContent.replace(/\{\s*,\s*/g, '{ ');
      implContent = implContent.replace(/,\s*\}/g, ' }');
    }

    // Clean up multiple blank lines
    implContent = implContent.replace(/\n{3,}/g, '\n\n');

    fs.writeFileSync(implFullPath, implContent);
    implsUpdated++;

    // 2. Update getter: change IFoo type to concrete class type
    if (getterPath) {
      const getterFullPath = path.resolve(ROOT, getterPath);
      let getterContent = fs.readFileSync(getterFullPath, 'utf-8');

      // Remove import of interface type
      getterContent = getterContent.replace(
        new RegExp(`import\\s+(?:type\\s+)?\\{\\s*${interfaceName}\\s*\\}\\s*from\\s*['"][^'"]*['"];?\\n?`, 'g'),
        ''
      );

      // Replace type references: IFoo -> ClassName
      getterContent = getterContent.replace(
        new RegExp(`\\b${interfaceName}\\b`, 'g'),
        className
      );

      // Fix the import path for the implementation class if it references contracts
      // The impl import might need its path updated since we're keeping the impl where it is
      // But the getter already imports the impl class, so we just need to remove the interface import

      // Clean up multiple blank lines
      getterContent = getterContent.replace(/\n{3,}/g, '\n\n');

      fs.writeFileSync(getterFullPath, getterContent);
      gettersUpdated++;
    }

    // 3. Delete contract file
    fs.unlinkSync(contractFullPath);
    deleted++;

    // 4. Check if contracts/ directory is now empty
    const contractsDir = path.dirname(contractFullPath);
    try {
      const remaining = fs.readdirSync(contractsDir);
      if (remaining.length === 0) {
        fs.rmdirSync(contractsDir);
        dirsDeleted++;
      }
    } catch { }

  } catch (err) {
    errors.push({ interfaceName, error: err.message });
  }
}

console.log(`Results:`);
console.log(`  Contracts deleted: ${deleted}`);
console.log(`  Implementations updated: ${implsUpdated}`);
console.log(`  Getters updated: ${gettersUpdated}`);
console.log(`  Empty contracts/ dirs deleted: ${dirsDeleted}`);
if (errors.length > 0) {
  console.log(`  Errors: ${errors.length}`);
  for (const e of errors) {
    console.log(`    ${e.interfaceName}: ${e.error}`);
  }
}
