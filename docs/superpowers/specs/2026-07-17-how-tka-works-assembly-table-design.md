# How TKA Works Assembly Table Design

**Date:** 2026-07-17
**Status:** Direction approved; implementation pending
**Surface:** Public landing page, `HowTkaWorksSection`
**Working name:** Assembly Table

## Summary

Replace the landing page's six equal "How it works" cards with one large, persistent notation stage and a six-step control rail. The stage changes in place as the visitor moves from the empty grid through the animation. The redesign must feel specific to a movement-notation product, recompose at 4K instead of merely scaling, and remain compact and legible on phones.

The section keeps the existing public sequence source and existing product renderers. It changes presentation, interaction, and responsive composition. It does not introduce new TKA domain data or hand-built notation rendering.

## Problem

The current section presents six equally weighted translucent cards in a uniform row. This creates four problems:

1. The section looks like a generic dark product template: repeated glass cards, circular number badges, centered labels, and hover-border changes.
2. The relationship between the six states is weak. Each state looks like a separate feature instead of one notation system being assembled.
3. The 4K treatment scales the row to 1,960 px but does not recompose it. At 3,840 px viewport width, the section leaves about 930 px on each side while retaining the same six-card strip.
4. On a 390 px phone, the 2-by-3 card grid consumes most of the viewport and makes each live product view too small to teach effectively.

## Approved Direction

Use one evolving stage rather than six simultaneous cards.

```text
┌───────────────────────────────────────────────────────────────────┐
│ HOW IT WORKS                                                      │
│ Start with the grid. Add hands, props, and motion.                │
│ String the steps together, then press play.                       │
│                                                                   │
│ ┌────────────────────────────────────┐    01  The grid             │
│ │                                    │    02  Place the hands      │
│ │       PERSISTENT NOTATION STAGE    │    03  Add the props        │
│ │                                    │    04  Add motion           │
│ │         one state at a time        │    05  Build the sequence   │
│ │                                    │    06  Play it back         │
│ └────────────────────────────────────┘                             │
└───────────────────────────────────────────────────────────────────┘
```

The visual hierarchy is:

1. The notation stage is the primary object.
2. The step rail is the control and explanation.
3. The heading introduces the section without competing with the stage.

## Content

### Heading

Keep the direct heading:

> How it works

Replace the current subtitle with:

> Start with the grid. Add hands, props, and motion. String the steps together, then press play.

### Step labels

1. The grid
2. Place the hands
3. Add the props
4. Add motion
5. Build the sequence
6. Play it back

The labels describe visible changes. They do not make claims beyond the states already rendered by the current section.

## State Model

Use a six-value string union for the active step:

```ts
type AssemblyStep = "grid" | "hands" | "props" | "motion" | "sequence" | "playback";
```

The active step is local presentation state inside `HowTkaWorksSection`. It does not belong in a feature store or shared context.

### Steps 1 through 4

Render one `PictographContainer` in one stable stage frame. Change its existing data and visibility props as `activeStep` changes. Let `PictographContainer` own its established internal content transition. Do not wrap it in another crossfade and do not mount four hidden pictograph renderers.

Use the same data variants already prepared by the section:

- `emptyGridData`
- `gridOnlyData`
- `propsData`
- `motionData`

The implementation must preserve their current source data and transformations. This redesign does not reinterpret TKA domain behavior.

### Step 5

Show the existing `ChoreoCard` using the already-loaded sequence data. The change from a single pictograph to the sequence is a format cut, not a layered dissolve.

### Step 6

Show the existing `HowTkaAnimationCard`. Add an `active` input if the component does not already expose an equivalent lifecycle control. The animation may initialize and play only while:

- the playback step is active;
- the section is in or near the viewport; and
- the document is visible.

Leaving the playback step pauses the animation. Returning to it may resume from the component's supported state without reconstructing domain data.

## Control Primitive

Use the installed Bits UI `ToggleGroup`:

- `type="single"`
- vertical orientation on desktop and fold layouts
- horizontal visual flow adapted into a 2-by-3 control grid on phones
- roving focus enabled
- empty value changes ignored so one step always remains selected

This primitive supplies radio semantics, `aria-checked`, and arrow-key focus movement. It also keeps the stage independent from the control items, which allows one persistent pictograph renderer.

