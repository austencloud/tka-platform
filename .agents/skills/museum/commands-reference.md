# Museum Commands Reference

Detailed per-command workflows, the proposal system, and examples.

---

## Per-Command Instructions

### For no arguments (Department Briefing):

**This is the orchestrator workflow.** Dispatch one Codex subagent per department, in batches that respect the current concurrency limit. Collect their briefings, then synthesize.

**Step 1: Dispatch department agents in parallel**

Dispatch the seven department prompts through Codex subagents, using only the available concurrency slots. Each agent gets this prompt template (fill in the department name and tag):

```
You are the {DEPARTMENT_NAME} department manager for The Kinetic Archive museum project.

Your job: Review all items in your department and produce a concise status briefing.

Run this command to get your department's items:
  node scripts/museum-dev.js list --tag "{TAG}"

Then for any items that look important (audit items, unanswered questions, recent decisions), read their full details:
  node scripts/museum-dev.js {itemId}

Produce a briefing in EXACTLY this format:

## {DEPARTMENT_NAME}
**Items:** [total] | **Decided:** [count with verdict] | **Open:** [count without verdict] | **Questions:** [answered/total]
**Audit concerns:** [count, or "None"]

**Status summary:** [2-3 sentences on current state — what's solid, what's unresolved]

**Top priority:** [The single most important thing to address next in this department, and why]

**Blockers/dependencies:** [What this department is waiting on from other departments, or "None"]

Keep it tight. No filler. The orchestrator will synthesize across all 7 departments.
```

The 7 departments and their tags:
1. Lore & Narrative → `lore`
2. Exhibit Design → `exhibit-design`
3. Experience Design → `experience-design`
4. Art Direction → `art-direction`
5. Audio → `audio`
6. Engineering → `engineering`
7. Production → `production`

**Step 2: Synthesize briefings**

After all 7 agents return, present the combined briefing to the user with:

1. **Dashboard** — all 7 department summaries stacked
2. **Cross-department dependencies** — what's blocking what across departments
3. **Audit concerns** — any unresolved audit items across all departments
4. **Recommended focus** — your recommendation for what to work on next, with reasoning based on dependencies and urgency. Consider:
   - Audit concerns that affect multiple departments (address first)
   - Departments with unanswered questions that block other departments
   - Departments with the most open/unverdicted decisions
   - What the user worked on most recently (check session dates)

**Step 3: Joint decision**

Ask the user what they want to focus on. Present 3-4 options based on the briefing analysis.

### For "list":

Show the museum development tracker item list:
```powershell
node scripts/museum-dev.js list
node scripts/museum-dev.js list --tag lore
node scripts/museum-dev.js list --type decision --status completed
```

### For a department name (e.g., "lore", "engineering", "exhibit-design"):

Focus on a single department. Run:
```powershell
node scripts/museum-dev.js list --tag "{department-tag}"
```

Then read key items and present a detailed department view — not just the list, but analysis of what's decided vs open, what needs attention, and what to work on next within that department.

**Note:** Items must be tagged with the department tag to appear. If a department shows no items, existing items may need tagging.

### For "session <title>":

Start a new brainstorming session:
```powershell
node scripts/museum-dev.js session "Session Title"
```

This creates a session item and returns its ID. Use this ID with `capture` commands to link decisions/questions to the session.

### For "capture <sessionId> <type> <content>":

Quickly capture an item during a brainstorming session:
```powershell
node scripts/museum-dev.js capture <sessionId> decision "The Order are tragic protectors, not villains"
node scripts/museum-dev.js capture <sessionId> question "Why hasn't the Order silenced Austen?"
```

Valid types: `session`, `decision`, `question`, `element`, `reference`, `proposal`

**IMPORTANT:** When the agent generates an idea and the user approves casually ("sure", "yeah", "cool"), capture it as a `proposal`, NOT a `decision`. See the Proposal System section below.

The captured item is automatically linked to the session with a "spawned" relationship.

