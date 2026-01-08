---
description: Create a new release version with git tagging and feedback archival
allowed-tools: Bash Read Edit AskUserQuestion
---

# Release Command

Automate the release process by analyzing completed feedback, generating version numbers, creating git tags, and archiving completed feedback.

## Workflow

### Step 1: Gather ALL Changes (Feedback + Git Commits)

**CRITICAL**: Always gather BOTH sources of changes. Not everything goes through the feedback system, so you must check both to get a comprehensive picture.

**Step 1a: Run the release script preview**

```bash
node scripts/release.js --dry-run
```

This will show completed feedback items from Firestore.

**Step 1b: Get git commits since last release**

```bash
git log v{LAST_VERSION}..HEAD --oneline --no-merges
```

Replace `{LAST_VERSION}` with the most recent tag (shown in the dry-run output).

**Step 1c: Get detailed feedback (if any)**

```bash
node scripts/fetch-feedback.js list --status completed
```

**Why both sources?**

- Feedback captures user-reported issues and feature requests
- Git commits capture developer-initiated fixes, refactors, and infrastructure work
- Some work bypasses the feedback system entirely (CSP fixes, build config, etc.)
- The changelog should reflect ALL meaningful changes, not just tracked feedback

**Combine the information:**

Review both the feedback items AND the commit messages to build a complete picture of what changed. Look for:

- Commits that aren't represented in feedback (infrastructure, build, security)
- Feedback items that might have multiple related commits
- Duplicate entries (same fix mentioned in both)

### Step 2: Rewrite Changelog for Users

**CRITICAL**: The raw feedback titles are developer notes, NOT user-facing release notes. Before showing the preview, you MUST rewrite them.

**Audience**: Flow artists who create choreography. They don't code, don't know what "persistence" or "endpoints" mean, and just want to know what's better for them.

**Rewriting Rules**:

1. **Remove ALL developer jargon** - If a non-coder wouldn't understand it, rewrite it or skip it entirely:
   - ❌ NO: persistence, endpoints, state, components, services, providers, handlers
   - ❌ NO: service worker, auth, callbacks, preload, cache, middleware, hooks
   - ❌ NO: FedCM, CSP, CORS, PWA (spell out or describe the benefit instead)
   - ❌ NO: API, SDK, DOM, CSS, HMR, DI, injection, pipeline, renderer
   - ❌ NO: refactor, migrate, deprecate, legacy, fallback, polyfill
   - ✅ YES: sign-in, save, load, export, share, edit, create, view
2. **Focus on user benefit**: What can they DO now? What problem is fixed?
3. **Be specific about WHAT changed**: Don't just say "better" or "improved" - describe the actual change
4. **Ideal length: 8-15 words**: Long enough to be clear, short enough to scan
5. **Use active voice**: "You can now..." or "Fixed..."
6. **Name the feature/area**: Users need context - "in the option picker", "when exporting", etc.
7. **Avoid vague words**: "better", "improved", "enhanced", "updated" alone aren't helpful
8. **Skip pure infrastructure changes**: If a commit is only about build config, security headers, or internal cleanup with no user-visible effect, DON'T include it. Users don't care about internal plumbing.

**BAD vs GOOD Examples**:
| ❌ Bad (vague OR technical) | ✅ Good (specific AND user-friendly) |
|-------------|------------|
| "Better option picker" | "Option picker now shows your filter choices immediately" |
| "Improved drawer animations" | "Drawers slide open/closed more smoothly" |
| "App security improvements" | SKIP - users don't see this |
| "Fixed service worker registration" | SKIP - users don't see this |
| "Added CSP headers" | SKIP - users don't see this |
| "Fixed legacy auth callbacks" | "Fixed occasional sign-in errors" |
| "Removed unused Font Awesome preload" | SKIP - users don't see this |

