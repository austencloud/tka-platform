# Mobile PWA Components and Utilities

This directory contains components and utilities for PWA (Progressive Web App) installation and mobile-specific features.

## Directory Structure

```
mobile/
├── components/           # Svelte components
│   ├── EnhancedPWAInstallGuide.svelte    # Main PWA installation guide (refactored)
│   ├── PlatformInstructions.svelte       # Instruction orchestrator
│   ├── InstructionStep.svelte            # Single step display
│   ├── PWAInstallGuide.svelte            # Legacy PWA guide
│   ├── SubtleInstallBanner.svelte        # Subtle banner prompt
│   ├── MobileFullscreenPrompt.svelte     # Fullscreen prompt
│   └── FullscreenHint.svelte             # Fullscreen hint
│
├── config/               # Configuration files
│   └── pwa-install-instructions.ts       # Platform-specific instructions config
│
├── utils/                # Utility functions and composables
│   ├── platform-detection.service.ts     # Platform/browser detection
│   └── viewport-measurement.svelte.ts    # Viewport measurement utility
│
└── services/             # Business logic services
    ├── contracts/        # Service interfaces
    └── implementations/  # Service implementations
```

## Quick Start

### Using EnhancedPWAInstallGuide

```svelte
<script lang="ts">
  import EnhancedPWAInstallGuide from "$lib/shared/mobile/components/EnhancedPWAInstallGuide.svelte";

  let showGuide = $state(false);

  function openInstallGuide() {
    showGuide = true;
  }
</script>

<button onclick={openInstallGuide}>Install App</button>
<EnhancedPWAInstallGuide bind:showGuide />
```

### Using Platform Detection

```typescript
import {
  detectPlatformAndBrowser,
  supportsPWAInstall,
} from "$lib/shared/mobile/utils/platform-detection.service";

// Detect user's platform and browser
const { platform, browser } = detectPlatformAndBrowser();

// Check if PWA installation is supported
if (supportsPWAInstall(platform, browser)) {
  // Show install prompt
}
```

### Using Viewport Measurement

```svelte
<script lang="ts">
  import { createViewportMeasurement } from "$lib/shared/mobile/utils/viewport-measurement.svelte";

  const viewport = createViewportMeasurement();
</script>

<div bind:this={viewport.sheetElement}>
  <div
    bind:this={viewport.contentElement}
    class:compact={viewport.needsCompactMode}
  >
    <!-- Your content here -->
  </div>
</div>
```

### Getting Install Instructions

```typescript
import { getInstallInstructions } from "$lib/shared/mobile/config/pwa-install-instructions";
import type {
  Platform,
  Browser,
} from "$lib/shared/mobile/config/pwa-install-instructions";

const platform: Platform = "ios";
const browser: Browser = "safari";

const instructions = getInstallInstructions(platform, browser);
// instructions.title
// instructions.steps
// instructions.benefits
```

## Components

### EnhancedPWAInstallGuide

**Purpose**: Full-featured PWA installation guide with platform-specific instructions

**Props**:

- `showGuide: boolean` (bindable) - Controls visibility

**Features**:

- Automatic platform/browser detection
- Platform-specific installation instructions
- Responsive layout with compact mode
- Glass morphism styling
- Animations and transitions
- Screenshot placeholders

**Example**:

```svelte
<EnhancedPWAInstallGuide bind:showGuide={showPWAGuide} />
```

### PlatformInstructions

**Purpose**: Displays platform-specific instructions and benefits

**Props**:

- `instructions: InstallInstructions` - Instruction configuration
- `compact?: boolean` - Enable compact mode

**Example**:

```svelte
<PlatformInstructions {instructions} {compact} />
```

### InstructionStep

**Purpose**: Displays a single instruction step

**Props**:

- `step: InstructionStep` - Step configuration
- `index: number` - Step number (0-indexed)
- `compact?: boolean` - Enable compact mode

**Example**:

```svelte
<InstructionStep {step} index={0} {compact} />
```

## Utilities

