/**
 * When the inbox drawer takes the whole screen instead of being a side panel.
 *
 * Width alone was the original test (`max-width: 768px`) and it gets foldables
 * wrong. A Galaxy Z Fold unfolded is a 707x823 CSS viewport in portrait, so it
 * passed and got the full-bleed treatment; turn the same device sideways and it
 * is 823x707, which fails a 768px test and fell back to a 480px side panel with
 * a scrim over the rest. Same device, same hand, same reach - a worse layout,
 * for no reason other than which number happened to be the width.
 *
 * The distinction that actually matters is not "narrow" but "held". On a touch
 * device the drawer IS the task and should own the screen; on a desktop with a
 * pointer it is a panel beside work the user is keeping in view. `(hover: none)
 * and (pointer: coarse)` is that test, and it excludes hybrid touch laptops,
 * which report a hover-capable pointer.
 *
 * The 1024px ceiling keeps large tablets in landscape on the side panel, where
 * there is genuinely room for one, and keeps a desktop browser from flipping to
 * full-bleed if its pointer is ever reported as coarse.
 *
 * MUST stay byte-identical to the @media rule in InboxDrawer.svelte - the two
 * control halves of the same layout (placement, drag handle and keyboard inset
 * on the JS side; width, radius and height on the CSS side), and a drift
 * between them yields a side panel stretched to full height, or a full-bleed
 * sheet with no drag handle. `full-bleed-drawer-contract.test.ts` pins them.
 */
export const FULL_BLEED_DRAWER_QUERY =
  "(max-width: 768px), ((hover: none) and (pointer: coarse) and (max-width: 1024px))";
