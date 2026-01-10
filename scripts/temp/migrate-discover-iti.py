#!/usr/bin/env python3
"""
Automated migration script: Inversify → ITI for discover module
Migrates all files in src/lib/features/discover/
"""

import os
import re
from pathlib import Path

DISCOVER_DIR = Path(__file__).parent.parent.parent / "src" / "lib" / "features" / "discover"

# Mapping of Inversify TYPES to ITI container.items names
TYPE_MAPPINGS = {
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
    'TYPES.IThumbnailKeyDeriver': 'container.items.thumbnailKeyDeriver',
    'TYPES.ICloudThumbnailCache': 'container.items.discoverThumbnailCache',
    'TYPES.ICollaborativeVideoManager': 'container.items.collaborativeVideoManager',
    'TYPES.ILeaderboardManager': 'container.items.leaderboardManager',
}

def migrate_file(file_path):
    """Migrate a single file from Inversify to ITI"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Only process files that import from inversify
    if '$lib/shared/inversify' not in content:
        return False

    print(f"Migrating: {file_path.relative_to(DISCOVER_DIR)}")

    # Replace import statements - use raw strings and escape $ properly
    content = re.sub(
        r'import\s+\{\s*resolve\s*,\s*loadFeatureModule\s*,\s*TYPES\s*\}\s+from\s+["\'][$]lib/shared/inversify/di["\'];?',
        'import { container } from "$lib/shared/di";',
        content
    )
    content = re.sub(
        r'import\s+\{\s*resolve\s*,\s*loadFeatureModule\s*\}\s+from\s+["\'][$]lib/shared/inversify/di["\'];?',
        'import { container } from "$lib/shared/di";',
        content
    )
    content = re.sub(
        r'import\s+\{\s*resolve\s*,\s*tryResolve\s*\}\s+from\s+["\'][$]lib/shared/inversify/di["\'];?',
        'import { container } from "$lib/shared/di";',
        content
    )
    content = re.sub(
        r'import\s+\{\s*resolve\s*\}\s+from\s+["\'][$]lib/shared/inversify/di["\'];?',
        'import { container } from "$lib/shared/di";',
        content
    )
    content = re.sub(
        r'import\s+\{\s*tryResolve\s*\}\s+from\s+["\'][$]lib/shared/inversify/di["\'];?',
        'import { container } from "$lib/shared/di";',
        content
    )
    content = re.sub(
        r'import\s+\{\s*getContainerInstance\s*\}\s+from\s+["\'][$]lib/shared/inversify/di["\'];?',
        'import { container } from "$lib/shared/di";',
        content
    )

    # Remove TYPES import
    content = re.sub(
        r'import\s+\{\s*TYPES\s*\}\s+from\s+["\'][$]lib/shared/inversify/types["\'];?\n?',
        '',
        content
    )

    # Replace resolve and tryResolve calls
    for types_key, container_path in TYPE_MAPPINGS.items():
        escaped_key = re.escape(types_key)

        # Pattern: resolve<Type>(TYPES.X) or await resolve<Type>(TYPES.X)
        content = re.sub(
            rf'(?:await\s+)?resolve<[^>]+>\({escaped_key}\)',
            container_path,
            content
        )

        # Pattern: tryResolve<Type>(TYPES.X)
        content = re.sub(
            rf'tryResolve<[^>]+>\({escaped_key}\)',
            container_path,
            content
        )

        # Pattern: container.get<Type>(TYPES.X)
        content = re.sub(
            rf'container\.get<[^>]+>\({escaped_key}\)',
            container_path,
            content
        )

    # Remove getContainerInstance() usage
    content = re.sub(
        r'const\s+container\s*=\s*await\s+getContainerInstance\(\);?\n+',
        '',
        content
    )

    # Remove loadFeatureModule calls - multi-line version
    content = re.sub(
        r'await\s+Promise\.all\(\[\s*loadFeatureModule\([^)]+\),?\s*\]\);?\n+',
        '',
        content
    )
    content = re.sub(
        r'await\s+loadFeatureModule\([^)]+\);?\n+',
        '',
        content
    )

    # Clean up extra blank lines
    content = re.sub(r'\n\n\n+', '\n\n', content)

    # Only write if changed
    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    """Main migration function"""
    migrated_count = 0

    # Find all .ts and .svelte files
    for ext in ['*.ts', '*.svelte']:
        for file_path in DISCOVER_DIR.rglob(ext):
            if migrate_file(file_path):
                migrated_count += 1

    print(f"\nMigration complete: {migrated_count} files migrated")

if __name__ == "__main__":
    main()
