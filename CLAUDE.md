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
