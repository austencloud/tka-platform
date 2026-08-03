# Verification Protocol — ENFORCED

Every "done," "fixed," or "should work" claim ships with its evidence in the
same message: test output, runtime query output, console log, or a screenshot
you took and actually read. Can you prove it works, or are you guessing? If
you're guessing, say so; if you can prove it, show the proof. There is no
third option.

- **Visual/UI changes:** the evidence is a screenshot per
  `visual-verification-mandatory.md`. Passing tests and a green
  `npm run check` are not visual verification — both were green the day a
  1765px-wide control shipped.
- **Non-visual changes:** runtime state query, or a test run with its output.
- **Genuinely unverifiable:** say exactly what you could not verify and why,
  and what you tried. This is reserved for tools that won't run — not for
  handing the check back to the user.

Don't predict what the user will experience ("reload and try it", "you should
now see...") in place of evidence.
