---
description: Complete work - either mark existing feedback done OR auto-create and complete new feedback
allowed-tools: Bash Read
---

# Done Command

Complete work and log it to the feedback system. Supports two modes:

1. **Mark existing feedback as completed** - when you have a document ID
2. **Auto-create and complete** - when you just finished work with no existing feedback item

## Mode 1: Complete Existing Feedback

When you have a document ID (from `/fb` or the Kanban board):

```bash
/done <document-id> "Brief summary of what was changed"
```

With user-facing notes (for user-submitted feedback):

```bash
/done <document-id> "Admin notes" "User-facing notes"
```

**Examples:**

```bash
/done abc123xyz "Fixed card height overflow"
/done abc123xyz "Fixed card overflow" "Cards now display correctly"
```

## Mode 2: Auto-Create and Complete (Quick Log)

When you just finished work and there's no existing feedback item:

```bash
/done "Title of what you did"
```

Or with a description:

```bash
/done "Title" "Description of the work"
```

**Examples:**

```bash
/done "Help button discovery overlay"
/done "Fix thumbnail cache invalidation" "Updated cache key derivation to include prop type"
```

### What happens in auto-create mode:

1. Creates new feedback under Austen's profile
2. Sets status directly to `completed`
3. Marks as `internal-only` (dev work, excluded from user changelog)
4. Sets source as `terminal` (distinguishes from user-submitted feedback)
5. Reports what was created with the document ID

## How to tell which mode

The command detects the mode automatically:

| First argument | Mode |
|----------------|------|
| 20-char alphanumeric (e.g., `gD1ts7gMR4LIXRV1eumk`) | Complete existing |
| Text with spaces or descriptive title | Auto-create |

## Implementation

Parse the arguments and determine the mode:

### If first argument looks like a document ID (20+ alphanumeric chars, no spaces):

```bash
# Complete existing feedback
node scripts/fetch-feedback.js <document-id> completed "admin notes"

# With user-facing notes
node scripts/fetch-feedback.js <document-id> completed "admin notes" --user-notes "user-facing notes"
```

### If first argument is a title (has spaces or is descriptive text):

Run these commands in sequence:

```bash
# 1. Create feedback (captures the ID from output)
node scripts/submit-feedback.js "Title" "Description" --type feature --module system --tab general --user austen

# 2. Mark as completed (using the ID from step 1)
node scripts/fetch-feedback.js <new-id> completed "Title"

# 3. Mark as internal-only
node scripts/fetch-feedback.js <new-id> internal-only true
```

**Important:** Parse the feedback ID from the submit-feedback.js output (line containing "Feedback ID:") to use in subsequent commands.

## Options for auto-create mode

The command can accept optional flags to customize the created feedback:

```bash
/done "Title" "Description" --module create --tab generator --type bug
```

| Option | Default | Description |
|--------|---------|-------------|
| `--module` | system | Module where work was done |
| `--tab` | general | Tab within the module |
| `--type` | feature | bug, feature, or general |

## When to use each mode

| Scenario | Use |
|----------|-----|
| Working on user-submitted feedback | Mode 1 (complete existing) |
| Working on feedback from `/fb` | Mode 1 (complete existing) |
| Quick fix you did without a ticket | Mode 2 (auto-create) |
| Refactoring/cleanup work | Mode 2 (auto-create) |
| Small improvement you just made | Mode 2 (auto-create) |

## Workflow context

- `completed` items are staged for the next release
- Auto-created items are marked `internal-only` by default (won't appear in user changelog)
- When `/release` runs, all completed items are archived and tagged with the version
