# Sidebar prop pairs

The desktop footer and mobile/side navigation now show both selected props,
using the saved primary colors, fan build, model look and applicable chirality.
Mixed prop selections keep separate slots. The existing Prop Button Lab tunes
the same composition renderer; its saved overrides still take precedence.

Fan artwork is cropped to its painted window and arranged as an outward-facing,
diagonally offset pair. Alpha coverage is strengthened at icon size so the thin
spokes and flat grips stay visible without changing the chosen colors.

Review route: `/test/sidebar-props`. Shipping surface: `/create` navigation.

Verified with Chrome DevTools in the dedicated agent browser:

- Inspected 375×667, 960×412, 820×1180, 1440×900, 1920×1080, 2560×1440 and
  3840×2160. The glyph stayed 40×40, with no horizontal overflow.
- Mounted the production SidebarFooter in collapsed and expanded states using
  local fixture settings. Both images resolved to `fan-flat-grip.svg`; their
  SVG colors were exactly `#36d6c5` and `#ff8dba`. The button remained 44×44.
- Clicking the production button set the existing prop drawer's open state.
- Switched between Pictograph and Flat Grip Fire using the picker. Both image
  sources changed and the glyph dimensions stayed fixed.
- Changed only the left color to orange using the picker. The left filter
  became `#f97316`; the right remained `#ff8dba`.
- 16 focused tests passed across primary colors, render appearance and tile/glyph
  artwork. Svelte check reported zero errors and zero warnings.

An additional existing chirality contract suite had two failures because it
expects chirality markup inside BentoPropGrid, which now delegates to PropGrid.
That file is unchanged by this task; the other 17 assertions passed.

## Family and variant refinement

The gallery now shows all 40 active prop types across 19 registry families,
expanded to 50 choices by the six fan builds for both fan sizes. Each choice
has an enlarged preview and actual 36px mobile and 40px sidebar glyphs. Shared
controls expose both colors, artwork mode, buugeng grip and fan covers.

Compact recipes give clubs an upright V, torches and swords a crossing pose,
buugengs parallel curves, and double stars/eight rings separate vertical pairs.
Hands and three-part shapes have more separation. Single contact balls retain
two distinct circles; double-contact variants retain four. Existing staff
crosses and the fan arrangement remain. Variant recipes now take precedence
over base-family defaults, so torches, trigengs and double-contact variants
keep their intended poses. Saved lab overrides remain intact.

Navigation crops remove invisible artwork and unused canvas from 16 notation
variants. Big Fan's notation artwork uses its own canvas, while physical fan
builds retain their measured crop. Oppositely oriented model captures receive
a navigation-only rotation. Model silhouettes get slightly stronger alpha
coverage; the fire staff uses its equivalent vector silhouette because the
capture's thin shaft disappears at 36px. Picker and choreography artwork are
unchanged.

Verification: inspected every gallery choice in pictograph and model modes,
all six fan builds, covered fans, and flipped buugeng grips using Chrome DevTools.
The seven viewport sizes listed above each rendered 50 cards without horizontal
overflow. Also inspected mobile cards and 200% CSS zoom. No browser console
errors. The focused artwork and composition suites passed all 24 tests; Svelte
check reported zero errors and warnings.
