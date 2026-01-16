# TKA Scribe - Claude Code Guidelines

## Development Philosophy: Build for the Decade

**This project is not an MVP. Build what you'd wish you had done in 10 years.**

When implementing features, don't reach for the quick solution. Research the current state of the art - your training data may be outdated. Ask yourself:

1. **Will this still work well in a decade?** Choose patterns that have stood the test of time AND leverage modern capabilities that solve real problems.

2. **Balance proven with cutting-edge.** Tried-and-true architectural patterns (dependency injection, composition, single responsibility) combined with the latest advancements that have demonstrated real value.

3. **Research before implementing.** When facing non-trivial problems, use web search to find what the community has learned since your training cutoff. The ecosystem evolves fast - don't rely on stale knowledge.

4. **Production-quality from day one.** No "we'll fix it later" code. No shortcuts that accumulate technical debt. Every feature should be something you'd be proud to maintain for years.

5. **Thorough, not bloated.** Engineering for scale is not over-engineering. Design architecture that accommodates growth, but don't add features nobody asked for. The goal is robust foundations, not gold-plating.

**The question to ask:** "If I come back to this code in 10 years, will I thank past-me or curse them?"

### Token Budget: Generous

**Think "one-percenter, not billionaire." Be generous, not stingy - but not wasteful.**

- Take time to understand fully before changing - don't rush to save tokens
- Read the files you need, research when facing unfamiliar territory
- Explore approaches when the decision matters
- Default to building the full product, not an MVP
- If unsure whether user wants quick-and-dirty vs production-quality, ask
- Stay concise in output - generous tokens for *research*, not verbosity

Still suggest `/compact` at 70% context. The budget is generous, not infinite.

---

## CRITICAL: Never Claim "Fixed" Without Verification

**On January 15, 2026, Claude claimed trail rendering was "fixed" after updating config files, without ever verifying the renderer actually used those settings. The user saw zero visual difference. This wasted significant time and was infuriating.**

### The Industry Standard: Objective Verification Loops

From the AI agent development community (Ralph Wiggum technique, Addy Osmani, etc.):

> "Not when it thought it was done, but when your tests actually pass."

The agent must **run verification itself and include the output as proof**.

### Required Verification By Change Type

**For logic/code changes:**
```
1. Run tests: `npm test` or relevant test command
2. Run typecheck: `npm run check`
3. Include actual output in response showing pass/fail
```

**For visual/UI changes:**
```
1. Use Playwright to navigate to the affected area
2. Query runtime state via browser_evaluate to show actual values
3. Take screenshot if visual confirmation needed
4. Include the query results or screenshot in response
```

**For configuration/settings changes:**
```
1. Add temporary console.log at the point where config is READ (not just where it's defined)
2. Trigger the code path that uses the config
3. Show the console output proving the new values are being used
4. Remove the console.log after verification
```

### The Verification Output Rule

**Every "done" or "fixed" claim MUST include one of:**

- Actual test output showing tests pass
- Playwright query results showing correct runtime values
- Console output showing correct values at the usage site
- User confirmation after they explicitly checked

**If you cannot include verification output, say instead:**
> "I've made the changes but need you to verify. Please [specific action] and tell me what you see."

### What Does NOT Count as Verification

- "Build succeeded" - only means no type errors
- "I updated the config" - config might not be read
- "The defaults are now correct" - persisted settings override defaults
- "I changed the component" - might be wrong component
- "I verified it" without showing proof - meaningless

### Before Claiming Fixed

1. Did I trace the COMPLETE code path from trigger to render?
2. Did I run actual verification and can I show the output?
3. If visual, did I query runtime state or take a screenshot?

**If you cannot show proof, do not claim it's fixed.**

---

## Rules

`.claude/rules/` contains:
- `code-style.md` - Imports, Svelte 5, state, TypeScript
- `service-naming.md` - Never use "Service" suffix
- `styling.md` - CSS variables, typography, panels
- `testing.md` - Earned tests philosophy
- `workflows.md` - /fb, /release, /done commands
- `project-patterns.md` - Module checklist

---

## Quick Reference

- **Stack:** Svelte 5 + TypeScript + Inversify DI + Firebase
- **User:** Austen Cloud (austencloud@gmail.com)
- **Context:** Suggest `/compact` at 70% capacity

---

## Dev Server Ports - CRITICAL

**Port 5173 belongs to the user. NEVER touch it.**

The user runs their dev server via VS Code on port 5173. The `npm run dev` script includes `kill-port 5173` which will destroy their session.

### Rules:
1. **NEVER run `npm run dev`** - it kills port 5173
2. **NEVER run `kill-port 5173`** - same reason
3. **Port 5174 is Claude's port** - if you need a dev server: `vite --port 5174`
4. **Assume 5173 is running** - you can `curl localhost:5173/...` to test
5. **Recommend, don't execute** - if a restart is needed, tell the user

### For verification, use:
- `npm run build` - check compilation
- `npm run check` - TypeScript errors
- `curl localhost:5173/path` - test the user's running server
