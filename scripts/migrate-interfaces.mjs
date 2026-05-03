import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync, rmdirSync } from 'fs';
import { join, dirname, basename, posix } from 'path';
import { execSync } from 'child_process';

const ROOT = 'E:/tka-platform';

const INTERFACE_FILES = [
  'src/lib/features/admin/services/contracts/IPostHogAnalyticsProvider.ts',
  'src/lib/features/admin/services/contracts/IPostHogUserAnalytics.ts',
  'src/lib/features/admin/services/contracts/IUserActivityTracker.ts',
  'src/lib/features/arena/services/contracts/IMatchupSelector.ts',
  'src/lib/features/arena/services/contracts/IStabilityAnalyzer.ts',
  'src/lib/features/assemble-lab/services/contracts/IGridHitTargetCalculator.ts',
  'src/lib/features/assemble-lab/services/contracts/ISvgPropAnimator.ts',
  'src/lib/features/background-builder/services/contracts/INightSkyLabController.ts',
  'src/lib/features/background-builder/services/contracts/IPreviewAnimationController.ts',
  'src/lib/features/background-builder/services/contracts/IUFOStatusPoller.ts',
  'src/lib/features/browse/sequences/display/services/contracts/IVariationGrouper.ts',
  'src/lib/features/browse/shared/services/contracts/IBrowseDataSource.ts',
  'src/lib/features/browse/shared/services/contracts/IBrowseEventHandler.ts',
  'src/lib/features/browse/shared/services/contracts/IOptimizedBrowser.ts',
  'src/lib/features/community/services/contracts/IFollowingFeedProvider.ts',
  'src/lib/features/community/services/contracts/IGeocodingService.ts',
  'src/lib/features/community/services/contracts/ILocationProvider.ts',
  'src/lib/features/compose/compose/phases/audio/library/services/contracts/IAudioStorageManager.ts',
  'src/lib/features/compose/tabs/arrange/services/contracts/IArrangeCompositionConverter.ts',
  'src/lib/features/compose/tabs/arrange/services/contracts/IArrangeGridSerializer.ts',
  'src/lib/features/compose/tabs/arrange/services/contracts/IArrangeKeyboardHandler.ts',
  'src/lib/features/compose/tabs/arrange/services/contracts/IArrangeLayerTransformer.ts',
  'src/lib/features/compose/tabs/arrange/services/contracts/IArrangeUndoManager.ts',
  'src/lib/features/compose/tabs/browse/services/contracts/ICompositionLayoutCalculator.ts',
  'src/lib/features/compose/timeline/services/contracts/ITimelinePlayer.ts',
  'src/lib/features/compose/timeline/services/contracts/ITimelineSnapper.ts',
  'src/lib/features/compose/timeline/services/contracts/ITimelineUndoManager.ts',
  'src/lib/features/effects-lab/services/contracts/IEffectPointsPersister.ts',
  'src/lib/features/feedback/services/contracts/IClaimStatusDeriver.ts',
  'src/lib/features/feedback/services/contracts/IFeedbackEditor.ts',
  'src/lib/features/feedback/services/contracts/IFeedbackQueryService.ts',
  'src/lib/features/feedback/services/contracts/IFeedbackTypeResolver.ts',
  'src/lib/features/feedback/services/contracts/IFormDraftPersister.ts',
  'src/lib/features/feedback/services/contracts/IImageStager.ts',
  'src/lib/features/feedback/services/contracts/ISwimLaneDeriver.ts',
  'src/lib/features/feedback/services/contracts/IVoiceRecorder.ts',
  'src/lib/features/festivals/services/contracts/IFestivalLoader.ts',
  'src/lib/features/fuse/services/contracts/ISequenceFuser.ts',
  'src/lib/features/lab/services/contracts/IGalleryItemAdapter.ts',
  'src/lib/features/lab/services/contracts/IScreenshotOrchestrator.ts',
  'src/lib/features/lab/services/contracts/IScreenshotUploader.ts',
  'src/lib/features/lab/services/contracts/IScreenshotUploadOrchestrator.ts',
  'src/lib/features/lab/tabs/collision-lab/services/contracts/IStanceOptimizer.ts',
  'src/lib/features/lab/tabs/collision-lab/services/contracts/IStanceSimulator.ts',
  'src/lib/features/landing/services/contracts/IBroadcastRepository.ts',
  'src/lib/features/landing/services/contracts/IEndlessSpinnerOrchestrator.ts',
  'src/lib/features/library/services/contracts/ILibraryRepository.ts',
  'src/lib/features/library/services/contracts/ILibrarySaveService.ts',
  'src/lib/features/museum/scenes/procedural/services/contracts/IInteractionDetector.ts',
  'src/lib/features/museum/scenes/procedural/services/contracts/IMuseumPersister.ts',
  'src/lib/features/museum/services/contracts/IMuseumDesignValidator.ts',
  'src/lib/features/museum/services/contracts/IMuseumGridBuilder.ts',
  'src/lib/features/museum/services/contracts/IMuseumModelLoader.ts',
  'src/lib/features/museum/services/contracts/IMuseumRoomSerializer.ts',
  'src/lib/features/museum/services/contracts/IPlaqueTextureGenerator.ts',
  'src/lib/features/museum/services/contracts/IRoomLifecycleManager.ts',
  'src/lib/features/museum/services/contracts/IRoomStreamingManager.ts',
  'src/lib/features/museum/services/contracts/ITileGridAnalyzer.ts',
  'src/lib/features/museum/services/contracts/IWallSegmentStamper.ts',
  'src/lib/features/phrase-effort-lab/services/contracts/IPhraseInterpolator.ts',
  'src/lib/features/retro/shared/services/contracts/IEraRenderer.ts',
  'src/lib/features/retro/win95/services/contracts/IFakeLoadingManager.ts',
  'src/lib/features/retro/win95/services/contracts/IWindowManager.ts',
  'src/lib/features/sticker-lab/services/contracts/IStickerSheetPdfExporter.ts',
  'src/lib/features/tika/services/contracts/IConversationMemoryRetriever.ts',
  'src/lib/features/tika/services/contracts/ITikaCapabilityLookup.ts',
];

