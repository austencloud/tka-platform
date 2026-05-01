---
name: new-module
description: Use when creating a new feature module in src/lib/features/. Walks through module registration, module-definitions wiring, and service getter setup.
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

## Step 3: Create service getters (if module has services)

```typescript
// src/lib/features/your-module/services/getYourService.ts
import { browser } from '$app/environment';
import { YourService } from './implementations/YourService';

let instance: YourService | null = null;

export function getYourService(): YourService {
  if (!browser) throw new Error('getYourService() is browser-only');
  return instance ??= new YourService();
}
```

Getter files live next to the implementation they wrap. No central container or container-types file.

## Navigation is Automatic

New modules automatically get bottom navigation on mobile. Blocklist pattern — only modules in `MODULES_WITHOUT_NAV` in `layout-state.svelte.ts` hide navigation.

To hide navigation (rare): add to `MODULES_WITHOUT_NAV` with a comment explaining why.
