---
description: Work with museum development tracking system
argument-hint: "[session|capture|create|link|search|<id>]"
allowed-tools: Bash(node:*)
---

# Museum Development Tracking System

Track creative worldbuilding decisions, brainstorming sessions, and design evolution with full traceability.

## Usage

- `/museum` - List all museum development items
- `/museum session "Title"` - Start a new brainstorming session
- `/museum capture <sessionId> decision "Content"` - Capture a decision during session
- `/museum capture <sessionId> question "Content"` - Capture a question during session
- `/museum <id>` - View item details
- `/museum <id> verdict accepted "Rationale"` - Set verdict on a decision
- `/museum link <from> <to> spawned "Note"` - Link two items
- `/museum search "query"` - Search items

## Arguments

$ARGUMENTS - Command and arguments (see help for full list)

## Instructions

### For no arguments or "list":

Show the current museum development tracker status:
```bash
node scripts/museum-dev.js list
```

### For "session <title>":

Start a new brainstorming session:
```bash
node scripts/museum-dev.js session "Session Title"
```

This creates a session item and returns its ID. Use this ID with `capture` commands to link decisions/questions to the session.

### For "capture <sessionId> <type> <content>":

Quickly capture an item during a brainstorming session:
```bash
node scripts/museum-dev.js capture <sessionId> decision "The Order are tragic protectors, not villains"
node scripts/museum-dev.js capture <sessionId> question "Why hasn't the Order silenced Austen?"
```

Valid types: `session`, `decision`, `question`, `element`, `reference`

The captured item is automatically linked to the session with a "spawned" relationship.

### For "session-end <sessionId>":

End a session and optionally attach the transcript:
```bash
node scripts/museum-dev.js session-end <sessionId>
node scripts/museum-dev.js session-end <sessionId> --transcript ./transcript.md
```

### For "create <type> <title>":

Create a standalone item (not linked to a session):
```bash
node scripts/museum-dev.js create decision "Title"
node scripts/museum-dev.js create question "Title"
node scripts/museum-dev.js create element "Title" --element-type wing
node scripts/museum-dev.js create reference "Title"
```

Element subtypes: `wing`, `artifact`, `plaque`, `character`, `mechanic`, `audio`, `visual`

### For "<id>" (viewing an item):

View full details of an item:
```bash
node scripts/museum-dev.js <id>
```

Partial IDs (8+ characters) are resolved automatically.

### For "<id> <status>":

Update item status:
```bash
node scripts/museum-dev.js <id> in-progress "Starting work"
node scripts/museum-dev.js <id> completed "Documented in museum-layout.md"
```

Valid statuses: `new`, `in-progress`, `in-review`, `completed`, `archived`

### For "<id> verdict <type> <rationale>":

Set a verdict on a decision:
```bash
node scripts/museum-dev.js <id> verdict accepted "Aligns with the protective tragedy theme"
node scripts/museum-dev.js <id> verdict rejected "Too on-the-nose, breaks immersion"
node scripts/museum-dev.js <id> verdict deferred "Revisit after Phase 2"
node scripts/museum-dev.js <id> verdict superseded "Replaced by decision XYZ"
```

- `accepted` moves the item to completed
- `rejected` archives the item but preserves it for historical context
- `deferred` keeps it for later consideration
- `superseded` indicates it was replaced by a better idea

### For "<id> answer <answer>":

Answer a question item:
```bash
node scripts/museum-dev.js <id> answer "The Order hasn't silenced Austen because..."
```

### For "link <from> <to> <type> [note]":

Create a bidirectional link between items:
```bash
node scripts/museum-dev.js link <sessionId> <decisionId> spawned "From brainstorm"
node scripts/museum-dev.js link <id1> <id2> derived "Evolved from"
node scripts/museum-dev.js link <id1> <id2> related "See also"
node scripts/museum-dev.js link <id1> <id2> contradicts "Conflicts with"
node scripts/museum-dev.js link <questionId> <decisionId> answers "This resolves the question"
```

Link types: `spawned`, `derived`, `related`, `contradicts`, `answers`

### For "links <id>":

Show all links to/from an item:
```bash
node scripts/museum-dev.js links <id>
```

### For "trace <id>":

Trace an item back to its source session(s):
```bash
node scripts/museum-dev.js trace <id>
```

### For "tree <sessionId>":

Show all items spawned from a session:
```bash
node scripts/museum-dev.js tree <sessionId>
```

### For "search <query>":

Search across all items:
```bash
node scripts/museum-dev.js search "order"
node scripts/museum-dev.js search "vtg"
```

### For "journal <id>":

View the activity journal for an item:
```bash
node scripts/museum-dev.js journal <id>
```

### For "transcript <sessionId>":

View the full transcript attached to a session:
```bash
node scripts/museum-dev.js transcript <sessionId>
```

### For tags and attachments:

```bash
node scripts/museum-dev.js <id> tag add order
node scripts/museum-dev.js <id> tag remove vtg
node scripts/museum-dev.js <id> attach ./concept-art.png "Early Order concept"
node scripts/museum-dev.js <id> attach-url https://... "Reference material"
node scripts/museum-dev.js <id> attachments
```

### For help:

```bash
node scripts/museum-dev.js help
```

## Workflow Example

1. **Start a session:**
   ```bash
   node scripts/museum-dev.js session "Order motivation brainstorm"
   # Returns: SESSION_ID=abc123xyz
   ```

2. **Capture ideas during conversation:**
   ```bash
   node scripts/museum-dev.js capture abc123 decision "Order = tragic protectors, not villains"
   node scripts/museum-dev.js capture abc123 question "Why hasn't Order silenced Austen?"
   node scripts/museum-dev.js capture abc123 decision "VTG origin story - Oakland fire spinners"
   ```

3. **End session with transcript:**
   ```bash
   node scripts/museum-dev.js session-end abc123 --transcript ./session-transcript.md
   ```

4. **Set verdicts later:**
   ```bash
   node scripts/museum-dev.js <decisionId> verdict accepted "Core to the narrative"
   ```

5. **Trace any decision back to its source:**
   ```bash
   node scripts/museum-dev.js trace <decisionId>
   ```

## Key Principles

1. **Capture everything** - rejected ideas are as valuable as accepted ones for understanding the creative process
2. **Link liberally** - connections help trace the evolution of ideas
3. **Store transcripts** - raw conversations are more valuable than summaries
4. **Set verdicts** - accepted/rejected/deferred helps filter but preserves history
5. **Trace back** - any decision should be traceable to the session that spawned it
