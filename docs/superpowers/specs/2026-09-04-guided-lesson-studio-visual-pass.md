# Guided Lesson Studio Visual Pass

**Status:** Approved for implementation
**Approved by:** Austen, 2026-09-04 (`yes`)

## Objective

Bring Pictograph Anatomy and Learning Letters into the visual language of Flow
Arts Composer without changing their approved curriculum, explanatory copy, or
canonical artifact renderers. The lesson should read as one guided creative
workspace rather than a collection of equal cards.

## Rejected Presentation

- A detached instruction card floating far from the artifact it describes.
- Equal-width video, animation, and card boxes with equally prominent headers.
- A separate notes card and navigation controls stranded at viewport edges.
- Narrow center islands that leave most of a 4K canvas unused.
- Decorative all-caps labels and repeated black panels that compete with the
  active background theme.

## Composition

Pictograph Anatomy uses one continuous studio frame: a teaching rail joined to
the canonical pictograph stage, followed by an attached lesson transport. The
spotlight moves over the stable pictograph while the rail's short teaching copy
crossfades in the direction of travel.

Learning Letters uses the same studio grammar. Its intro pairs one reading
column with two family bands. Each word step joins the family header,
performance video, live animation, ChoreoCard, guide notes, and lesson
transport into one workspace. The animation receives the largest desktop
allocation; video and card remain simultaneously visible and resizable. The
recap keeps the two families legible as parallel groups instead of rebuilding a
deck browser.

## Capability Ownership

| Capability                       | Owner                                      | Relationship                              |
| -------------------------------- | ------------------------------------------ | ----------------------------------------- |
| Pictograph rendering             | `PictographContainer`                      | Reuse                                     |
| Pictograph focus region          | `ArtifactRegionSpotlight`                  | Extend with coordinated geometry motion   |
| Live sequence motion             | `InlineAnimationPlayer`                    | Reuse                                     |
| Printed notation                 | `ChoreoCard`                               | Reuse                                     |
| Resizable media workspace        | `PanelGroup`                               | Compose                                   |
| Step-copy replacement            | `Crossfade`                                | Reuse                                     |
| Previous/progress/Next transport | `LessonStageControls`                      | Extend without breaking current consumers |
| Word identity                    | `TKAWordGlyph` plus `simplifyRepeatedWord` | Reuse                                     |

## Responsive Contract

- **1920 and 2560:** one connected authored band, with a joined teaching rail
  or a three-pane Composer workbench.
- **3840:** the studio grows into the wide canvas; artifacts gain space while
  ordinary controls and prose retain their logical size.
- **Tablet:** the word workbench becomes an asymmetric two-tier composition;
  animation remains the largest region and all three artifacts remain present.
- **Phone:** the same video, animation, card, and notes stack in a deliberate
  reading order. The transport remains attached to the workspace.
- **Short landscape:** vertical rhythm compacts while the page remains
  scrollable and every capability stays available.

## Copy Boundary

No explanatory copy changes are part of this pass. Existing Austen-approved
sentences remain verbatim. Routine region labels remain sentence case.

## Verification

Run the focused Learn tests and the project check. Inspect real transitions,
overflow, text size, and composition at 375x667, 960x412, 820x1180, 1440x900,
1920x1080, 2560x1440, and 3840x2160, plus 200% browser zoom. The integrated
result must be delivered from local `main` at both affected lesson routes.
