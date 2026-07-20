---
name: submitfb
description: Use when submitting a bug report, feature request, or feedback item to the tracker
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Submit Feedback

Extract from conversation context:
- **Title:** Concise summary (max 80 chars)
- **Description:** Detailed description
- **Type:** bug / feature / general
- **Priority:** low / medium / high / critical
- **Module/Tab:** If mentioned, otherwise system/general

## Scope

Submission only. For working on existing feedback, use `$fb`. For marking items done, use `$done`.

## Show Preview

```
Title: [title]
Type: [type]
Priority: [priority]
Module: [module] / [tab]

Description:
[description]
```

## Submit (after confirmation)

```powershell
node scripts/submit-feedback.js "Title" "Description" --type [type] --priority [priority] --module [module] --tab [tab]
```

Report result with feedback ID.
