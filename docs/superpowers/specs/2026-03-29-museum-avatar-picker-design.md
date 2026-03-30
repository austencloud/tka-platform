# Museum Avatar Picker Design

**Date:** 2026-03-29
**Status:** Approved
**Scope:** Player avatar customization for the 2D museum walker

---

## Problem

The player sprite needs to feel personal without being a full character creator. The current sprite (shadow figure with lantern) was too dark for the well-lit museum aesthetic. The golden orb was too abstract.

## Solution

A simple avatar picker shown before the player enters the museum. Three customization axes: skin tone, hair color, jacket color. The sprite is a top-down museum visitor (head + hair + body) rendered with CSS shapes.

### Avatar Picker UI

- Shown once on first visit to Museum 2D (or accessible from Settings)
- Title: "Choose Your Visitor"
- Three rows of color swatches:
  - **Skin:** 6 options (light → dark)
  - **Hair:** 7 options (black, brown, blonde, red, gray, white, fun gradient)
  - **Jacket:** 7 options (blue, black, brown, green, red, purple, gold)
- Live preview at 2x scale above the swatches
- Tile-size previews at 48px, 32px, 24px below the large preview
- "Enter the Archive" button
- "You can change this later in Settings" footnote
- 180+ possible combinations

### Player Sprite (In-Game)

The sprite is a top-down view of a person, rendered as CSS shapes:

- **Head:** Oval with radial gradient using selected skin tone + darker variant
- **Hair:** Half-oval on top of head using selected hair color
- **Body:** Rounded rectangle using selected jacket color (gradient top→bottom)
- **No bag strap** — too noisy at 32px
- **No facing blob** — looked like a hair bun

**Facing direction:** Shown by rotating the entire sprite to match the facing direction. The head being offset from center (slightly toward "front") makes the facing readable.

**Walking animation:**
- Head bobs up 1-2px on steps(2) timing
- Body sways slightly (0.5px translate + 1.5deg rotation)
- Different timing from idle to feel more urgent

**Idle animation:**
- Subtle head breathing (scale 1.0 → 1.03 over 3.5s)

### Visual Direction

- **Well-lit museum** — warm, inviting, everything visible
- Floor materials, exhibits, and architectural details all clearly readable
- Torches add warmth and character, not darkness
- No darkness overlay, no fog of war, no dungeon aesthetic
- Wing-themed color tinting: subtle, not dramatic

### Persistence

Avatar choices stored in localStorage:
```typescript
interface AvatarConfig {
  skinColor: string;    // hex
  hairColor: string;    // hex or CSS gradient
  jacketColor: [string, string];  // gradient top, bottom
}
```

Default: medium skin (#d4a574), black hair (#1a0a00), blue jacket (#4a7aaa → #3a6a9a).

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/features/museum-2d/components/game/AvatarPicker.svelte` | Create | The picker UI with swatches + live preview |
| `src/lib/features/museum-2d/components/game/MuseumPlayerView.svelte` | Modify | Render sprite using avatar config (head/hair/body shapes) |
| `src/lib/features/museum-2d/state/avatar-state.svelte.ts` | Create | Avatar config state + localStorage persistence |
| `src/lib/features/museum-2d/Museum2DModule.svelte` | Modify | Show picker on first visit, then game |

---

## What This Does NOT Include

- Accessories (hat, glasses, scarf) — may add later if warranted
- Sprite sheet animations — CSS shapes only
- Different body types — one silhouette, colors vary
- Name input — the player identity is deliberately ambiguous per the story bible
