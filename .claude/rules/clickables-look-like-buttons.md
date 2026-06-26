# Clickable Things Look Like Buttons — ENFORCED

## The Problem This Solves

If an element is meant to be clicked, it must look clickable: a button, not a
bare text hyperlink. The shop product page shipped a sign-in "link" as 12px
low-contrast text under the Buy button. It was easy to miss, failed contrast, and
did not read as actionable. Austen (2026-06-26): *"we generally don't want to use
hyperlinks and things that don't look like buttons if we intend for people to
click them."*

## The Rule

Any primary or standalone action the user is meant to click renders as a button
(or an obviously-interactive control), never a bare inline text link:

- A real `<button>`, or an `<a>` styled as a button when it navigates (semantic
  anchor with button appearance: back nav, "view all", CTAs).
- A visible affordance: background or border, padding, and a hover state.
- 44px minimum touch target (design-system floor, `feedback_design_system_mandatory`).
- Reuse an existing button primitive before styling a new one (`never-hand-roll`,
  `primitive-discovery`).

Inline text links are acceptable ONLY for an in-sentence reference inside running
prose (a word in a paragraph linking to a doc). A standalone call-to-action is not
that.

## Forbidden

- A standalone action rendered as faint or low-contrast text (the shop sign-in hint).
- A clickable that gives no visual signal it is clickable (no button look, no hover).
- Adding a text-link CTA when a button primitive already covers it, or when the
  same action already exists as a button elsewhere. That makes it redundant. Remove
  it rather than duplicating it as a weak link.

## The Self-Check

Before shipping any clickable: if a first-time user glanced at this, would they
know it is clickable without hovering? If the answer is no, style it as a button.

## Related

- `no-checkboxes.md`, `chip-primitives.md`, `primitive-discovery.md`,
  `never-hand-roll.md`, `no-layout-shift.md`
- Memory: `feedback_design_system_mandatory`
