# DI Architecture Migration: ITI Container → Module Singletons + createContext

**Date:** 2026-04-23
**Status:** Approved
**Scope:** Replace the ITI-based DI container system with module-level singleton getters and Svelte 5 `createContext()` for component-scoped services.

---

## Problem Statement

The current DI system (`src/lib/shared/di/index.ts`) has hit structural ceilings:

- **ITI's generic inference breaks at ~20 chained `.add()` calls**, forcing `buildAppContainer()` to return `any` and requiring a manually maintained 270-line type intersection file (`container-types.ts`) to recover type safety at the public boundary.
- **575-line index.ts** imports 60+ containers, manually gates 48 browser-only instantiations, handles naming conflicts via `upsert`, resolves circular dependencies via post-construction late-binding, and grows with every new feature.
- **Three-file tax per new service:** container file → index.ts composition → container-types.ts type intersection.
- **AI collaborators must trace 3 hops** to understand a service: consumer → one of 63 container files → index.ts composition → container-types.ts type.
- **No other large SvelteKit app uses this pattern.** The ecosystem converged on module singletons + context API.

## Target Architecture

### Two patterns, clear boundary

| Pattern | When to use | Lifetime | Example |
|---|---|---|---|
| **Module singleton getter** | App-wide services (most services) | App lifetime, lazy on first call | `getAuthenticator()`, `getSequenceRenderer()` |
| **Svelte 5 `createContext()`** | Component-scoped services (per-viewer, per-3D-scene, per-feature-instance) | Component tree lifetime, GC'd on unmount | `[getAnimationEngine, setAnimationEngine]` |

### Module singleton getter pattern

```typescript
// src/lib/shared/auth/getAuthenticator.ts
import { browser } from '$app/environment';
import type { IAuthenticator } from './services/contracts/IAuthenticator';
import { Authenticator } from './services/implementations/Authenticator';

let instance: IAuthenticator | null = null;

export function getAuthenticator(): IAuthenticator {
  if (!browser) throw new Error('getAuthenticator() is browser-only');
  return instance ??= new Authenticator(getFirebaseApp());
}
```

For heavy services that benefit from code-splitting, use an async getter variant:

```typescript
// src/lib/features/museum/getMuseumRenderer.ts
import { browser } from '$app/environment';
import type { IMuseumRenderer } from './services/contracts/IMuseumRenderer';

let instance: IMuseumRenderer | null = null;

export async function getMuseumRenderer(): Promise<IMuseumRenderer> {
  if (!browser) throw new Error('getMuseumRenderer() is browser-only');
  if (!instance) {
    const { MuseumRenderer } = await import('./services/implementations/MuseumRenderer');
    instance = new MuseumRenderer();
  }
  return instance;
}
```

Variation for SSR-safe services (no browser guard needed):

```typescript
// src/lib/shared/core/getWordDeriver.ts
import type { IWordDeriver } from './services/contracts/IWordDeriver';
import { WordDeriver } from './services/implementations/WordDeriver';

let instance: IWordDeriver | null = null;

export function getWordDeriver(): IWordDeriver {
  return instance ??= new WordDeriver();
}
```

### Svelte 5 createContext pattern

```typescript
// src/lib/shared/3d/animation-engine-context.ts
import { createContext } from 'svelte';
import type { IAnimationEngine } from './services/contracts/IAnimationEngine';

export const [getAnimationEngine, setAnimationEngine] = createContext<IAnimationEngine>();
```

```svelte
<!-- Parent: sets context -->
<script>
  import { setAnimationEngine } from '$lib/shared/3d/animation-engine-context';
  import { AnimationEngine } from '$lib/shared/3d/services/implementations/AnimationEngine';

  setAnimationEngine(new AnimationEngine(/* deps */));
</script>

<!-- Child: reads context -->
<script>
  import { getAnimationEngine } from '$lib/shared/3d/animation-engine-context';
  const engine = getAnimationEngine();
</script>
```

### Naming conventions

| Type | File name | Export name |
|---|---|---|
| Module singleton | `get<ServiceName>.ts` | `get<ServiceName>()` |
| Context pair | `<service-name>-context.ts` | `[get<ServiceName>, set<ServiceName>]` |
| SSR-safe singleton | `get<ServiceName>.ts` (no browser guard) | `get<ServiceName>()` |

### File location

Getters live next to the service they expose, inside the service's domain directory:

```
src/lib/shared/auth/
  services/
    contracts/IAuthenticator.ts
    implementations/Authenticator.ts
  getAuthenticator.ts          ← getter lives here

src/lib/features/browse/
  services/
    contracts/IBrowseLoader.ts
    implementations/BrowseLoader.ts
  getBrowseLoader.ts           ← getter lives here
```

Not in a central `di/` directory. The whole point is eliminating the central bottleneck.

## What Gets Deleted

After full migration:

