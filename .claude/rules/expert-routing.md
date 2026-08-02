# Expert Routing — ENFORCED

Domain work dispatches to the preconfigured domain expert, not
`general-purpose` — and what a session learns flows back into that expert's
file. A 2026-07-16 transcript audit found 40 of 40 dispatches generic while 11
curated experts sat unused; a curated library nobody routes to is pure
maintenance cost. (`Explore` stays correct for pure file-finding with no
domain judgment. Dispatch with explicit `model`/`effort` per
`fable-routing.md`.)

| Task smells like | Dispatch |
|---|---|
| Arrow placement, rotation, mirroring, half-arrow glyphs, placement/parity harnesses, arrow JSON adjustments | `arrow-positioning-expert` |
| Prop coords, beta offsets, orientation rendering, prop classification, PictographPreparer/cache staleness | `prop-positioning-expert` |
| Letter/VTG/position/pictograph questions in a subagent context | `tka-domain-expert` (main loop: call MCP directly) |
| "Prove it's actually fixed" loops after a change | `verification-runner` |
| Module/tab quality audit | `module-auditor` |
| WCAG / accessibility review | `accessibility-auditor` |
| Deck composition, release to Firestore, print ordering | `deck-release-expert` |
| Feedback queue triage | `feedback-triager` |
| Changelog / release notes | `release-notes-writer` |

The same routing applies to skills: when a listed skill covers the work
(`styling` for CSS, `state-management` for reactive state, `code-style` for
TS/Svelte conventions, `testing` before writing tests, `new-module` for
scaffolding, `qr` for sequence QR codes, …), load it before doing the work.
When in doubt, load it.

**Knowledge flows back.** When landed work changes canon an expert owns — a
pipeline stage, data format, invariant, naming convention, harness, asset
family — updating that expert's `.md` (paths cited) is part of "done." A
handoff doc is consumed once; the expert file is what every future session
dispatches against. If an expert turns out stale mid-task, fix its file rather
than silently falling back to a generic agent. New expert agents get a row in
the table above.
