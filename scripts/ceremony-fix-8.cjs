/**
 * Fix the 8 files that were restored from git.
 * For each: remove contract import, remove implements, inline co-exported types.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const files = [
  'src/lib/features/assemble-lab/services/implementations/GridHitTargetCalculator.ts',
  'src/lib/features/background-builder/services/implementations/CoralSceneRenderer.ts',
  'src/lib/features/background-builder/services/implementations/PreviewAnimationController.ts',
  'src/lib/features/compose/tabs/arrange/services/implementations/ArrangeCompositionConverter.ts',
  'src/lib/features/create/generate/shared/services/implementations/LoopViabilityService.ts',
  'src/lib/features/feedback/services/implementations/FormDraftPersister.svelte.ts',
  'src/lib/features/museum/services/implementations/MuseumDesignValidator.ts',
  'src/lib/features/voice-sessions/services/implementations/VoiceSessionRepository.ts',
];

function getContractContent(contractPath) {
  try {
    return execSync(`git show HEAD:"${contractPath}"`, {
      cwd: ROOT,
      encoding: 'utf-8',
    });
  } catch {
    return null;
  }
}

function extractAllTypes(contractContent, interfaceName) {
  const types = [];
  // Find all export statements that aren't the main interface
  const lines = contractContent.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Match export interface/type/enum that isn't the main contract
    const m = line.match(/^export\s+(interface|type|enum)\s+(\w+)/);
    if (m && m[2] !== interfaceName) {
      if (m[1] === 'type' && !line.includes('{')) {
        // Single-line type alias
        types.push(line);
        i++;
        continue;
      }
      // Multi-line: collect until matching brace
      let depth = 0;
      let block = '';
      for (let j = i; j < lines.length; j++) {
        block += lines[j] + '\n';
        for (const ch of lines[j]) {
          if (ch === '{') depth++;
          if (ch === '}') depth--;
        }
        if (depth <= 0 && block.includes('{')) {
          break;
        }
      }
      types.push(block.trimEnd());
      // Skip past this block
      let d = 0;
      for (; i < lines.length; i++) {
        for (const ch of lines[i]) {
          if (ch === '{') d++;
          if (ch === '}') d--;
        }
        if (d <= 0 && lines[i].includes('}')) {
          i++;
          break;
        }
      }
      continue;
    }
    i++;
  }
  return types;
}

for (const file of files) {
  const fullPath = path.resolve(ROOT, file);
  let content = fs.readFileSync(fullPath, 'utf-8');

  // Find which contract this file imports from
  const contractImportMatch = content.match(/from\s+['"]([^'"]*contracts\/I[^'"]+)['"]/);
  if (!contractImportMatch) {
    console.log(`  ${file}: no contract import found, skipping`);
    continue;
  }

  const contractImportPath = contractImportMatch[1];
  // Resolve to actual file path
  const fileDir = path.dirname(file);
  let contractFile;
  if (contractImportPath.startsWith('$lib/')) {
    contractFile = contractImportPath.replace('$lib/', 'src/lib/') + '.ts';
  } else {
    contractFile = path.posix.join(fileDir.replace(/\\/g, '/'), contractImportPath) + '.ts';
    // Normalize
    contractFile = path.posix.normalize(contractFile);
  }

  const contractContent = getContractContent(contractFile);
  const interfaceName = path.basename(contractFile, '.ts');

  // Extract co-exported types
  let typeDefs = [];
  if (contractContent) {
    typeDefs = extractAllTypes(contractContent, interfaceName);
  }

  // Remove the entire import statement that references the contract
  // Handle multi-line imports
  const importRegex = new RegExp(
    `import\\s+(?:type\\s+)?\\{[^}]*\\}\\s*from\\s*['"][^'"]*contracts\\/I[^'"]*['"];?\\n?`,
    'gs'
  );
  content = content.replace(importRegex, '');

  // Remove implements IXxx (with optional generic params)
  content = content.replace(
    new RegExp(`\\s+implements\\s+${interfaceName}(?:<[^>]*>)?`),
    ''
  );

  // Insert type definitions after all imports
  if (typeDefs.length > 0) {
    // Find the last import line (handling multi-line imports)
    const lines = content.split('\n');
    let lastImportEnd = -1;
    let inImport = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s/)) inImport = true;
      if (inImport && (lines[i].includes('from ') || lines[i].match(/['"];?\s*$/))) {
        lastImportEnd = i;
        inImport = false;
      }
    }

    const insertAt = lastImportEnd >= 0 ? lastImportEnd + 1 : 0;
    const typeBlock = '\n' + typeDefs.join('\n\n') + '\n';
    lines.splice(insertAt, 0, typeBlock);
    content = lines.join('\n');
  }

  // Clean up multiple blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(fullPath, content);
  console.log(`  ${file}: fixed (${typeDefs.length} types inlined)`);
}
