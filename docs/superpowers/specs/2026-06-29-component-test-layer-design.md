# Component Test Layer — Design

**Date:** 2026-06-29
**Status:** Approved (design); pending spec review → implementation plan
**Owner:** Austen
**Topic:** A standing, app-wide component-test layer for interactive Svelte 5 components, authored as plain test files (no Storybook UI).

---

## 1. Problem

TKA has 378 automated tests, all of which test **logic** — pure functions, services, vector math, codecs, data shapes — in Vitest under jsdom. Zero tests render or interact with a Svelte component. Every wiring, reactivity, interaction, focus, and accessibility bug is therefore caught by exactly one mechanism: a human opening the app and clicking.

The 2026-06-28 orientation-selector bug is the archetype. The component logic was individually correct; what broke was the **wiring** between the customize overlay, the engine's `setOptions` (full-REPLACE), and the displayed value — cross-field state silently reset. A logic test cannot observe wiring. It was found by hand and guarded afterward only by a pure-function test (`customize-start-end-options.test.ts`) that protects the data shape, not the rendered behavior. This is the most common defect class in a reactive UI ("each part works, the connection lies") and the codebase has no layer that watches for it.

## 2. What exists today (grounded — audited 2026-06-29)

- **Vitest 4 + jsdom**, single project at `tests/config/vitest.config.ts`. 378 tests across `tests/unit/**`, `tests/integration/**`, `src/**/__tests__/**`, `src/lib/features/train/prop-tracking-lab/**`. Runs in CI via `test:ci` (`.github/workflows/web-ci.yml`).
- **A 267-line jsdom setup harness** (`tests/setup/vitest-setup.ts`) plus `$app/*` stubs under `tests/setup/stubs/*` (`app-environment`, `app-navigation`, `app-stores`). These stubs are reusable by the new project.
- **`@vitest/browser@^4.0.16`** is already in `package.json`. **Missing:** `vitest-browser-svelte`, the Vitest 4 provider package `@vitest/browser-playwright`, the Playwright Chromium binary, and `axe-core`.
- **Storybook 10 stack is installed but never configured** (no `.storybook/`, zero stories). It is **not** part of this design — left dormant (see §11).
- **Absent:** any component-mount test, `@testing-library/svelte`, `vitest-browser-svelte`, any browser-mode Vitest project, any a11y or component test step in CI.

**Conclusion:** the component-test front is genuinely greenfield (grep for `*.svelte.test.ts`, `vitest-browser-svelte`, `@testing-library/svelte`, `render(`/`mount(` of `.svelte` returned nothing). The reusable "already done" assets are the dependency baseline and the `$app/*` stubs.

## 3. State of the art (2026, verified) and tool choice

jsdom/happy-dom **cannot faithfully run Svelte 5's microtask-based effect scheduler** — `$effect`/`$derived` updates do not reliably flush before assertions, producing **silent reactivity false-negatives** (the exact failure mode of the orientation bug). The modern path is **real-browser component testing on Vitest 4 browser mode, driven by Playwright Chromium.**

Two authoring flavors run on that same engine: Storybook `addon-vitest` (stories-driven) and **`vitest-browser-svelte`** (test-file-driven). Both render in the same real browser; they differ only in authoring format and surrounding ecosystem.

**Chosen tool: `vitest-browser-svelte` (`2.1.1`, maintained by the vitest-community org; peer-requires `vitest@^4`).** Rationale, specific to this project and owner:
- Tests are authored as plain `*.svelte.test.ts` files colocated with components — the same mental model as the existing 378 tests. Run in the terminal/CI; **no separate UI to open, no story format, no component catalog to visit.**
- The owner does little visual checking (verifies in the real app) and previously bounced off Storybook's catalog/UI overhead. Storybook's distinguishing value — living catalog, docs, visual regression — is unused or unwanted here; only its interaction + a11y legs are wanted, and those are available without it.
- It is **not** a fringe choice: it runs the same Vitest-browser-mode + Playwright Chromium engine Storybook's test addon uses, maintained inside the Vitest team's community org.