let implementsRemovedCount = 0;
let gettersUpdatedCount = 0;
let interfacesDeletedCount = 0;
const filesModified = new Set();

/**
 * Parse an interface file and extract:
 * - The interface definition block (to discard)
 * - Co-exported types/interfaces/enums (to move to types.ts)
 * - Imports needed by co-exported types
 */
function parseInterfaceFile(content, interfaceName) {
  const lines = content.split('\n');
  const importLines = [];
  const typeBlocks = [];
  let currentBlock = [];
  let braceDepth = 0;
  let inBlock = false;
  let blockIsInterface = false;
  let isMainInterface = false;

  for (const line of lines) {
    // Collect imports
    if (line.startsWith('import ')) {
      importLines.push(line);
      continue;
    }

    // Detect start of an exported block
    const exportMatch = line.match(/^export\s+(interface|type|enum)\s+(\w+)/);
    if (exportMatch && !inBlock) {
      inBlock = true;
      blockIsInterface = exportMatch[1] === 'interface' || exportMatch[1] === 'enum';
      isMainInterface = exportMatch[2] === interfaceName;
      braceDepth = 0;
      currentBlock = [line];
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      // type alias on single line
      if (!blockIsInterface && line.includes(';')) {
        if (!isMainInterface) {
          typeBlocks.push(currentBlock.join('\n'));
        }
        inBlock = false;
        currentBlock = [];
        continue;
      }
      if (braceDepth === 0 && line.includes('}')) {
        if (!isMainInterface) {
          typeBlocks.push(currentBlock.join('\n'));
        }
        inBlock = false;
        currentBlock = [];
      }
      continue;
    }

    if (inBlock) {
      currentBlock.push(line);
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0 && line.includes('}')) {
        if (!isMainInterface) {
          typeBlocks.push(currentBlock.join('\n'));
        }
        inBlock = false;
        currentBlock = [];
      }
      continue;
    }

    // Standalone comment blocks between exports - include them as context
    if (line.startsWith('/**') || line.startsWith(' *') || line.startsWith(' */') || line.trim() === '' || line.startsWith('//')) {
      // These are either doc comments or blank lines between blocks - skip
      continue;
    }
  }

  return { importLines, typeBlocks };
}

/**
 * Get the names of all exported types (not the main interface)
 */
function getExportedTypeNames(content, interfaceName) {
  const names = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^export\s+(?:interface|type|enum)\s+(\w+)/);
    if (m && m[1] !== interfaceName) {
      names.push(m[1]);
    }
  }
  return names;
}

/**
 * Find all files that import from the given interface file path pattern
 */
function findImporters(ifaceBaseName) {
  try {
    const output = execSync(
      `grep -rl "contracts/${ifaceBaseName}" src/ --include="*.ts" --include="*.svelte"`,
      { cwd: ROOT, encoding: 'utf8', timeout: 15000 }
    ).trim();
    return output ? output.split('\n') : [];
  } catch {
    return [];
  }
}

