# Verification Protocol — ENFORCED

## The Problem This Solves

Claude repeatedly claims visual/UI changes are "fixed" or "should work now" without any objective evidence. This wastes hours of the user's time. Rules in CLAUDE.md have been ignored. Promises are worthless.

## The Protocol

### After ANY visual/UI change, Claude MUST take a screenshot before responding

Not "one of these options" — this one. Launch Chrome, load the route, resize,
`take_screenshot`, and read the frame. Standing permission; no asking. Full
protocol and the required viewport set: `visual-verification-mandatory.md`.

Runtime queries (`evaluate_script` returning widths, column counts, computed
sizes) are a cheap *supplement* between frames. They are not a substitute — a
number cannot tell you the page looks like a scatter of dots.

Passing tests and a green `npm run check` are NOT visual verification. They
were both green on the day a control shipped 1765px wide.

"I cannot verify this visually — please check X" is reserved for a browser that
genuinely will not start, and you say what you tried. It is never available
because you didn't ask permission, and never as a way to hand the screenshot
back to the user.

### For non-visual changes, one of these still applies:

1. **Query runtime state** and include the output
2. **Run tests** that verify the behavior and include pass/fail output
3. **Say explicitly what you could not verify and why**

### FORBIDDEN phrases without verification evidence in the same message:

- "Should work now"
- "Reload and try it"
- "The fix is applied"
- "This should feel..."
- "You should now see..."
- "The transition should..."
- Any sentence that predicts what the user will experience

### What counts as verification evidence:

- Screenshot image data
- Console output from browser_evaluate
- Test results (pass/fail with actual output)
- The literal sentence "I cannot verify this — please check X"

### The test: Can I prove it works, or am I guessing?

If I'm guessing, I say so. If I can prove it, I show the proof. There is no third option.
