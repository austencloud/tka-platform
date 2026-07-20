---
name: release
description: Use when packaging and publishing a new version with changelog and GitHub release
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Release Command

## Step 1: Gather All Changes

Always gather BOTH sources - not everything goes through feedback.

```powershell
# Preview release (shows completed feedback)
node scripts/release.js --dry-run

# Git commits since last release
git log v{LAST_VERSION}..HEAD --oneline --no-merges

# Detailed feedback list
node scripts/fetch-feedback.js list --status completed
```

## Step 2: Rewrite Changelog for Users

**Audience:** Flow artists who create choreography. No coding knowledge.
**Tone:** Matter-of-fact, not promotional. Like Codex's changelog.

### Rewriting Rules:

1. **Remove ALL developer jargon** - NO: persistence, endpoints, state, components, services, auth, cache, API. YES: sign-in, save, load, export, share, edit, create, view.
2. **Focus on user benefit** - what can they DO now?
3. **Be specific** - don't just say "better"
4. **Ideal length** - 8-15 words per item
5. **Skip infrastructure** - if users won't notice, don't include it
6. **No promotional filler** - "while you practice" and dashes with feature lists are promotional

### Examples:

| Raw Title | User-Friendly |
|-----------|---------------|
| "Fixed service worker registration" | SKIP |
| "Fixed legacy auth callbacks" | "Fixed occasional sign-in errors" |
| "Added CSP headers" | SKIP |
| "Toggle cards don't register taps" | "Toggle buttons respond better to taps" |

### Always Exclude

Lab modules, Learn tab, endless spinner, CLI/auth infrastructure, docs/contributor onboarding. Mark internal items: `node scripts/fetch-feedback.js <id> internal-only true`

## Step 3: Show Preview

Present:
- Sources gathered (feedback count + commit count)
- Version bump (current -> new, with rationale)
- Your rewritten changelog (categorized: Fixed/Added/Improved)
- Warnings (uncommitted changes, etc.)

## Step 4: Get Confirmation

Ask the user to choose one of these options:
1. "Yes, release now"
2. "Change version number"
3. "Edit changelog"
4. "Cancel"

## Step 5: Execute Release

Create `.release-changelog.json` with `apply_patch` using this shape:

```json
[
  { "category": "fixed", "text": "Your polished fix description" },
  { "category": "added", "text": "Your polished feature description" }
]
```

Then run:

```powershell
node scripts/release.js --confirm --changelog .release-changelog.json --highlights 1,3 --version X.Y.Z --from-main
```

**REQUIRED flags:**
- `--version X.Y.Z` — always specify explicitly. The script's auto-suggestion is often wrong.
- `--from-main` — we release from main, not develop.
- `--highlights` — 1-based indices for "What's New" modal items.

## Step 6: Push and Create GitHub Release

```powershell
git push origin main
git push origin vX.Y.Z
```

**A release is NOT complete until the GitHub Release is created:**

Create `.release-notes.md` with `apply_patch`:

```markdown
## What's New
### Fixed
- [descriptions]
### Added
- [descriptions]
```

Then run:

```powershell
gh release create vX.Y.Z --title "vX.Y.Z" -F .release-notes.md
```

## Step 7: Archive and Sync

```powershell
node scripts/archive-feedback.js X.Y.Z
git push origin main
```

---

## Version Bump Rules

### Minor bump (0.X.0): New user-facing capability
Something users literally could not do before: new module, new tab, entirely new workflow.

### Patch bump (0.X.Y): Everything else
Bug fixes, performance, mobile layout, redesigns, improvements, infrastructure.

### The test
"Can users do something today that they literally could not do yesterday?"
- Yes -> minor
- No, but things work better -> patch
