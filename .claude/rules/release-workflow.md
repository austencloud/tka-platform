# Release Workflow

## Step 1: Gather All Changes

Always gather BOTH sources - not everything goes through feedback.

```bash
# Preview release (shows completed feedback)
node scripts/release.js --dry-run

# Git commits since last release
git log v{LAST_VERSION}..HEAD --oneline --no-merges

# Detailed feedback list
node scripts/fetch-feedback.js list --status completed
```

---

## Step 2: Rewrite Changelog for Users

**Audience:** Flow artists who create choreography. No coding knowledge.

### Rewriting Rules:

1. **Remove ALL developer jargon:**
   - NO: persistence, endpoints, state, components, services, auth, cache, API
   - YES: sign-in, save, load, export, share, edit, create, view

2. **Focus on user benefit:** What can they DO now?

3. **Be specific:** Don't just say "better" - describe the actual change

4. **Ideal length:** 8-15 words

5. **Skip infrastructure:** If users won't notice, don't include it

### Examples:

| Raw Title | User-Friendly |
|-----------|---------------|
| "Fixed service worker registration" | SKIP |
| "Fixed legacy auth callbacks" | "Fixed occasional sign-in errors" |
| "Added CSP headers" | SKIP |
| "Toggle cards don't register taps" | "Toggle buttons respond better to taps" |

---

## Step 3: Show Preview

Present:
- Sources gathered (feedback count + commit count)
- Version bump (current -> new, with rationale)
- **Your rewritten changelog** (categorized: Fixed/Added/Improved)
- Warnings (uncommitted changes, etc.)

---

## Step 4: Get Confirmation

Use AskUserQuestion with options:
1. "Yes, release now"
2. "Change version number"
3. "Edit changelog"
4. "Cancel"

---

## Step 5: Execute Release

Create changelog JSON and run:

```bash
cat > .release-changelog.json << 'EOF'
[
  { "category": "fixed", "text": "Your polished fix description" },
  { "category": "added", "text": "Your polished feature description" }
]
EOF

node scripts/release.js --confirm --changelog .release-changelog.json --highlights 1,3
```

The `--highlights` flag selects which items appear in "What's New" modal (1-based indices).

---

## Step 6: Push to Remote

After release, ask about pushing:

```bash
git push && git push --tags
```

---

## Version Bump Rules

- **Minor** (0.1.0 -> 0.2.0): At least one feature
- **Patch** (0.1.0 -> 0.1.1): Only bug fixes

---

## Important Notes

- NEVER run `--confirm` without user approval
- ALWAYS run `--dry-run` first
- NEVER push without explicit confirmation
- The release script handles Firestore operations automatically
