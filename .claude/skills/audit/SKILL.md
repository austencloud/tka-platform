---
description: Audit a module, tab, or feature for quality
---

# Audit Command

**Args:** `$ARGUMENTS` (optional: target path, or "list", "targets", "stats", "--auto-claim")

## Quick Commands (pass-through)

If the user passes a tracker command directly, just run it:

```bash
node scripts/audit-tracker.cjs $ARGUMENTS
```

This handles: `list`, `targets`, `stats`, `status <target>`, `resolve-issue <target> <index>`

## Pipeline Workflow

For actual audits (no args, or a target path), run the **three-phase pipeline**:

```
audit-tracker --auto-claim → collect-evidence.cjs → audit-evaluator agent → record → present
```

### Role Separation (CRITICAL)

| Role | Can read source? | Can grade? | Can fix? |
|------|-----------------|------------|----------|
| Evidence collector (script) | Yes | No | No |
| Evaluator agent | Evidence JSON + source | Yes | No |
| Fixer agent | Cited files only | No | Yes |
| This orchestrator (you) | Coordinates all | No | No |

**You do NOT grade code.** The evaluator agent does. You orchestrate the pipeline.

---

### Phase 1: Claim Target

**No args (auto-select):**

```bash
node scripts/audit-tracker.cjs --auto-claim
```

Parse `CLAIMED_TARGET:` from output. If `AUTO_CLAIM_TARGET:` appears, the claim succeeded.

**With target specified** (e.g., `/audit features/compose`):

```bash
node scripts/audit-tracker.cjs claim "$ARGUMENTS"
```

**Large module protection:** If the claim command shows "MODULE TOO LARGE", pick a sub-feature from the list and claim that instead.

---

### Phase 2: Collect Evidence

Run the deterministic evidence collector:

```bash
node scripts/collect-evidence.cjs "<target>" --out .audit-evidence.json
```

This produces structured JSON with per-dimension findings. No LLM involved. Takes ~10 seconds.

---

### Phase 3: Evaluate

Spawn the **audit-evaluator** agent (read-only, Sonnet):

```
Task(
  subagent_type: "audit-evaluator",
  prompt: "Read the evidence file at F:\tka-platform\.audit-evidence.json and grade the target '<target>' (scope: src/lib/<target>). Apply mechanical thresholds from your protocol. Output the scorecard, issues, GRADES_JSON, and ISSUES_JSON blocks."
)
```

The evaluator returns:
- A formatted scorecard with per-dimension grades + evidence counts
- A `GRADES_JSON` block with machine-readable grades
- An `ISSUES_JSON` block with machine-readable issues (file:line citations)

---

### Phase 4: Record

Parse the evaluator's `GRADES_JSON` and `ISSUES_JSON` from its response. Record to tracker:

```bash
node scripts/audit-tracker.cjs record "<target>" --grades "<A+,A,A,B,A,A,A+,A>" --issues-json '<json>'
```

Grade order: Architecture, Code Quality, Svelte 5, Accessibility, UX States, UI Consistency, Performance, Security.

---

### Phase 5: Present to User

Show the evaluator's scorecard and issues to the user. Then ask:

1. **Fix now** - Spawn fixer agent for all issues
2. **Fix critical only** - Spawn fixer for critical/serious issues
3. **Defer to feedback** - Auto-create feedback items
4. **Skip** - Leave issues for later

---

### Phase 6 (Optional): Fix

If user chooses to fix, spawn the **audit-fixer** agent:

```
Task(
  subagent_type: "audit-fixer",
  prompt: "Fix these audit issues in TKA Scribe (working dir: F:\tka-platform). Issues: <ISSUES_JSON>. Fix only cited issues. Run typecheck after."
)
```

After the fixer completes:
1. **Re-collect evidence**: `node scripts/collect-evidence.cjs "<target>" --out .audit-evidence.json`
2. **Re-evaluate**: Spawn evaluator again with fresh evidence
3. **Re-record**: Update grades in tracker with new results
4. Present the before/after comparison

---

### Phase 7 (Optional): Defer to Feedback

If user chooses to defer, create feedback items:

```bash
node scripts/fetch-feedback.js create --type enhancement --module "<module>" --title "Audit: <issue summary>" --description "<full issue with file:line>"
```

---

## Post-Audit

1. **Recording auto-releases the claim**
2. **If fixes were made**, offer to commit: group audit fixes into a single commit
3. **Summary**: Show grades, issues fixed/deferred, and next recommendation

## Important Notes

- **Evidence is deterministic** - grep finds violations or it doesn't
- **Thresholds are mechanical** - 0 violations = A+, period
- **Evaluator cannot fix code** - no incentive to rationalize
- **Issues have file:line citations** - accountability
- **Re-evaluation uses fresh evidence** - not the fixer's word
- Claims expire after 4 hours
- Large modules (>30 files) must be audited as sub-features
- The goal is A+ across all 8 dimensions
