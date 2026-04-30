---
name: new-module
description: Use when creating a new feature module in src/lib/features/. Walks through module registration, module-definitions wiring, DI container setup, and container-types integration.
---

# New Module Checklist

## Step 1: Register in `ModuleRenderer.svelte`

```typescript
// src/lib/shared/modules/ModuleRenderer.svelte
const moduleLoaders = {
  yourmodule: () => import("../../features/your-module/YourModule.svelte"),
};
```

## Step 2: Add to `MODULE_DEFINITIONS`

```typescript
// src/lib/shared/navigation/config/module-definitions.ts
{
  id: "yourmodule",
  label: "Your Module",
  icon: '<i class="fas fa-icon" style="color: #hexcolor;" aria-hidden="true"></i>',
  color: "#hexcolor",
  description: "What your module does",
  isMain: true,
  sections: [], // Or YOUR_MODULE_TABS if it has tabs
}
```

## Step 3: Add ITI container (if module has services)

```typescript
// src/lib/shared/di/containers/yourmodule-container.ts
import { createContainer } from "iti";
import { YourService } from "$lib/features/your-module/services/implementations/YourService";

export function createYourModuleContainer(deps: YourModuleDeps) {
  return createContainer()
    .add({ yourService: () => new YourService(deps.someDep) });
}

export type YourModuleContainer = ReturnType<typeof createYourModuleContainer>;
```

## Step 4: Wire container types

```typescript
// src/lib/shared/di/container-types.ts
import type { YourModuleContainer } from "./containers/yourmodule-container";
type YourModuleItems = ItemsOf<YourModuleContainer>;
// Add to IAppContainerItems intersection: ... & YourModuleItems & ...
```

Then wire into `buildAppContainer()` in `src/lib/shared/di/index.ts`.

## Navigation is Automatic

New modules automatically get bottom navigation on mobile. Blocklist pattern — only modules in `MODULES_WITHOUT_NAV` in `layout-state.svelte.ts` hide navigation.

To hide navigation (rare): add to `MODULES_WITHOUT_NAV` with a comment explaining why.
