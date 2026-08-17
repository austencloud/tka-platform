# Deliver In The In-App Browser — ENFORCED

## The Problem This Solves

In the Claude desktop app, agents keep finishing work and handing Austen a
markdown link — "live at [localhost:5173/test/grip-lab](...)" — instead of
opening the route in the in-app Browser pane. He has corrected this roughly
twenty times across sessions ("burn it into your brain"), a feedback memory
already existed (`feedback_use_in_app_browser`, `feedback_open_the_thing_in_the_pane`),
and it STILL happened on 2026-08-17 at the end of the weave-autopilot delivery.
Memory alone does not fire reliably at delivery time; this rule is the enforced
layer.

Austen (2026-08-17): *"If you ever should announce to me hey I did the work
look at the work here's the link — remember that link needs to lead to the
In App Browser ... anytime you make any announcement that I need to review the
work whatsoever is to use the In App Browser."*

## The Rule

**In the desktop app (the `mcp__Claude_Browser__*` tools are present), any
message that announces work for Austen to review MUST open the destination in
the in-app Browser pane in the same turn.** `preview_start({url})` for a new
pane, `navigate` if one is already open. A markdown link may accompany the
pane; it never substitutes for it.

"Announces work to review" means every shape of it: "done, take a look",
"here's the page", "the four frames show…", "your critique is the next input",
a spec handoff, a before/after, a test route. If the sentence invites his eyes,
the pane is already pointed at the thing before the sentence ships.

The pane leads the message: open it, say what it's pointed at and how to drive
it, THEN the analysis. Screenshots and `SendUserFile` frames are supplements to
the live page, never the headline.

## Self-check (run before sending any completion message)

Grep your own draft for URLs and "take a look" phrasing. If the message
contains a route, page, or artifact Austen would open — did a
`mcp__Claude_Browser__` call happen this turn? If no, make it happen before
sending.

## Scope and precedence

- **Desktop app** (Browser pane tools available): this rule governs delivery.
  It supersedes the link-only handoff pattern; `clickable-links.md` still
  governs link FORMATTING for any links that accompany the pane.
- **Terminal sessions** (no pane): `clickable-links.md` alone — clickable
  https/file links remain the delivery mechanism.
- **DevTools MCP** stays the tool for MY verification loops (measurement,
  `emulate` viewport sweeps, cheap element screenshots per
  `visual-verification-mandatory.md`). Delivery to Austen is the pane. Two
  different jobs; neither replaces the other.
- A broken pane (500, dead server, blank frame) is the task, not an excuse —
  diagnose (IPv6 `[::1]` trap, `never-start-the-dev-server.md`), fix or ask for
  the Agent Hub restart, then open it. Do not fall back to a link.
- 3D/WebGL routes may not composite until the pane is displayed — open it, note
  it's waiting on his display, verify runtime after.

## Forbidden

- Ending a completion/review message with only a link, file path, or screenshot
  when the Browser pane tools are available.
- Telling Austen to navigate somewhere the pane could have been pointed.
- Treating one failed pane call as license to fall back to links or DevTools
  screenshots.

## Related

- Memory: `feedback_use_in_app_browser`, `feedback_open_the_thing_in_the_pane`,
  `feedback_put_it_in_front_of_him`
- `clickable-links.md` (formatting for accompanying links),
  `visual-verification-mandatory.md` (my own eyes; unchanged by this rule)
