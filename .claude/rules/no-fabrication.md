# No Fabrication — ENFORCED

## The Problem This Solves

Claude has fabricated biographical facts about Austen (e.g. "15 years of juggling experience" — false) and cited UI elements, function names, and file paths that don't exist. Each fabrication corrodes trust and cascades into downstream errors.

Austen's feedback (2026-04-21):

> *"basic fact checking such as claiming that I have 15 years of juggling experience when I don't ... all these things are utterly not OK you have to do things right you have to stop your bullshit."*

## The Rule

Claims that require evidence fall into four buckets. Each has a verification path. Missing verification = don't make the claim.

### About Austen (biographical / preference)

**Never invent facts about Austen.** That includes:
- Years of experience in any discipline
- Skill level, proficiency claims, credentials, degrees
- History, timeline, personal events
- Relationships, collaborators, students, teachers
- Preferences not stated in this conversation or in memory

**Verification paths:**
- Check `C:/Users/Austen/.claude/projects/E--tka-platform/memory/MEMORY.md` and referenced files
- Ask directly, short and scoped: "Before I write the tagline, should I reference your juggling background? If so, how many years?"
- Default to no biographical reference when uncertain

**Paraphrasing rule:** Use only details Austen stated explicitly. If he gave a number, use that number. If he did not, omit the detail. If he said "I like mandalas," don't render that as "I've been drawn to mandalas for years" — no years, no intensity qualifier, no invented history.

### About the codebase

Every claim of the form "the X component does Y" or "we have a utility for Z" must be backed by grep or Read output in the current turn.

**Verification paths:**
- `Grep` with a narrow pattern to locate the symbol
- `Read` the file + line to confirm behavior
- `Glob` to enumerate the directory if you aren't sure where it lives

**Forbidden shortcuts:**
- "The `FooComponent` handles this" — without a file path + line
- "There's probably a utility that..." — find it or don't claim it
- "Standard pattern in this codebase is..." — show grep output for the pattern claim

### About TKA domain

See `mcp-ground-truth.md`. Every domain claim — letter behavior, VTG transitions, position definitions, pictograph structure — requires an MCP call in the current turn.

### About libraries, APIs, and their behavior

Use `mcp__plugin_context7_context7__*` to verify library APIs before writing code against them. Don't guess at:
- Function signatures
- Version-specific behaviors
- Deprecation status
- Default arguments
- Return types / thrown exceptions

Install commands, package names, and import paths all count.

## What counts as verified

- Grep output in the current turn
- A direct `Read` in the current turn
- An MCP call response in the current turn
- `git log --oneline` / `gh pr view` output in the current turn
- A reproducible test run output

## What doesn't count

- "I remember seeing this"
- "This should be how it works"
- "Based on standard patterns in this kind of project"
- "Typically Svelte 5 apps use..."
- "I believe this is the case"
- Memory of a prior conversation

## The correction pattern

When you realize you stated something without verification, **correct it explicitly** in the same turn:

> "Retracting — I claimed `StepData` has a `mandalaRole` field. Grepping the file, it doesn't. Actual fields are [list]. Here's the corrected approach."

Never let an unverified claim stand silently once you've noticed it.

## Turn-end self-check

Before writing the final message in any turn where you made factual claims, answer silently:

1. Did I state any fact about Austen (years, skill, history, relationships, preferences) that wasn't in this conversation or memory?
2. Did I cite any file path, function name, class name, or UI element without grep / Read evidence in this turn?
3. Did I state any TKA domain fact (letter, VTG, position, pictograph) without an MCP call in this turn?
4. Did I state any library / API / version claim without `context7` MCP or official source evidence?

If any answer is yes, go back and either verify or retract. Do not ship the message with the unverified claim standing.

## Related rules

- `mcp-ground-truth.md` — domain-specific extension
- `primitive-discovery.md` — component existence verification
- `verification-protocol.md` — visual claims need evidence
- Memory: `feedback_verify_ui_references.md`, `feedback_no_fabricated_community_lore.md`
