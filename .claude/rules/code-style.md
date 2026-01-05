# Code Style & Architecture

## File Size & Composition Philosophy

This project follows a **2026+ AI-assisted development approach**:

- **Single responsibility per file** - each file does one thing well
- **Composition over consolidation** - build features by composing small services
- **Don't warn about "too many files"** - AI navigation makes file count a non-issue
- **Extract when there are multiple responsibilities** - not to hit arbitrary line counts
- **Service-based architecture** - logic lives in services, components orchestrate

### Why this matters for AI-assisted development:

- Smaller files = smaller context windows = faster, cheaper, more accurate AI assistance
- Git diffs are cleaner and easier to review
- Each file is fully readable in one screen
- Easier to test, modify, and reason about in isolation
- When user says "fix X", AI can read one focused file instead of hunting through 500 lines

### What's NOT a good split:

- Re-export files that just forward imports
- Wrapper components that add no logic
- Splitting cohesive logic across files just to reduce line count
- Utility functions that belong together (e.g., string utils can live in one file)

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
- Services resolved via inversify DI container
- Settings persisted to Firebase with optimistic local updates

---

## TypeScript

- Strict types enabled
- Prefer explicit over implicit
- Small, focused functions
- Descriptive names over comments
