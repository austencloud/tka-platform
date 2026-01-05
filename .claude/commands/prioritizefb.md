---
description: Auto-prioritize all unprioritized feedback items using AI analysis
allowed-tools: Bash
---

# AI-Powered Feedback Prioritization

You are prioritizing feedback for TKA-Studio, an application for **flow artists** who create choreography with spinning props (staff, clubs, fans, etc.).

## Step 1: Fetch unprioritized items

Run this command to get all feedback items that need prioritization:

```bash
node scripts/fetch-feedback.js.js prioritize --json
```

This returns JSON with all "new" status items that have no priority set.

## Step 2: Analyze each item

For each feedback item, determine priority (high/medium/low) based on:

### HIGH Priority

- **Blocks core workflows** - users can't create, save, or share choreography
- **Data loss risk** - sequences could be lost, settings not saved
- **Crashes or freezes** - app becomes unusable
- **Auth/security issues** - users locked out, data exposed
- **Affects many users** - core features everyone uses

### MEDIUM Priority

- **Degrades experience** - feature works but poorly (slow, janky, confusing)
- **Missing expected functionality** - "I expected X to do Y but it doesn't"
- **Moderate UX friction** - extra clicks, confusing flow, poor feedback
- **New features that would help workflows** - not just nice-to-have

### LOW Priority

- **Polish/cosmetic** - visual tweaks, minor alignment, icon preferences
- **Edge cases** - rare scenarios, unusual configurations
- **Nice-to-haves** - "it would be cool if..." without clear workflow benefit
- **Preferences** - personal taste rather than usability issues

### Context matters more than keywords

- A bug labeled "minor" might actually block a workflow → HIGH
- A feature request with urgent language might just be a nice-to-have → LOW
- Consider: How many flow artists would be affected? How severely?

## Step 3: Present your analysis

Show a table with your recommendations:

| Priority | ID (first 8 chars) | Type    | Summary              | Reasoning                |
| -------- | ------------------ | ------- | -------------------- | ------------------------ |
| HIGH     | abc12345           | bug     | Can't save sequences | Blocks core workflow     |
| MEDIUM   | def67890           | feature | Add undo button      | Would improve editing UX |
| LOW      | ghi11223           | general | Change icon color    | Cosmetic preference      |

## Step 4: Ask for confirmation

Ask the user:

- "Apply these priorities?"
- Or if they want to adjust any before applying

## Step 5: Apply priorities (after confirmation)

For each item, run:

```bash
node scripts/fetch-feedback.js.js <id> priority <high|medium|low>
```

You can batch these with `&&` for efficiency.

## Important

- If there are no unprioritized items, just report that
- Be thoughtful - the point is to make better judgments than keyword matching
- Consider the TKA-Studio context: flow artists creating choreography, not developers
