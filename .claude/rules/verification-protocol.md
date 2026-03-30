# Verification Protocol — ENFORCED

## The Problem This Solves

Claude repeatedly claims visual/UI changes are "fixed" or "should work now" without any objective evidence. This wastes hours of the user's time. Rules in CLAUDE.md have been ignored. Promises are worthless.

## The Protocol

### After ANY visual/UI change, Claude MUST do ONE of these before responding:

1. **Take a screenshot** via Playwright/CDP and include it in the response
2. **Query runtime state** via browser_evaluate and include the output
3. **Run tests** that verify the behavior and include pass/fail output
4. **Say explicitly: "I cannot verify this visually. Please check [specific thing] and tell me what you see."**

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
