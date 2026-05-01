/**
 * Fix the 4 files that the main codemod broke due to multi-line type extraction bugs.
 * These files were restored from git HEAD and need ceremony changes applied manually.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function getGit(relPath) {
  try {
    return execSync(`git show HEAD:"${relPath}"`, { cwd: ROOT, encoding: 'utf-8' });
  } catch { return null; }
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
      // Collect the full type definition, tracking brace depth
      let def = lines[i];
      let j = i + 1;
      let depth = 0;
      for (const ch of def) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      // Keep going until we find ';' at depth 0
      while (j < lines.length) {
        if (depth <= 0 && def.includes(';')) break;
        def += '\n' + lines[j];
        for (const ch of lines[j]) {
          if (ch === '{') depth++;
          if (ch === '}') depth--;
        }
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
  const escaped = contractBasename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content.replace(
    new RegExp(
      `import\\s+(?:type\\s+)?\\{[\\s\\S]*?\\}\\s*from\\s*['"][^'"]*${escaped}['"];?\\n?`,
      'g'
    ),
    ''
  );
}

function removeImplements(content, interfaceName) {
  return content.replace(
    new RegExp(`\\s+implements\\s+${interfaceName}(?:<[^>]*>)?`),
    ''
  );
}

function makeRelative(fromFile, toFile) {
  const fromDir = path.dirname(fromFile).replace(/\\/g, '/');
  const toNorm = toFile.replace(/\\/g, '/').replace(/\.ts$/, '');
  let rel = path.posix.relative(fromDir, toNorm);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// The 4 files to fix, with their contract and implementation mappings
const targets = [
  {
    implPath: 'src/lib/features/browse/sequences/display/services/implementations/ThumbnailRenderer.ts',
    contracts: [
      {
        contractPath: 'src/lib/features/browse/sequences/display/services/contracts/IThumbnailRenderer.ts',
        interfaceName: 'IThumbnailRenderer',
        implFile: 'src/lib/features/browse/sequences/display/services/implementations/ThumbnailRenderer.ts',
      },
      {
        contractPath: 'src/lib/features/browse/sequences/display/services/contracts/IBrowseLoader.ts',
        interfaceName: 'IBrowseLoader',
        implFile: 'src/lib/features/browse/sequences/display/services/implementations/PublicSequencesLoader.ts',
      },
      {
        contractPath: 'src/lib/shared/render/services/contracts/ISequenceRenderer.ts',
        interfaceName: 'ISequenceRenderer',
        implFile: 'src/lib/shared/render/services/implementations/SequenceRenderer.ts',
      },
      {
        contractPath: 'src/lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver.ts',
        interfaceName: 'IStartPositionDeriver',
        implFile: 'src/lib/shared/pictograph/shared/services/implementations/StartPositionDeriver.ts',
      },
      {
        contractPath: 'src/lib/features/browse/sequences/display/services/contracts/IThumbnailKeyDeriver.ts',
        interfaceName: 'IThumbnailKeyDeriver',
        implFile: 'src/lib/features/browse/sequences/display/services/implementations/ThumbnailKeyDeriver.ts',
      },
    ],
  },
  {
    implPath: 'src/lib/features/create/construct/option-picker/services/implementations/LayoutDetector.ts',
    contracts: [
      {
        contractPath: 'src/lib/features/create/construct/option-picker/services/contracts/ILayoutDetector.ts',
        interfaceName: 'ILayoutDetector',
        implFile: 'src/lib/features/create/construct/option-picker/services/implementations/LayoutDetector.ts',
      },
      {
        contractPath: 'src/lib/shared/device/services/contracts/IDeviceDetector.ts',
        interfaceName: 'IDeviceDetector',
        implFile: 'src/lib/shared/device/services/implementations/DeviceDetector.ts',
      },
    ],
  },
  {
    implPath: 'src/lib/shared/render/services/implementations/ImageComposer.ts',
    contracts: [
      {
        contractPath: 'src/lib/shared/render/services/contracts/IImageComposer.ts',
        interfaceName: 'IImageComposer',
        implFile: 'src/lib/shared/render/services/implementations/ImageComposer.ts',
      },
      {
        contractPath: 'src/lib/shared/render/services/contracts/IDimensionCalculator.ts',
        interfaceName: 'IDimensionCalculator',
        implFile: 'src/lib/shared/render/services/implementations/DimensionCalculator.ts',
      },
      {
        contractPath: 'src/lib/shared/render/services/contracts/ILayoutCalculator.ts',
        interfaceName: 'ILayoutCalculator',
        implFile: 'src/lib/shared/render/services/implementations/LayoutCalculator.ts',
      },
      {
        contractPath: 'src/lib/shared/render/services/contracts/ITextRenderer.ts',
        interfaceName: 'ITextRenderer',
        implFile: 'src/lib/shared/render/services/implementations/TextRenderer.ts',
      },
      {
        contractPath: 'src/lib/shared/render/services/contracts/IPictographBlobCache.ts',
        interfaceName: 'IPictographBlobCache',
        implFile: 'src/lib/shared/render/services/implementations/PictographBlobCache.ts',
      },
      {
        contractPath: 'src/lib/shared/render/services/contracts/IPictographKeyHasher.ts',
        interfaceName: 'IPictographKeyHasher',
        implFile: 'src/lib/shared/render/services/implementations/PictographKeyHasher.ts',
      },
      {
        contractPath: 'src/lib/shared/render/services/contracts/IStepNumberRenderer.ts',
        interfaceName: 'IStepNumberRenderer',
        implFile: 'src/lib/shared/render/services/implementations/StepNumberRenderer.ts',
      },
      {
        contractPath: 'src/lib/shared/render/services/contracts/ILayerCompositor.ts',
        interfaceName: 'ILayerCompositor',
        implFile: 'src/lib/shared/render/services/implementations/LayerCompositor.ts',
      },
      {
        contractPath: 'src/lib/shared/qr/services/contracts/IQRCodeGenerator.ts',
        interfaceName: 'IQRCodeGenerator',
        implFile: 'src/lib/shared/qr/services/implementations/QRCodeGenerator.ts',
      },
      {
        contractPath: 'src/lib/shared/sequence-viewer/services/contracts/IPreviewCellRenderer.ts',
        interfaceName: 'IPreviewCellRenderer',
        implFile: 'src/lib/shared/sequence-viewer/services/implementations/PreviewCellRenderer.ts',
      },
    ],
  },
  {
    implPath: 'src/lib/shared/share/services/implementations/Sharer.ts',
    contracts: [
      {
        contractPath: 'src/lib/shared/share/services/contracts/ISharer.ts',
        interfaceName: 'ISharer',
        implFile: 'src/lib/shared/share/services/implementations/Sharer.ts',
      },
      {
        contractPath: 'src/lib/shared/render/services/contracts/ISequenceRenderer.ts',
        interfaceName: 'ISequenceRenderer',
        implFile: 'src/lib/shared/render/services/implementations/SequenceRenderer.ts',
      },
    ],
  },
];

for (const target of targets) {
  let content = fs.readFileSync(path.resolve(ROOT, target.implPath), 'utf-8');
  const allCoExports = [];

  for (const contract of target.contracts) {
    const contractBasename = path.basename(contract.contractPath, '.ts');
    const className = contract.interfaceName.slice(1);

    // 1. Remove implements for the SELF contract only
    if (contract.implFile === target.implPath) {
      content = removeImplements(content, contract.interfaceName);
    }

    // 2. Remove import block from this contract
    content = removeImportBlock(content, contractBasename);

    // 3. Replace interface type references with class names in the file
    // But only for type references (not string literals)
    if (contract.interfaceName !== 'ILOOPDetector') { // KEEP set
      content = content.replace(
        new RegExp(`(?<!['"\\w])${contract.interfaceName}(?!['"\\w])`, 'g'),
        className
      );
    }

    // 4. Add import for the implementation class if it's from a DIFFERENT file
    if (contract.implFile !== target.implPath) {
      const relPath = makeRelative(target.implPath, contract.implFile);
      // Check if we need to import the class itself (used as type in constructor etc.)
      if (content.includes(className)) {
        // Check we don't already have this import
        if (!content.includes(`from "${relPath}"`) && !content.includes(`from '${relPath}'`)) {
          // Find the right place to insert — after last import
          const importLine = `import type { ${className} } from "${relPath}";\n`;
          const lastImport = content.lastIndexOf('\nimport ');
          if (lastImport >= 0) {
            // Find end of that import statement
            let pos = lastImport + 1;
            let bd = 0;
            let inImp = false;
            const lines = content.split('\n');
            let insertLine = 0;
            for (let i = 0; i < lines.length; i++) {
              if (/^import\s/.test(lines[i])) {
                inImp = true;
                bd = 0;
              }
              if (inImp) {
                for (const ch of lines[i]) {
                  if (ch === '{') bd++;
                  if (ch === '}') bd--;
                }
                if (bd <= 0 && /from\s+['"]/.test(lines[i])) {
                  insertLine = i;
                  inImp = false;
                }
              }
            }
            const contentLines = content.split('\n');
            contentLines.splice(insertLine + 1, 0, importLine.trimEnd());
            content = contentLines.join('\n');
          }
        }
      }
    }

    // 5. Extract co-exported types from the contract
    const contractContent = getGit(contract.contractPath);
    if (contractContent) {
      const coExports = extractCoExportedTypes(contractContent, contract.interfaceName);
      for (const ce of coExports) {
        // Only add if the type is actually used in this file or was imported from this contract
        if (contract.implFile === target.implPath) {
          allCoExports.push(ce);
        }
      }
    }
  }

  // Insert co-exported types after imports
  if (allCoExports.length > 0) {
    const newTypes = allCoExports.filter(ce => {
      return !content.includes(`export interface ${ce.name}`) &&
             !content.includes(`export type ${ce.name}`);
    });

    if (newTypes.length > 0) {
      const endOfImports = findEndOfImports(content);
      const lines = content.split('\n');
      const typeBlock = '\n' + newTypes.map(e => e.definition).join('\n\n') + '\n';
      lines.splice(endOfImports + 1, 0, typeBlock);
      content = lines.join('\n');
    }
  }

  // Clean up
  content = content.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(path.resolve(ROOT, target.implPath), content);
  console.log('Fixed:', target.implPath);
}
