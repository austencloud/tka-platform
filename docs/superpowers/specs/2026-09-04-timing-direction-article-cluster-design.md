# Timing and Direction Article Cluster

Date: 2026-09-04
Status: Approved for implementation by Austen's “Let's do this then. Proceed.”

## Outcome

Publish an indexable hub at `/timing-and-direction` and one canonical article
for each of the six timing-and-direction modes. The cluster explains the full
three-by-two model, separates phase from placement, shows each relationship in
the existing animation player, and carries the documented community lineage.

The pages must be useful without JavaScript. Titles, definitions, comparisons,
history, citations, and sibling links render in static HTML. Hydration adds a
two-axis explorer and live demonstrations.

## Routes

- `/timing-and-direction`
- `/timing-and-direction/together-time-same-direction`
- `/timing-and-direction/together-time-opposite-direction`
- `/timing-and-direction/split-time-same-direction`
- `/timing-and-direction/split-time-opposite-direction`
- `/timing-and-direction/quarter-time-same-direction`
- `/timing-and-direction/quarter-time-opposite-direction`

All seven routes are prerendered, self-canonicalized, internally linked, and
listed in the sitemap.

## Ownership

| Capability                                   | Owner                                                       | Relationship |
| -------------------------------------------- | ----------------------------------------------------------- | ------------ |
| Six mode identities and order                | `shared/shape-matrix/services/shape-matrix-realizations.ts` | Reuse        |
| Element names, normalized icons, and accents | `features/choreo-card/domain/tnd-element.ts`                | Reuse        |
| Representative motion sequences              | Learn `pictograph-foundation-content.ts`                    | Compose      |
| Public live animation                        | `shared/landing/components/SequenceHeroDemo.svelte`         | Reuse        |
| Timing and direction selection               | `shared/ui/components/SegmentedControl.svelte`              | Reuse        |
| Editorial page frame and reading measure     | `public-editorial.css`                                      | Reuse        |
| Metadata and JSON-LD                         | `shared/components/Seo.svelte`                              | Reuse        |
| Public discovery                             | `SiteHeader.svelte`, `SiteFooter.svelte`, and sitemap       | Extend       |
| Article prose and source mapping             | Route-local `_data/timing-direction-articles.ts`            | Create       |

The article data is a new editorial owner. It does not redefine motion
classification or generate sequences.

## Interaction

The hub opens with two single-select controls: Timing and Direction. Selecting
one value from each resolves to one canonical mode and swaps the existing live
sequence in place. Both controls use `SegmentedControl`, including its keyboard
and selected-indicator behavior.

The result panel reserves enough space for the longest mode name and definition.
The animation stage also reserves its geometry before mounting. A selection
therefore changes content without pushing later sections down the page.

Each mode article presents its own live example and links to all six siblings.
Sibling navigation is ordinary document navigation, not a second stateful
selector.

## Visual contract

- The animation player owns its own rectangle. No outer decorative card wraps it.
- Element color applies to whole cards, controls, and headings. No edge stripe.
- Element icons come from the normalized canonical assets.
- TKA letters appear only in prose as named examples; no raw Latin letter is
  presented as a standalone notation glyph.
- Mode links are full-surface anchors with a visible border, background, focus
  state, and 44px touch floor.
- The shared editorial shell owns the page title, prose measure, CTA, and wide
  composition band.

Rejected treatments: a second Learn curriculum, a custom pictograph renderer,
hand-drawn orbit animation, glass around a rendered artifact, thin colored
rails, hidden mode details, and viewport-driven root typography.

## Responsive composition

- Wide desktop: explorer controls and live stage share a row; six mode links
  occupy three columns.
- Tablet: explorer stacks; mode links occupy two columns.
- Phone: one content column and one mode link per row.
- Short landscape: the explorer remains compact and the page scrolls normally;
  no fixed-height room traps the article.
- 4K: the shared shell widens the composition while prose keeps the existing
  editorial measure. Controls and body type do not magnify with viewport width.

## Copy and sourcing

Definitions are grounded in the current Flow Arts MCP category results and the
project's canonical mode data. History follows
`docs/reference/timing-direction-history.md`. Every historical paragraph links
to the source it summarizes. The copy does not assign inventorship where the
record proves only public usage.

The public claim is:

> TKA gives all six timing-and-direction modes one consistent visual language,
> keeps placement independent, and names the community record behind the model.

## Verification

1. Unit-test the six article identities, route slugs, phase/direction matrix,
   citations, and sitemap entries.
2. Run the focused tests with the repository Vitest config.
3. Run `svelte-check` through the worktree integration gate.
4. Search the diff for raw chip controls, edge-accent patterns, `transition: all`,
   and user-facing AI-writing tells.
5. Verify the hub and one representative original/quarter article at 375×667,
   960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, and 3840×2160, including
   one real Timing/Direction selection change and reduced motion.
