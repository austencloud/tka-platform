---
description: Submit feedback to tracking system
---

# Submit Feedback

Extract from conversation context:
- **Title:** Concise summary (max 80 chars)
- **Description:** Detailed description
- **Type:** bug / feature / general
- **Priority:** low / medium / high / critical
- **Module/Tab:** If mentioned, otherwise system/general

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

```bash
node scripts/submit-feedback.js "Title" "Description" --type [type] --priority [priority] --module [module] --tab [tab]
```

Report result with feedback ID.
