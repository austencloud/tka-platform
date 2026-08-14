# Visualization Routing — ENFORCED

## The Problem This Solves

This repo has four ways to "show" a design: superpowers **visual companion**,
the **Playground** skill, **HTML sketches** (`static/sketches/`), and **test
pages** (`src/routes/test/*` rendering the real Svelte components). Without a
rule, agents pick arbitrarily — and worse, reach for low-fidelity mockup tools
that hand-roll emoji fakes of components this codebase has already built to AAA.
That fights `never-hand-roll.md` and tells the user nothing about whether the
*real* layout balances.

Austen's framing (2026-05-30): *"why hand roll stuff that we already have ...
maybe the visual companion is built for codebases that aren't sprawling and
massive and have the amount of primitives that we already have established."*
Correct. The decision is not "which tool is best" — it's "how much real-component
truth does this question need."

## The Rule: route by fidelity needed vs. primitives available

| Question shape | Tool | Why |
|---|---|---|
| Rearrange / polish / restyle components **that already exist** | **Test page** (`src/routes/test/*`, real Svelte + HMR) | Zero hand-rolling. Real gradients, spacing, counts. The only thing that answers "does the whitespace balance." |
| Try N variants of one knob fast | **Playground** skill | Parameter sweep + copy-out prompt |
| Greenfield layout, components don't exist yet | **HTML sketch** (`static/sketches/<date>-*.html`, served at `http://localhost:5173/sketches/...`) | Cheap throwaway before any Svelte exists |
| Abstract concept, no primitive library at all | (visual companion's design target) | — see ban below |

**Default for this codebase: test page with real components.** The primitive
density makes it correct ~90% of the time. When a screen already has a test
harness (e.g. `test/deck-releaser-configure/ConfigurePrototype.svelte`), iterate
*there* — don't spin up a mockup.

## Effect work: use a stable test route

While developing or tuning a visual effect, leave Austen on an effect-specific
`src/routes/test/*` page that loads the real avatar, props, renderer, playback,
and controls directly. Follow the `test/coal-3d-showcase` pattern. The page must
survive Vite HMR and reload back into the same effect and preset without manual
navigation.

The Sequence Viewer is a production integration check, not the working handoff
surface for effect iteration. Do not leave it open as the only way to inspect an
effect: an HMR restart can discard its modal, 3D mode, performer selection, and
FX state.

## Visual companion: RETIRED here

Never use or offer the superpowers visual companion. Not arbitrary — the
companion is built for codebases that **lack** a primitive library, so it
hand-rolls simplified emoji fakes of UI. Showing an emoji mockup of a component
that already renders in HMR is strictly worse than showing the real thing, and
it violates `never-hand-roll.md`. Its cheap-throwaway value prop is anti-value
when the real component exists.

Skip step 2 (visual-companion offer) of the brainstorming checklist entirely.

## Forbidden

- Offering / using the superpowers visual companion.
- Hand-rolling an HTML/emoji mockup of a component that already exists as Svelte
  — render the real one in a test page instead.
- Spinning up a new sketch/playground when a test harness for that screen
  already exists.

## Related

- `never-hand-roll.md` (master), `primitive-discovery.md`
- `CLAUDE.md` → HTML sketches via localhost; `feedback_html_sketches_via_localhost`
- Memory: `feedback_no_visual_companion` (reason now reframed to primitive density)
