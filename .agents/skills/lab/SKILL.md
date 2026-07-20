---
name: lab
description: Use when the lab module has accumulated too many tabs and needs cleanup, pruning, or reorganization
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Lab Triage

Systematic triage of the Lab module's experiment tabs. Assess each tab's health, present recommendations, get user approval, then execute.

**Don't use this** for graduating a single known tab or deleting one specific experiment. Just do those directly.

## Step 1: Inventory

Read the current lab tabs from `src/lib/shared/navigation/config/tab-definitions.ts` (the `LAB_TABS` array) and `src/lib/features/lab/LabModule.svelte` (the `tabComponents` map).

Build a table of every tab with:
- Tab ID
- Label
- Description (from tab-definitions.ts)
- Component path (from LabModule.svelte)

## Step 2: Assess Each Tab

For each tab, quickly check its component to determine:

1. **Substance**: Does it have real implementation or is it a placeholder/skeleton?
2. **Recency**: When was it last meaningfully touched? (git log)
3. **Dependencies**: Does anything outside the lab reference it?

Use parallel subagents (batches of 5-6 tabs each) to assess quickly. Each subagent should:
- Read the component file (just the first 50-100 lines to gauge substance)
- Run `git log -1 --format="%ar %s" -- <component-path>` for recency
- Run a quick grep for the tab ID outside the lab to check for external references

## Step 3: Present Triage Table

Present the full inventory as a table with a recommended disposition for each:

| Disposition | Meaning | Action |
|-------------|---------|--------|
| **GRADUATE** | Ready for production | Move to its own module outside lab |
| **KEEP** | Active experiment, still being worked on | Leave in lab |
| **ARCHIVE** | Not active but has value for reference | Move code to `docs/archived-labs/` or a branch |
| **DELETE** | Dead experiment, placeholder, or abandoned | Remove tab + component entirely |
| **MERGE** | Overlaps with another tab | Combine into one |

Format:

```
| Tab | Last Touch | Substance | Disposition | Rationale |
```

Sort by disposition (DELETE first, then ARCHIVE, MERGE, KEEP, GRADUATE).

## Step 4: Get User Decisions

**DO NOT act on any disposition without explicit user approval.**

Present the table and ask the user to confirm, override, or discuss each one. They know which ideas they're still excited about.

Expect pushback. Some "dead" tabs are ideas the user plans to revisit. That's fine.

## Step 5: Execute Approved Actions

Only after the user confirms, execute in this order:

### For DELETE tabs:
1. Remove the entry from `LAB_TABS` in `tab-definitions.ts`
2. Remove the entry from `tabComponents` in `LabModule.svelte`
3. Delete the component file(s)
4. If the component lives in `src/lib/features/<name>/`, check if the entire feature directory can be deleted (no other references)
5. Run `npm run check` after each batch to catch broken imports

### For ARCHIVE tabs:
Same as DELETE, but first copy the component to `docs/archived-labs/<tab-id>/` with a brief README.

### For MERGE tabs:
Confirm which tab survives with user, move useful code over, then DELETE the merged tab.

### For GRADUATE tabs:
Follow the New Module Checklist in `project-patterns.md`. Remove from lab's `tabComponents` and `LAB_TABS`.

## Step 6: Verify

After all changes:
```powershell
npm run check
npm run build
```

Report final tab count vs. starting count.

## Rules

- **Never delete without asking.** The user's half-baked ideas are still their ideas.
- **Batch deletions.** Don't make 34 individual commits. Group by disposition.
- **Check for orphaned services.** When deleting a feature directory, check if its service getters (`get*.ts` files) need cleanup too.
- **Preserve git history.** Use `git rm` not `rm` so history is preserved.