### For "session-end <sessionId>":

End a session and optionally attach the transcript:
```powershell
node scripts/museum-dev.js session-end <sessionId>
node scripts/museum-dev.js session-end <sessionId> --transcript ./transcript.md
```

**Before ending any session, resolve all captures:**

1. Run `node scripts/museum-dev.js tree <sessionId>` to list all spawned items
2. For each item:
   - **Decision** -> mark `completed` if approved
   - **Proposal** -> promote (`museum promote <id>`) or reject (`museum <id> verdict rejected "reason"`)
   - **Question** -> answer (`museum <id> answer "..."`) or tag with `carries-to-next-session`
3. No orphaned proposals or unanswered questions should remain

**For lore sessions:** Use `$museum-lore` instead — it adds story bible sync and stricter close hygiene.

### For "create <type> <title>":

Create a standalone item (not linked to a session):
```powershell
node scripts/museum-dev.js create decision "Title"
node scripts/museum-dev.js create question "Title"
node scripts/museum-dev.js create element "Title" --element-type wing
node scripts/museum-dev.js create reference "Title"
```

Element subtypes: `wing`, `artifact`, `plaque`, `character`, `mechanic`, `audio`, `visual`

### For "<id>" (viewing an item):

View full details of an item:
```powershell
node scripts/museum-dev.js <id>
```

Partial IDs (8+ characters) are resolved automatically.

### For "<id> <status>":

Update item status:
```powershell
node scripts/museum-dev.js <id> in-progress "Starting work"
node scripts/museum-dev.js <id> completed "Documented in museum-layout.md"
```

Valid statuses: `new`, `in-progress`, `in-review`, `completed`, `archived`

### For "<id> verdict <type> <rationale>":