**Transform Examples**:
| Raw Feedback Title | User-Friendly Version |
|-------------------|----------------------|
| "Fixed i thought we had implemented persistence for the feedback..." | "Your feedback drafts now save automatically between sessions" |
| "Added when extending a module in the desktop navigation sidebar..." | "Clicking a module in the sidebar now expands its sections smoothly" |
| "Fixed generator endpoint mismatch" | "Sequence generator now creates the correct number of beats" |
| "Added video collaboration (Instagram-style)" | "Share videos with collaborators using Instagram-style mentions" |
| "Fixed toggle cards don't register taps with slight finger movement" | "Toggle buttons now respond even when your finger moves slightly while tapping" |

**After rewriting**, present the polished changelog to the user for review before proceeding.

### Step 3: Show Preview to User

Present a comprehensive preview that includes:

**Sources gathered:**

- Completed feedback count and breakdown (X bugs, Y features, Z general)
- Git commits since last release (N commits)

**Version info:**

- Current version vs. suggested new version
- Bump rationale (minor for features, patch for fixes only)

**Combined changelog preview:**

- **YOUR REWRITTEN changelog** (categorized by fixed/added/improved)
- Include items from BOTH feedback AND commits that have USER-VISIBLE impact
- Deduplicate where the same change appears in both sources
- SKIP infrastructure/build/security changes that users won't notice

**Warnings:**

- Git status warnings (if uncommitted changes exist)

### Step 4: Get User Confirmation

Use AskUserQuestion to confirm the release:

**Question:** "Ready to release v{VERSION}?"

**Header:** "Release"

**Options:**

1. **"Yes, release now"**
   - Description: "Update package.json, create git commit & tag, GitHub release, archive feedback"

2. **"Change version number"**
   - Description: "Manually specify a different version (e.g., for major releases)"

3. **"Edit changelog"**
   - Description: "Revise the release notes before publishing"

4. **"Cancel"**
   - Description: "Abort the release process"

### Step 5: Handle User Response

#### If "Yes, release now":

**IMPORTANT**: You must pass your rewritten changelog entries to the release script. Create a temporary JSON file with your polished entries:

```bash
# Write your rewritten changelog to a temp file
cat > .release-changelog.json << 'EOF'
[
  { "category": "fixed", "text": "Your polished fix description" },
  { "category": "added", "text": "Your polished feature description" },
  { "category": "improved", "text": "Your polished improvement description" }
]
EOF

# Execute release with the custom changelog and highlights
# --highlights takes 1-based indices of added/improved items, or "none"
node scripts/release.js --confirm --changelog .release-changelog.json --highlights 1,3,4
```

**Highlights flag:** The `--highlights` flag selects which features/improvements appear prominently in the "What's New" modal:
- Use comma-separated 1-based indices: `--highlights 1,3,4`
- Use `--highlights none` or `--highlights 0` for no highlights
- Indices refer to the "added" and "improved" items in order

This will:

- Update package.json version field
- Create git commit with changelog
- Create annotated git tag
- Create GitHub release with **YOUR REWRITTEN** changelog
- Archive completed feedback in Firestore (feedback mode only)
- Create version record in Firestore with **YOUR REWRITTEN** changelog entries
- **Create a "What's New" announcement** that pops up for all users

Then proceed to Step 6.

**Note:** The announcement summarizes key features and links to Settings → What's New for full details. Use `--skip-announcement` if you don't want to notify users.

#### If "Edit changelog":

Let the user provide corrections, then update your rewritten changelog and return to Step 4.

#### If "Change version number":

Ask for manual version input, then execute with:

```bash
node scripts/release.js --version {USER_VERSION} --confirm
```

Validate the version format (semver) before proceeding.

#### If "Cancel":

Exit gracefully with message: "Release cancelled. No changes made."

### Step 5: Ask About Pushing to Remote

After successful release, use AskUserQuestion again:

**Question:** "Release v{VERSION} created successfully! Push to remote?"

**Header:** "Push"

**Options:**

1. **"Yes, push tags and commits"**
   - Description: "Push the release commit and tag to origin"

2. **"No, I'll push manually"**
   - Description: "Keep changes local for now"