| File | Lines | Purpose | Replacement |
|---|---|---|---|
| `src/lib/shared/di/index.ts` | 575 | Central composition | Eliminated — getters compose themselves |
| `src/lib/shared/di/container-types.ts` | 270 | Manual type intersection | Eliminated — TypeScript infers getter return types |
| `src/lib/shared/di/containers/*.ts` | 63 files | ITI container registrations | Each becomes 1-3 getter files in domain directories |
| `buildAppContainer()` | 110 lines | `any`-typed composition | Eliminated |
| `_timeContainer` profiler | 15 lines | Boot timing | Browser DevTools Performance tab |
| `src/lib/shared/di/lazy-container.ts` | — | Lazy loading utility | Dynamic `import()` inside async getters |
| `src/lib/shared/di/lazy-containers.ts` | — | Lazy container registry | Dynamic `import()` inside async getters |
| `clearAllRenderCaches()` | 10 lines | Cache clearing export | Moves to render domain |

**Total eliminated:** ~1,500+ lines of DI wiring infrastructure, the `iti` dependency, and the `any`-typed composition root.

## What Gets Preserved

- **Service interfaces** (`services/contracts/I*.ts`) — unchanged
- **Service implementations** (`services/implementations/*.ts`) — unchanged  
- **Lazy loading** for heavy features — dynamic `import()` inside getters replaces `lazy-containers.ts`
- **Boot profiling capability** — opt-in via individual getter instrumentation, not central wrapper

## Migration Strategy

### Coexistence during migration

Both systems work simultaneously. A getter can call `container.items.foo` internally during transition:

```typescript
// Temporary bridge during migration
import { container } from '$lib/shared/di';

let instance: IFoo | null = null;
export function getFoo(): IFoo {
  return instance ??= container.items.foo;
}
```

Consumers switch to `getFoo()`. Once all consumers of `foo` use the getter, the container registration is removed. No big-bang cutover.

### Migration order

1. **Leaf services first** — services with no dependencies on other container services (DeviceDetector, ViewportManager, WordDeriver). Already module singletons wrapped in ITI.
2. **Pictograph services** — 12 services on lines 45-57 of index.ts already imported as module singletons. Remove the ITI wrapping.
3. **Core container** — infrastructure services other containers depend on.
4. **Feature containers** — one domain at a time (browse, create, compose, etc.).
5. **Factory containers with cross-deps** — navigation, render, share (these have the most inter-container wiring).
6. **Delete index.ts, container-types.ts, iti dependency** — final cleanup.

### Consumer migration pattern

```typescript
// Before
import { container } from '$lib/shared/di';
const renderer = container.items.sequenceRenderer;

// After
import { getSequenceRenderer } from '$lib/shared/render/getSequenceRenderer';
const renderer = getSequenceRenderer();
```

## Circular Dependencies

### How they're handled today

One known circular dep: `imageComposer` ↔ `qrCodeGenerator`. Resolved via post-construction `setQRCodeGenerator()` call in index.ts (line 547).

### How module singletons handle them

Lazy `??=` naturally breaks simple cycles:

```typescript
// getImageComposer.ts
export function getImageComposer(): IImageComposer {
  return instance ??= new ImageComposer(/* no qr dep in constructor */);
}

// Post-init wiring (called once at app startup)
export function wireImageComposerQR(): void {
  getImageComposer().setQRCodeGenerator(getQRCodeGenerator());
}
```

The `wireImageComposerQR()` call moves to the app's root `+layout.svelte` `onMount`, which is the natural composition root in SvelteKit.

For true circular constructor deps (A needs B, B needs A at construction time): refactor to break the cycle. This is the correct fix regardless of DI approach.

## Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Circular deps become runtime errors instead of composition-time | Medium | Static analysis pass during migration to map dep graph; break true cycles via refactoring |
| 120+ consumer files change | Low-medium | Incremental migration, one domain at a time, both systems coexist |
| No single file shows full service graph | Low | Import graph IS the service graph; `grep -r "export function get" src/lib/` reconstructs it |
| Testing with service doubles needs `vi.mock()` | Low | Tests already don't use container; pure function testing unchanged |
| No centralized boot profiling | Low | Browser DevTools Performance tab; opt-in timing in individual getters |
| Context vs singleton decision requires discipline | Low | Clear naming convention: `getFoo()` = singleton, `[getFoo, setFoo] = createContext()` = scoped |

## Success Criteria

- [ ] `iti` removed from `package.json`
- [ ] `src/lib/shared/di/index.ts` deleted
- [ ] `src/lib/shared/di/container-types.ts` deleted
- [ ] `src/lib/shared/di/containers/` directory deleted
- [ ] Zero `container.items.` references in codebase
- [ ] Zero `as any` casts in DI-related code
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds
- [ ] All existing tests pass
- [ ] Boot time equal or better (measure before/after)

## Non-Goals

- Adopting Effect, Inversify, or any other DI library
- Changing service interfaces or implementations (only how they're accessed)
- Refactoring service internals during this migration
- Adding new testing patterns (existing test approach unchanged)
