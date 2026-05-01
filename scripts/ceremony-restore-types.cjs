/**
 * Fix: For each deleted contract file that had co-exported types used by its implementation,
 * restore those type definitions by extracting them from git and inserting into the implementation file.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Get all TS2304 errors
const tscOutput = execSync('npx tsc --noEmit 2>&1 || true', {
  cwd: ROOT,
  encoding: 'utf-8',
  maxBuffer: 10 * 1024 * 1024,
  timeout: 300000,
});

// Parse: file:line -> missing name
const missing = new Map(); // file -> Set of missing names
const errorRegex = /^(.+?)\(\d+,\d+\): error TS2304: Cannot find name '(\w+)'/gm;
let match;
while ((match = errorRegex.exec(tscOutput)) !== null) {
  const file = match[1];
  const name = match[2];
  if (!missing.has(file)) missing.set(file, new Set());
  missing.get(file).add(name);
}

console.log(`${missing.size} files missing ${[...missing.values()].reduce((s, set) => s + set.size, 0)} type names\n`);

// For each file, find the deleted contract that used to provide these types
// The contract path follows the pattern: same feature dir, contracts/IClassName.ts
const restored = new Map(); // contractPath -> extracted type definitions

function getDeletedContractContent(contractPath) {
  if (restored.has(contractPath)) return restored.get(contractPath);
  try {
    const content = execSync(`git show HEAD:"${contractPath.replace(/\\/g, '/')}"`, {
      cwd: ROOT,
      encoding: 'utf-8',
    });
    restored.set(contractPath, content);
    return content;
  } catch {
    restored.set(contractPath, null);
    return null;
  }
}

function extractTypeDefinition(contractContent, typeName) {
  // Match: export interface TypeName { ... } or export type TypeName = ...
  // Handle multi-line definitions

  // Try interface/type/enum
  const patterns = [
    // export interface Foo { ... }
    new RegExp(`(export\\s+(?:interface|type|enum)\\s+${typeName}\\b[^{]*\\{)`, 's'),
    // export type Foo = ...;
    new RegExp(`(export\\s+type\\s+${typeName}\\s*=\\s*[^;]+;)`, 's'),
  ];

  for (const pattern of patterns) {
    const match = contractContent.match(pattern);
    if (match) {
      // For interface/enum with braces, need to find matching close brace
      if (match[0].includes('{')) {
        const startIdx = contractContent.indexOf(match[0]);
        let depth = 0;
        let endIdx = startIdx;
        for (let i = startIdx; i < contractContent.length; i++) {
          if (contractContent[i] === '{') depth++;
          if (contractContent[i] === '}') {
            depth--;
            if (depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }
        return contractContent.slice(startIdx, endIdx);
      }
      return match[0];
    }
  }
  return null;
}

let fixedFiles = 0;
let typesRestored = 0;

for (const [file, missingNames] of missing) {
  // Find the contract file(s) that might have had these types
  // Look for contracts/ dirs relative to the implementation
  const implDir = path.dirname(file);
  const contractsDir = implDir.replace(/implementations$/, 'contracts');

  // Try each possible contract file in that contracts dir
  let foundTypes = new Map();

  // Get list of deleted contracts from git
  try {
    const gitFiles = execSync(
      `git ls-tree --name-only HEAD "${contractsDir.replace(/\\/g, '/')}/" 2>/dev/null || true`,
      { cwd: ROOT, encoding: 'utf-8' }
    ).trim().split('\n').filter(Boolean);

    for (const gitFile of gitFiles) {
      const contractContent = getDeletedContractContent(gitFile);
      if (!contractContent) continue;

      for (const name of missingNames) {
        if (foundTypes.has(name)) continue;
        const typeDef = extractTypeDefinition(contractContent, name);
        if (typeDef) {
          foundTypes.set(name, typeDef);
        }
      }
    }
  } catch { }

  // Also try: the contract named after the class
  // e.g., BrowseDataSource.ts impl -> IBrowseDataSource.ts contract
  const className = path.basename(file, '.ts').replace(/\.svelte$/, '');
  const possibleContract = `${contractsDir}/I${className}.ts`.replace(/\\/g, '/');
  const contractContent = getDeletedContractContent(possibleContract);
  if (contractContent) {
    for (const name of missingNames) {
      if (foundTypes.has(name)) continue;
      const typeDef = extractTypeDefinition(contractContent, name);
      if (typeDef) {
        foundTypes.set(name, typeDef);
      }
    }
  }

  if (foundTypes.size === 0) continue;

  // Insert type definitions at top of implementation file, after imports
  const fullPath = path.resolve(ROOT, file);
  let content = fs.readFileSync(fullPath, 'utf-8');

  // Find the end of imports
  const lines = content.split('\n');
  let lastImportLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^import\s/) || lines[i].match(/^\s*\}?\s*from\s/)) {
      lastImportLine = i;
    }
  }

  const insertionPoint = lastImportLine >= 0 ? lastImportLine + 1 : 0;
  const typeBlock = '\n' + [...foundTypes.values()].join('\n\n') + '\n';

  lines.splice(insertionPoint, 0, typeBlock);
  fs.writeFileSync(fullPath, lines.join('\n'));

  fixedFiles++;
  typesRestored += foundTypes.size;
  console.log(`  ${file}: restored ${foundTypes.size} types (${[...foundTypes.keys()].join(', ')})`);
}

console.log(`\nRestored ${typesRestored} type definitions across ${fixedFiles} files`);
