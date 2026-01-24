# Code Style & Architecture

## File Size & Composition Philosophy

This project follows a **2026+ AI-assisted development approach**:

- **Single responsibility per file** - each file does one thing well
- **Composition over consolidation** - build features by composing small services
- **Don't warn about "too many files"** - AI navigation makes file count a non-issue
- **Extract when there are multiple responsibilities** - not to hit arbitrary line counts
- **Service-based architecture** - logic lives in services, components orchestrate

---

## Dependency Injection with ITI

**This project uses ITI (Isomorphic Type-safe IoC) for dependency injection.**

### Why DI:

1. **Testability** - Swap implementations for mocking
2. **Composition root** - All wiring in one place (`src/lib/shared/di/index.ts`)
3. **Explicit dependencies** - Services declare what they need
4. **Type safety** - ITI provides full TypeScript inference

### The Pattern

Services are registered in container files:

```typescript
// src/lib/shared/di/containers/yourmodule-container.ts
import { createContainer } from "iti";
import { YourService } from "$lib/features/your-module/services/implementations/YourService";

export function createYourModuleContainer(deps: YourModuleDeps) {
  return createContainer()
    .add({ yourService: () => new YourService(deps.someDep) });
}
```

Then consumed via the container:

```typescript
import { container } from "$lib/shared/di";

const myService = container.items.myService;
myService.doThing();
```

### Service Structure

Every service should:
1. Have an **interface** in `services/contracts/IServiceName.ts`
2. Have an **implementation** in `services/implementations/ServiceName.ts`
3. Be **registered** in the appropriate container

### Container Organization

Containers are organized by domain in `src/lib/shared/di/containers/`:
- `pictograph-container.ts` - Pictograph rendering services
- `core-container.ts` - Shared core services
- `data-container.ts` - Data loading/parsing
- etc.

The composition root (`src/lib/shared/di/index.ts`) wires all containers together.

---

## NEVER Create Utility Files or Hooks

**Logic lives in service classes registered in DI containers, not loose functions.**

### What NOT to create:

- `utils/` folders or files (e.g., `utils/deriveWord.ts`)
- `helpers/` folders or files
- `hooks/` folders or files (this isn't React)
- Standalone pure functions in random files

### What to create instead:

1. **Interface** in `services/contracts/IServiceName.ts`
2. **Implementation** in `services/implementations/ServiceName.ts`
3. **Registration** in the appropriate container

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

// In container:
.add({ wordDeriver: () => new WordDeriver() })
```

### Why interfaces?

- Documentation of the service's contract
- Enables mocking in tests
- Self-documenting API surface
- Type-safe dependency injection

### If you think you need a utility:

You actually need a service class registered in a DI container.

---

## Why this matters for AI-assisted development:

- Smaller files = smaller context windows = faster, cheaper, more accurate AI assistance
- Git diffs are cleaner and easier to review
- Each file is fully readable in one screen
- Easier to test, modify, and reason about in isolation
- When user says "fix X", AI can read one focused file instead of hunting through 500 lines

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

**Exception:** The DI container exports (`src/lib/shared/di/index.ts`) are fine because that's the composition root, not a barrel re-export.

---

## Svelte 5

- Use **runes** (`$state`, `$derived`, `$effect`) not legacy reactive syntax
- Use `$props()` with TypeScript interfaces
- Prefer `$derived` over `$effect` when computing values

---

## State Management

- Use **context + runes** for shared state, not stores
- Access services via `container.items.X` from the DI container
- Settings persisted to Firebase with optimistic local updates

---

## TypeScript

- Strict types enabled
- Prefer explicit over implicit
- Small, focused functions
- Descriptive names over comments
