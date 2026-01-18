# Monolith Detection Workflow

## Auto-Claim (Race-Safe)

```bash
node scripts/find-monoliths.cjs --auto-claim
```

This atomically finds and claims the top available file. Parse `CLAIMED_FILE:` from output.

---

## After Claiming

1. **Read the file** - Don't ask permission
2. **Identify responsibilities** - List each distinct thing it does
3. **Propose decomposition** - Suggest specific DI services to extract
4. **Estimate complexity** - Simple / Medium / Complex
5. **Ask for confirmation** before proceeding

---

## Service Extraction Pattern (MANDATORY)

Every extraction MUST follow this structure:

```
1. Interface:      services/contracts/I{Name}.ts
2. Implementation: services/implementations/{Name}.ts
3. Container:      Register in src/lib/shared/di/containers/{feature}-container.ts
4. Usage:          import { container } from "$shared/di"; container.items.serviceName
```

**ITI Container Registration:**
```typescript
// In the container file:
import { createContainer } from "iti";
import { MyService } from "./services/implementations/MyService";

export function createMyContainer(deps: MyContainerDeps) {
  return createContainer()
    .add({ myService: () => new MyService(deps.someDep) });
}
```

### Service Naming (no "Service" suffix):

| Action | Suffix | Example |
|--------|--------|---------|
| Load data | `*Loader` | `SequenceLoader` |
| Detect/check | `*Detector` | `LayoutDetector` |
| Manage state | `*Manager` | `PlaybackManager` |
| Calculate | `*Calculator` | `BeatCalculator` |

---

## Component Extraction (Markup + CSS)

When a component has significant CSS, extract child components that take markup AND styles together.

**When to extract:**
- Distinct UI section with 50+ lines of CSS
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

## Defending "Leave It Alone" Conclusions

**If the four perspectives test says "don't decompose," trust it.**

When challenged with "but what if it grows?" or "this might become user-facing," don't just flip. Instead ask:

> "What **specific** growth would benefit from this extraction?"

### Bad reasons to extract:
- "It might get bigger" (vague)
- "It could become user-facing" (hypothetical)
- "The line count makes me uncomfortable" (that's what the Skeptic perspective already evaluated)

### Good reasons to revisit:
- "We're adding 10 new behavior types next sprint" (concrete growth)
- "This exact logic needs to be reused in ComponentX" (actual duplication)
- "The drawing code needs unit tests because bugs are silent" (real testing need)

### The trap to avoid:
Extracting thin wrappers (switch statements, property setters, ctx.save/restore boilerplate) into DI services adds ceremony without benefit. A 50-line service that just delegates to object properties isn't "testable game logic" - it's indirection.

**Lesson learned:** On 2026-01-15, Claude extracted FishStyleMapper, FishBehaviorTrigger, and DeepOceanLabDrawer from DeepOceanLab.svelte after being challenged on a "leave it alone" conclusion. In retrospect, only PersonalityBars.svelte (a reusable UI component) was worth extracting. The services added 7 files and ~240 lines for no meaningful benefit.

---

## Signs File Needs Decomposition

- Polling/workarounds in comments
- Multiple unrelated `$effect` blocks
- Mixed concerns that don't belong together
- 30+ props being passed
- Can't describe in one sentence

## Signs File is Fine Despite Size

- Orchestrators coordinating services
- Test utilities/benchmarks
- Well-commented, logically grouped
- Logic is elsewhere (just wiring)

---

## Release Claim

After completing refactor:

```bash
node scripts/find-monoliths.cjs --release "lib/path/to/File.svelte"
```

Other commands:
- `--claims` - See active claims
- `--clear-expired` - Remove stale claims (>2 hours)
