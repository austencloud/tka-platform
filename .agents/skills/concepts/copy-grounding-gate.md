# Concept Copy Grounding Gate

Use this gate whenever a Learn concept task includes educational copy, quiz
explanations, feedback, captions, summaries, or claims about what a learner
will see, feel, understand, or do.

## Hard Gate

Do not put proposed explanatory copy into a component until Austen approves
the exact wording in the current conversation.

Before requesting that approval:

1. Call the Flow Arts Knowledge MCP in the current turn for every TKA claim.
2. Read the canonical guide pages named by the concept definition when those
   pages exist. MCP data establishes domain behavior; the guide establishes
   the intended lesson and framing.
3. Audit existing copy as if it were an untrusted draft. Do not use the current
   UI, an older lesson component, tests, or generated sequence output as the
   sole source for a general explanation.
4. Create or update `docs/learn/copy-reviews/<concept-id>.md` with:
   - review state: `DRAFT`, `APPROVED`, or `REJECTED`;
   - exact proposed or approved text;
   - a sentence-by-sentence evidence map;
   - unresolved questions for Austen;
   - the approval date and Austen's approval language when approved.
5. Present the exact draft to Austen. Stop before component edits containing
   that draft. Continue only after explicit approval.

## Claims That Require Extra Scrutiny

Never add prose saying something is easy, intuitive, smooth, natural, clear,
obvious, easier to see, easier to feel, or better for learning unless the
canonical evidence or Austen explicitly says so. These phrases often disguise
an inference as a fact.

Likewise, do not turn implementation details into curriculum. Generator
behavior, component reuse, view modes, and rendering architecture belong in
technical documentation unless they directly teach an approved lesson goal.

## Approval Integrity

- Approval applies only to the exact text shown to Austen.
- Grammar and punctuation fixes that do not change meaning are allowed.
- New claims, changed emphasis, sensory language, or teaching rationale require
  another review.
- `CONFIRMED` still requires Austen to interact with and approve the lesson;
  approved copy alone is not enough.
