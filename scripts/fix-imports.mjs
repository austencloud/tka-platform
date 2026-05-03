import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename, posix } from 'path';
import { execSync } from 'child_process';
import { globSync } from 'fs';

const ROOT = 'E:/tka-platform';

const INTERFACES = [
  'IPostHogAnalyticsProvider',
  'IPostHogUserAnalytics',
  'IUserActivityTracker',
  'IMatchupSelector',
  'IStabilityAnalyzer',
  'IGridHitTargetCalculator',
  'ISvgPropAnimator',
  'INightSkyLabController',
  'IPreviewAnimationController',
  'IUFOStatusPoller',
  'IVariationGrouper',
  'IBrowseDataSource',
  'IBrowseEventHandler',
  'IOptimizedBrowser',
  'IFollowingFeedProvider',
  'IGeocodingService',
  'ILocationProvider',
  'IAudioStorageManager',
  'IArrangeCompositionConverter',
  'IArrangeGridSerializer',
  'IArrangeKeyboardHandler',
  'IArrangeLayerTransformer',
  'IArrangeUndoManager',
  'ICompositionLayoutCalculator',
  'ITimelinePlayer',
  'ITimelineSnapper',
  'ITimelineUndoManager',
  'IEffectPointsPersister',
  'IClaimStatusDeriver',
  'IFeedbackEditor',
  'IFeedbackQueryService',
  'IFeedbackTypeResolver',
  'IFormDraftPersister',
  'IImageStager',
  'ISwimLaneDeriver',
  'IVoiceRecorder',
  'IFestivalLoader',
  'ISequenceFuser',
  'IGalleryItemAdapter',
  'IScreenshotOrchestrator',
  'IScreenshotUploader',
  'IScreenshotUploadOrchestrator',
  'IStanceOptimizer',
  'IStanceSimulator',
  'IBroadcastRepository',
  'IEndlessSpinnerOrchestrator',
  'ILibraryRepository',
  'ILibrarySaveService',
  'IInteractionDetector',
  'IMuseumPersister',
  'IMuseumDesignValidator',
  'IMuseumGridBuilder',
  'IMuseumModelLoader',
  'IMuseumRoomSerializer',
  'IPlaqueTextureGenerator',
  'IRoomLifecycleManager',
  'IRoomStreamingManager',
  'ITileGridAnalyzer',
  'IWallSegmentStamper',
  'IPhraseInterpolator',
  'IEraRenderer',
  'IFakeLoadingManager',
  'IWindowManager',
  'IStickerSheetPdfExporter',
  'IConversationMemoryRetriever',
  'ITikaCapabilityLookup',
];

// Special cases where implementation file name differs from class name
const IMPL_FILE_OVERRIDES = {
  ITimelineSnapper: 'TimelineSnapService',
  ITimelinePlayer: 'TimelinePlaybackService',
  IFeedbackQueryService: 'FeedbackQuerier',
};

function getImplFileName(ifaceName) {
  if (IMPL_FILE_OVERRIDES[ifaceName]) return IMPL_FILE_OVERRIDES[ifaceName];
  return ifaceName.substring(1);
}

