# Monolith Detection Workflow

## Auto-Claim (Race-Safe)

```bash
npx -p @austencloud/code-quality ac-monolith --auto-claim
```

This atomically finds and claims the top available file. Parse `CLAIMED_FILE:` from output.

---

## After Claiming

1. **Read the file** - Don't ask permission
2. **Identify responsibilities** - List each distinct thing it does
3. **Propose decomposition** - Suggest specific extractions
4. **Ask for confirmation** before proceeding

---

## The Single Responsibility Test

**Line count is a signal, not a rule.** The real question is:

> "Can I describe what this file does in one sentence without using 'and'?"

A 1500-line orchestrator that wires children together is fine. A 400-line file with 6 tangled responsibilities is not.

### What to Extract

| Extract When | Example |
|--------------|---------|
| Distinct UI section with its own markup + CSS | Header, Footer, SplitPane |
| Reusable logic that appears in multiple places | Validation, formatting |
| Logic that needs unit testing (silent bugs) | Calculations, algorithms |
| A section you can't describe without "and" | "handles swipe AND export AND sync" |

### What NOT to Extract

| Leave Alone When | Example |
|------------------|---------|
| It's orchestration (wiring children, managing flow) | Modal coordinating header/body/footer |
| Extraction creates thin wrappers with no logic | A service that just delegates |
| The "duplication" is actually encapsulation | Similar CSS in sibling components |
| You're uncomfortable with size but can't name the responsibility to extract | "It's big" isn't a reason |

---

## Service Extraction Pattern (MANDATORY)

Every service extraction MUST follow this structure:

```
1. Interface:      services/contracts/I{Name}.ts
2. Implementation: services/implementations/{Name}.ts
3. Registration:   Add to appropriate DI container
4. Usage:          container.items.serviceName
```

**Register in DI containers - see code-style.md for the full pattern.**

### Service Naming (no "Service" suffix):

| Action | Suffix | Example |
|--------|--------|---------|
| Load data | `*Loader` | `SequenceLoader` |
| Detect/check | `*Detector` | `LayoutDetector` |
| Manage state | `*Manager` | `PlaybackManager` |
| Calculate | `*Calculator` | `BeatCalculator` |

---

## Component Extraction (Markup + CSS)

When extracting UI, the markup AND styles go together.

**When to extract:**
- Distinct UI section (header, footer, panel)
- Markup is self-contained
- Section is conceptually a single "thing"

**CSS travels with components in Svelte** - this is NOT extracting CSS to a standalone file.

---

## FORBIDDEN Patterns

| FORBIDDEN | CORRECT ALTERNATIVE |
|-----------|---------------------|
| `use*.ts` hooks | Service class registered in ITI container |
| `*Utils.ts` | Service class registered in ITI container |
| `*.css` standalone | Extract component with markup + CSS |
| Loose function files | Service class registered in ITI container |

---

## Four Perspectives Test

Before decomposition, evaluate through:

1. **Architect** - Is the boundary at the right level?
2. **Pragmatist** - Can I find a bug in 5 minutes?
3. **Skeptic** - Am I solving a real problem or just uncomfortable with size?
4. **Svelte Component** - Are there extractable UI sections?

**Convergence:** 3/4 perspectives agree -> proceed

---

## Signs File Needs Decomposition

- Multiple unrelated `$effect` blocks
- Mixed concerns that don't belong together
- 30+ props being passed
- Can't describe in one sentence without "and"
- Polling/workarounds in comments
- You'd need to read 1000+ lines to fix a bug in one feature

## Signs File is Fine Despite Size

- It's an orchestrator (wires children, manages state flow)
- Logic is delegated to services/children (file is mostly imports + props + handlers)
- Each section serves the same responsibility
- A new developer could understand the file's purpose from the filename

---

## Lessons Learned

### The Thin Wrapper Trap (2026-01-15)

Claude extracted FishStyleMapper, FishBehaviorTrigger, and DeepOceanLabDrawer from DeepOceanLab.svelte after being challenged. In retrospect, only PersonalityBars.svelte (a reusable UI component) was worth extracting. The services added 7 files and ~240 lines for no benefit.

**Lesson:** Don't extract just because challenged. Extract when there's a real responsibility boundary.

### The "Leave It Alone" Overcorrection (2026-01-29)

Claude analyzed a 2867-line modal and concluded "leave it alone" because "it's an orchestrator." This was wrong - the file had 5+ clear UI sections (header, split pane, export content, footer) that each owned their own markup + CSS.

**Lesson:** "Orchestrator" doesn't mean "can't be decomposed." Look for UI sections that are self-contained.

### The Real Test

For any file, ask:

1. Can a new developer know what it does from the filename?
2. Can you delete it without breaking unrelated features?
3. Can you find a bug in under 60 seconds?

If yes to all three, it's fine regardless of line count.

---

## Concluding Monolith Review

After analyzing a file, you must reach one of two conclusions:

### Option A: Decompose

If decomposition is warranted:
1. Get user confirmation
2. Extract following the mandatory patterns
3. Release claim when done: `npx -p @austencloud/code-quality ac-monolith --release "lib/path/to/File.svelte"`

### Option B: Mark as Audited (Leave It Alone)

If the Four Perspectives Test says leave it alone:
1. Present findings with clear reasoning
2. Offer to mark as audited so it won't appear in future `/monolith` runs
3. If user agrees, run:

```bash
npx -p @austencloud/code-quality ac-monolith --mark-audited "lib/path/to/File.svelte" "Reason: Single responsibility - [what it does]. Complexity is inherent to [why]."
```

**Always offer this option when concluding "leave it alone".**

---

## Commands Reference

```bash
# Scanning
npx -p @austencloud/code-quality ac-monolith              # Show top 20 monoliths
npx -p @austencloud/code-quality ac-monolith --all        # Show all files over threshold
npx -p @austencloud/code-quality ac-monolith --include-audited  # Include audited files

# Claiming (multi-agent coordination)
npx -p @austencloud/code-quality ac-monolith --auto-claim     # Find and claim top available (RECOMMENDED)
npx -p @austencloud/code-quality ac-monolith --claim <path>   # Claim specific file
npx -p @austencloud/code-quality ac-monolith --release <path> # Release a claim
npx -p @austencloud/code-quality ac-monolith --claims         # Show active claims
npx -p @austencloud/code-quality ac-monolith --clear-expired  # Remove stale claims (>2 hours)

# Auditing
npx -p @austencloud/code-quality ac-monolith --mark-audited <path> "<reason>"  # Mark as reviewed
npx -p @austencloud/code-quality ac-monolith --unmark-audited <path>           # Remove from audited list
```
