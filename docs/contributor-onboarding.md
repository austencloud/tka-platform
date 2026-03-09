# Contributing to TKA with Claude Code

Welcome. This guide gets you from zero to claiming your first feedback item.

---

## Prerequisites

- **Node.js 22+** — check with `node --version`
- **Claude Code** — Anthropic's CLI tool
- **Git** — to clone the repo

---

## Setup (one-time)

### 1. Clone the repo

```bash
git clone https://github.com/austencloud/the-kinetic-alphabet.git
cd the-kinetic-alphabet
npm install
```

### 2. Sign into the web app once

Go to https://the-kinetic-alphabet.web.app and sign in with your Google account. This creates your Firebase account — needed before the CLI can recognize you.

### 3. Log into the CLI

```bash
node scripts/fetch-feedback.js login
```

A browser window opens for Google sign-in. After you authenticate, you'll see:

```
Logged in as Your Name (you@gmail.com)
Credentials saved to ~/.tka/credentials.json
```

### 4. Austen adds you as a contributor

After you log in, tell Austen your email. He runs:

```bash
node scripts/fetch-feedback.js add-developer you@gmail.com contributor
```

### 5. Verify it works

```bash
node scripts/fetch-feedback.js whoami
```

You should see your name, email, and `Role: contributor`.

---

## The Feedback Workflow

Feedback items are bugs, features, and ideas tracked in Firestore. Your job: pick one, fix it, submit for review.

### See what's available

```bash
node scripts/fetch-feedback.js list
```

Shows all items grouped by status. Look at the **UNCLAIMED** section — those are ready to work on.

### Claim an item

```bash
# Auto-claim the next item (by priority)
node scripts/fetch-feedback.js

# Claim a specific item by ID (first 8 chars is enough)
node scripts/fetch-feedback.js claim yfTRt6UK

# Claim the next high-priority item
node scripts/fetch-feedback.js high
```

When you claim an item, Austen gets notified.

### View item details

```bash
node scripts/fetch-feedback.js yfTRt6UK
```

### Keep your claim alive

Claims go stale after 45 minutes of inactivity. If you're working on something for a while:

```bash
node scripts/fetch-feedback.js heartbeat yfTRt6UK "still working on the component"
```

### Submit for review

When you're done:

```bash
node scripts/fetch-feedback.js yfTRt6UK in-review "Fixed the dropdown override logic, added confirmation dialog"
```

Austen gets an email and an in-app notification. He tests it and either moves it to `completed` or sends it back.

### See your active items

```bash
node scripts/fetch-feedback.js mine
```

### Create new feedback

Found a bug while working? Log it:

```bash
node scripts/fetch-feedback.js create
```

Follows an interactive prompt.

---

## What You Can Do

| Action | Available |
|--------|-----------|
| View all feedback | Yes |
| Claim items | Yes |
| Work on claimed items | Yes |
| Submit for review | Yes |
| Create new feedback | Yes |
| Delete your own feedback | Yes |
| Change priority | No (admin) |
| Mark as completed | No (admin) |
| Archive items | No (admin) |
| Delete others' feedback | No (admin) |

---

## Using Claude Code with /fb

Once you have Claude Code set up in this repo, the `/fb` command is the fast path:

```
/fb              — auto-claim next item
/fb yfTRt6UK     — claim specific item and start working
/fb mine         — see your items
```

Claude reads the feedback item, understands the codebase, and helps you fix it. When done, it submits for review automatically via `/done`.

---

## Quick Reference

```bash
# Auth
node scripts/fetch-feedback.js login        # Sign in
node scripts/fetch-feedback.js logout       # Sign out
node scripts/fetch-feedback.js whoami       # Check identity

# Work
node scripts/fetch-feedback.js list         # See all items
node scripts/fetch-feedback.js              # Auto-claim next
node scripts/fetch-feedback.js claim <id>   # Claim specific
node scripts/fetch-feedback.js mine         # Your items
node scripts/fetch-feedback.js <id>         # View details

# Progress
node scripts/fetch-feedback.js heartbeat <id> "msg"    # Keep claim alive
node scripts/fetch-feedback.js <id> in-review "notes"  # Submit for review

# Help
node scripts/fetch-feedback.js help         # Full command list
```

---

## Troubleshooting

**"Not authenticated"** — Run `login` first.

**"No Firebase account found"** — Sign into the web app (https://the-kinetic-alphabet.web.app) with Google first, then try `login` again.

**"Permission denied"** — Ask Austen to run `add-developer` with your email.

**"Cannot claim — active work in progress"** — Someone else is working on it. Pick a different item or wait for the claim to go stale (45 min).

**Credentials expired** — Run `login` again. Credentials last 1 year but can be refreshed anytime.
