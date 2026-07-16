# Expert Routing — ENFORCED

## The Problem This Solves

Transcript audit (2026-07-16, all 21 sessions on this machine): 40 subagent
dispatches, every single one generic (`Explore`/`general-purpose`); **zero
dispatches of the 11 preconfigured expert agents; zero project-skill
invocations.** The half-arrow positioning marathon ran on generic agents while
`arrow-positioning-expert` sat unused — and the new canon it produced never
flowed back into the expert. A curated library that never gets routed to is
pure maintenance cost. Austen (2026-07-16): *"Why aren't my agents knowing
that they have all these wonderful skills and choosing to use them of their
own accord?"*

Two mechanical causes, two rules:
1. Nothing binds a domain to its expert — generic dispatch is the path of
   least resistance, so it always wins.
2. Nothing makes updating the expert part of "done" — so experts rot, which
   makes them even less likely to be trusted next time.

## Rule 1: Domain work routes to the domain expert

When a task falls in a row of this table, dispatch THAT agent for the
domain-reasoning portion — not `general-purpose`, not raw greps in the main
loop. (`Explore` remains correct for pure file-finding with no domain
judgment.) Dispatch with explicit `model`/`effort` per `fable-routing.md`.

| Task smells like | Dispatch |
|---|---|
| Arrow placement, rotation, mirroring, half-arrow glyphs, placement/parity harnesses, arrow JSON adjustments | `arrow-positioning-expert` |
| Prop coords, beta offsets, orientation rendering, prop classification, PictographPreparer/cache staleness | `prop-positioning-expert` |
| Letter/VTG/position/pictograph domain questions in a subagent context | `tka-domain-expert` (main loop: call MCP directly per `mcp-ground-truth.md`) |
| "Prove it's actually fixed" loops after a change | `verification-runner` |
| Module/tab quality audit | `module-auditor` |
| WCAG / accessibility review | `accessibility-auditor` |
| Deck composition, release to Firestore, print ordering | `deck-release-expert` |
| Feedback queue triage | `feedback-triager` |
| Changelog / release notes | `release-notes-writer` |

If the expert's knowledge turns out stale or wrong mid-task, fix the expert's
`.md` — do not silently fall back to a generic agent and leave the rot in
place.

The same discipline applies to skills: when a listed skill covers the work
(`styling` for CSS, `state-management` for reactive state, `code-style` for
TS/Svelte conventions, `testing` before writing tests, `new-module` for
feature scaffolding, `qr` for sequence QR codes, …), load it via the Skill
tool BEFORE doing the work. Skill descriptions are binding routing surface,
not suggestions — Claude's documented failure mode is undertriggering, so
when in doubt, load it.

## Rule 2: Knowledge flows back (the upkeep loop)

When a session lands work that changes the canon an expert agent owns — a new
pipeline stage, data format, invariant, naming convention, harness, or asset
family — **updating that expert's `.md` is part of "done"**, the same class
of obligation as verification evidence. A handoff doc is not a substitute:
handoffs get consumed once; the expert file is what every future session
dispatches against.

The update is small: add/amend the sections the work touched, cite file paths
and (if branch-local) the branch name. Precedent for the failure: the
half-arrow glyph system and halved-orientation canon (July 2026) both shipped
without touching their experts, which is how Austen found the experts stale.

## Forbidden

- Dispatching `general-purpose` for work squarely inside an expert's table row.
- Editing CSS/state/TS-conventions/tests without having loaded the matching
  skill when one exists.
- Landing domain-canon changes without updating the owning expert agent file
  in the same turn (or explicitly flagging why not).
- Adding a new expert agent without adding its row to the table above.

## Related

- `fable-routing.md` — model/effort tiers for every dispatch
- `mcp-ground-truth.md` — domain facts come from MCP, not memory
- `never-hand-roll.md` — the same "use what exists" principle, applied to code
