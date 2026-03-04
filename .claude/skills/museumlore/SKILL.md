---
name: museumlore
description: Use when the user wants to discuss, analyze, or brainstorm museum lore and narrative elements for The Kinetic Archive. Triggers on /museumlore or when conversation focuses on worldbuilding, story consistency, or narrative design.
---

# Museum Lore Deep Dive

## Overview

Focus exclusively on the Lore & Narrative department of The Kinetic Archive museum project. No dispatching department agents, no full audits. Just lore discussion. Writers' room energy.

## Usage

- `/museumlore` - Review all lore items and open a focused discussion
- `/museumlore strengths` - Analyze the strongest elements of the lore system
- `/museumlore weaknesses` - Analyze the weakest elements and unresolved questions
- `/museumlore <id>` - Deep dive on a specific lore item
- `/museumlore session "Title"` - Start a lore-focused brainstorming session

## Instructions

### For no arguments or "strengths" or "weaknesses":

**Step 1: Load all lore items**

```bash
node scripts/museum-dev.js list --tag lore
```

Read key items in detail (especially audit-tagged questions and accepted decisions).

**Step 2: Analyze and discuss**

For **strengths**: Identify the lore elements that are most internally consistent, narratively compelling, comedically effective, and structurally sound. Explain WHY each element works — what it solves, what it enables, how it connects to other lore elements.

For **weaknesses**: Identify unresolved questions, potential contradictions, thin areas, and elements that haven't been stress-tested. Be specific about what breaks and why.

For **no arguments**: Present a brief status overview, then ask the user what angle they want to explore.

**Step 3: Conversational mode**

This is a DISCUSSION skill, not a dispatch-and-report skill. After the initial analysis, engage in back-and-forth with the user. Propose ideas, challenge assumptions, build on their responses. Think like a writers' room collaborator.

### For "<id>":

Read the item in detail and all linked items:
```bash
node scripts/museum-dev.js <id>
node scripts/museum-dev.js links <id>
node scripts/museum-dev.js trace <id>
```

Present the full context — the decision, its origin session, what it answers, what it links to — then discuss its implications and whether it's holding up.

### For "session <title>":

Start a lore brainstorming session:
```bash
node scripts/museum-dev.js session "Title"
```

During the session, capture ideas as they emerge. **Use the correct type based on provenance:**
```bash
# User-directed idea → decision
node scripts/museum-dev.js capture <sessionId> decision "Content"

# Claude-generated idea, user said "sure" → proposal
node scripts/museum-dev.js capture <sessionId> proposal "Content"

# Open question → question
node scripts/museum-dev.js capture <sessionId> question "Content"
```

Tag all captures with `lore`:
```bash
node scripts/museum-dev.js <capturedId> tag add lore
```

## Key Principles

- This is writers' room energy, not project management
- Challenge lore that sounds good but doesn't hold up under scrutiny
- Connect dots between decisions — the best lore is a web, not a list
- When something is strong, explain the structural reason it works
- When something is weak, propose specific fixes, not vague concerns
- Capture any decisions or questions that emerge during discussion
- **Proposals, not decisions** — Claude's ideas are captured as `proposal` type, not `decision`. Only the user can promote a proposal to a decision. See `/museum` skill for full rules.
- **One pushback before capture** — Before saving a Claude-generated idea, give one honest counterargument.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Capturing Claude's idea as `decision` | Always use `proposal`. Only the user promotes to `decision`. |
| Citing previous Claude output as "the strongest element" | That's a feedback loop, not evaluation. Judge lore on structural merit, not who wrote it. |
| Switching to project management mode | Stay in writers' room. Discuss narrative, don't track tasks. |
| Vague criticism ("this feels weak") | Be specific: what breaks, what contradicts, what's untested. |
| Forgetting to tag captures with `lore` | Every capture from this skill gets `node scripts/museum-dev.js <id> tag add lore`. |
