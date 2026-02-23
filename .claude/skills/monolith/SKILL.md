---
description: Detect monolithic files and propose decomposition
---

# Monolith Detection

## Run

```bash
npx -p @austencloud/code-quality ac-monolith --auto-claim
```

## Workflow

1. **Parse CLAIMED_FILE** from output
2. **Read the file** and identify responsibilities
3. **Evaluate with Four Perspectives** (see below)
4. **Propose decomposition OR mark as audited**
5. **Get confirmation** before proceeding
6. **Extract services** following the mandatory pattern, or mark audited
7. **Release claim** when done

---

## Critical Guardrails

### The Single Responsibility Test

Line count is a signal, not a rule. The real question:

> "Can I describe what this file does in one sentence without using 'and'?"

A 1500-line orchestrator that wires children together is fine. A 400-line file with 6 tangled responsibilities is not.

### Four Perspectives Test

Evaluate through all four before proposing changes:

1. **Architect** - Is the boundary at the right level?
2. **Pragmatist** - Can I find a bug in 5 minutes?
3. **Skeptic** - Am I solving a real problem or just uncomfortable with size?
4. **Svelte Component** - Are there extractable UI sections?

**Convergence:** 3/4 must agree before proceeding.

### When to Extract

| Extract When | Example |
|--------------|---------|
| Distinct UI section with own markup + CSS | Header, Footer, SplitPane |
| Reusable logic in multiple places | Validation, formatting |
| Logic that needs unit testing (silent bugs) | Calculations, algorithms |
| A section you can't describe without "and" | "handles swipe AND export AND sync" |

### When NOT to Extract

- It's orchestration (wiring children, managing flow)
- Extraction creates thin wrappers with no logic
- The "duplication" is actually encapsulation
- You're uncomfortable with size but can't name the responsibility

### Lessons From Real Mistakes

**The Thin Wrapper Trap (2026-01-15):** Claude extracted FishStyleMapper, FishBehaviorTrigger, and DeepOceanLabDrawer after being challenged. Only PersonalityBars.svelte (a reusable UI component) was worth it. The services added 7 files and ~240 lines for no benefit.

**The Leave It Alone Overcorrection (2026-01-29):** Claude analyzed a 2867-line modal and concluded "leave it alone" because "it's an orchestrator." Wrong. The file had 5+ clear UI sections that each owned their own markup + CSS.

### The Real Test

1. Can a new developer know what it does from the filename?
2. Can you delete it without breaking unrelated features?
3. Can you find a bug in under 60 seconds?

If yes to all three, it's fine regardless of line count.

---

## Service Extraction Pattern (MANDATORY)

Every service extraction MUST follow this structure:

```
1. Interface:      services/contracts/I{Name}.ts
2. Implementation: services/implementations/{Name}.ts
3. Registration:   Add to appropriate DI container
4. Usage:          container.items.serviceName
```

### Service Naming (no "Service" suffix):

| Action | Suffix | Example |
|--------|--------|---------|
| Load data | `*Loader` | `SequenceLoader` |
| Detect/check | `*Detector` | `LayoutDetector` |
| Manage state | `*Manager` | `PlaybackManager` |
| Calculate | `*Calculator` | `BeatCalculator` |
| Persist | `*Persister` | `SequencePersister` |
| Orchestrate | `*Orchestrator` | `GenerationOrchestrator` |

### Component Extraction (Markup + CSS)

When extracting UI, the markup AND styles go together. CSS travels with components in Svelte.

### FORBIDDEN Patterns

| FORBIDDEN | CORRECT ALTERNATIVE |
|-----------|---------------------|
| `use*.ts` hooks | Service class in ITI container |
| `*Utils.ts` | Service class in ITI container |
| `*.css` standalone | Extract component with markup + CSS |
| Loose function files | Service class in ITI container |

---

## Two Valid Outcomes

### Option A: Decompose

Extract following mandatory service pattern (interface + implementation + DI registration). Get user confirmation first.

### Option B: Mark as Audited

```bash
npx -p @austencloud/code-quality ac-monolith --mark-audited "lib/path/to/File.svelte" "Reason: [what it does]. [Why size is inherent]."
```

**Always offer this when concluding "leave it alone."**

---

## Commands Reference

```bash
# Scanning
npx -p @austencloud/code-quality ac-monolith              # Top 20 monoliths
npx -p @austencloud/code-quality ac-monolith --all         # All over threshold
npx -p @austencloud/code-quality ac-monolith --include-audited  # Include audited

# Claiming
npx -p @austencloud/code-quality ac-monolith --auto-claim     # Find and claim top
npx -p @austencloud/code-quality ac-monolith --claim <path>   # Claim specific
npx -p @austencloud/code-quality ac-monolith --release <path> # Release claim
npx -p @austencloud/code-quality ac-monolith --claims         # Show active claims
npx -p @austencloud/code-quality ac-monolith --clear-expired  # Remove stale claims

# Auditing
npx -p @austencloud/code-quality ac-monolith --mark-audited <path> "<reason>"
npx -p @austencloud/code-quality ac-monolith --unmark-audited <path>
```
