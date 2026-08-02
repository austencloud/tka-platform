# Never Hand-Roll — ENFORCED (MASTER RULE)

This codebase has 500+ components, 100+ services, and an established primitive
for nearly every common interaction. Building a duplicate creates drift and
maintenance burden that costs far more than the search that would have found
the original. Standing directive from Austen (2026-05-25); this binds every
phase — brainstorm, spec, plan, implementation, review — and every agent,
including subagents whose orchestrator said "create X" without having searched.

Before speccing or writing any new component, utility, service, or interaction
pattern (drag, popover, timeline, overlay, transition — anything beyond ~10
lines that isn't feature-unique business logic), run both searches:

1. **Internal.** Grep at least 3 term variants — naming varies (chip/pill/badge,
   popover/floating/dropdown, timeline/scrubber/playhead) — across
   `src/lib/shared/`, `src/lib/components/`, `src/lib/ui/`,
   `src/lib/features/*/components/`. Read the top matches.
2. **External.** Check whether the framework, its extras package
   (`@threlte/extras` etc.), or a maintained npm package already ships it —
   context7 or a current-year web search.

Then state which of these applies, in the spec or before the code:

- **Reusing `<path>`** — covers the need (~80%+: use it, adapt the rest).
- **Extending `<path>`** — does X but not Y; adding Y (60–80% fit).
- **Adopting package `<name>`.**
- **Creating new, because <specific incompatibility>.** "Slightly different"
  or "a lightweight version" doesn't qualify; if the existing one is too heavy,
  refactor it. Under a 60% fit, still follow the closest match's patterns and
  styling/state conventions.

A spec that lists files under "Create:" without naming what was searched and
why the closest match doesn't work is incomplete.

## Related

- `primitive-discovery.md` — UI-specific arm
- `research-before-building.md` — external/framework arm
- `no-fabrication.md` — existence claims need grep proof
