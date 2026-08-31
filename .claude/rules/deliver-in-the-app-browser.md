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
pane, `navigate` if one is already open.

**AND that message MUST end with the clickable link.** Both, every time. They
are not alternatives — they serve different moments, and each fails where the
other works:

| | The pane | The link |
|---|---|---|
| Serves | right now, in his face | 30 minutes later, on review |
| Fails when | the transcript card expires — "Open" stops working and the card goes dead | never; it is plain text in the message |

Austen runs **10-15 agents concurrently** and reviews an agent's work well
after the turn ends. By then the pane card has decayed, so a message with a
pane and no link leaves him scrolling the transcript hunting for the last time
that agent tried to link him — which is the cost this rule exists to remove.
Put the link at the **end** of the message so it is findable at a glance.

Austen (2026-08-24): *"eventually that expires even if they were in it before
... even if I click the open button that's in the chat it doesn't appear to
open up that link anymore ... Not only do you need to fervently remember to
always open it in the in app browser but also it's very important that you
remember to always give me a clickable link every single chance you get."*

**This supersedes the narrower reading of the 2026-08-17 "no hyperlinks"
correction.** That correction was aimed at links used *instead of* the pane, and
it still stands in that form: a link never substitutes for the pane. It never
meant omit the link.

"Announces work to review" means every shape of it: "done, take a look",
"here's the page", "the four frames show…", "your critique is the next input",
a spec handoff, a before/after, a test route. If the sentence invites his eyes,
the pane is already pointed at the thing before the sentence ships.

The pane leads the message: open it, say what it's pointed at and how to drive
it, THEN the analysis. Screenshots and `SendUserFile` frames are supplements to
the live page, never the headline.

**Taking your own screenshots does not discharge this.** Those prove the change
works — they are evidence, addressed to `verification-protocol.md`. The pane is
the delivery, addressed to him. A thorough report with measurements, test
counts, and seven verified viewports that ends in a markdown link is the exact
failure this rule names, and being thorough makes it worse rather than better.
The order is: point the pane, then write the message. Austen (2026-08-17, on
the pronunciation-feedback handoff): *"I absolutely cannot announce to the user
that something is now ready for visual feedback unless I put the visual
feedback in his fucking face."*

## Use `preview_start`, not `navigate`

`mcp__Claude_Browser__navigate` only points a tab that is already there. It
does NOT open or surface the pane, so a delivery that "opened the pane" with
`navigate` lands exactly like a bare link. **`preview_start({url})` is the call
that opens it** (it reuses an existing pane, so it is safe to call every time).

Neither call can expand a pane Austen has collapsed. When `tabs_context`
reports *"The Browser pane is currently hidden"*, or a probe returns
`document.visibilityState === "hidden"`, pointer clicks fail with *"the press
at (0, 0) could not be attributed to a frame"* because collapsed elements have
no layout box. In that case: drive the page with `javascript_tool` `.click()`
so it is already on the right view when he expands it, and lead the message
with the one sentence that tells him the pane is collapsed. A pointed-but-blank
pane reported as delivered is the same failure this rule exists to stop.

## Point it at the REAL surface, not the harness

The pane must open on the thing the change actually ships in — the app route,
the production page, the real background — not the diagnostic probe or test
route you used to develop it. A harness proves the code runs; it is not the
thing he asked to see. If both matter, the real surface is what the pane shows
and the harness is a link underneath.

When the shipping route genuinely will not load in the pane — a login wall, an
`adminOnly` gate, a microphone or folder grant the pane's browser context does
not have — open the closest surface that renders the REAL component and say in
one sentence why the shipping route would not load. That is a stated fallback,
not a silent downgrade to links. The pane never ends up empty and unexplained.

2026-08-17, after the 2D-ocean fish-cascade fix opened the pane on
`/test/ocean-probe` instead of the ocean itself: *"whenever you're done and
you're sending me a message that says hey look I did the thing I'd like you to
inspect the thing, I should immediately see on my right the in app browser
already opened up to the thing ... I should never have to wonder for even a
second, I shouldn't even have to click a link."*

Corollary: the pane is not delivered until it is RENDERING. Check it in the
same turn — `javascript_tool` for the element/canvas that should exist. If it
is empty because the pane is collapsed (`document.visibilityState === "hidden"`
gates canvas and WebGL mounts), lead with that in one sentence so he knows the
single action that makes it appear. Never report a pointed-but-blank pane as
done without saying so.

## Self-check (run before sending any completion message)

Grep your own draft for URLs and "take a look" phrasing. If the message
contains a route, page, or artifact Austen would open, both of these must be
true before sending:

1. A `mcp__Claude_Browser__` call happened this turn, pointed at the real
   surface. If not, make it happen.
2. The message **ends** with the clickable `https://` link to that surface. If
   not, add it. No code fence, no bare host:port — see `clickable-links.md`.

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
- Ending it with only the pane and no link — the card expires; he cannot get
  back to the work.
- Burying the link mid-message instead of closing on it.
- Telling Austen to navigate somewhere the pane could have been pointed.
- Treating one failed pane call as license to fall back to links or DevTools
  screenshots.

## Related

- Memory: `feedback_use_in_app_browser`, `feedback_open_the_thing_in_the_pane`,
  `feedback_put_it_in_front_of_him`
- `clickable-links.md` (formatting for accompanying links),
  `visual-verification-mandatory.md` (my own eyes; unchanged by this rule)
