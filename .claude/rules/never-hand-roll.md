# Never Hand-Roll — ENFORCED (MASTER RULE)

## The Problem This Solves

This codebase has 500+ components, 100+ services, dozens of shared utilities, and established patterns for every common interaction. Despite existing rules (`primitive-discovery.md`, `research-before-building.md`), Claude repeatedly specs and builds new components that duplicate what already exists — creating drift, inconsistency, and maintenance burden.

Austen's feedback (2026-05-25): *"How many times do I have to tell you you should never handle things... I'm really sick of you hand rolling your own features and components. This code base is so massive that you should never be re hand rolling things that already exist. Any other agent in the future doesn't fucking act like an idiot."*

This is not a suggestion. This is not a heuristic. This is a hard gate that applies to EVERY agent (Opus, Sonnet, Haiku, subagent, orchestrator) at EVERY phase (brainstorming, spec, plan, implementation, review).

## The Rule: Two Mandatory Searches Before ANY New Code

Before writing, speccing, or planning ANY of these:
- A new component (UI or logic)
- A new utility function
- A new service/state module
- A new interaction pattern (drag, popover, timeline, overlay, flip, transition)
- A new data structure that feels like it might already exist
- ANY code >10 lines that isn't pure business logic unique to this feature

You MUST complete BOTH searches:

### Search 1: Internal (codebase)

```
Grep for: [the thing you're about to create] + synonyms + related patterns
In: src/lib/components/, src/lib/ui/, src/lib/shared/, src/lib/features/*/components/
```

Minimum grep patterns per new thing: 3 different search terms. One grep is not enough — this codebase uses varied naming.

Examples:
- About to create a popover? Grep: `Popover`, `popover`, `floating`, `dropdown`, `Dropdown`
- About to create a timeline? Grep: `Timeline`, `timeline`, `Scrubber`, `scrubber`, `playhead`, `beat`
- About to create a chip? Grep: `Chip`, `chip`, `Pill`, `pill`, `Badge`, `tag`
- About to create a camera transition? Grep: `lerp`, `slerp`, `camera-flip`, `snapCameraTo`, `CameraStateSnapshot`
- About to create a drag handler? Grep: `pointerdown`, `onDrag`, `draggable`, `drag-handle`
- About to create an overlay? Grep: `overlay`, `Overlay`, `absolute`, `pointer-events`

**Read the top matches.** Understand what exists before deciding to create new.

### Search 2: External (web + ecosystem)

```
Web search: "[framework] [thing] [2026]"
Context7 MCP: check if framework ships it natively
npm: check if a well-maintained package does it
```

This applies to interaction patterns, not just libraries. "Svelte drag interaction pattern 2026" might reveal `@neodrag/svelte` does exactly what you need in 3 lines.

## When Each Search Applies

| Phase | Internal search required? | External search required? |
|-------|--------------------------|--------------------------|
| Brainstorming/spec | YES — don't spec things that already exist | YES — don't spec hand-rolled infra |
| Plan writing | YES — plan should reference existing files | YES — plan should name libraries to use |
| Implementation | YES — last check before writing | YES — last check before writing |
| Code review | YES — reviewer must flag duplicates | N/A |

## The Justification Gate

After both searches, you MUST state ONE of:

1. **"Reusing `<path>`. Covers this need."** → Use it directly.
2. **"Extending `<path>`. It does X but not Y; adding Y."** → Extend, don't duplicate.
3. **"Nothing exists internally. Package `<name>` does it; adopting."** → Use external.
4. **"Nothing exists internally or externally. Creating new because [specific reason]."** → Justify creation.

Option 4 requires a SPECIFIC reason. "It's slightly different" is not a reason. "The existing one handles X but this needs to handle Y which is fundamentally incompatible because Z" is a reason.

## What Counts as "Already Exists"

- Does 80%+ of what you need → USE IT, adapt the remaining 20%
- Does 60-80% → EXTEND IT with the missing capability
- Does <60% but establishes a pattern → FOLLOW THE PATTERN in your new component
- Does <60% and different pattern → You may create new, but must follow the codebase's styling/state conventions

## Forbidden Patterns

| Pattern | Why it's banned |
|---------|-----------------|
| Speccing a new component without grep evidence | Spec becomes a mandate to duplicate |
| "I'll create a lightweight version of X" | Use X. If X is too heavy, refactor X. |
| "This is similar to X but slightly different" | Extend X. Don't duplicate. |
| "For simplicity, I'll hand-roll a quick..." | Simplicity = reuse. Hand-rolling = complexity. |
| One grep returning no results → "nothing exists" | Try 3+ search terms. Naming varies. |
| Speccing `FooChip.svelte` when `Chip.svelte` exists | Use Chip.svelte with props. |
| Writing 50 lines of drag logic when `@neodrag/svelte` exists | npm install. |
| "Custom popover for this specific use case" | Use the existing popover with custom content. |
| Creating a new state pattern when `*.svelte.ts` factory exists | Follow the factory pattern. |

## For Subagents Specifically

If you are a subagent receiving a task that says "create ComponentX":
1. STOP before creating it
2. Grep the codebase for similar components
3. If you find one, report back: "Found existing `<path>` that covers this. Should I reuse/extend instead of creating new?"
4. Only create new if grep genuinely returns nothing relevant after 3+ search terms

The orchestrator speccing "create X" does NOT override this rule. The orchestrator may not have searched. You search anyway.

## For Spec/Plan Writers

When writing a spec or plan:
- Every file listed under "Create:" must have a justification: "Grep found nothing matching [terms searched]"
- Every interaction pattern (drag, popover, flip, timeline) must reference either an existing internal implementation OR an external library
- If the spec says "create BeatTimeline.svelte" without noting what existing timeline/scrubber components were found and why they don't work, THE SPEC IS INCOMPLETE

## The Self-Check

Before finalizing any spec, plan, or implementation:

1. Count the new files/components being created
2. For each one, can I point to the grep evidence that nothing similar exists?
3. For each interaction pattern, did I check both internally and externally?
4. Am I creating something because it's NEEDED, or because it's EASIER than understanding what exists?

If #4 triggers — stop. Read the existing code. Understanding existing patterns is the job.

## Related Rules

- `primitive-discovery.md` — UI component-specific discovery (subset of this rule)
- `research-before-building.md` — external library research (subset of this rule)
- `no-fabrication.md` — don't claim things exist without grep proof
