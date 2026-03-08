---
description: Track grant deadlines, manage applications, and draft proposals section by section
argument-hint: "[status|deadlines|<id>|<id> draft|<id> status <new-status>|add|research <query>]"
---

# Grant Tracker & Drafting Assistant

Manage grant applications from discovery through submission, with section-by-section drafting workshops.

## Data Files

- **Tracker:** `docs/grants/grant-tracker.md` (source of truth for all grants)
- **Knowledge base:** `docs/grants/grant-writing-knowledge.md` (read during drafting)
- **Drafts:** `docs/grants/drafts/<id>-<section-slug>.md` (approved draft sections)

## Commands

| Command | What it does |
|---------|-------------|
| `/grant` or `/grant status` | Dashboard with all grants, deadlines, days remaining |
| `/grant deadlines` | Upcoming deadlines sorted by urgency with alerts |
| `/grant <id>` | Full details for a specific grant (e.g., `/grant CC`) |
| `/grant <id> draft` | Start or continue section-by-section drafting workshop |
| `/grant <id> status <status>` | Update status |
| `/grant add` | Add a new grant opportunity interactively |
| `/grant research <query>` | Web search for new opportunities matching Austen's profile |

## Arguments

$ARGUMENTS - Command and optional grant ID or query

## Instructions

### For no arguments or "status":

**STEP 1:** Read `docs/grants/grant-tracker.md`

**STEP 2:** Display dashboard:

```
Grant Applications — [today's date]

  ID     Name                  Status        Deadline    Days Left  Amount
  CC     Creative Capital      drafting      Apr 2       26 days    $50K
  LACMA  Art + Tech Lab        not-started   Apr 22      46 days    $50K
  ...

  Next action: [most urgent incomplete task]
```

**STEP 3:** Flag urgency levels:
- Under 7 days: CRITICAL
- Under 14 days: URGENT
- Under 30 days: APPROACHING

### For "deadlines":

Same as status but sorted by deadline, only showing upcoming grants (not waiting/submitted/awarded/rejected). Include the action items section from the tracker.

### For "<id>":

Read the tracker, find the grant by ID (case-insensitive), display all fields including checked/unchecked sections.

### For "<id> draft":

This is the core drafting workflow. Follow it precisely.

**STEP 1:** Read `docs/grants/grant-tracker.md` to get the grant details and see which sections are done.

**STEP 2:** Read `docs/grants/grant-writing-knowledge.md` for the knowledge base.

**STEP 3:** If this grant has specific application requirements listed (sections with word/char limits), proceed. If sections say "TBD", first web search for the application requirements and update the tracker with actual sections before drafting.

**STEP 4:** Find the first unchecked section. Tell the user which section you're working on and its constraints (word count, character limit, what reviewers look for).

**STEP 5:** Pull relevant context. Depending on the section, read from:
- `docs/museum/story-bible.md` — for project description, narrative concept
- `docs/grants/grant-tracker.md` — for framing notes
- The codebase itself — for technical description of what TKA Scribe does
- Previous approved drafts in `docs/grants/drafts/` — for consistency

**STEP 6:** Draft the section. Follow these rules:

#### Drafting Rules

1. **Sound like Austen, not like a grant writer.** Direct, confident, no art-speak. Apply every rule from the AI-isms section of CLAUDE.md. If a sentence could appear in any grant application for any project, rewrite it until it couldn't.

2. **Be specific about what exists.** TKA Scribe is a working web application. The notation system has defined letter forms, position classifications, and rotation tracking. The museum game has a 350-line story bible. Say what's real.

3. **Don't overclaim.** TKA is for dual-wielded rigid gripped props. Not all flow arts. Not all movement. Not dance notation. Be precise about scope.

4. **Lead with the concrete, follow with the vision.** "I built a notation system for movement arts. 24 letter forms map hand positions through space. A web app renders them in real time. Now I'm building the cultural argument for why this matters — a narrative game set in an abandoned government archive." Not the other way around.

5. **Hit the word count, not over it.** If the limit is 150 words, draft at 140-148. Reviewers notice when you hit the limit exactly — it suggests you had more to say. Slightly under says you said what you needed.

6. **Answer the actual question.** Read the prompt three times before drafting. If they ask about innovation, talk about innovation, not influences. If they ask about impact, talk about audiences, not technique.

7. **No fabricated statistics.** Don't invent user counts, community sizes, or impact metrics. If a number isn't verified, don't use it.

8. **The fire jam test applies.** If Austen wouldn't say it to another spinner, rewrite it.

**STEP 7:** Present the draft with:
- The section name and constraints
- The word count and character count
- The draft itself
- 2-3 specific questions for the user ("Does this accurately describe...?" "Should I emphasize X more?")

**STEP 8:** Workshop with the user. Revise based on feedback. When they approve:
1. Save to `docs/grants/drafts/<id>-<section-slug>.md`
2. Check off the section in `docs/grants/grant-tracker.md`
3. Ask if they want to continue to the next section

### For "<id> status <status>":

Valid statuses: `not-started`, `researching`, `drafting`, `submitted`, `awarded`, `rejected`, `waiting`

Update the status field in the tracker file. If moving to `submitted`, congratulate and note the date. If `rejected`, ask what feedback was given and note it for future applications.

### For "add":

Ask the user for:
1. Grant name
2. Deadline
3. Amount
4. URL
5. Which framing angle fits best

Generate a short ID (2-5 uppercase letters). Add to the tracker with sections TBD. Suggest web searching for application requirements.

### For "research <query>":

Web search for grant opportunities matching the query plus Austen's profile (individual artist, Chicago, technology + art, notation system, video game, flow arts). Present findings with:
- Grant name and organization
- Amount and deadline
- Why it fits (or doesn't)
- Whether it's worth pursuing

## Urgency Protocol

When `/grant` or `/grant status` is invoked and any grant is CRITICAL (under 7 days):

```
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  CRITICAL: [Grant Name] due in [N] days
  [X] of [Y] sections complete
  Run /grant <id> draft to continue
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
```

## The Reviewer Simulation

During drafting, after each section is approved, optionally offer: "Want me to simulate a skeptical reviewer reading this?" If yes, critique the section from the perspective of someone who:
- Has read 200 applications today
- Knows nothing about flow arts
- Is looking for reasons to say no (because they can only fund 15-20%)
- Flags anything generic, unclear, or overclaimed

This helps stress-test before submission.

## Statuses

`not-started` -> `researching` -> `drafting` -> `submitted` -> `awarded` or `rejected`

`waiting` = deadline hasn't opened yet (e.g., Chicago IAP for 2027)

## Rules

1. **Never fabricate grant opportunities.** Only recommend grants found via web search with real URLs.
2. **Never submit on behalf of the user.** Drafting and tracking only.
3. **Respect word limits absolutely.** A 500-word limit means 500 words, not 501.
4. **Save every approved draft.** The user's approved words are precious.
5. **Track everything in the tracker file.** It's the source of truth.
6. **When in doubt about Austen's voice, ask.** Better to pause than to write something that sounds like a language model wrote it.
7. **Read the knowledge base before every drafting session.** The grant writing research is in there for a reason.