// Use PowerShell to find files containing any of our interface imports
function findAffectedFiles() {
  const pattern = INTERFACES.map(i => `contracts/${i}`).join('|');
  try {
    const output = execSync(
      `Get-ChildItem -Path "src" -Recurse -Include "*.ts","*.svelte" | Select-String -Pattern "contracts/(${pattern.replace(/\|/g, '|')})" -List | ForEach-Object { $_.Path }`,
      { cwd: ROOT, encoding: 'utf8', timeout: 30000, shell: 'powershell.exe' }
    ).trim();
    return output ? output.split('\n').map(f => f.trim().replace(/\\/g, '/').replace(ROOT.replace(/\\/g, '/') + '/', '').replace(/^E:\/tka-platform\//, '')) : [];
  } catch (e) {
    console.error('PowerShell search failed, falling back to manual scan');
    return [];
  }
}

let files = findAffectedFiles();
console.log(`Found ${files.length} files to process`);

// If PowerShell search failed, try building the list from known patterns
if (files.length === 0) {
  // Manually list all known affected files from the tsc output
  console.log('Using manual file list from known error patterns');
  // We know the patterns - every getter, every implementation, and cross-module consumers
  files = [];
  // Scan all .ts and .svelte files under src/ for references
  function walkDir(dir) {
    const entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
    for (const entry of entries) {
      const path = dir + '/' + entry.name;
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walkDir(path);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.svelte'))) {
        const content = readFileSync(join(ROOT, path), 'utf8');
        for (const ifaceName of INTERFACES) {
          if (content.includes(`contracts/${ifaceName}`)) {
            files.push(path);
            break;
          }
        }
      }
    }
  }
  walkDir('src');
  console.log(`Manual scan found ${files.length} files`);
}

let implementsRemovedCount = 0;
let gettersUpdatedCount = 0;
let totalFilesFixed = 0;

for (const file of files) {
  const absFile = join(ROOT, file);
  if (!existsSync(absFile)) continue;

  let content = readFileSync(absFile, 'utf8');
  const origContent = content;

  for (const ifaceName of INTERFACES) {
    // Skip if this file doesn't reference this interface
    if (!content.includes(`contracts/${ifaceName}`)) continue;

    const concreteName = ifaceName.substring(1);
    const implFileName = getImplFileName(ifaceName);

    // Match import lines referencing this interface - handle multi-line too
    // Strategy: find the import, extract names, rebuild

    // Multi-line pattern first (greedy match within braces across lines)
    const multiRe = new RegExp(
      `import\\s+type\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*["']([^"']*contracts\\/${ifaceName})["'];?`,
      'g'
    );

    let match;
    while ((match = multiRe.exec(content)) !== null) {
      const fullMatch = match[0];
      const namesStr = match[1];
      const fromPath = match[2];

      const importedNames = namesStr
        .split(',')
        .map(n => n.trim())
        .filter(Boolean);

      const hasInterface = importedNames.includes(ifaceName);
      const typeNames = importedNames.filter(n => n !== ifaceName);

      // Build the types.ts path
      const typesPath = fromPath.replace(new RegExp(ifaceName + '$'), 'types');

      let replacement = '';
      if (typeNames.length > 0) {
        replacement = `import type { ${typeNames.join(', ')} } from "${typesPath}";`;
      }

      content = content.replace(fullMatch, replacement);
      // Reset regex after content change
      multiRe.lastIndex = 0;
    }

    // Also try non-type imports
    const nonTypeRe = new RegExp(
      `import\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*["']([^"']*contracts\\/${ifaceName})["'];?`,
      'g'
    );

    while ((match = nonTypeRe.exec(content)) !== null) {
      const fullMatch = match[0];
      const namesStr = match[1];
      const fromPath = match[2];

      const importedNames = namesStr
        .split(',')
        .map(n => n.trim())
        .filter(Boolean);

      const hasInterface = importedNames.includes(ifaceName);
      const typeNames = importedNames.filter(n => n !== ifaceName);

      const typesPath = fromPath.replace(new RegExp(ifaceName + '$'), 'types');

      let replacement = '';
      if (typeNames.length > 0) {
        replacement = `import type { ${typeNames.join(', ')} } from "${typesPath}";`;
      }

      content = content.replace(fullMatch, replacement);
      nonTypeRe.lastIndex = 0;
    }

    // Now handle `implements IFoo` removal
    if (content.includes(`implements ${ifaceName}`)) {
      content = content.replace(
        new RegExp(`\\s+implements\\s+${ifaceName}`, 'g'),
        ''
      );
      implementsRemovedCount++;
    }

    // Check if the interface name is still used in non-import lines
    const lines = content.split('\n');
    let needsConcrete = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimStart().startsWith('import')) continue;
      if (new RegExp(`\\b${ifaceName}\\b`).test(lines[i])) {
        lines[i] = lines[i].replace(new RegExp(`\\b${ifaceName}\\b`, 'g'), concreteName);
        needsConcrete = true;
      }
    }
    content = lines.join('\n');

    // Add concrete class import if needed and not already present
    if (needsConcrete) {
      const hasConcreteImport = content.includes(`{ ${concreteName} }`) ||
                                 content.includes(`{ ${concreteName},`) ||
                                 content.includes(`, ${concreteName} }`) ||
                                 content.includes(`, ${concreteName},`);
      if (!hasConcreteImport) {
        // Find any remaining import from this feature to determine path style
        const firstFromMatch = origContent.match(/from\s*["']([^"']*contracts\/[^"']+)["']/);
        let importPath;
        if (firstFromMatch) {
          const origPath = firstFromMatch[1];
          importPath = origPath
            .replace(/contracts\/\w+$/, `implementations/${implFileName}`);
        } else {
          // Fallback: compute relative path
          importPath = `../implementations/${implFileName}`;
        }

        // Find the original import path for THIS specific interface
        const specificFromMatch = origContent.match(
          new RegExp(`from\\s*["']([^"']*contracts\\/${ifaceName})["']`)
        );
        if (specificFromMatch) {
          importPath = specificFromMatch[1]
            .replace('/contracts/', '/implementations/')
            .replace(new RegExp(ifaceName + '$'), implFileName);
        }

        const importLine = `import type { ${concreteName} } from "${importPath}";`;
        const cLines = content.split('\n');
        let lastImp = -1;
        for (let i = 0; i < cLines.length; i++) {
          if (cLines[i].trimStart().startsWith('import')) lastImp = i;
        }
        if (lastImp >= 0) {
          cLines.splice(lastImp + 1, 0, importLine);
        }
        content = cLines.join('\n');
      }
    }

    // Track getter updates
    if (file.includes('get') && !file.includes('implementations') && content !== origContent) {
      // Only count once per file
    }
  }

  // Clean up multiple blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  if (content !== origContent) {
    writeFileSync(absFile, content, 'utf8');
    totalFilesFixed++;

    // Count getter updates
    if (file.match(/\/get\w+\.(ts|svelte)$/)) {
      gettersUpdatedCount++;
    }

    console.log(`FIXED: ${file}`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Files fixed: ${totalFilesFixed}`);
console.log(`Implements removed: ${implementsRemovedCount}`);
console.log(`Getters updated: ${gettersUpdatedCount}`);
