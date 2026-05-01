---
name: code-style
description: Use when writing or editing TypeScript/Svelte code in this project. Covers project-specific architectural decisions — module-level singleton getters, no utils/helpers directories, no barrel exports, and the conversational commenting style.
---

# TKA Code Style

Project-specific architectural decisions. Standard engineering wisdom (single responsibility, descriptive names, strict types) is assumed.

## Services: Module-Level Singleton Getters

Services are module-level singletons accessed via colocated getter functions. No DI containers, no `iti` package.

```typescript
// src/lib/shared/<domain>/getYourService.ts
import { YourService } from './services/implementations/YourService';

let instance: YourService | null = null;
export function getYourService(): YourService {
  if (!instance) instance = new YourService();
  return instance;
}

// consumer
import { getYourService } from '$lib/shared/<domain>/getYourService';
const myService = getYourService();
```

Every service: interface in `services/contracts/IName.ts`, implementation in `services/implementations/Name.ts`, getter in a colocated `get*.ts` file.

## Never Create Utility Files

No `utils/`, `helpers/`, or `hooks/` directories. No standalone pure functions in random files. If you think you need a utility, you need a service class with a singleton getter.

## No Barrel Exports

Never create `index.ts` files in `src/` that re-export other modules. Vite's bundle bloats dramatically — importing one item from a barrel loads and evaluates the entire barrel, tree-shaking fails, dev-mode network requests skyrocket. Always import directly from source files using relative paths.

## Commenting Style

Write comments as if explaining to someone who uses the app but doesn't write code. Say what the user would observe, not what the code does internally. Explain *why* — what problem does this solve, what would go wrong without it.

**Good:**
```ts
// We normally find a sequence by its word (e.g. "ABBD"). But if the user
// edited and re-saved it with a different word (e.g. "ABBDJ"), our lookup
// table still has the old word and won't find the new one. In that case,
// we fall back to locating it by its unique ID instead.
```

**Bad:**
```ts
// Look up sourceRef from cache. If word changed, fall back to ownerId + id.
```

## Svelte 5

Use runes (`$state`, `$derived`, `$effect`) not legacy reactive syntax. Prefer `$derived` over `$effect` when computing values. Use `$props()` with TypeScript interfaces.

## State Management

Use context + runes for shared state, not stores. See the `state-management` skill for the factory+context pattern.
