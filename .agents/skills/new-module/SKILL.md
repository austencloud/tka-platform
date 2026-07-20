---
name: new-module
description: Use when creating a new feature module in src/lib/features/. Walks through module registration, module-definitions wiring, and service getter setup.
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

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

## Step 3: Add service getters (if module has services)

```typescript
// src/lib/shared/<domain>/getYourService.ts
import { YourService } from '$lib/features/your-module/services/implementations/YourService';

let instance: YourService | null = null;
export function getYourService(): YourService {
  if (!instance) instance = new YourService();
  return instance;
}
```

Consumers import the getter directly: `import { getYourService } from '$lib/shared/<domain>/getYourService'`.

## Navigation is Automatic

New modules automatically get bottom navigation on mobile. Blocklist pattern — only modules in `MODULES_WITHOUT_NAV` in `layout-state.svelte.ts` hide navigation.

To hide navigation (rare): add to `MODULES_WITHOUT_NAV` with a comment explaining why.
