---
name: state-management
description: Use when building, reviewing, or modifying reactive state in a feature module — state factories, context setup, or when deciding where state should live. Enforces the factory + context pattern that every module follows.
---

# State Management: Factory + Context

Every feature module uses this pattern. No exceptions.

## Three Layers

| Layer | Job | File |
|-------|-----|------|
| Service | Business logic (load, save, validate) | `services/implementations/X.ts` + getter in `get*.ts` |
| State Factory | Reactive UI state (`$state`, `$derived`) | `state/x-module-state.svelte.ts` |
| Context | Distribution to descendants | `context/x-module-context.ts` |

## Flow

```
ModuleRoot.svelte
  → createXModuleState(getLoader(), ...)              // services via getter functions
  → setXModuleContext({ state })                      // set once

AnyChild.svelte
  → const { state } = getXModuleContext()             // consume anywhere
```

## Rules

1. State factories receive services as arguments — never resolve internally
2. Return plain objects with getter accessors — not classes
3. Context set once in module root — consumed by any descendant
4. No module-level singletons (no `let instance = null` patterns)
5. No global ref escape hatches — if you need state outside the component tree, redesign
6. Simple modules get small factories — 3 fields is fine
7. Complex modules compose sub-factories — `createSequenceState()` inside `createModuleState()`

## Don't

- Prop-drill the entire state object through intermediaries
- Call service getters in leaf components for state they could get from context
- Create event handler services with `initialize()` callback wiring
- Create `*-state-ref.svelte.ts` global reference files

Full spec: `docs/superpowers/specs/shipped/2026-03-10-unified-state-management-design.md`
