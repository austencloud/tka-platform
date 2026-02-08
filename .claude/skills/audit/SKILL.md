---
description: Audit a module, tab, or feature for quality
---

# Audit Command

**Args:** `$ARGUMENTS` (optional: target path, or "list", "targets", "stats")

## Run

```bash
node scripts/audit-tracker.cjs $ARGUMENTS
```

## Workflow

Read `.claude/rules/auditing.md` for the complete 8-dimension audit protocol.

### Default Behavior (no args)

1. Run `node scripts/audit-tracker.cjs` to get the queue
2. **Immediately propose the top recommendation** with a brief rationale
3. Ask ONE question: "Audit [target]?" with options: Yes / Pick different target
4. On confirmation, claim and begin the audit

**Minimize interaction.** User runs `/audit`, you propose a target, they say go, you audit.

### With Target Specified

If user provides a target (e.g., `/audit features/compose`), skip proposal and begin immediately after claiming.

### Large Module Protection

**Modules with >30 files or >3 sub-features cannot be audited as a single unit.** The script will refuse and show sub-features to audit instead.

Example: `features/create` (521 files, 6 sub-features) -> audit `features/create/assemble`, `features/create/generate`, etc. instead.

If the claim command shows "MODULE TOO LARGE FOR SINGLE AUDIT":
1. Pick one of the listed sub-features
2. Claim and audit that sub-feature
3. Repeat for other sub-features as needed

This ensures audits are thorough and meaningful - you can't claim to have audited 500+ files in one pass.

### The Audit Process

1. **Claim the target**: `node scripts/audit-tracker.cjs claim "<target>"`
2. **Read the entry component** and map the component tree
3. **Grade across 8 dimensions** (see auditing.md):
   - Architecture, Code Quality, Svelte 5 Compliance, Accessibility
   - UX States, UI Consistency, Performance, Security
4. **Present the scorecard** with grades and prioritized issues
5. **Immediately record grades** (no confirmation needed):
   `node scripts/audit-tracker.cjs record "<target>" --grades "A+,A,A,B,A,A,A+,A" --notes "..."`
6. **If fixes needed**: Present the fix plan and ask "Ready to bring this to A+?" with options to proceed or defer
7. **If no fixes needed (A+ across the board)**: Ask "Shall I audit the next feature?"

### Useful Commands

```bash
# See what needs auditing
node scripts/audit-tracker.cjs

# List all recorded audits
node scripts/audit-tracker.cjs list

# List all auditable targets
node scripts/audit-tracker.cjs targets

# Check status of a specific target
node scripts/audit-tracker.cjs status features/compose

# Show coverage stats
node scripts/audit-tracker.cjs stats

# Claim a target (prevents parallel agent conflicts)
node scripts/audit-tracker.cjs claim features/compose

# Force claim a large module (not recommended - prefer sub-features)
node scripts/audit-tracker.cjs claim features/create --force

# Record audit results (order: Arch, Code, Svelte5, A11y, UX, UI, Perf, Security)
node scripts/audit-tracker.cjs record features/compose --grades "A+,A,A,B,A,A,A+,A"

# Release a claim without recording (if audit abandoned)
node scripts/audit-tracker.cjs release features/compose
```

## Post-Audit Workflow

After recording an audit:

1. **Recording auto-releases the claim** - no manual release needed
2. **If you made code changes**, offer to commit them:
   - Use `/commit` or ask user if they want changes committed
   - Group audit fixes into a single commit with descriptive message
3. **Summary**: Provide a brief summary of grades and key changes made

## Important Notes

- **Always claim before auditing** to prevent conflicts with parallel agents
- **Claims use file locking** to prevent race conditions between parallel agents
- **Large modules (>30 files or >3 sub-features) must be audited as sub-features** - the script will refuse to claim them
- Grade order for `--grades` flag: Architecture, Code Quality, Svelte 5, Accessibility, UX States, UI Consistency, Performance, Security
- Targets are auto-browseed from `src/lib/features/` and `src/lib/shared/`
- Sub-features are auto-browseed within large modules (e.g., `create/assemble`, `create/generate`)
- Audits older than 30 days are flagged as stale
- Claims expire after 4 hours if not released
- The goal is **A+ across all dimensions**