#### If "Yes, push tags and commits":

```bash
git push && git push --tags
```

Show output and confirm success.

#### If "No, I'll push manually":

Show reminder:

```
✓ Release v{VERSION} committed locally.
  To push later: git push && git push --tags
```

## Version Bumping Rules

The release script automatically suggests a version based on changelog content:

**Feedback Mode:**

- **Minor bump** (0.1.0 → 0.2.0): At least one `feature` type feedback item
- **Patch bump** (0.1.0 → 0.1.1): Only `bug` or `general` type feedback items

**Git History Mode:**

- **Minor bump** (0.1.0 → 0.2.0): At least one `feat:` commit
- **Patch bump** (0.1.0 → 0.1.1): Only `fix:`, `refactor:`, `style:`, or `chore:` commits

**Both Modes:**

- **Manual override**: User can specify any semver version with `--version` flag

## Important Notes

- NEVER run with `--confirm` without user approval via AskUserQuestion
- ALWAYS run `--dry-run` first to preview
- ALWAYS show the full output to the user before confirming
- NEVER push without explicit user confirmation
- If git status is dirty, the script will warn - ask user if they want to continue
- The release script handles all Firestore operations (archives feedback, creates version record)

## Error Handling

The release script will exit with error if:

- No completed feedback AND no commits since last tag → explain options
- Version format invalid → show semver examples
- Firestore operation fails (feedback mode only) → error message with details
- Git operation fails → error message with details

If any step fails after confirmation:

- Git operations are atomic (commit + tag together)
- If Firestore fails after git operations (feedback mode), user must manually clean up
- Show clear error message with recovery steps

## Example Session

```
User: /release

Claude: I'll help you create a new release. Let me gather all changes from both
feedback AND git commits...

[Runs: node scripts/release.js --dry-run]
[Runs: git log v0.1.0..HEAD --oneline --no-merges]

## Release Preview: v0.2.0

**Sources gathered:**
- 8 completed feedback items (5 bugs, 3 features)
- 12 commits since v0.1.0

**Version:** 0.1.0 → 0.2.0 (minor bump - includes new features)

### 📋 Combined Changelog (rewritten for users):

**🐛 Fixed:**
- Navigation no longer overlaps on mobile
- Gallery loads faster
- Settings save properly now
- Drag gestures work on mobile
- Animations play smoothly

**✨ Added:**
- Save your favorite sequences
- Export multiple sequences at once
- Keyboard shortcuts for faster editing

**🔧 Improved:**
- Smoother page transitions
- Cleaner navigation sidebar

⚠️ Warning: 3 uncommitted files

---

Claude: [Uses AskUserQuestion]
Ready to release v0.2.0?

User: [Selects "Yes, release now"]

Claude: Executing release...

[Runs: node scripts/release.js --confirm --changelog .release-changelog.json]

✓ Updating package.json...
✓ Archiving feedback in Firestore...
✓ Creating git commit and tag...
✓ Creating GitHub release...

🎉 Release v0.2.0 complete!

Claude: [Uses AskUserQuestion]
Release v0.2.0 created successfully! Push to remote?

User: [Selects "Yes, push tags and commits"]

[Runs: git push && git push --tags]

✓ Pushed commits and tags to origin

All done! Release v0.2.0 is live.
```

**Key points demonstrated:**

- Both feedback AND commits were gathered
- Technical/infrastructure commits were SKIPPED (not visible to users)
- Changelog was rewritten in user-friendly language with no jargon
- Only user-visible changes made it into the release notes

## Backfilling GitHub Releases

If you have existing git tags without GitHub releases, use the backfill script:

```bash
node scripts/temp/backfill-github-releases.js
```

This will:

- Check all git tags in the repository
- Compare against existing GitHub releases
- For each tag without a release:
  - Pull changelog from Firestore version record (if available)
  - Fallback to git tag message if no version record exists
  - Create a formatted GitHub release

The script is idempotent - safe to run multiple times.
