# Hero Feature Pills Design

**Date:** 2026-02-25
**Status:** Approved

## Problem

The landing page hero has a title, tagline, and install CTA but no context about what the app actually does. Visitors see "Create, record, and share flow arts choreography" and a "Start exploring" button with no specifics.

## Solution

Add three feature pills inside the existing `hero-text-panel`, between the tagline and the install CTA. Each pill has an icon, bold label, and short description.

## Feature Pills

| Icon | Label | Description |
|------|-------|-------------|
| `fa-pen-nib` | **Create** | Build sequences beat by beat |
| `fa-graduation-cap` | **Learn** | Interactive lessons and guides |
| `fa-users` | **Connect** | Inbox, reactions, choreo cards |

## Layout

- Pills sit inside `hero-text-panel`, below the tagline, above the install flow
- Stacked vertically, left-aligned within the centered panel
- Each pill: icon (accent color) + bold label + muted description on one line
- 12px gap between pills
- 24px spacing above (from tagline) and below (to CTA)

## Styling

- Icons: `var(--theme-accent)` color
- Labels: `var(--theme-text)`, bold
- Descriptions: muted opacity, normal weight
- No background on individual pills (the panel provides the container)

## Mobile

Same vertical stack, tighter padding. No layout change needed since pills are already vertical.

## Files Modified

- `src/routes/landing/components/HeroSection.svelte` — Add feature pills markup and styles inside `hero-text-panel`

## Not Changed

- `HeroInstallFlow.svelte` — Install logic stays exactly as-is
- No new components needed — pills are simple enough to live in HeroSection
