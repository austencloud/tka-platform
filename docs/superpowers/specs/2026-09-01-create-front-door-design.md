# Create Front Door

**Date:** 2026-09-01
**Status:** Approved
**Owner:** Austen Cloud

## Problem

The generic Create entry currently opens Construct at its first decision. A
new user sees an inline guide offer, a tutorial instruction, and three
start-position choices before the app has explained what they are creating or
why Construct is the right tool. The guide and the workspace also repeat the
same start-position instruction when the guide is active.

Create now has four ordinary creation methods with meaningfully different
inputs. Construct is only one of them. Sending every generic Create visit into
that one workflow hides Generate, Fuse, and Tunnel and makes the first screen
look like unexplained domain vocabulary.

## Outcome

Generic Create intent opens a real in-module home titled **What do you want to
create?** It explains the available creation methods as outcome-oriented
cards, then enters the selected workspace without a modal or a launch-time
timer.

Ordinary users see:

1. **Construct** for building one pictograph at a time.
2. **Generate** for creating from a few rules.
3. **Fuse** for combining two existing sequences.
4. **Tunnel** for arranging complete sequences for multiple performers.

Admins also see **Assemble**, using the same role and feature-flag rules as the
navigation system. The front door never invents its own access policy.

## Entry Contract

The decision is based on intent, not elapsed time.

| Entry                                               | Surface                                 |
| --------------------------------------------------- | --------------------------------------- |
| Bare `/create`                                      | Create front door                       |
| Create module button with no target method          | Create front door                       |
| `/create/{method}`                                  | Requested workspace                     |
| Sidebar method, command, import, edit, or deep link | Requested workspace                     |
| Refresh while a method URL is active                | Same workspace and persisted draft      |
| **All creation methods** from a workspace           | Create front door without clearing work |
| Browser Back from a selected method                 | Create front door                       |

The active method remains remembered while the front door is visible. Returning
to that card restores the method through the existing persistence owners. The
front door does not claim that a draft exists unless a method-specific owner
can prove it; it labels the remembered choice **Last used** instead.

## Interaction Model

### Front door

The front door is part of Create, not a modal. It uses the full module canvas,
keeps global navigation available, and does not trap focus.

Each card contains:

- the canonical method name, icon, and color from `CREATE_TABS`;
- a plain-language statement of the user's likely intent;
- a small abstract diagram of the method's input and output;
- one sentence describing what the method does; and
- a visible arrow affordance showing that the card opens a workspace.

Cards are native buttons. The entire card is the target, the focus ring is
visible, and essential text remains at least 14px. Layout is one column on
narrow phones, two columns at ordinary desktop/tablet widths, and a bounded
four-column composition on wide displays. The admin-only fifth card gets a
deliberate final position instead of an accidental orphan.

### Workspace return

Every creation workspace exposes a compact **All creation methods** action at
the module edge. It returns to the chooser without clearing, resetting, or
changing the active method. Selecting a different method uses the existing
navigation and persistence path.

The chooser and workspace remain mounted as two stateful sources. The canonical
dual-source crossfade owns the visual handoff, so returning to the chooser does
not destroy in-progress child state. Reduced-motion preferences collapse the
handoff to the final state.

### Construct instruction arbitration

Construct has one instruction owner at a time:

- when the guide offer is visible, the offer owns the start-position heading;
- when the guide is active, `ConstructTutorialGuide` owns the instruction and
  the ordinary workspace heading is suppressed; and
- when neither is active, the workspace shows **Choose your start position**.

This removes the overlapping/repeated text without removing the optional guide.

## State and Routing

`navigationState` owns whether Create is presenting its front door because the
state is navigation intent, not draft data. The flag is session-only and is
never written as a fake tab or persisted method.

- Generic Create navigation opens the front door.
- Setting an explicit Create tab closes it.
- The backing `activeTab` remains a valid method at all times.
- History entries distinguish `/create` from `/create/{method}`.
- Back/forward restores the matching surface without clearing method state.

`CREATE_TABS` remains the canonical method registry. The new component adds
only front-door presentation metadata such as the intent sentence and abstract
diagram kind. A coverage test keeps that metadata aligned with every tab marked
`isCreationMethod`.

## Analytics

Record:

- `create_front_door_viewed` with entry source and available method count;
- `create_method_selected` with method, entry source, and whether it was last
  used; and
- `create_front_door_returned` when the in-workspace action is used.

These events measure discovery and selection without treating a visible card
as evidence that the method itself was used successfully.

## Accessibility

- The front door uses a heading hierarchy and a labelled method list.
- Cards are native buttons with at least 44px targets and visible focus rings.
- Decorative diagrams and icons are hidden from assistive technology.
- The **Last used** label is text, not color alone.
- Hidden crossfade sources are inert and `aria-hidden`.
- Essential text remains at least 14px and supporting text at least 12px.
- Reduced-motion preferences disable the chooser/workspace fade and decorative
  card movement.
- The design must remain usable at 200% browser zoom.

## Files and Systems

- Create entry presentation under `src/lib/features/create/shared/components/`
- Front-door presentation metadata and analytics under the Create shared domain
- `navigation-state.svelte.ts` for the session-only surface state
- `navigation-coordinator.svelte.ts` for URL/history intent
- `CreateModule.svelte` for dual-source composition and the return action
- Construct tutorial entry for instruction arbitration
- Canonical Create descriptions in `tab-definitions.ts`
- Focused unit/component tests for entry decisions and presentation coverage

The deleted CreationMethodSelector is not restored. Residual
`creationMethodSelected` panel coordination state has no consumer and should be
removed rather than wired into the new flow.

## Risks

- Generic programmatic navigation to Create may have expected the remembered
  tab. Calls with a real destination already pass a target tab; tests cover the
  distinction and settings return passes its remembered tab explicitly.
- A method may be selected before the heavy Create initializer finishes. The
  workspace source already owns a loading state, so selection remains valid and
  resolves into that state without losing the navigation intent.
- Feature flags can resolve after first paint. The card list reads the same
  reactive access services as navigation and updates in place.
- Returning to the front door must not remount Fuse, Tunnel, or another
  stateful workspace. Dual-source composition keeps the workspace tree alive.

## Verification

1. Focused unit tests for generic versus explicit Create intent, history
   restoration, method presentation coverage, and access filtering seams.
2. Focused component proof that the active Construct guide suppresses the
   duplicate workspace heading.
3. Targeted formatter and TypeScript/Svelte checks for touched files, followed
   by the repository check once focused failures are clear.
4. Runtime interaction proof for bare `/create`, every available method,
   **All creation methods**, refresh, and browser Back/Forward.
5. Console review with no new errors and overflow/touch-target inspection.
6. Visual screenshots at 1920×1080, 2560×1440, 3840×2160, 1440×900,
   820×1180, 960×412, and 375×667, plus 200% browser zoom.
