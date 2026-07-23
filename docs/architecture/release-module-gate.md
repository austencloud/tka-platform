# ADR: Release Visibility Gate

**Date:** 2026-07-12
**Updated:** 2026-07-23
**Status:** Accepted
**Related:** `scripts/lib/release-module-gate.mjs`, `scripts/release.js`,
`tests/unit/release-module-gate.test.ts`

## Context

Commits belonging to modules that were not live repeatedly leaked into
user-facing changelogs and had to be caught by eye. The release script already
had a source of truth for production modules, but git-history mode only parsed
commit subjects. It could not reliably distinguish dark work from live work.

The first module gate left a second leak. A module can be live while one of its
tabs requires sign-in. Create is available to guests, but Fuse is not. Custom
and feedback-based changelogs also bypassed the gate entirely. That allowed
account-only, tester-only, previously announced, and currently broken behavior
to be presented as generally available.

## Decision

The pure module `scripts/lib/release-module-gate.mjs` classifies each commit's
production visibility and guest/account audience. `release.js` runs the commit
audit for every changelog source and optionally drops dark commits in
git-history mode.

Final releases require a custom changelog manifest. Each private manifest entry
declares:

- `audience`: `guest` or `account`
- `surface`: `global` or a canonical `{ module, tab }`

The release script validates module state against `PRODUCTION_MODULES`, guest
tab access against `GUEST_MODULE_ACCESS`, and tab ids against the navigation
registry. Account-only copy must plainly say that it requires sign-in or an
account. Disabled modules, unknown tabs, missing metadata, and audience
mismatches block the release. Audit metadata is stripped before notes are
displayed, stored, tagged, or published.

### Commit resolution order

1. **Dark denylist** (`DARK_DENYLIST`): hand-maintained rules for sub-features
   that are dark even though their parent module is live. It is seeded with the
   shop LOOP deck listing.
2. **Commit scope**: a conventional commit scope resolves directly to a module
   or through `SCOPE_TO_MODULE`. Tab-specific scopes such as `fuse` also resolve
   through `SCOPE_TO_SURFACE`.
3. **File fallback**: when scope names no module, a commit resolves to the one
   feature module it owns. Shared and cross-cutting commits remain unresolved
   so the gate does not incorrectly drop live infrastructure.
4. **Tab surface**: tab-specific scopes and unambiguous feature paths resolve to
   `{ module, tab }`. A live tab omitted from the guest allowlist is
   account-only. A live parent module with no resolved tab is mixed and needs
   manual entry-point review.

### Outcomes

`released` has three outcomes:

- `false`: behind a dark flag, so exclude it
- `true`: parent module is live
- `null`: unresolved or cross-cutting, so investigate instead of auto-dropping

`audience` adds five outcomes:

- `guest`: reachable before sign-in
- `account`: requires a signed-in account
- `mixed`: parent module contains both guest and account-only tabs
- `unreleased`: disabled in production
- `unknown`: no safe module or tab resolution

### Integration

`release.js` audits the full git range whether the displayed changelog came from
commits, feedback, or a custom file. Commit output is advisory: dark work must
be excluded, account-only work must be qualified, and mixed work must be traced
to its exact tab. `--auto-gate` only drops dark raw commit entries. It never
rewrites or silently removes custom copy.

Execution with `--confirm` is blocked unless `--changelog` supplies a manifest
that passes the guest/account audit. The release skill supplies the human half:
trace every entry point, exclude known-broken behavior, and search prior GitHub
release bodies before calling a capability new or announcing it again.

## Consequences

- Production visibility still follows `environment-features.ts`.
- Guest access follows the same config used by runtime navigation. Fuse is
  reported as live but sign-in required, while Construct is guest-visible.
- Custom and feedback workflows no longer bypass commit visibility evidence.
- A final changelog cannot omit the guest/account decision.
- Account-only notes that read as universally available fail validation.
- The alias and denylist tables remain small and hand-maintained for scopes and
  capability flags that have no central guest registry.
- A mis-scoped commit degrades to manual review instead of being auto-dropped.

## Not done

- Per-module release notes.
- Automatic proof for global controls and capability flags. The release skill
  requires a real entry-point trace, and unresolved items are excluded.
- Automatic semantic comparison with prior release prose. Agents search
  published GitHub release bodies before using "new," "first," or equivalent.