**Rejected:** Storybook addon-vitest as the layer (catalog/docs/visual are dead weight for this owner; story ceremony is the overhead that burned him before). `@testing-library/svelte` + jsdom (silent-reactivity failure mode is precisely what we must catch). Playwright Component Testing (experimental for Svelte; redundant — the chosen path already uses Playwright Chromium underneath).

**Visual regression is out of scope** (YAGNI — the owner does not visual-check in isolation). If a public component library ever becomes a goal, revisit Storybook + Chromatic for the catalog (deps already installed); not now.

## 4. Architecture

### 4.1 Dependencies to add
- `vitest-browser-svelte` (component renderer for browser mode).
- `@vitest/browser-playwright` (Vitest 4 provider, pinned to the installed `vitest` version) + `playwright`.
- `axe-core` (accessibility assertions; see §6).
- CI step: `npx playwright install --with-deps chromium`.

### 4.2 New Vitest project (the existing jsdom suite stays intact)
A **separate** config, `tests/config/vitest.components.config.ts`, defines the browser project:

```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import path from 'node:path';

export default defineConfig({
  plugins: [svelte()],                       // compile .svelte in the component project
  resolve: {
    alias: {
      $lib: path.resolve('src/lib'),
      $shared: path.resolve('src/lib/shared'),
      // reuse existing SvelteKit stubs so components that import $app/* render in isolation
      '$app/environment': path.resolve('tests/setup/stubs/app-environment.ts'),
      '$app/navigation': path.resolve('tests/setup/stubs/app-navigation.ts'),
      '$app/stores': path.resolve('tests/setup/stubs/app-stores.ts'),
    },
  },
  test: {
    name: 'components',
    include: ['src/**/*.svelte.{test,spec}.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),              // v4: a function, not the string 'playwright'
      instances: [{ browser: 'chromium' }],
    },
  },
});
```

### 4.3 Coexistence guard (one additive line to the jsdom config)
The existing `tests/config/vitest.config.ts` keeps its 378 tests unchanged, with **one additive exclude** to guarantee the file-naming split so a component test is never claimed by the jsdom project:

```ts
exclude: [...existingExcludes, '**/*.svelte.{test,spec}.ts'],
```

Verified-safe assumption (the plan re-confirms with a grep): no existing test file is named `*.svelte.test.ts` — that naming is the Svelte-rune-compile convention and is reserved here for component tests. Component tests live **colocated** as `Foo.svelte.test.ts` (NOT inside `__tests__/`, which the jsdom project globs).

### 4.4 npm scripts (new)
- `test:components` — `vitest --config tests/config/vitest.components.config.ts`
- `test:components:ci` — `vitest run --config tests/config/vitest.components.config.ts`

### 4.5 Authoring conventions
- **Colocation + naming:** `Foo.svelte.test.ts` next to `Foo.svelte`. The `.svelte.` segment enables rune compilation inside the test file and routes it to the browser project.
- **Render/interact/assert:** `render(Component, props)` from `vitest-browser-svelte`; locators + `userEvent` from `@vitest/browser/context`; `expect.element(locator).toBeVisible()` for auto-retrying assertions (no manual `waitFor`/`act`). For out-of-band rune-state mutations in the test, call `flushSync()` before a synchronous assertion.
- **Query by role/name** (`page.getByRole('button', { name })`) to keep tests resilient and a11y-aligned.
- **Portalled content** (popovers/overlays — `FilterChipBase` `mode="dropdown"`, bits-ui floating content): query the panel via the document body locator with async `findBy*` (floating-UI positions on a microtask/rAF; sync `getBy*` can fire before the portal mounts).
- **Toggles/segmented/chips:** assert state via `aria-pressed` / `role="switch"` / `aria-checked` + active class, not internal state. Segmented controls: assert exactly-one-active and that click/arrow-key moves the indicator. **No checkboxes** (project rule) — toggles use the button + toggle-indicator pattern.
- **Callback contracts:** pass `vi.fn()` spies as props and assert call args.

