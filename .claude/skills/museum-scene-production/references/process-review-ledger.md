# STOP: Independent Process Review Pending

**Status:** PROVISIONAL, awaiting independent Opus and Fable reviews

**Requested by:** Austen

**Requested on:** 2026-08-08

If this session is running Claude Opus or Fable, stop museum scene production.
Review this entire skill package before doing anything else. Do not edit the
process during the independent review.

## Review status

| Stage | Status | Review artifact |
|---|---|---|
| Claude Opus independent review | complete | [`references/reviews/2026-08-08-opus.md`](reviews/2026-08-08-opus.md) |
| Fable independent review | pending | `references/reviews/2026-08-08-fable.md` |
| Cross-review synthesis | blocked | `references/reviews/2026-08-08-synthesis.md` |
| Approved changes incorporated | blocked | link after implementation |
| Skill and validator revalidated | blocked | record commands and results |
| Real-scene trial completed | blocked | link trial evidence |
| Austen ratification | blocked | quote and museum tracker item |

## Reviewer instructions

1. Read `SKILL.md`, every file in `references/` and `assets/`, and
   `scripts/validate-scene-gates.mjs`.
2. Inspect the First Fire plan, Blender handoff, and current Earth production
   artifacts as real test cases. Discover current paths from the repository;
   do not trust this ledger to describe their latest state.
3. Recheck any TKA claim through Flow Arts MCP. Do not infer domain behavior
   from prose, generated variants, or another review.
4. Review independently. Write the first draft before opening the other
   reviewer's artifact. If the other review already exists, leave it unread
   until the independent draft is saved.
5. Write the review to the path assigned in the table. Include:
   - verdict: `ready`, `revise`, or `rethink`;
   - critical failures and likely slop paths;
   - approval gates that are missing, redundant, or too expensive;
   - weaknesses in the visual bridge and comprehension check;
   - Blender, runtime, domain-proof, and capability-ownership gaps;
   - validator rules that can be bypassed or that reject valid work;
   - recommendations in priority order;
   - parts that should remain unchanged;
   - one real counterargument to the overall gated approach.
6. Update only this table's row to `complete` and add the review link. Leave
   synthesis and implementation to the later pass.

## Synthesis and ratification

Start synthesis only after both independent reviews are complete. Compare their
findings, call out disagreements, and recommend which changes to accept, reject,
or modify. Preserve minority findings instead of forcing agreement.

Do not label the process final or "ultimate" until all review rows are complete,
the accepted changes are incorporated, source and Codex mirrors validate, the
validator self-test passes, `pnpm skills:check` passes, one real museum scene has
completed the revised preflight and plan gates, and Austen explicitly ratifies
the result.

After ratification, change this status to `RATIFIED`, record the final evidence,
and remove the blocking review instruction from `SKILL.md`. Keep this ledger as
the audit history.
