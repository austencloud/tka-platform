# Component-Test Discipline — ENFORCED

## The Problem This Solves

The component-test layer (vitest-browser-svelte, stood up 2026-06-29 — see
`docs/reference/component-testing.md`) is real infrastructure with a real,
ongoing cost: Playwright Chromium in CI, a version-pinned dep surface, and
selector/ARIA rot when components legitimately change. Its value scales with
coverage **and only if** that coverage sits on things worth guarding. At its
birth it was ~1% coverage (6 of 500+ components) — a seed and a proof, **not a
safety net**.

The failure mode is widening the door for its own sake: chasing a coverage
number, gold-plating a thin layer, or promoting a flaky/thin job to a required
gate — all of which cost more than they catch.

Austen's framing (2026-06-29): *"Not a door you should regret opening. A door
you shouldn't keep widening just because it's open."*

## The Rule

1. **Grow component tests organically — test-on-fix.** Write one when you either
   (a) FIX an interactive-component bug (lock the regression — e.g. the
   orientation-selector and FilterChipBase `role="switch"` catches), or (b) are
   already touching a high-traffic, reactivity- or ARIA-prone shared primitive.
   Not on a schedule. Not to hit a number.
2. **Do not chase breadth or a coverage %.** More tests on low-risk or
   presentational components are maintenance debt, not safety. The long tail does
   not need browser tests.
3. **Keep the CI `component-tests` job NON-BLOCKING** (`continue-on-error: true`)
   until coverage is meaningful AND it has proven flake-free across many runs on
   `main`. A flaky required gate that blocks pushes is worse than no gate.
   Promote to required only after it earns it (catches real bugs in normal use +
   a stable run history).
4. **Lean core over gold-plating.** The valuable core of any test/infra effort is
   the minimal slice that delivers the win (proof + the bug fix). Extra breadth,
   redundant review rounds, exhaustive sweeps on a thin layer are
   over-investment — name it as such, don't default to it.

## Generalizes to all infra / tooling doors

Same discipline for any new infrastructure (test harnesses, build tooling,
generators, dashboards, scaffolds): build the lean valuable core, grow it only on
demonstrated need, and don't widen it just because it's open. Infrastructure is
not product — weigh every expansion against the active tier list
(cross-ref `feedback_shiny_object_guard`).

## Forbidden

- A "let's get coverage up" push that adds component tests to low-risk or
  presentational components.
- Flipping the `component-tests` CI job to required/blocking while it is thin or
  unproven.
- Gold-plating a low-coverage layer (breadth sweeps, redundant review passes)
  instead of shipping the lean win and stopping.

## Related

- `docs/reference/component-testing.md` — how to write a component test, and the
  `.svelte.test.ts` naming footgun
- Memory: `feedback_shiny_object_guard` (infra vs unfinished product tiers),
  `feedback_agent_importance_honesty` (don't inflate work importance)
- `.claude/rules/never-hand-roll.md`, `.claude/rules/research-before-building.md`
