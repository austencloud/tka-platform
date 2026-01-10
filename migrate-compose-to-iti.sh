#!/bin/bash

# Script to migrate compose feature from Inversify to ITI

# Find all TypeScript and Svelte files in compose that import from inversify
files=$(find "F:/_THE KINETIC ALPHABET/_TKA-SCRIBE/src/lib/features/compose" -type f \( -name "*.ts" -o -name "*.svelte" \) -exec grep -l "from.*inversify" {} \; 2>/dev/null)

for file in $files; do
    echo "Processing: $file"

    # Skip inversify folder itself
    if [[ "$file" == *"/inversify/"* ]]; then
        echo "  Skipping inversify folder"
        continue
    fi

    # Step 1: Replace import statements
    # Replace: import { resolve } from "$lib/shared/inversify/di";
    # With:    import { container } from "$lib/shared/di";
    sed -i 's/import { resolve } from "\$lib\/shared\/inversify\/di";/import { container } from "\$lib\/shared\/di";/g' "$file"

    # Replace: import { resolve } from "$lib/shared/inversify/resolve-utils";
    # With:    import { container } from "$lib/shared/di";
    sed -i 's/import { resolve } from "\$lib\/shared\/inversify\/resolve-utils";/import { container } from "\$lib\/shared\/di";/g' "$file"

    # Remove TYPES import line entirely
    sed -i '/import { TYPES } from "\$lib\/shared\/inversify\/types";/d' "$file"
    sed -i '/import { TYPES } from "\$lib\/shared\/inversify\/types\/index";/d' "$file"

    # Step 2: Replace resolve() calls with container.items.*
    # Pattern: resolve<IServiceName>(TYPES.IServiceName) → container.items.serviceName

    # Common services in compose:
    sed -i 's/resolve<IURLSyncer>(TYPES\.IURLSyncer)/container.items.urlSyncer/g' "$file"
    sed -i 's/resolve<IDeepLinker>(TYPES\.IDeepLinker)/container.items.deepLinker/g' "$file"
    sed -i 's/resolve<ISettingsState>(TYPES\.ISettingsState)/container.items.settingsState/g' "$file"
    sed -i 's/resolve<IDeviceDetector>(TYPES\.IDeviceDetector)/container.items.deviceDetector/g' "$file"
    sed -i 's/resolve<IHapticFeedback>(TYPES\.IHapticFeedback)/container.items.hapticFeedback/g' "$file"
    sed -i 's/resolve<IDiscoverFilter>(TYPES\.IDiscoverFilter)/container.items.discoverFilter/g' "$file"
    sed -i 's/resolve<IDiscoverLoader>(TYPES\.IDiscoverLoader)/container.items.discoverLoader/g' "$file"
    sed -i 's/resolve<IDiscoverSorter>(TYPES\.IDiscoverSorter)/container.items.discoverSorter/g' "$file"
    sed -i 's/resolve<IDiscoverThumbnailProvider>(TYPES\.IDiscoverThumbnailProvider)/container.items.discoverThumbnailProvider/g' "$file"
    sed -i 's/resolve<IStartPositionDeriver>(TYPES\.IStartPositionDeriver)/container.items.startPositionDeriver/g' "$file"
    sed -i 's/resolve<ISVGGenerator>(TYPES\.ISVGGenerator)/container.items.svgGenerator/g' "$file"
    sed -i 's/resolve<IAnimationPlaybackController>(TYPES\.IAnimationPlaybackController)/container.items.animationPlaybackController/g' "$file"
    sed -i 's/resolve<ISequenceAnimationOrchestrator>(TYPES\.ISequenceAnimationOrchestrator)/container.items.sequenceAnimationOrchestrator/g' "$file"
    sed -i 's/resolve<IAnimationRenderer>(TYPES\.IAnimationRenderer)/container.items.canvas2dAnimationRenderer/g' "$file"

    echo "  Done"
done

echo "Migration complete!"