Set a verdict on a decision:
```powershell
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
```powershell
node scripts/museum-dev.js <id> answer "The Order hasn't silenced Austen because..."
```

### For "link <from> <to> <type> [note]":

Create a bidirectional link between items:
```powershell
node scripts/museum-dev.js link <sessionId> <decisionId> spawned "From brainstorm"
node scripts/museum-dev.js link <id1> <id2> derived "Evolved from"
node scripts/museum-dev.js link <id1> <id2> related "See also"
node scripts/museum-dev.js link <id1> <id2> contradicts "Conflicts with"
node scripts/museum-dev.js link <questionId> <decisionId> answers "This resolves the question"
```

Link types: `spawned`, `derived`, `related`, `contradicts`, `answers`

### For "links <id>":

Show all links to/from an item:
```powershell
node scripts/museum-dev.js links <id>
```

### For "trace <id>":

Trace an item back to its source session(s):
```powershell
node scripts/museum-dev.js trace <id>
```

### For "tree <sessionId>":

Show all items spawned from a session:
```powershell
node scripts/museum-dev.js tree <sessionId>
```

### For "search <query>":

Search across all items:
```powershell
node scripts/museum-dev.js search "order"
node scripts/museum-dev.js search "vtg"
```

### For "journal <id>":

View the activity journal for an item:
```powershell
node scripts/museum-dev.js journal <id>
```

### For "transcript <sessionId>":

View the full transcript attached to a session:
```powershell
node scripts/museum-dev.js transcript <sessionId>
```

### For tags and attachments:

```powershell
node scripts/museum-dev.js <id> tag add order
node scripts/museum-dev.js <id> tag remove vtg
node scripts/museum-dev.js <id> attach ./concept-art.png "Early Order concept"
node scripts/museum-dev.js <id> attach-url https://... "Reference material"
node scripts/museum-dev.js <id> attachments
```

### For help:

```powershell
node scripts/museum-dev.js help
```

---

## Workflow Example

1. **Start a session:**
   ```powershell
   node scripts/museum-dev.js session "Order motivation brainstorm"
   # Returns: SESSION_ID=abc123xyz
   ```

2. **Capture ideas during conversation:**
   ```powershell
   node scripts/museum-dev.js capture abc123 decision "Order = tragic protectors, not villains"
   node scripts/museum-dev.js capture abc123 question "Why hasn't Order silenced Austen?"
   node scripts/museum-dev.js capture abc123 decision "VTG origin story - Oakland fire spinners"
   ```

3. **End session with transcript:**
   ```powershell
   node scripts/museum-dev.js session-end abc123 --transcript ./session-transcript.md
   ```

4. **Set verdicts later:**
   ```powershell
   node scripts/museum-dev.js <decisionId> verdict accepted "Core to the narrative"
   ```

5. **Trace any decision back to its source:**
   ```powershell
   node scripts/museum-dev.js trace <decisionId>
   ```

---

## Proposal System — Preventing the AI Feedback Loop

**The problem:** The agent generates an idea, user says "sure," and future agent sessions treat it as a load-bearing decision. The agent ends up citing its own previous output as evidence of quality. This is a closed loop.

### The Rules

1. **Agent-generated ideas are proposals, not decisions.** When the agent generates a creative idea during a session (lore, exhibit concepts, narrative structure, tone), capture it as type `proposal` unless the user explicitly directs otherwise.

2. **"Sure" is not conviction.** Casual user approval ("yeah", "cool", "that works", "sure") means "I don't object" — not "this is the direction." Capture as `proposal`.

3. **Decisions require explicit user direction.** Capture as `decision` only when:
   - The user originated the idea themselves
   - The user explicitly says something like "that's the direction, lock it in" or "yes, make that a decision"
   - The user promotes a proposal via `$museum promote <id>`

4. **Never cite your own quality.** The agent must never describe its own previous output as "the best writing," "the strongest element," or similar self-evaluation. It can say "previously captured as a proposal" but not "previously identified as excellent."

5. **One honest pushback before capture.** Before saving an agent-generated idea (even as a proposal), give one real counterargument — an actual reason it might be wrong. Not performative. If the idea survives and the user engages, it's stronger.

6. **Provenance is automatic.** Proposals are tagged with `proposedBy: claude` by default. When reading proposals in future sessions, The agent should note this provenance and not treat them as user-directed decisions.

### Commands

```powershell
# Capture the agent's idea as a proposal (DEFAULT for agent-generated ideas)
node scripts/museum-dev.js capture <sessionId> proposal "The MEH room should be physically smaller"

# Promote a proposal to a decision (ONLY when user explicitly directs)
node scripts/museum-dev.js promote <proposalId>
```

### How to Read Proposals in Future Sessions

When encountering a proposal in the tracker:
- Treat it as **scaffolding that hasn't been stress-tested**
- Don't build load-bearing narrative on top of unreviewed proposals
- If you need to reference it, say "there's a proposal that..." not "it was decided that..."
- Flag it for the user: "This was an agent-generated proposal from [date]. Want to keep it, modify it, or kill it?"

---

## Evaluation Integrity

- **Never cite a previous session's quality judgment as your own.** If you're about to say "this is the strongest/weakest/best element," check: did you evaluate it just now, or are you repeating what a previous Claude session said? If the judgment traces to an agent-generated item, flag it as inherited and evaluate fresh.
- **Don't present the user's existing plans back as new ideas.** If the tracker already contains a decision about X, reference it ("the existing plan for X does this — one refinement might be...") instead of "discovering" it.
- **Docs may be stale.** When a doc and a tracker decision conflict, the tracker decision wins. Flag the doc for update.

---

## Key Principles

1. **Capture everything** — rejected ideas are as valuable as accepted ones for understanding the creative process
2. **Link liberally** — connections help trace the evolution of ideas
3. **Store transcripts** — raw conversations are more valuable than summaries
4. **Set verdicts** — accepted/rejected/deferred helps filter but preserves history
5. **Trace back** — any decision should be traceable to the session that spawned it
6. **Proposals are not decisions** — Agent-generated ideas stay proposals until the user promotes them
