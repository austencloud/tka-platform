# Verify Corrections at Canonical Source — ENFORCED

## The Problem This Solves

When Claude is fixing a knowledge-base error (wrong letter classification, wrong motion type, wrong pictograph structure), the fix frequently references downstream files or extension data instead of the canonical source of truth. This produces "fixes" that compound the original error.

Memory: `feedback_verify_corrections_at_base_layer.md` — "when fixing a knowledge-base error, ground in canonical source (TYPE_DEFINITIONS, DiamondPictographDataframe); don't layer new inferences on extension data."

## The Rule

Before writing any fix that corrects TKA domain data:

1. **Identify the canonical source file** for the domain category being corrected. Examples:
   - Letter type classification → `TYPE_DEFINITIONS`
   - Pictograph structure → `DiamondPictographDataframe` (or equivalent canonical frame)
   - Motion type → whatever file holds the base motion enum, not a downstream derivative
2. **Read the canonical source before writing the fix.** Cite the file path + line in the fix commit or spec.
3. **Verify your proposed fix against the canonical source** — if the fix contradicts the canonical data, the fix is wrong (or the canonical data is the bug — in which case stop and tell Austen before touching anything).
4. **Do not infer from extension data.** Extension files (Type 3/4/5/6 extensions, compound letters, custom dataframes) are derived from the canonical base. A fix at the extension layer that doesn't reference the base layer is likely wrong.

## Forbidden

- Writing a correction to TKA domain data without a Read on the canonical source file in the same turn
- Citing an extension file as the source of truth when a canonical base file exists
- Shipping a fix where the commit message / spec references only downstream files

## The verification pattern

> "The canonical source is `<file>:<line>`. It defines [fact]. The bug is that [extension file] misrepresents this as [wrong value]. Fix: [change], which aligns with the canonical source."

Every knowledge-base correction should follow this structure.

## Related

- Memory: `feedback_verify_corrections_at_base_layer.md`
- Memory: `feedback_level1_base_float_classification.md`
- Rule: `mcp-ground-truth.md`