### platform-detection.service.ts

**Exports**:

- `detectPlatformAndBrowser(): PlatformInfo` - Detect platform and browser
- `supportsPWAInstall(platform, browser): boolean` - Check PWA support
- `getBrowserDisplayName(browser): string` - Get friendly browser name
- `getPlatformDisplayName(platform): string` - Get friendly platform name

**Types**:

- `Platform`: "ios" | "android" | "desktop"
- `Browser`: "chrome" | "safari" | "edge" | "firefox" | "samsung" | "other"
- `PlatformInfo`: { platform: Platform, browser: Browser }

### viewport-measurement.svelte.ts

**Exports**:

- `createViewportMeasurement(options?): ViewportMeasurement` - Create measurement manager

**Options**:

- `onMeasure?: (needsCompact: boolean) => void` - Callback on measurement
- `initialDelay?: number` - Delay before first measurement (default: 100ms)

**Returns**:

- `sheetElement: HTMLElement | null` - Bind to sheet container
- `contentElement: HTMLElement | null` - Bind to scrollable content
- `needsCompactMode: boolean` - Whether compact mode is needed
- `measure(): void` - Manually trigger measurement

## Configuration

### pwa-install-instructions.ts

**Exports**:

- `getInstallInstructions(platform, browser): InstallInstructions` - Get instructions

**Types**:

```typescript
interface InstructionStep {
  text: string; // HTML string with formatting
  icon: string; // Font Awesome icon class
  image: string | null; // Screenshot path or null
}

interface InstallInstructions {
  title: string; // Guide title
  icon: string; // Font Awesome icon class
  steps: InstructionStep[]; // Installation steps
  benefits: string[]; // Benefits list
}
```

**Supported Platforms**:

- iOS + Safari ✅
- iOS + Other browsers (redirects to Safari)
- Android + Chrome ✅
- Android + Edge ✅
- Android + Samsung Internet ✅
- Desktop + Chrome ✅
- Desktop + Edge ✅
- Fallback for unsupported combinations

## Architecture

The EnhancedPWAInstallGuide component follows a layered architecture:

1. **Detection Layer**: Identifies user's platform and browser
2. **Configuration Layer**: Provides appropriate instructions
3. **Measurement Layer**: Determines layout needs
4. **Display Layer**: Renders the UI

This separation enables:

- Easy testing of individual layers
- Reusability of utilities
- Simple maintenance and updates
- Configuration-driven behavior

## Refactoring Notes

The EnhancedPWAInstallGuide was refactored from a 780-line monolithic component to a modular architecture:

- **Main component**: 281 lines (64% reduction)
- **Supporting files**: 5 files, 864 lines total
- **Duplication eliminated**: ~70% reduction in duplicated code
- **Functionality preserved**: 100% feature parity

See [REFACTORING_SUMMARY.md](../../../../REFACTORING_SUMMARY.md) for details.

## Testing

### Unit Tests

```typescript
// Test platform detection
import { detectPlatformAndBrowser } from "./utils/platform-detection.service";

// Test instructions retrieval
import { getInstallInstructions } from "./config/pwa-install-instructions";
```

### Component Tests

```typescript
// Test components in isolation
import { render } from "@testing-library/svelte";
import InstructionStep from "./components/InstructionStep.svelte";
```

### Integration Tests

```typescript
// Test full component
import EnhancedPWAInstallGuide from "./components/EnhancedPWAInstallGuide.svelte";
```

## Contributing

When adding new platforms or browsers:

1. Update `platform-detection.service.ts` detection logic
2. Add configuration to `pwa-install-instructions.ts`
3. Update type definitions if needed
4. Add tests for new platform/browser
5. Update documentation

## Resources

- [PWA Install Guide Architecture](../../../../docs/refactoring/enhanced-pwa-guide-architecture.md)
- [Refactoring Summary](../../../../REFACTORING_SUMMARY.md)
- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/what-are-runes)

---

**Last Updated**: 2025-10-30
**Maintainer**: Development Team