Do not use the project `SegmentedControl`. It is designed for compact, equal-width settings and its sliding indicator conflicts with the editorial step rail. Do not use Tabs because six tab panels would duplicate heavy stage content or weaken the one-stage architecture.

## Interaction

### Automatic introduction

When the real section first becomes visible, run one introductory progression:

1. Begin on `grid`.
2. Advance through the six states at a readable cadence.
3. Rest longer on `motion`, `sequence`, and `playback` than on the additive first states.
4. Stop after `playback`.

The exact timing belongs in the implementation plan, but the full progression should complete in roughly 5 to 7 seconds. It must not loop.

Cancel the automatic progression permanently for the current mount when the visitor:

- clicks or taps a step;
- focuses or changes a step with the keyboard;
- interacts with the stage; or
- has `prefers-reduced-motion: reduce` enabled.

Reduced-motion users start on `motion`, which presents the completed single-step state without automatic movement.

### Direct control

Selecting a rail item updates the stage immediately. The selected rail item stays visually obvious. Focus and selection are related but not forcibly coupled during the automatic introduction, so autoplay must not steal keyboard focus.

### Transition grammar

- Steps 1 through 4 are additive states and use the existing pictograph content transition.
- Step 4 to step 5 is a purposeful format cut.
- Step 5 to step 6 is a purposeful format cut.
- Stage dimensions stay fixed across all six states.
- No scroll hijacking, pinned scrolling, parallax, hover lift, or infinite autoplay.

## Visual System

### Stage

Use a warm, light notation surface against the existing cosmic background. This is the section's signature contrast and distinguishes it from the surrounding dark sections.

Core colors:

- Void: `#070910`
- Cosmic navy: `#111735`
- Notation paper: `#F3F0E8`
- Ink: `#171821`
- Prop blue: `#4C8DFF`
- Prop red: `#FF4C5E`

Map these through the project's three-layer variable hierarchy. The component owns semantic variables and maps them to existing global tokens where suitable. Do not scatter raw colors through descendant selectors.

The surface should read as a notation sheet or working table, not another glass card. Use a restrained border and shadow only to separate the pale surface from the dark field. Do not add fake interface chrome, decorative browser controls, gradient text, or floating icon tiles.

### Rail

Use one continuous structural rule with six numbered markers. Numbering is justified because the content is a real sequence.

Each item includes:

- a two-digit step number;
- the label;
- a visible selected state;
- a full 44 px minimum pointer target; and
- a clear focus-visible outline.

Remove the current circular orange badges. Avoid pill shapes and glass-panel backgrounds.

### Typography

Reuse the landing page's existing typography:

- Playfair Display for the section heading
- the existing body face for the subtitle and labels
- tabular numerals or the existing utility treatment for step numbers

Do not add a font dependency.

## Responsive Composition

The section uses container-query sizing where the surrounding layout can provide a stable container. Viewport media queries remain appropriate for page-level layout thresholds.

### 4K and ultra-wide

At 3,840 px viewport width:

- target an overall content width of roughly 70 to 74 vw, about 2,688 to 2,842 px;
- give the stage about 1,100 to 1,250 px of usable width;
- give the rail enough width for unbroken labels and comfortable spacing;
- keep the composition asymmetrical, with the stage dominant; and
- use intentional negative space inside the composition instead of leaving the entire section as a narrow centered strip.

The final values must be clamped so the layout remains controlled on wider displays.

### Standard desktop

At approximately 1,200 to 2,199 px:

- use a two-column stage-and-rail composition;
- keep the stage near a 60 percent share;
- reserve enough fixed stage height to prevent changes between states; and
- keep the section heading aligned with the composition rather than floating as an unrelated centered block.

### Fold layout

At 920 to 1,199 px:

- retain the two-part composition;
- reduce the gap and rail width;
- preserve readable labels and 44 px targets; and
- keep the stage large enough to teach, not merely decorate.

This threshold must continue to honor the existing 920 px landing-page fold breakpoint.

### Phone

Below the compact-layout threshold:

- place the stage above the controls;
- present the six controls as a compact 2-by-3 grid;
- keep each target at least 44 px high;
- keep the selected state visible without relying on color alone;
- avoid horizontal scrolling; and
- avoid reproducing the current 2-by-3 grid of six large content cards.

