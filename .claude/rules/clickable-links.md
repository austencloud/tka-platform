# Clickable Links — ENFORCED

## The Rule

Every URL or localhost link in output to Austen MUST be a clickable markdown
link with a full `http(s)://` scheme.

- Yes: `[localhost:5173/test/mandala-mobile](http://localhost:5173/test/mandala-mobile)`
- No: `localhost:5173/test/mandala-mobile` (bare host:port — not clickable in his terminal)
- No: `http://localhost:5173/...` as bare text (works in some terminals, inconsistent — wrap it anyway)

## Why

Bare `host:port/path` without a scheme is not clickable in Austen's terminal, so
he has to copy-paste. A markdown link saves him the step. His request
(2026-05-29): *"whenever you give me a link ... I want it to be clickable right
here just to save me that teensy bit of time."*

## Scope

All output: localhost dev routes, production domains (tkaflowarts.com, tka.run),
dashboards, docs, GitHub, anything URL-shaped. Always add the scheme, even for
localhost (`http://`).

## Local files (specs, docs, plans)

When you point Austen at a file on disk (a spec, plan, doc, review — anything he
opens to read), give it as a `file://` link with the absolute path and forward
slashes, so it opens in one click:

- Yes: `[spec title](file:///E:/tka-platform/docs/superpowers/specs/2026-05-29-foo-design.md)`
- No: `docs/superpowers/specs/2026-05-29-foo-design.md` (bare relative path — not openable)
- No: `E:\tka-platform\docs\...` (backslashes — not a valid file URI)

This applies especially every time you hand off a spec/plan for review. His
request (2026-05-29): *"when you give me a spec it could be given to me as a link
I can open easy peasy right away."*

## Related

- Memory: `feedback_clickable_links.md`
