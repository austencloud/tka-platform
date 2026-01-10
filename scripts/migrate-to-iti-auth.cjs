const fs = require('fs');
const path = require('path');

// File paths to migrate
const files = [
  'src/lib/shared/auth/components/EmailLinkingDrawer.svelte',
  'src/lib/shared/auth/components/GoogleOneTap.svelte',
  'src/lib/shared/auth/components/LandingPage.svelte',
  'src/lib/shared/auth/services/implementations/Impersonator.ts',
  'src/lib/shared/auth/state/authState.svelte.ts',
  'src/lib/shared/application/components/MainApplication.svelte',
  'src/lib/shared/application/state/auto-sync-state.svelte.ts',
  'src/lib/shared/application/state/services.svelte.ts',
  'src/lib/shared/device/services/implementations/GeoLocationProvider.ts',
  'src/lib/shared/foundation/ui/ConfirmDialog.svelte',
  'src/lib/shared/foundation/ui/drawer/useDrawer.ts',
  'src/lib/shared/foundation/ui/Drawer.svelte',
  'src/lib/shared/foundation/ui/ErrorScreen.svelte',
];

// Service name mappings (TYPES.X → container.items.x)
const serviceMappings = {
  'TYPES.IAuthenticator': 'container.items.authenticator',
  'TYPES.IAccountManager': 'container.items.accountManager',
  'TYPES.IUserDocumentManager': 'container.items.userDocumentManager',
  'TYPES.IProfilePictureManager': 'container.items.profilePictureManager',
  'TYPES.IDeviceDetector': 'container.items.deviceDetector',
  'TYPES.IViewportManager': 'container.items.viewportManager',
  'TYPES.IGeoLocationProvider': 'container.items.geoLocationProvider',
  'TYPES.IWordDeriver': 'container.items.wordDeriver',
  'TYPES.IStorageManager': 'container.items.storageManager',
  'TYPES.IFileDownloader': 'container.items.fileDownloader',
  'TYPES.ISeoManager': 'container.items.seoManager',
  'TYPES.ISvgImageConverter': 'container.items.svgImageConverter',
  'TYPES.IErrorHandler': 'container.items.errorHandler',
  'TYPES.IHapticFeedback': 'container.items.hapticFeedback',
  'TYPES.IRippleEffect': 'container.items.rippleEffect',
  'TYPES.IApplicationInitializer': 'container.items.applicationInitializer',
  'TYPES.IUsernameValidator': 'container.items.usernameValidator',
  'TYPES.IActivityLogger': 'container.items.activityLogger',
  'TYPES.IPresenceTracker': 'container.items.presenceTracker',
  'TYPES.ICollectionManager': 'container.items.collectionManager',
  'TYPES.ISettingsState': 'container.items.settingsState',
  'TYPES.ISheetRouter': 'container.items.sheetRouter',
  'TYPES.IResponsiveLayoutManager': 'container.items.responsiveLayoutManager',
};

function migrateFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  console.log(`Migrating ${filePath}...`);

  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  // Replace import statements
  if (content.includes('from "../../inversify/di"') || content.includes("from '../../inversify/di'")) {
    content = content.replace(/import\s+{([^}]+)}\s+from\s+["']\.\.\/\.\.\/inversify\/di["'];?/g, 'import { container } from "../../di";');
    modified = true;
  }

  if (content.includes('from "../../inversify/types"') || content.includes("from '../../inversify/types'")) {
    content = content.replace(/import\s+{[^}]+}\s+from\s+["']\.\.\/\.\.\/inversify\/types["'];?/g, '');
    content = content.replace(/\n\n\n+/g, '\n\n'); // Clean up extra blank lines
    modified = true;
  }

  if (content.includes('from "../../inversify/resolve-utils"') || content.includes("from '../../inversify/resolve-utils'")) {
    content = content.replace(/import\s+{[^}]+}\s+from\s+["']\.\.\/\.\.\/inversify\/resolve-utils["'];?/g, '');
    content = content.replace(/\n\n\n+/g, '\n\n'); // Clean up extra blank lines
    modified = true;
  }

  if (content.includes('from "inversify"') || content.includes("from 'inversify'")) {
    content = content.replace(/import\s+{[^}]+}\s+from\s+["']inversify["'];?/g, '');
    content = content.replace(/\n\n\n+/g, '\n\n'); // Clean up extra blank lines
    modified = true;
  }

  // Replace resolve and tryResolve calls
  Object.entries(serviceMappings).forEach(([oldPattern, newPattern]) => {
    const patterns = [
      // resolve<T>(TYPES.X)
      new RegExp(`(?:await\\s+)?(?:resolve|tryResolve)<[^>]+>\\(\\s*${oldPattern.replace('.', '\\.')}\\s*\\)`, 'g'),
      // resolve(TYPES.X) as Type
      new RegExp(`(?:await\\s+)?(?:resolve|tryResolve)\\(\\s*${oldPattern.replace('.', '\\.')}\\s*\\)`, 'g'),
    ];

    patterns.forEach(pattern => {
      if (content.match(pattern)) {
        content = content.replace(pattern, newPattern);
        modified = true;
      }
    });
  });

  // Remove @injectable() decorator
  if (content.includes('@injectable()')) {
    content = content.replace(/@injectable\(\)\s*\n/g, '');
    modified = true;
  }

  // Special case: replace complex inversify/di dynamic imports in authState.svelte.ts
  if (filePath.includes('authState.svelte.ts')) {
    // Replace presence tracker initialization
    content = content.replace(
      /import\("\.\.\/\.\.\/inversify\/di"\)\s*\.then\(async \({ ensureContainerInitialized, tryResolve: resolve }\) => {[^}]+await ensureContainerInitialized\(\);[^}]+const presenceService = resolve<[^>]+>\(TYPES\.IPresenceTracker\);[^}]+if \(presenceService\) {[^}]+await presenceService\.initialize\(\);[^}]+}[^}]+}\)/s,
      `(async () => {
          try {
            const presenceService = container.items.presenceTracker;
            if (presenceService) {
              await presenceService.initialize();
            }
          } catch {
            // Presence may not be loaded yet
          }
        })()`
    );

    // Replace collection manager initialization
    content = content.replace(
      /import\("\$lib\/shared\/inversify\/di"\)\s*\.then\(async \({ loadFeatureModule, tryResolve }\) => {[^}]+await loadFeatureModule\("library"\);[^}]+const collectionService = tryResolve<[^>]+>\(TYPES\.ICollectionManager\);[^}]+if \(collectionService\?\.ensureSystemCollections\) {[^}]+await collectionService\.ensureSystemCollections\(\);[^}]+}[^}]+}\)/s,
      `(async () => {
          try {
            const collectionService = container.items.collectionManager;
            if (collectionService?.ensureSystemCollections) {
              await collectionService.ensureSystemCollections();
            }
          } catch {
            // Collection manager may not be loaded yet
          }
        })()`
    );

    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✓ Successfully migrated ${filePath}`);
  } else {
    console.log(`- No changes needed for ${filePath}`);
  }
}

// Migrate all files
files.forEach(migrateFile);

console.log('\n✓ Migration complete!');
