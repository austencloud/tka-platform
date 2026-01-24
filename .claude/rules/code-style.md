# Code Style & Architecture

## File Size & Composition Philosophy

This project follows a **2026+ AI-assisted development approach**:

- **Single responsibility per file** - each file does one thing well
- **Composition over consolidation** - build features by composing small services
- **Don't warn about "too many files"** - AI navigation makes file count a non-issue
- **Extract when there are multiple responsibilities** - not to hit arbitrary line counts
- **Service-based architecture** - logic lives in services, components orchestrate

---

## ⛔ DEPENDENCY INJECTION IS DEPRECATED ⛔

**The ITI dependency injection container is being phased out. Do NOT create new DI-registered services.**

### Why DI is being removed:

1. **HMR pain** - Any change to a container or its dependencies triggers full container rebuilds, causing 5+ second refresh delays during development
2. **Unnecessary complexity** - For a single-developer project, DI's "swap implementations" benefit never materialized
3. **Indirection tax** - `container.items.serviceName` is harder to trace than direct imports
4. **Circular dependency hell** - Container layering to avoid circular deps added massive complexity

### The new pattern: Direct Singleton Exports

Instead of registering services in containers, export singleton instances directly:

```typescript
// services/implementations/MyService.ts
import type { IMyService } from '../contracts/IMyService';
import { otherService } from '../other/OtherService';

export class MyService implements IMyService {
  doThing(): void { /* ... */ }
}

// Direct singleton export at bottom of file
export const myService = new MyService();
```

```typescript
// Usage - direct import, no container
import { myService } from '$lib/path/to/MyService';

myService.doThing();
```

### Migration status:

The following containers are being eliminated one by one:
- `pictograph-container.ts` - **IN PROGRESS** (core services migrated)
- All other containers - **PENDING**

### If you encounter `container.items.X`:

1. Check if that service already has a direct export
2. If yes, replace with direct import
3. If no, add a direct singleton export to the service file, then use direct import

### NEVER do this anymore:

```typescript
// ❌ OLD PATTERN - DO NOT USE
import { container } from "$lib/shared/di";
const myService = container.items.myService;

// ❌ DO NOT CREATE NEW CONTAINERS
export const myContainer = createContainer()
  .add({ myService: () => new MyService() });
```

### Always do this instead:

```typescript
// ✅ NEW PATTERN - Direct imports
import { myService } from "$lib/path/to/MyService";
```

---

## NEVER Create Utility Files or Hooks

**Logic lives in service classes, not loose functions.**

### What NOT to create:

- `utils/` folders or files (e.g., `utils/deriveWord.ts`)
- `helpers/` folders or files
- `hooks/` folders or files (this isn't React)
- Standalone pure functions in random files

### What to create instead:

1. **Interface** in `services/contracts/IServiceName.ts`
2. **Implementation** in `services/implementations/ServiceName.ts`
3. **Direct singleton export** at the bottom of the implementation file

### Service Pattern Example:

```typescript
// services/contracts/IWordDeriver.ts
export interface IWordDeriver {
  deriveWord(steps: StepData[]): string;
}

// services/implementations/WordDeriver.ts
import type { IWordDeriver } from '../contracts/IWordDeriver';

export class WordDeriver implements IWordDeriver {
  deriveWord(steps: StepData[]): string {
    return steps.map(s => s.letter).join('');
  }
}

// Direct singleton export
export const wordDeriver = new WordDeriver();
```

### Why keep interfaces?

- Documentation of the service's contract
- Enables mocking in tests if needed
- Self-documenting API surface

### If you think you need a utility:

You actually need a service class with a direct singleton export.

---

## Why this matters for AI-assisted development:

- Smaller files = smaller context windows = faster, cheaper, more accurate AI assistance
- Git diffs are cleaner and easier to review
- Each file is fully readable in one screen
- Easier to test, modify, and reason about in isolation
- When user says "fix X", AI can read one focused file instead of hunting through 500 lines
- **Direct imports = instant HMR** instead of waiting for container rebuilds

### What's NOT a good split:

- Re-export files that just forward imports
- Wrapper components that add no logic
- Splitting cohesive logic across files just to reduce line count

---

## Import Strategy: No Barrel Exports

**CRITICAL: Never use barrel exports (index.ts files that re-export other modules).**

**Why we removed them:**

- Barrel exports cause massive bundle bloat in Vite
- Importing one item from a barrel loads and evaluates the entire barrel
- Network requests skyrocket (especially in dev mode)
- Tree-shaking doesn't work reliably with re-exports
- Harder to trace dependencies

**What to do instead:**

- **Always import directly from source files** using relative paths
- Example: `import { MyComponent } from '../../components/MyComponent.svelte'`
- NOT: `import { MyComponent } from '../../components'`

**Rules:**

- Never create `index.ts` files in `src/` directory
- If you see an `index.ts` that re-exports, flag it for removal
- Direct imports are more verbose but vastly better for performance
- IDEs handle relative imports just fine with autocomplete

---

## Svelte 5

- Use **runes** (`$state`, `$derived`, `$effect`) not legacy reactive syntax
- Use `$props()` with TypeScript interfaces
- Prefer `$derived` over `$effect` when computing values

---

## State Management

- Use **context + runes** for shared state, not stores
- **Direct singleton imports** for services (NOT `container.items.X`)
- Settings persisted to Firebase with optimistic local updates

---

## TypeScript

- Strict types enabled
- Prefer explicit over implicit
- Small, focused functions
- Descriptive names over comments
