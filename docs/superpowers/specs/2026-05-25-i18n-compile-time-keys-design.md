# i18n Compile-Time Key Enforcement

## Problem

Module and tab translation keys are constructed at runtime via string concatenation (`tDynamic(`module_${id}`)`) with zero compile-time verification. Missing keys only surface as dev console warnings when someone happens to navigate to that module. This has produced 44+ missing keys that accumulated silently.

## Solution

Add `labelKey: TranslationKey` and `descKey: TranslationKey` fields to `ModuleDefinition` and `Section` interfaces. TypeScript enforces that every module/tab references a key that actually exists in en.json. Adding a module without its translation key becomes a compile error, not a runtime warning.

## Design

### Type Changes

```ts
// src/lib/shared/navigation/domain/types.ts
import type { TranslationKey } from '../../i18n/i18n-types';

interface ModuleDefinition {
  id: ModuleId;
  labelKey: TranslationKey;   // e.g. "module_stage"
  descKey: TranslationKey;    // e.g. "module_desc_stage"
  label: string;              // kept for dev tools, logs, non-i18n contexts
  description?: string;       // kept as fallback source
  // ...rest unchanged
}

interface Section {
  id: string;
  labelKey: TranslationKey;   // e.g. "tab_stage_editor"
  descKey: TranslationKey;    // e.g. "tab_desc_stage_editor"
  label: string;              // kept for fallback
  description?: string;       // kept as fallback source
  // ...rest unchanged
}
```

### Definition Site Changes

```ts
// module-definitions.ts
{
  id: "stage",
  labelKey: "module_stage",
  descKey: "module_desc_stage",
  label: "Stage",
  description: "Choreograph multi-performer formations on stage",
  // ...
}

// tab-definitions.ts
{
  id: "editor",
  labelKey: "tab_stage_editor",
  descKey: "tab_desc_stage_editor",
  label: "Editor",
  description: "Formation editor and timeline",
  // ...
}
```

### Consumer Changes

```ts
// Before (runtime string construction, no type safety)
translateModule(module.id)  // → tDynamic(`module_${normalize(id)}`)

// After (compile-time verified)
t(module.labelKey)
```

Consumers that already have a `ModuleDefinition` or `Section` reference switch from `translateModule(mod.id)` / `translateTab(moduleId, section.id)` to `t(mod.labelKey)` / `t(section.labelKey)`.

### translate.ts Simplification

The `translateModule`, `translateTab`, `translateModuleDescription`, `translateTabDescription` helpers become thin wrappers or deprecated:

```ts
export function translateModule(mod: ModuleDefinition): string {
  return t(mod.labelKey);
}
```

For call sites that only have a `moduleId` string (not the full definition), add a lookup:

```ts
export function translateModuleById(moduleId: ModuleId): string {
  const mod = MODULE_DEFINITIONS.find(m => m.id === moduleId);
  return mod ? t(mod.labelKey) : moduleId;
}
```

### What Stays

- `label` field remains for non-i18n contexts (console logs, dev tools, feature flags UI)
- `tDynamic` remains for truly dynamic keys (user-generated content)
- `validate-i18n-structure.cjs` stays as belt-and-suspenders CI check
- Other locale JSON files (es.json, fr.json, etc.) unaffected — they follow en.json keys

### Migration Path

1. Add `labelKey` and `descKey` as optional fields first
2. Populate all 26 modules + all tabs with their keys
3. Update consumers to use new fields
4. Make fields required (TypeScript catches any stragglers)
5. Deprecate old `translateModule(id)` / `translateTab(moduleId, tabId)` signatures

## Verification

After migration:
- `npm run check` passes (TypeScript enforces all keys exist)
- Remove a key from en.json → compile error at the definition site
- Add a new module without `labelKey` → compile error
- `npm run i18n:structure` still passes as redundant check

## Scope

- 26 module definitions (~52 keys to add)
- ~80 tab definitions (~160 keys to add)
- 8 consumer files to update
- `translate.ts` simplified
- Total: ~300 lines changed across ~12 files