## 5. Test helper (small, shared)
A single colocated helper `tests/helpers/component-a11y.ts` exporting `expectNoA11yViolations(container, opts?)` that runs `axe-core` against the rendered container with the WCAG **AAA** ruleset (`runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag2aaa','best-practice']`) and asserts zero violations. An `opts.soft` mode logs violations without failing (used only while remediating a pre-existing-dirty primitive — see §6). No other bespoke render wrapper is introduced; `render()` is the unit.

## 6. Accessibility gate ramp (AAA without a day-one wall)
Without Storybook there is no global `a11y.test` parameter; the gate is the helper assertion:
1. New/covered primitives call `expectNoA11yViolations(container)` **hard** by default (greenfield — we control these, they should be clean).
2. If a primitive carries pre-existing violations, land its test with `{ soft: true }` (logs, does not fail) while remediating, then remove `soft`.
3. AAA ruleset applied from the start.

## 7. CI integration
- **`test:ci`** (jsdom, 378 tests) — unchanged, stays the fast **required** gate.
- **New `component-tests` job** — installs Chromium (`npx playwright install --with-deps chromium`), runs `test:components:ci`.
  - **P0–P1:** non-blocking (reports results, does not fail the build) while coverage and stability ramp.
  - **P3:** promoted to a **required** gate once stable.
- Browser install + run cost is isolated to this job; existing pipeline timing is unaffected.

## 8. Rollout phases
Each phase is independently shippable.

- **P0 — Scaffold + proof.** Add the deps, write `tests/config/vitest.components.config.ts`, add the one-line jsdom exclude + the two scripts, and write **one** `*.svelte.test.ts` for a toggle primitive (render → click → assert `aria-pressed` flips). Green locally + the (non-blocking) CI job wired. Deliverable: "the layer runs, end to end, on one component."
- **P1 — Shared consolidated primitives.** Tests for `FilterChipBase` (`src/lib/shared/browse/components/filter-chips/FilterChipBase.svelte`), `SegmentedControl` (`src/lib/shared/3d/components/controls/SegmentedControl.svelte`), the toggle (`@austencloud/chip-toggle`), and **`PropOrientationControl`** (the popover from the orientation bug). Add the a11y helper (§5) and assert it on each. Includes the orientation cross-field-reset repro (§9). Deliverable: highest-reuse primitives covered; the just-fixed bug class guarded at the component boundary.
- **P2 — a11y hardening.** Remove any `soft` flags; ensure every covered primitive asserts AAA-clean.
- **P3 — Breadth + gate.** Expand to feature-level interactive components; promote the `component-tests` CI job to a required gate.

## 9. Proof case — the orientation bug at the component boundary
A `PropOrientationControl.svelte.test.ts` (and/or a customize-overlay test) whose body reproduces the original defect: render the control/overlay, change blue orientation, then change red, and assert **both** the displayed value **and** the emitted/engine value retain blue's change (the bug reset it). Demonstrates the layer catches the wiring/reactivity class jsdom logic tests cannot — making the regression permanently impossible, not just guarded by a data-shape test.

## 10. Risks / gotchas
- **Vitest 4 provider split:** use `provider: playwright({})` (function), not the v3 string `'playwright'`; requires `@vitest/browser-playwright` + the Chromium binary.
- **File-naming collision:** mitigated by the §4.3 exclude + the colocation-not-`__tests__` rule; the plan greps to confirm no existing `*.svelte.test.ts`.
- **`$app/*` in isolation:** components importing SvelteKit `$app/*` rely on the reused stub aliases (§4.2); a component needing real navigation/stores is a candidate for E2E instead.
- **First-run cost:** browser boot + Chromium install adds CI time; isolated to the new job, non-blocking until P3.
- **Windows path-with-space** Playwright postinstall quirk — `E:\tka-platform` has no space; clear.

## 11. Out of scope
- Storybook (stays installed, dormant; revisit only if a public component-library catalog becomes a goal).
- Visual regression (Chromatic or local) — YAGNI for this owner.
- E2E flows (routing, persistence, multi-page, real Firebase) — that's Playwright E2E, a separate layer above this one.
- Migrating any existing logic test to browser mode — the 378 jsdom tests stay as they are.
- A generic `renderComponent()` wrapper — `render()` is the unit; only the `expectNoA11yViolations` helper is shared.

## 12. Open questions
None blocking.
