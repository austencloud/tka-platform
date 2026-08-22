# Words: Alpha/Beta Copy Review

**Concept ID:** `words-alpha-beta`  
**Review state:** DRAFT  
**Implementation gate:** CLOSED  
**Last reviewed:** 2026-08-21

## Rejected Copy

The following text must not be restored or paraphrased:

> Doubling each letter makes the change easy to see and feel.

It makes an unsupported sensory and teaching-effect claim.

The following statement is also rejected:

> Letters select canonical pictographs.

It contradicts the Level 1 guide, which describes letters as categories that
do not contain all the information required to perform a specific sequence.

## Grounded Evidence Collected

- Flow Arts MCP `get_letter_explanation(A)`: A is a Type 1 Dual-Shift with pro
  motion for both hands.
- Flow Arts MCP `get_letter_explanation(B)`: B is a Type 1 Dual-Shift with anti
  motion for both hands.
- Flow Arts MCP `get_sequence_data(AABB)`: the generated four-beat example
  connects alpha positions and returns to its starting alpha position.
- `static/guides/level-1.pdf`, PDF page 31: multiple AABB executions begin with
  different thumb orientations and require different negative-space pathways.
  The guide says the letters organize motion combinations into categories and
  that the complete pictographs provide the missing performance detail.

## Unresolved Instructional Framing

The current lesson is organized around the wrong learning task. Its GGGG,
CCCC, and AABB questions mostly repeat letter classification from the preceding
Type 1 lesson. The guide's Words page instead demonstrates that one written word
can have multiple fully specified pictographic executions.

The following interaction is proposed:

1. Show all three guide-backed AABB cards together before asking a question.
   Selecting a card may highlight it, but must not be required to reveal it.
2. Label the cards by their starting thumb orientations: `IN | IN`,
   `OUT | OUT`, and `IN | OUT`.
3. Ask the learner to identify one starting orientation from the visible cards.
4. End by distinguishing the information supplied by the word from the
   information supplied by the full pictographs.

This redesign should reuse the production choreography-card presentation and
the existing orientation controls or staff-position visualizer. It must not
invent a negative-space visualization. The repository does not currently have
a canonical Learn primitive that truthfully demonstrates the body's
negative-space pathway.

## Proposed Learning Objective

> Recognize that the same TKA word can have multiple valid pictographic
> executions, and use the full pictographs to identify the starting thumb
> orientation for a specific execution.

## Proposed Exact On-Screen Copy

### Compare

> ONE WORD, THREE CARDS

> These are all AABB.

> The letters are the same. The starting thumb orientations are different.

> Compare the starting staves on all three cards.

### Check

> STARTING ORIENTATION

> Which AABB starts with both thumb ends pointing out?

Correct feedback:

> Both thumb ends point out at the start of this AABB.

Wrong feedback must name the selected card's actual starting orientation. For
example:

> This AABB starts in | in. Look for the card where both thumb ends point out.

### Finish

> The word is not the whole instruction.

> AABB tells you the motion category for each beat. The pictographs supply the
> start position, rotation direction, and thumb orientation.

## Sentence Evidence Map

| Draft statement                                                                         | Evidence                                                                                                                                                                |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “These are all AABB.”                                                                   | The Level 1 guide's Words page presents three complete pictographic executions of AABB.                                                                                 |
| “The letters are the same. The starting thumb orientations are different.”              | The same guide page labels the three AABB starts `in \| in`, `out \| out`, and `in \| out`.                                                                             |
| “Which AABB starts with both thumb ends pointing out?”                                  | The guide explicitly includes an `out \| out` AABB example.                                                                                                             |
| “AABB tells you the motion category for each beat.”                                     | The guide says the alphabet's letters categorize motion combinations; MCP defines a word as a sequence in which each letter is one motion step.                         |
| “The pictographs supply the start position, rotation direction, and thumb orientation.” | The guide says letters do not provide all the information and identifies start position, rotation direction, and thumb orientation as details that change an execution. |

## Question for Austen

The guide shows `in | in`, `out | out`, and `in | out`, but not `out | in`.
Nothing reviewed so far establishes whether the fourth combination is omitted
because it is equivalent under a symmetry, or simply because the page chose
three examples. The lesson will not explain or imply a reason until Austen
confirms it.

## Implementation Gate

No replacement explanation is approved. Before editing the lesson copy:

1. Agree with Austen on the exact learning objective.
2. Draft the exact on-screen explanation and feedback.
3. Map every sentence to the MCP or guide evidence above.
4. Record Austen's approval below.

## Approved Text

None.

## Approval Record

No approval has been granted.
