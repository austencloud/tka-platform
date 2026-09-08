# App Navigation Hierarchy — Design

Date: 2026-09-04
Status: Approved
Area: App shell navigation, Create workspace chrome, keyboard settings

## Problem

Create currently repeats the same hierarchy and commands in several places:

- the global module and section navigation;
- a Create-only `Create / Current method` header;
- a passive Shortcuts launcher;
- a second Alt-held shortcut presentation;
- the Actions panel, which already contains the sequence commands and their
  bindings.

The Create header was added only to return from a method workspace to the
Create method chooser. That local fix competes with the app shell and makes the
workspace read like a dashboard instead of a creative instrument.

The shortcut editor has the same ownership problem. It is an app setting, but
the app shell mounts it as an extra-large modal over every workspace. Create
then adds a local launcher into that global modal.

## Decision

The app shell owns one two-level hierarchy:

```text
Module
├── Module home, when the module declares one
└── Destinations
```

Create declares `All methods` as its module home. `/create` opens that landing
surface without changing the valid backing method; `/create/{method}` opens the
method directly. Modules without a real landing surface do not receive a fake
home.

The desktop sidebar renders the module home as the first destination inside the
existing morphing module/section tree. The mobile module switcher drills from a
module list into that module's home and destinations before navigating. Direct
links, command-palette navigation, and browser history remain valid.

Create has no feature-local navigation header. The Actions panel is the only
visual catalog for sequence transformations. Keyboard execution remains
available and tracked, but Alt alone does not reveal or move UI.

Keyboard shortcut discovery and remapping live in Settings as a normal
destination. `Shift+?`, command-palette help, and legacy `/settings/keyboard`
intent navigate to that destination instead of placing a modal over the active
artifact.

## Visual Direction

- Preserve the existing theme palette and app typography.
- Keep the creative artifact flush to the workspace; do not replace the
  deleted Create header with another band.
- Treat module homes and destinations as navigation, not dashboard cards.
- Use each module's existing identity color only on its icon and active state.
- Mobile drilldown is one decision at a time and uses the canonical structural
  transition with a reduced-motion endpoint.
- Shortcut management is quiet Settings content: one reading column for the
  catalog, with editing presented as a focused detail rather than a floating
  command dashboard.

## Capability Ownership

Search terms: `sectionHome`, `ModuleSwitcher`, `ModuleList`, `openHelp`,
`ShortcutCenter`, `CreateShortcutHeader`, `create-method-bar`.

| Capability                      | Owner                                                     | Change                                                            |
| ------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Module and destination metadata | `module-definitions.ts` / `tab-definitions.ts`            | Extend module definitions with optional home metadata             |
| Module and tab routing          | `navigationState` + `navigationCoordinator`               | Reuse existing `/module` and `/module/tab` behavior               |
| Desktop hierarchy               | `@austencloud/sidebar` through `DesktopNavigationSidebar` | Compose module-home metadata as a non-routing destination adapter |
| Mobile hierarchy                | `ModuleSwitcher`                                          | Extend with an in-drawer destination drilldown                    |
| Create method landing           | `CreateFrontDoor`                                         | Keep unchanged as `/create` content                               |
| Create actions                  | Existing Actions panel and shortcut registrations         | Keep; remove parallel header and Alt presentation                 |
| Shortcut settings               | Keyboard registry/customizer + Settings                   | Move presentation from app-shell modal to Settings content        |

No new router, shortcut registry, action dispatcher, modal system, or motion
primitive is introduced.

## Behavior

### Desktop

- Expanding Create reveals `All methods` followed by its available methods.
- `All methods` opens `/create` and preserves the current method draft.
- A method opens `/create/{method}` directly.
- The active state moves between `All methods` and the active method without
  changing the tree's geometry.

### Mobile

- The existing module-switcher button opens the module list.
- Choosing a module with several destinations drills into that module inside
  the same drawer.
- The drill shows an explicit back button, the optional module home, and every
  accessible destination.
- Choosing a destination closes the drawer and navigates.
- A module with no child destinations navigates immediately.

### Keyboard settings

- Settings exposes Keyboard as a normal section.
- `Shift+?` and the command palette route to Settings → Keyboard.
- Create no longer listens for bare Alt.
- Registered keyboard actions, custom bindings, conflict detection, disabled
  bindings, execution analytics, and failure analytics remain owned by the
  existing keyboard services.

## Files

Expected modifications:

- `src/lib/shared/navigation/domain/types.ts`
- `src/lib/shared/navigation/config/module-definitions.ts`
- `src/lib/shared/navigation/config/tab-definitions.ts`
- `src/lib/shared/MainInterface.svelte`
- `src/lib/shared/navigation/components/DesktopNavigationSidebar.svelte`
- `src/lib/shared/navigation/components/ModuleSwitcher.svelte`
- `src/lib/shared/navigation/components/ModuleList.svelte`
- `src/lib/shared/keyboard/components/ShortcutCenter.svelte` or its replacement
- `src/lib/shared/keyboard/registration/*`
- `src/lib/features/settings/SettingsModule.svelte`
- `src/lib/shared/settings/components/tabs/PreferencesTab.svelte`
- `src/lib/features/create/shared/components/CreateModule.svelte`

The rejected Create-only shortcut header and its Alt-only presentation files
are removed when no consumers remain.

## Risks

- The desktop sidebar package accepts only sections, so its host adapter must
  keep module homes out of routing state and feature-flag filtering.
- Settings navigation must preserve the previous module and return path.
- The mobile drawer must not trap focus or leave two scroll owners mounted
  during a drill transition.
- Removing the header changes available workspace height at desktop widths;
  the artifact must use the recovered space without stretching ordinary UI.
- Shortcut presentation can move, but shortcut execution and analytics cannot
  regress.

## Verification

- Unit tests for module-home metadata/adaptation and Create home routing.
- Contract test proving Create no longer mounts a local header or Alt listener.
- Keyboard tests proving `Shift+?` routes to Settings and registered actions
  still log execution.
- Runtime checks for `/create`, `/create/construct`, browser back/forward, and
  returning to `All methods` without clearing the draft.
- Mobile interaction check for module → destination → workspace and drill back.
- Visual inspection at 375×667, 960×412, 820×1180, 1440×900, 1920×1080,
  2560×1440, and 3840×2160, plus 200% zoom.
