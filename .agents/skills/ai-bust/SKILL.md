---
name: ai-bust
description: Use when writing or reviewing user-facing text to check for AI writing patterns, banned words, or robotic tone
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# AI Writing Buster

When explicitly invoked, treat the text after `$ai-bust` as `<arguments>`.

**Args:** `<arguments>` (file path, glob pattern, or paste text directly)

Scans user-facing text for AI writing patterns and flags violations.

## Usage

```
$ai-bust src/routes/+page.svelte
$ai-bust src/lib/components/**/*.svelte
$ai-bust "Your text to check here"
```

## Detection Patterns

### Category 1: Structural Tells

| Pattern | Example | Fix |
|---------|---------|-----|
| Em dashes | "for users — whether" | Use comma or period |
| Negative-to-positive flip | "Not to constrain, but to free" | State directly what it does |
| Redundant emphasis | "Share globally — communicates across distances" | Delete the repetition |
| Perfect threes | "efficient, reliable, and scalable" | Break rhythm or reduce to two |
| "Whether you're..." endings | "Whether you're beginner or expert..." | Cut entirely |

### Category 2: Banned Openers

Flag any paragraph starting with:
- "In today's fast-paced world..."
- "In an era where..."
- "In the ever-evolving landscape of..."
- "In the realm of..."

### Category 3: Blacklisted Words

**Nouns:** tapestry, landscape, realm, journey, nuances

**Adjectives:** robust, comprehensive, crucial, pivotal, seamless, cutting-edge, game-changing, next-level

**Verbs:** delve, leverage, harness, unlock, foster, navigate, streamline, empower

**Marketing:** revolutionary, effortlessly, seamlessly

### Category 4: Hedging Phrases

- "It's worth noting that..."
- "It's important to remember..."
- "Furthermore", "Moreover", "Additionally"
- "In conclusion"

### Category 5: Sycophantic Openers

- "Absolutely!"
- "Certainly!"
- "Great question!"
- "You're absolutely right"

### Category 6: Extended Metaphor Verbs

- "weaving together"
- "painting a picture"
- "crafting your..."

## Output Format

For each violation found:

```
FILE:LINE | PATTERN | QUOTED TEXT
  -> Suggestion: [fix or "delete this"]
```

## Workflow

1. **If given a file/glob:** Read the file(s) and scan for patterns
2. **If given quoted text:** Scan the text directly
3. **Report violations** grouped by category
4. **Provide suggestions** for each violation
5. **Give overall assessment:** Clean / Minor issues / Needs rewrite

## Severity Levels

- **CRITICAL:** Banned openers, em dashes (dead giveaways)
- **HIGH:** Blacklisted words, hedging phrases
- **MEDIUM:** Perfect threes, sycophantic openers
- **LOW:** Extended metaphor verbs (context-dependent)

## What to Scan

Focus on user-facing text:
- Landing pages, marketing copy
- Documentation, help text
- UI labels, button text, error messages
- Release notes, changelogs
- About pages, descriptions

Skip:
- Code comments (unless they're user-visible)
- Variable names
- Test files
- Config files

## Burstiness Check

After pattern-matching, check sentence rhythm. If most sentences are 15-25 words with uniform structure, flag as "uniform rhythm." Real writing varies length.

## After Reporting

Ask: "Want me to fix these issues, or just use this as a reference?"
