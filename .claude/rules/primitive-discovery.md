---
paths:
  - "src/**/*.{svelte,ts}"
---

# Primitive Discovery — ENFORCED

The UI-specific arm of `never-hand-roll.md`. It distinguishes a new component
file from a new product capability.

## New UI Component

Before writing it:

1. Grep `src/lib/components/`, `src/lib/ui/`, `src/lib/shared/`, and relevant
   `src/lib/features/*/components/` paths for the same user-facing concept and
   interaction. Search at least three terms, including labels, props, callbacks,
   and state names.
2. Read the closest match and a real consumer.
3. Classify the component:
   - **Composition:** feature-specific arrangement of existing primitives. New
     component is allowed.
   - **Presentation:** new view of existing behavior. New component is allowed,
     but shared behavior stays with the existing owner.
   - **Capability:** new state transitions or interaction contract. Reuse or
     extend the canonical owner when one exists. When none exists, follow the
     first/second/third-use rule in `never-hand-roll.md`.

Match the closest component's styling and state conventions even when a new
file is justified. Read the `styling`, `code-style`, and `state-management`
skills when their triggers apply.

## Redesigning an Existing Surface

Before changing an established page's presentation, record its current owners
for selection, pointer/keyboard input, motion, feedback, responsive layout,
detail surfaces, typography, and color. A redesign does not authorize deleting
those capabilities. For every owner, choose and document one outcome:

- **keep** it unchanged;
- **extend** it for the new requirement;
- **replace** it with another existing owner and name the replacement;
- **remove** it because the user explicitly rejected that behavior.

Changing the visual concept is not a reason to replace shared behavior with raw
buttons, local transitions, or locally invented theme variables. A prototype
route still follows this rule. "It is only a test page" does not make a second
implementation cheaper or safer.

## New Service

Read the `service-naming` skill. Search `src/lib/services/` and
`src/lib/features/*/services/` by responsibility, inputs, outputs, and callers.
A new service name does not justify a second owner for the same side effect or
persistence boundary. Extend the owner or create a narrow adapter.

## New Feature Module

Use the `new-module` skill. Never scaffold one by hand.

## Required Report

Before implementation, state one of:

- `Reusing <owner> for <capability>.`
- `Extending <owner> with <behavior>.`
- `Composing <owners> in new feature component <name>.`
- `Creating <capability> with <name> as owner; closest match differs because <interaction contract>.`

Grep output from the current turn counts as discovery. Assumptions do not.
