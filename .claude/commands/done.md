---
description: Mark the current feedback item as completed
allowed-tools: Bash Read
---

# Done Command

Mark the current feedback item as `completed` after you've reviewed and approved the work.

## Usage

When you've reviewed a feedback item and verified it works correctly, use this command to move it to the completed column.

The command supports two notes formats:

### Basic (admin notes only)

```bash
/done <document-id> "Brief summary of what was changed"
```

### Full (admin notes + user-facing notes)

```bash
/done <document-id> "Admin notes" "User-facing notes"
```

**Examples:**

```bash
# Basic - admin notes only (for internal fixes)
/done abc123xyz "Fixed card height overflow in Kanban board"

# Full - with user-facing message (for user-submitted feedback)
/done abc123xyz "Fixed card overflow" "Cards now display at the correct height without being cut off"
```

**Note:** The document ID is shown when the agent runs `/fb`. Copy it from the agent's output.

## What happens

1. Moves the feedback item from any status to `completed`
2. Updates `adminNotes` (admin-only) with your summary
3. Updates `userFacingNotes` (visible to submitter) if provided
4. The item is now staged for the next release
5. If user-facing notes are provided, the submitter is notified

## When to include user-facing notes

| Scenario | Include user-facing notes? |
|----------|---------------------------|
| User-submitted feedback (source: "app") | Yes - they want to know what changed |
| Admin/internal features | No - they won't see it anyway |
| Terminal-submitted feedback (source: "terminal") | Optional - depends on context |
| Bug fixes visible to users | Yes - explain the improvement |
| Refactoring/infrastructure | No - not user-visible |

## Resolution notes guidelines

### Admin notes (adminNotes)

- **Brief summary** of what was fixed (1 line, ~5-10 words)
- Focus on **WHAT** was addressed, not HOW
- Example: "Fixed card height overflow"
- NOT: "Updated MyFeedbackCard.svelte:88-92 to set min-height: 120px"
- NO file paths, line numbers, or testing steps

### User-facing notes (userFacingNotes)

- **Friendly explanation** for the person who submitted feedback
- Use natural language, not technical jargon
- Focus on the **benefit** or **change** they'll notice
- Example: "Cards now display at the correct height without being cut off"
- NOT: "Fixed the CSS min-height property on the card component"

## Workflow context

- `completed` items are staged for the next release
- They stay visible in the "completed" column until `/release` is run
- When `/release` runs, they're archived and tagged with the version number
- This lets you batch multiple fixes into one release

## Full workflow

1. Agent runs `/fb` - claims item, moves to `in-progress`
2. Agent implements fix - moves to `in-review`, adds resolution notes
3. **You review and test** - run `/done` - moves to `completed`
4. Later, run `/release` - batches all completed items into a versioned release

## Implementation

The command will extract the document ID and notes from the command arguments and run:

```bash
# Basic (admin notes only)
node scripts/fetch-feedback.js <document-id> completed "admin notes"

# Full (with user-facing notes)
node scripts/fetch-feedback.js <document-id> completed "admin notes" --user-notes "user-facing notes"
```

This marks the item as completed and ready for the next release.
