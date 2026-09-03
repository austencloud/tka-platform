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
| Greenfield layout, components don't exist yet | **HTML sketch** (`static/sketches/<date>-*.html`, served at `https://localhost:5173/sketches/...`) | Cheap throwaway before any Svelte exists |
| Abstract concept / data model / greenfield, nothing real to render | **Visual companion** or an HTML sketch | Nothing in `src/routes/test/*` renders a state machine or a schema |

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

## Visual companion: allowed again, for work with nothing real to render

The 2026-05-30 retirement is **lifted** (Austen, 2026-09-02). That ban was
written when every session ran through the CLI with no browser attached, so
anything the companion produced was a local URL Austen had to go open himself.
The desktop app's in-app Browser pane removed that cost: a companion visual now
lands beside the conversation like any other surface. *"That ban was made when
we did not use an in app browser and we did everything through CLI. That's no
longer the case."*

What has **not** changed is the primitive-density argument, and it still decides
most cases. This codebase has an enormous set of real, shipping components, so a
low-fidelity mockup of something that already renders in HMR remains strictly
worse than the real thing and still violates `never-hand-roll.md`. Route by the
table above:

- **The component exists** -> test page with the real Svelte. Still roughly 90%
  of visual questions here. The companion is the wrong tool for these.
- **Greenfield layout, no primitives yet** -> companion or HTML sketch, whichever
  is cheaper for the question.
- **Diagrams, data models, layer stacks, state machines, architecture** -> the
  companion or an artifact. Nothing in `src/routes/test/*` renders a schema, and
  these were the cases the blanket ban left with no good tool at all.

Step 2 of the brainstorming checklist (the visual-companion offer) is live again
for those last two rows. Skip it when the answer is a test page.

Whatever the companion produces, open it in the in-app Browser pane per
`deliver-in-the-app-browser.md`. Handing over a companion URL and letting Austen
click it is the pre-2026-09 workflow this lift exists to replace.

## Forbidden

- Hand-rolling an HTML/emoji/companion mockup of a component that already exists
  as Svelte — render the real one in a test page instead.
- Spinning up a new sketch, playground, or companion when a test harness for that
  screen already exists.
- Handing Austen a companion or sketch URL without opening it in the in-app
  Browser pane.

## Related

- `never-hand-roll.md` (master), `primitive-discovery.md`
- `CLAUDE.md` → HTML sketches via localhost; `feedback_html_sketches_via_localhost`
- `deliver-in-the-app-browser.md` — anything visual reaches Austen through the pane
- Memory: `feedback_no_visual_companion` (ban lifted 2026-09-02; primitive-density
  routing survives it)
