# Primitive Discovery — ENFORCED

## The Problem This Solves

Austen's feedback: *"I hate having to manually tell Claude that there are many primitives that we've already created in this codebase and that any time we're asking it to create a UI component the very first thing it should do would be find the existing primitives and parents that would consume this component."*

Claude often jumps straight to writing new components without checking what already exists. Result: inconsistent UI, duplicated primitives, visual drift.

## The Rule

Before writing ANY new UI component, service, or feature module, you MUST discover existing patterns first. Report what you found before writing code.

### Before creating a NEW UI component

1. **Grep for similar primitives** in `src/lib/components/` and `src/lib/ui/`:
   - Same visual role (button, panel, card, modal, chip, etc.)
   - Same interaction pattern (toggle, select, form field)
2. **Grep for the parent(s) that will consume it** — which component is going to import this? Read that component.
3. **Check the `styling` skill** for design token rules and the 3-layer variable hierarchy.
4. **Check `code-style` and `state-management` skills** for architectural conventions.

Report to the user:
- *"Found existing primitive: `<path>:<line>`. I'll use/extend it rather than create new."*
- OR *"No existing primitive matches. Closest is `<path>`, which differs because X. Creating new primitive is justified."*

### Before creating a NEW service class

1. Read the `service-naming` skill
2. Grep existing services in `src/lib/features/*/services/` and `src/lib/services/`
3. Check if an existing service can absorb this responsibility
4. Report findings before writing

### Before creating a NEW feature module

Invoke the `new-module` skill. Do not scaffold manually.

## Forbidden

- Writing a new `Button`, `Panel`, `Chip`, `Card`, `Dialog`, `Modal`, `Input`, `Select`, `Toggle`, or any other common primitive without first confirming no existing version covers the need.
- Writing a new service with "Service" suffix (see `service-naming` skill).
- Creating a new feature directory without using `new-module`.

## What counts as discovery

- You ran Grep with a pattern narrow enough to find what exists (e.g. `type="button"` + visual context, or `class.*chip`)
- You read the closest-matching existing primitive and can articulate why the new one is distinct
- You read the parent component(s) that will use this

Passive "I assume there's probably something" doesn't count. Grep output in the current turn counts.
