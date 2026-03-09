# TKA Contributor Guide

Hey Kevin. Here's everything you need to start contributing.

---

## Get Running (5 minutes)

```bash
# 1. Clone and install
git clone https://github.com/austencloud/the-kinetic-alphabet.git
cd the-kinetic-alphabet
npm install

# 2. Create your Firebase account (one-time)
# Visit https://tkascribe.com and sign in with Google

# 3. Open Claude Code in this repo and type:
/fb
```

That's it. If you're not logged in yet, a browser window opens for Google sign-in. Once authenticated, Claude picks a feedback item and you start working.

After you log in, send Austen your email so he can add you as a contributor.

---

## How It Works

The project tracks bugs, features, and ideas as **feedback items** in a shared queue. You pick one, fix it, submit it for review. Austen tests it and either ships it or sends it back.

```
  You claim it          You fix it            Austen reviews it
┌──────────┐      ┌──────────────┐      ┌───────────────────┐
│   new    │ ───▸ │ in-progress  │ ───▸ │    in-review      │
└──────────┘      └──────────────┘      └───────────────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    ▼                     ▼
                              ┌──────────┐         ┌───────────┐
                              │completed │         │ back to   │
                              │ (ships!) │         │ you       │
                              └──────────┘         └───────────┘
```

---

## The Main Command: `/fb`

This is your primary workflow. Type it in Claude Code and Claude handles the rest.

| Command | What it does |
|---------|-------------|
| `/fb` | Auto-pick the best unclaimed item and start working |
| `/fb yfTRt6UK` | Claim a specific item by ID and start working |
| `/done` | Mark your current work done and submit for review |

Claude reads the feedback, understands the codebase, assesses complexity, and helps you implement the fix. When you're done, `/done` wraps it up and notifies Austen.

---

## Other Useful Commands

These are slash commands you type directly in Claude Code:

| Command | What it does |
|---------|-------------|
| `/check` | Find and fix TypeScript errors |
| `/commit` | Analyze your changes and commit in clean, logical chunks |
| `/submitfb` | Found a bug? Submit it to the feedback queue |
| `/audit` | Audit a module or component for code quality |
| `/monolith` | Detect files that are too large and need splitting |
| `/deadcode` | Find and remove unused code |
| `/ship` | Check if a feature is production-ready |
| `/screenshots` | Take screenshots across 9 device sizes at once |

You don't need to memorize these. Claude suggests them when relevant.

---

## Manual CLI Commands

If you prefer working outside Claude Code, or need finer control:

```bash
# See the queue
node scripts/fetch-feedback.js list

# Claim something specific
node scripts/fetch-feedback.js claim yfTRt6UK

# See what you're working on
node scripts/fetch-feedback.js mine

# View full details on an item
node scripts/fetch-feedback.js yfTRt6UK

# Submit your work for review
node scripts/fetch-feedback.js yfTRt6UK in-review "Fixed the layout bug"

# Keep your claim alive during long sessions (claims go stale after 45 min)
node scripts/fetch-feedback.js heartbeat yfTRt6UK "still on it"

# Check your identity
node scripts/fetch-feedback.js whoami

# Full command list
node scripts/fetch-feedback.js help
```

---

## Your Permissions

| You can | You can't (admin only) |
|---------|----------------------|
| View all feedback | Change priority |
| Claim and work on items | Mark items as completed |
| Submit work for review | Archive items |
| Create new feedback | Delete others' feedback |
| Delete your own feedback | Manage developers |

When you submit for review, Austen gets an email and an in-app notification. He tests it and moves it forward.

---

## Troubleshooting

**Browser doesn't open during login**
Copy the URL from the terminal and paste it into your browser manually.

**"Could not sign into Firebase"**
Visit https://tkascribe.com and sign in with Google first. This creates your Firebase account.

**"Permission denied" on commands**
Austen hasn't added you as a contributor yet. Send him your email.

**"Cannot claim — active work in progress"**
Someone else is working on that item. Pick a different one, or wait 45 minutes for the claim to expire.

**"Token refresh failed"**
Run `node scripts/fetch-feedback.js login` to re-authenticate.

**Anything else**
Ask Austen or check `node scripts/fetch-feedback.js help`.

---

## Project Basics

- **Stack:** Svelte 5 + TypeScript + Firebase
- **Architecture:** Small files, dependency injection, services over utilities
- **Node requirement:** v22+
- **Dev server:** `npm run dev` runs on port 5173 (Austen's), use `vite --port 5174` if you need your own
- **Tests:** `npm test` — we only test algorithms where bugs would be silent
- **Type check:** `npm run check`