// Process each interface file
for (const ifaceFile of INTERFACE_FILES) {
  const absIfaceFile = join(ROOT, ifaceFile);
  if (!existsSync(absIfaceFile)) {
    console.log(`SKIP (not found): ${ifaceFile}`);
    continue;
  }

  const content = readFileSync(absIfaceFile, 'utf8');
  const interfaceName = basename(ifaceFile, '.ts');
  const concreteName = interfaceName.substring(1); // IFoo -> Foo
  const contractsDir = dirname(ifaceFile);
  const typesFilePath = join(contractsDir, 'types.ts');
  const absTypesFile = join(ROOT, typesFilePath);

  // Parse the interface file
  const { importLines: ifaceImports, typeBlocks } = parseInterfaceFile(content, interfaceName);
  const coExportedTypeNames = getExportedTypeNames(content, interfaceName);

  // --- Step A: Move co-exported types to types.ts ---
  if (typeBlocks.length > 0) {
    let typesContent = '';
    if (existsSync(absTypesFile)) {
      typesContent = readFileSync(absTypesFile, 'utf8');
    } else {
      typesContent = '/**\n * Co-exported types from retired interface contracts.\n */\n';
    }

    // Check which imports from the interface file are needed for the co-exported types
    const typeBlockText = typeBlocks.join('\n');
    const neededImports = [];
    for (const imp of ifaceImports) {
      // Extract imported names
      const namesMatch = imp.match(/\{([^}]+)\}/);
      if (namesMatch) {
        const names = namesMatch[1].split(',').map(n => n.trim().replace(/^type\s+/, ''));
        if (names.some(n => typeBlockText.includes(n))) {
          // Check if this import already exists in types.ts
          if (!typesContent.includes(imp.split('from')[1]?.trim() || '__never__')) {
            neededImports.push(imp);
          }
        }
      }
    }

    // Add needed imports
    if (neededImports.length > 0) {
      const tLines = typesContent.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < tLines.length; i++) {
        if (tLines[i].startsWith('import ')) lastImportIdx = i;
      }
      for (const imp of neededImports) {
        if (lastImportIdx >= 0) {
          tLines.splice(lastImportIdx + 1, 0, imp);
          lastImportIdx++;
        } else {
          // Insert after header comment
          const headerEnd = tLines.findIndex(l => l.includes('*/'));
          if (headerEnd >= 0) {
            tLines.splice(headerEnd + 1, 0, '', imp);
            lastImportIdx = headerEnd + 2;
          } else {
            tLines.unshift(imp);
            lastImportIdx = 0;
          }
        }
      }
      typesContent = tLines.join('\n');
    }

    // Append type blocks
    typesContent = typesContent.trimEnd() + '\n\n// === From ' + interfaceName + ' ===\n\n' + typeBlocks.join('\n\n') + '\n';
    writeFileSync(absTypesFile, typesContent, 'utf8');
  }

  // --- Step B: Find all consumers and update imports ---
  const consumers = findImporters(interfaceName);

  for (const consumer of consumers) {
    const absConsumer = join(ROOT, consumer);
    if (!existsSync(absConsumer)) continue;
    let cc = readFileSync(absConsumer, 'utf8');
    const orig = cc;

    // Find import statement(s) that reference this interface file
    // Handle both single-line and multi-line imports
    const singleLineRe = new RegExp(
      `import\\s+type\\s*\\{([^}]+)\\}\\s*from\\s*["'][^"']*contracts/${interfaceName}["'];?`,
      'g'
    );
    const singleLineRe2 = new RegExp(
      `import\\s*\\{([^}]+)\\}\\s*from\\s*["'][^"']*contracts/${interfaceName}["'];?`,
      'g'
    );

    // Collect all import matches
    let allMatches = [];
    let m;
    while ((m = singleLineRe.exec(cc)) !== null) {
      allMatches.push({ full: m[0], names: m[1], isType: true });
    }
    // Reset and try non-type imports too
    while ((m = singleLineRe2.exec(cc)) !== null) {
      if (!allMatches.find(x => x.full === m[0])) {
        allMatches.push({ full: m[0], names: m[1], isType: false });
      }
    }

    // Also handle multi-line imports
    const multiLineRe = new RegExp(
      `import\\s+type\\s*\\{[^}]*\\n[^}]*\\}\\s*from\\s*["'][^"']*contracts/${interfaceName}["'];?`,
      'gs'
    );
    while ((m = multiLineRe.exec(cc)) !== null) {
      if (!allMatches.find(x => x.full === m[0])) {
        // Extract names from multi-line
        const namesBlock = m[0].match(/\{([\s\S]*?)\}/);
        if (namesBlock) {
          allMatches.push({ full: m[0], names: namesBlock[1], isType: true });
        }
      }
    }

    for (const imp of allMatches) {
      const importedNames = imp.names.split(',').map(n => n.trim()).filter(Boolean);
      const hasIface = importedNames.includes(interfaceName);
      const typeNames = importedNames.filter(n => n !== interfaceName);

      // Build replacement import(s)
      let replacement = '';
      if (typeNames.length > 0) {
        // Compute types.ts import path (replace IFoo with types in the from clause)
        const fromMatch = imp.full.match(/from\s*["']([^"']+)["']/);
        if (fromMatch) {
          const origPath = fromMatch[1];
          const typesPath = origPath.replace(new RegExp(interfaceName + '$'), 'types');
          replacement = `import type { ${typeNames.join(', ')} } from "${typesPath}";`;
        }
      }
      // If only the interface was imported, replacement is empty (remove the line)
      cc = cc.replace(imp.full, replacement);
    }

    // Remove `implements IFoo`
    if (cc.includes(`implements ${interfaceName}`)) {
      // Handle: `extends Base implements IFoo {`
      cc = cc.replace(
        new RegExp(`(\\S)\\s+implements\\s+${interfaceName}\\s*\\{`, 'g'),
        '$1 {'
      );
      // Handle: standalone `implements IFoo` possibly on its own line
      cc = cc.replace(
        new RegExp(`\\n\\s*implements\\s+${interfaceName}\\s*$`, 'gm'),
        ''
      );
      implementsRemovedCount++;
    }

    // Check if any non-import line still references the interface name
    const cLines = cc.split('\n');
    let needsConcreteImport = false;
    for (let i = 0; i < cLines.length; i++) {
      if (cLines[i].trim().startsWith('import')) continue;
      if (new RegExp(`\\b${interfaceName}\\b`).test(cLines[i])) {
        // Replace interface references with concrete class
        cLines[i] = cLines[i].replace(new RegExp(`\\b${interfaceName}\\b`, 'g'), concreteName);
        needsConcreteImport = true;
      }
    }
    cc = cLines.join('\n');

    // If this is a getter file, it should already have the concrete class import
    // If not, add one
    if (needsConcreteImport && !cc.includes(`{ ${concreteName} }`) && !cc.includes(`{ ${concreteName},`)) {
      // Determine the import path
      // The concrete class is at implementations/ConcreteName.ts
      // But some have different file names, so use the implements grep result
      const implFile = ifaceFile
        .replace('/contracts/', '/implementations/')
        .replace(interfaceName + '.ts', concreteName + '.ts');

      // Check if consumer uses $lib paths or relative paths
      const usesLibPaths = cc.includes('$lib/');
      let importPath;
      if (usesLibPaths) {
        importPath = implFile.replace('src/lib/', '$lib/').replace('.ts', '');
      } else {
        const consumerDir = dirname(consumer).replace(/\\/g, '/');
        const implDir = dirname(implFile).replace(/\\/g, '/');
        let rel = posix.relative(consumerDir, implDir);
        if (!rel.startsWith('.')) rel = './' + rel;
        importPath = rel + '/' + concreteName;
      }

      const importLine = `import type { ${concreteName} } from "${importPath}";`;
      const lines2 = cc.split('\n');
      let lastImp = -1;
      for (let i = 0; i < lines2.length; i++) {
        if (lines2[i].trimStart().startsWith('import ')) lastImp = i;
      }
      if (lastImp >= 0) {
        lines2.splice(lastImp + 1, 0, importLine);
      }
      cc = lines2.join('\n');
    }

    // Check if this is a getter - if so, count it
    if (consumer.includes('get') && !consumer.includes('implementations') && cc !== orig) {
      // Verify it actually had interface type references that we changed
      if (orig.includes(`: ${interfaceName}`) || orig.includes(interfaceName)) {
        gettersUpdatedCount++;
      }
    }

    // Clean up double blank lines
    cc = cc.replace(/\n{3,}/g, '\n\n');

    if (cc !== orig) {
      writeFileSync(absConsumer, cc, 'utf8');
      filesModified.add(consumer);
    }
  }

  // --- Step C: Delete the interface file ---
  unlinkSync(absIfaceFile);
  interfacesDeletedCount++;
  console.log(`DELETED: ${ifaceFile} (${coExportedTypeNames.length} co-exported types moved)`);
}

// --- Step D: Clean up empty contracts directories ---
const contractsDirs = new Set(INTERFACE_FILES.map(f => dirname(f)));
for (const dir of contractsDirs) {
  const absDir = join(ROOT, dir);
  if (existsSync(absDir)) {
    const remaining = readdirSync(absDir);
    if (remaining.length === 0) {
      rmdirSync(absDir);
      console.log(`REMOVED empty dir: ${dir}`);
    } else {
      console.log(`KEPT dir (${remaining.length} files): ${dir} -> ${remaining.join(', ')}`);
    }
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Interfaces deleted: ${interfacesDeletedCount}`);
console.log(`Implements removed: ${implementsRemovedCount}`);
console.log(`Getters updated: ${gettersUpdatedCount}`);
console.log(`Files modified: ${filesModified.size}`);
