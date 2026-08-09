# Opus 5 follow-up: Seraphic Vault Phase 2 Gate 1 revision 2

**Reviewed:** 2026-08-09

**Model:** `claude-opus-5`

**Effort:** low

**Verdict:** ready

## Result

Opus confirmed that revision 2 resolves the original screen-space defects:

- the four desktop centers now occupy distinct NDC positions at
  `(-0.77, -0.55)`, `(0.78, -0.34)`, `(-0.27, -0.08)`, and `(0.27, 0.42)`;
- the vertical compression and paired columns from revision 1 are gone;
- authored NDC targets are back-solved to distinct world transforms for each
  registered camera;
- the proposed 78-degree portrait camera keeps all four platforms visible;
- the central band, outer-feather masks, width hierarchy, and three registered
  camera presets are represented in the automated report.

## Gate 2 caution

Eroded Halo has only about `0.001` NDC between its desktop bound and the
rectangular left-outer-feather mask, plus `0.021` NDC before the protected center
band. Gate 2 must give it a small outward nudge and re-project against the actual
feather mesh silhouette rather than treating the planning rectangle as final
geometry proof.

## Process finding

Opus concluded that the gate earned its keep by catching a composition failure
that world-space measurements concealed and forcing a registered-camera method.
