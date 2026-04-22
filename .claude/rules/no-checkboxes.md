# No Checkboxes — ENFORCED

## The Problem This Solves

Austen's design system bans checkboxes. Every boolean option in the TKA app uses the button + toggle-indicator pattern. Claude has repeatedly introduced `<input type="checkbox">` into diffs because it's the default pattern in web-dev training data.

Memory: `feedback_no_checkboxes.md` — "button + toggle-indicator pattern only."

## The Rule

Before rendering any boolean / toggle UI:

1. **Do not use `<input type="checkbox">` anywhere in the codebase.**
2. The correct pattern is a `<button>` with an explicit toggle-indicator (switch, checkmark icon, filled/unfilled state, or equivalent).
3. Before claiming a toggle-related task is done, **grep your diff** for `type="checkbox"` and `type={"checkbox"}`. If any match exists, replace it before shipping.

## Finding the canonical pattern

Before building a new toggle, grep for existing toggle primitives:

```
Grep for: aria-pressed, toggle-indicator, role="switch"
In: src/lib/components/, src/lib/ui/
```

Read the primitive you find. Extend or reuse. Do not create a new toggle component if an existing one covers the case (cross-ref `primitive-discovery.md`).

## Forbidden

- `<input type="checkbox">` in any new or edited `.svelte` / `.tsx` / `.jsx` file
- A Svelte `bind:checked` on a checkbox input
- Any third-party `<Checkbox>` component imported for new work
- Shipping a toggle-related fix without grep-proof that the diff contains no checkboxes

## Related

- Memory: `feedback_no_checkboxes.md`
- Rule: `primitive-discovery.md`
