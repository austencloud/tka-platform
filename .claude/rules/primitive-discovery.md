# Primitive Discovery — ENFORCED

The UI-specific arm of `never-hand-roll.md`: before writing a new UI
component, service, or feature module, find what exists and report it — either
"found existing primitive `<path>`, using/extending it" or "closest is
`<path>`, differs because X, new one justified."

- **New UI component** → grep `src/lib/components/`, `src/lib/ui/`,
  `src/lib/shared/` for the same visual role (button, panel, card, chip,
  modal…) and interaction pattern; read the closest match AND the parent that
  will consume the new component; check the `styling`, `code-style`, and
  `state-management` skills for conventions.
- **New service** → read the `service-naming` skill (no "Service" suffix),
  grep `src/lib/services/` and `src/lib/features/*/services/`, and prefer
  absorbing the responsibility into an existing service.
- **New feature module** → use the `new-module` skill; never scaffold by hand.

Grep output in the current turn counts as discovery; "I assume there's
probably something" doesn't.
