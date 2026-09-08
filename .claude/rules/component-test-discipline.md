---
paths:
  - "tests/**/*.{ts,svelte}"
  - "src/**/*.svelte.test.ts"
  - ".github/workflows/**/*"
---

# Component Test Contract

Add a component test when it protects a silent interaction regression:

- a fixed interactive-component bug;
- a high-traffic shared primitive with subtle reactivity, keyboard, focus, or
  ARIA behavior;
- a state transition whose wrong result could look plausible.

Do not add browser-component tests for presentational components, obvious
rendering failures, coverage targets, or implementation details. Prefer the
smallest stable assertion that would fail if user-visible behavior regressed.

Keep the `component-tests` CI job non-blocking until it has broad meaningful
coverage and a demonstrated flake-free history on `main`. Apply the same rule to
new infrastructure: build only the slice justified by an observed product or
reliability need.

See `docs/reference/component-testing.md` for the harness and file conventions.
