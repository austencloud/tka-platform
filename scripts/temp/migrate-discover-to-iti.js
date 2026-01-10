/**
 * Automated migration script: Inversify → ITI for discover module
 * Migrates all files in src/lib/features/discover/
 */

const fs = require('fs');
const path = require('path');

const DISCOVER_DIR = path.join(__dirname, '../../src/lib/features/discover');

// Mapping of Inversify TYPES to ITI container.items names
const TYPE_TO_CONTAINER_MAPPING = {
  'TYPES.IDiscoverLoader': 'container.items.discoverLoader',
  'TYPES.IDiscoverFilter': 'container.items.discoverFilter',
  'TYPES.IDiscoverSorter': 'container.items.discoverSorter',
  'TYPES.INavigator': 'container.items.navigator',
  'TYPES.ISectionManager': 'container.items.discoverSectionManager',
  'TYPES.IFavoritesManager': 'container.items.favoritesManager',
  'TYPES.ILibraryRepository': 'container.items.libraryRepository',
  'TYPES.IUserRepository': 'container.items.userRepository',
  'TYPES.ICollectionManager': 'container.items.collectionManager',
  'TYPES.IHapticFeedback': 'container.items.hapticFeedback',
  'TYPES.IDiscoverThumbnailProvider': 'container.items.discoverThumbnailProvider',
  'TYPES.ISheetRouter': 'container.items.sheetRouter',
  'TYPES.IOptimizedDiscoverer': 'container.items.optimizedDiscoverer',
  'TYPES.IDiscoverCache': 'container.items.discoverCache',
  'TYPES.IDiscoverSectionManager': 'container.items.discoverSectionManager',
  'TYPES.IVariationGrouper': 'container.items.variationGrouper',
  'TYPES.IDiscoverThumbnailCache': 'container.items.discoverThumbnailCache',
  'TYPES.IThumbnailRenderOrchestrator': 'container.items.thumbnailRenderOrchestrator',
  'TYPES.IDiscoverDeleter': 'container.items.discoverDeleter',
  'TYPES.IDiscoverEventHandler': 'container.items.discoverEventHandler',
  'TYPES.ISequenceDifficultyCalculator': 'container.items.sequenceDifficultyCalculator',
};

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.svelte')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Skip if already migrated (contains "from \"$lib/shared/di\"")
  if (content.includes('from "$lib/shared/di"')) {
    return false;
  }

  // Only process files that import from inversify
  if (!content.includes('from "$lib/shared/inversify')) {
    return false;
  }

  console.log(`Migrating: ${path.relative(DISCOVER_DIR, filePath)}`);

  // Replace import statements
  content = content.replace(
    /import\s+{\s*resolve\s*,\s*loadFeatureModule\s*,\s*TYPES\s*}\s+from\s+['"]\$lib\/shared\/inversify\/di['"];?/g,
    'import { container } from "$lib/shared/di";'
  );

  content = content.replace(
    /import\s+{\s*resolve\s*,\s*loadFeatureModule\s*}\s+from\s+['"]\$lib\/shared\/inversify\/di['"];?/g,
    'import { container } from "$lib/shared/di";'
  );

  content = content.replace(
    /import\s+{\s*resolve\s*,\s*tryResolve\s*}\s+from\s+['"]\$lib\/shared\/inversify\/di['"];?/g,
    'import { container } from "$lib/shared/di";'
  );

  content = content.replace(
    /import\s+{\s*resolve\s*}\s+from\s+['"]\$lib\/shared\/inversify\/di['"];?/g,
    'import { container } from "$lib/shared/di";'
  );

  content = content.replace(
    /import\s+{\s*tryResolve\s*}\s+from\s+['"]\$lib\/shared\/inversify\/di['"];?/g,
    'import { container } from "$lib/shared/di";'
  );

  // Remove TYPES import if it exists on separate line
  content = content.replace(
    /import\s+{\s*TYPES\s*}\s+from\s+['"]\$lib\/shared\/inversify\/types['"];?\n?/g,
    ''
  );

  // Replace resolve and tryResolve calls
  for (const [typesKey, containerPath] of Object.entries(TYPE_TO_CONTAINER_MAPPING)) {
    // Pattern: resolve<Type>(TYPES.X)
    const resolvePattern = new RegExp(
      `resolve<[^>]+>\\(${typesKey.replace(/\./g, '\\.')}\\)`,
      'g'
    );
    content = content.replace(resolvePattern, containerPath);

    // Pattern: tryResolve<Type>(TYPES.X)
    const tryResolvePattern = new RegExp(
      `tryResolve<[^>]+>\\(${typesKey.replace(/\./g, '\\.')}\\)`,
      'g'
    );
    content = content.replace(tryResolvePattern, containerPath);
  }

  // Remove loadFeatureModule calls (no longer needed with ITI)
  content = content.replace(
    /await\s+Promise\.all\(\[\s*loadFeatureModule\([^)]+\),?\s*\]\);?\n?/g,
    ''
  );

  content = content.replace(
    /await\s+loadFeatureModule\([^)]+\);?\n?/g,
    ''
  );

  // Clean up extra blank lines
  content = content.replace(/\n\n\n+/g, '\n\n');

  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

// Main execution
const files = getAllFiles(DISCOVER_DIR);
let migratedCount = 0;

files.forEach(file => {
  if (migrateFile(file)) {
    migratedCount++;
  }
});

console.log(`\nMigration complete: ${migratedCount} files migrated`);