## Loading and Layout Stability

`LazyHowTkaWorksSection` must reserve the same outer geometry as the loaded Assembly Table at each responsive tier.

Replace the six-card skeleton with:

- one stage placeholder;
- one rail placeholder; and
- the same heading and outer spacing footprint as the loaded section.

The lazy swap must not move the sections below it. Verification must compare the skeleton and loaded section rectangles at phone, fold, desktop, and 4K widths.

If sequence loading fails, keep the rail and stage geometry. Show a concise message within the stage and allow the section to remain navigable. Do not collapse the section or replace it with an unrelated toast.

## Accessibility

- The Toggle Group has an accessible label that describes the six assembly stages.
- Each control exposes its full label and selected state.
- The stage has a concise accessible description that changes with the selected step.
- State announcements use a polite live region and do not announce every autoplay change when the visitor has not engaged.
- Keyboard users can reach the group once and move between items with the expected arrow keys.
- Focus is never moved by autoplay.
- Selected, hover, and focus states meet contrast requirements on the dark field.
- Reduced motion disables the introductory progression and nonessential transitions.
- The animation renderer does not run while hidden.

## Performance

- Keep one `PictographContainer` for steps 1 through 4.
- Do not instantiate hidden duplicates of the pictograph renderer.
- Keep the existing section-level lazy import.
- Delay animation initialization until playback is active and visible.
- Pause time-based work when the section or document is not visible.
- Reuse the current public sequence fetch and derived data rather than making per-step requests.
- Do not add a package dependency.

## Expected File Scope

Primary files:

- `src/lib/features/landing/components/HowTkaWorksSection.svelte`
- `src/lib/features/landing/components/LazyHowTkaWorksSection.svelte`
- `src/lib/features/landing/components/HowTkaAnimationCard.svelte`

Possible focused additions:

- a small landing-local step model or timing helper if extracting it materially improves readability;
- a silent-state test for autoplay cancellation or animation activation if that logic cannot be proven reliably through browser observation.

Do not modify notation renderers, sequence data, global themes, or unrelated landing sections unless implementation evidence shows a required integration change.

## Verification Matrix

### Automated

- Run the project fast TypeScript/Svelte check once after implementation.
- Run focused tests for any extracted state or lifecycle logic.
- Run the full required pre-commit verification according to the repository resource gate.

### Browser

Use the worktree's own dev server on a free port after checking the machine-wide server cap. Never modify or stop the user's `:5173` server.

Capture and inspect:

- 390 by 844
- 929 by 1,011
- 1,440 by 900
- 1,920 by 1,080
- 3,840 by 2,160

For each relevant size, verify:

- no horizontal overflow;
- stable section height during lazy mounting and step changes;
- stage dominance and rail readability;
- control targets and focus visibility;
- direct selection of all six states;
- keyboard arrow navigation;
- autoplay cancellation after engagement;
- reduced-motion behavior;
- animation inactivity outside step 6;
- loading and failure geometry; and
- no new console errors.

At 4K, record the final section, stage, and rail rectangles. The layout must demonstrate real recomposition compared with the measured 1,960 px six-card row.

## Acceptance Criteria

The redesign is complete when:

1. The six simultaneous cards are gone.
2. One persistent stage presents all six states.
3. Steps 1 through 4 reuse one `PictographContainer` and its internal transition.
4. The sequence and playback states use the existing real product components.
5. The rail uses an installed accessible primitive with keyboard navigation.
6. The animation does not initialize or play while its step is inactive.
7. The section recomposes at 4K and no longer reads as a narrow enlarged card strip.
8. The phone layout teaches through one large stage instead of six tiny previews.
9. The lazy skeleton matches the loaded geometry without visible layout shift.
10. Reduced motion, focus behavior, loading, and failure states are verified.
11. Automated checks pass with recorded output.
12. Browser screenshots and runtime measurements show the result at the required viewport sizes.

## Design Test

Cover the heading. The section should still look unmistakably like a movement-notation product. If the same composition could be transferred unchanged to an AI writing tool, task manager, or crypto dashboard, the redesign has failed.
