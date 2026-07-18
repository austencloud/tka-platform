<!-- managed by @austencloud/claude-skills — do not edit manually, run: npx @austencloud/claude-skills sync -->
<!-- LOCAL PATCH 2026-07-17 (Austen-directed): Category 7 structural/template
     tells + proactive-when-writing rule. Port to the @austencloud/claude-skills
     package source before the next sync or this knowledge is clobbered. -->

---
description: Use when writing or reviewing ANY user-facing text. Apply proactively while WRITING copy, not only when asked to review. Checks for AI writing patterns, banned words, robotic tone, and structural/template tells.
---

# AI Writing Buster

**Args:** `$ARGUMENTS` (file path, glob pattern, or paste text directly)

Scans user-facing text for AI writing patterns and flags violations.

## Usage

```
/ai-bust src/routes/+page.svelte
/ai-bust src/lib/components/**/*.svelte
/ai-bust "Your text to check here"
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

### Category 6.5: Unsigned First Person

Added 2026-07-17 (Austen): *"We should stick with facts. Avoid using anything
with I as a pronoun — the user shouldn't have to ask who is writing this."*

Flag `I / I'd / I've / my / me / we / our / us` in site copy that carries no
byline or signature. The reader can't tell who "I" is, so the voice reads as
an anonymous narrator (another generation tell). Fix: restate as fact
("I trained double staves" → "The Kinetic Alphabet was developed on double
staves"; "how we teach staves" → "how staves are taught"). First person is
fine only in signed content (about page, quoted testimony, bylined posts).
Severity: **HIGH**.

### Category 7: Structural / Template Tells (page- and site-level)

Added 2026-07-17 after Austen caught the per-prop notation pages reading as
"mini bite-size episodes." Detector literature names these (Forbes 2026,
StationX): *"if every subsection feels exactly as developed as the last,
mechanical generation becomes likely"* + "low burstiness."

| Pattern | Tell | Fix |
|---------|------|-----|
| Header-per-topic episodes | Every idea wrapped in an H2 + 1-2 same-size paragraphs | Continuous prose; zero or one internal header per page; let figures/demos punctuate instead |
| Uniform section development | All sections the same weight | Deliberately unequal passages: one long winding one, one short, a one-liner paragraph |
| Cross-page template reuse | Same page shape, caption sentence, CTA wording, or closer repeated across sibling pages | Every page gets its own shape (essay / short note / figure-led / stub / single Q-and-A answer); vary shared furniture |
| "Here's..." pivots | "Here's what changes...", "Here's where the line is" | State the thing directly |
| Label headers | H2s that are topic labels ("The Translation Rule") | Oblique or voice-carrying headers, or none |
| Summary-sentence caboose | Each section closing by restating itself | End on the detail, not the recap |

Severity: **CRITICAL** for header-per-topic episodes and cross-page template
reuse. These read as generated even when every sentence individually passes
Categories 1-6.

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

## Proactive Mode (writing, not just reviewing)

Standing directive from Austen (2026-07-17): invoke this skill automatically
whenever WRITING user-facing copy, not only when asked to review. Run the
full pattern set (Categories 1-7) against your own draft before showing it,
and design the page shape (Category 7) before drafting a word.

## After Reporting

Ask: "Want me to fix these issues, or just use this as a reference?"
