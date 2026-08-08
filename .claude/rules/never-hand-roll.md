# One Concept, One Owner — ENFORCED (MASTER RULE)

This file keeps its historical name so existing references remain valid. The
rule protects capability ownership. It does not prohibit new files, new ideas,
or new creative work.

A component file is an organizational boundary. A capability is the behavior
the product offers: choosing BPM, opening a dialog, filtering a collection,
scrubbing playback, saving a sequence, or dragging an object. New components
may compose or present a capability. They must not quietly become another
implementation of one the product already owns.

## Before Creating Shared Behavior

Before speccing or writing a user-facing control, reusable interaction, shared
service, utility, or cross-feature behavior:

1. **Search by meaning.** Grep at least three terms, including synonyms, state
   fields, callbacks, and user-facing labels. Names drift; concepts are more
   stable than filenames.
2. **Identify the owner.** Read the closest implementation and at least one real
   consumer. Check `canonical-capabilities.md` and any focused routing rule such
   as `chip-primitives.md`.
3. **Choose the relationship.** State one of these before implementation:
   - **Reuse:** the owner already provides the capability.
   - **Extend:** the owner needs another supported behavior or variant.
   - **Compose:** a new feature component will present existing capabilities
     without reimplementing them.
   - **Create:** the capability is genuinely new; name its intended owner and
     why the closest existing concept has a different interaction contract.

Different styling, layout, density, or a smaller API does not create a new
capability. A different presentation may be appropriate, but it must delegate
shared validation, state transitions, algorithms, accessibility semantics,
keyboard behavior, and domain constants to the existing owner.

## Duplication Threshold

- The first implementation of a new capability may remain feature-local.
- The second use triggers an ownership decision: promote the first owner,
  extract shared behavior, or document why the interaction models are distinct.
- A third parallel implementation is forbidden unless the distinction is
  recorded in `canonical-capabilities.md` or a focused rule's keep-separate
  section.

When several implementations already exist, do not add another. Reuse one for
presentation work. If the task changes duplicated behavior, establish a shared
behavior owner within that scope.

## New Work That Is Allowed

Agents may create:

- feature-specific components that compose existing primitives;
- feature-local business logic that no other feature owns;
- a new presentation backed by an existing behavior owner;
- genuinely different interaction models with a recorded reason;
- new art, trees, illustrations, meshes, textures, scene compositions,
  animations, shaders, and effects, including AI-generated creative assets.

Existing creative assets are references and reusable material, not a mandatory
catalog. Creative work still reuses technical infrastructure when appropriate:
loaders, render loops, controls, accessibility patterns, and shared state.

## When External Research Is Required

Do not perform package research for every feature component. Check the
framework, its extras, and maintained packages when implementing commodity or
specialized infrastructure such as drag and drop, popovers, timelines,
raycasting, animation, physics, parsing, media encoding, authentication, or
build tooling. Follow `research-before-building.md`.

## Evidence Gate

A spec or implementation that creates shared behavior must record:

- search terms and closest matches;
- the current or proposed capability owner;
- whether the change reuses, extends, composes, or creates;
- any intentionally separate interaction model.

Listing a new file is not a justification. Proving that the capability has no
owner, or that the new file delegates to that owner, is.

## Related

- `canonical-capabilities.md` — searchable ownership and routing index
- `primitive-discovery.md` — UI-specific discovery procedure
- `research-before-building.md` — framework and package research boundary
- `no-fabrication.md` — existence claims require current evidence
