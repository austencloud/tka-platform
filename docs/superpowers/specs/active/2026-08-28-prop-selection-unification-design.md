# Prop Selection Unification

## Outcome

Every prop-selection surface uses one visual card language, and a selected prop
family shows the exact build the user chose. Choosing LED Baton therefore leaves
LED Baton visible on the Double Staff family tile instead of replacing its art
with the base Double Staff.

## Scope

- Extract the card presentation from `PropTypeButton` into a shared
  `PropSelectionButton` that can render registry-backed prop art or custom art.
- Keep Bento family actions keyed to their base family while resolving the
  displayed art from the exact selected variant.
- Compose the same card in profile prop families, Hoop size choices, and the
  featured-skill step.
- Reuse `DrawerHeader` for the profile prop editor and use the canonical motion
  helpers when its step or Hoop choices change the layout.
- Preserve the profile catalog, persistence model, premium gating, family
  selection behavior, and Buugeng chirality controls.

## Ownership

`PropSelectionButton` owns the visual selection-card contract.
`PropTypeButton` remains the registry adapter for a concrete `PropType`.
`BentoPropGrid` owns family disclosure and Buugeng chirality.
The profile catalog remains the source of truth for profile skill taxonomy.

## Risks

- Headless popover trigger attributes must continue to reach the underlying
  button without changing outside-click or explicit-close behavior.
- Profile cards need enough density on mobile without shrinking labels below the
  project minimum.
- Showing exact family art must not change the base family used to open style
  choices.

## Verification

- Unit-test exact family-art resolution and the existing profile catalog.
- Run the Buugeng chirality contract suite unchanged.
- Compile every changed Svelte component and run the canonical project check.
- Exercise the main prop drawer and both profile editor steps at the required
  desktop, tablet, mobile, 4K, and 200% content-scale viewports. Verify focus,
  selection state, outside-click/close behavior, and a clean browser console.
