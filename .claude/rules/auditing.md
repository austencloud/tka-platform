# Module Audit Protocol

Run audits via `/audit`. Full rubric and thresholds in `docs/reference/audit-rubric.md`.

Three-phase pipeline: evidence collection (deterministic) -> evaluation (Sonnet agent) -> fixing (separate agent).

Evidence: `node scripts/collect-evidence.cjs "<scope>" --out .audit-evidence.json`
