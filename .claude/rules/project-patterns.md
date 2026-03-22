# Project-Specific Patterns

## Tech Stack Overview

- TKA Composer is a Svelte 5 + TypeScript application
- Uses ITI (Isomorphic Type-safe IoC) for dependency injection
- Firebase for persistence and auth
- Focus on animation and interactive pictograph rendering

---

## User Identity

- **Primary developer**: Austen Cloud (austencloud@gmail.com)
- When creating feedback via scripts, default user is `austen`

---

## New Module Checklist

**When creating a new module, complete these steps:**

### Step 1: Add to `moduleLoaders` in ModuleRenderer.svelte

```typescript
// src/lib/shared/modules/ModuleRenderer.svelte
const moduleLoaders = {
  // ... existing modules
  yourmodule: () => import("../../features/your-module/YourModule.svelte"),
};
```

### Step 2: Add to MODULE_DEFINITIONS in module-definitions.ts

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

### Step 3: Add ITI container if needed

If your module has services, create a container:

```typescript
// src/lib/shared/di/containers/yourmodule-container.ts
import { createContainer } from "iti";
import { YourService } from "$lib/features/your-module/services/implementations/YourService";

export function createYourModuleContainer(deps: YourModuleDeps) {
  return createContainer()
    .add({ yourService: () => new YourService(deps.someDep) });
}

export type YourModuleContainer = ReturnType<typeof createYourModuleContainer>;
// For simple containers (no factory): export type YourModuleContainer = typeof yourModuleContainer;
```

### Step 4: Add container type to `container-types.ts`

Import the container type and add its items to the `IAppContainerItems` intersection:

```typescript
// src/lib/shared/di/container-types.ts
import type { YourModuleContainer } from "./containers/yourmodule-container";
type YourModuleItems = ItemsOf<YourModuleContainer>;

// Add to the IAppContainerItems intersection:
// ... & YourModuleItems & ...
```

Then wire the container into `buildAppContainer()` in `src/lib/shared/di/index.ts`.

### Navigation is automatic

New modules **automatically get bottom navigation** on mobile. The system uses a blocklist pattern - only modules explicitly added to `MODULES_WITHOUT_NAV` in `layout-state.svelte.ts` will hide navigation.

**You do NOT need to manually add navigation.** Just complete the steps above and your module will have working navigation.

If you need to **hide** navigation for a specific module (rare), add it to `MODULES_WITHOUT_NAV` with a comment explaining why.

---

## When Claude Should Proactively Ask About Updating Rules

- User expresses frustration about Claude repeatedly doing something wrong
- User states a general principle ("I always want...", "Never do...", "My preference is...")
- User corrects Claude on an architectural decision
- A pattern emerges across multiple requests
