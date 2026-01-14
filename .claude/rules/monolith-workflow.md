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
3. DI Type:        src/lib/shared/inversify/types.ts
4. DI Module:      src/lib/shared/inversify/modules/{feature}.module.ts
5. Resolution:     resolve<I{Name}>(TYPES.I{Name})
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
| `use*.ts` hooks | DI service with interface |
| `*Utils.ts` | DI service |
| `*.css` standalone | Extract component with markup + CSS |
| Loose function files | DI service |

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
