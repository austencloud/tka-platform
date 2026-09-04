/**
 * How a panel is allowed to take space inside a PanelGroup.
 *
 * A panel is either *held* -- both grow and shrink are zero, so its flex-basis
 * alone decides its size -- or it takes a share of what is left. The
 * distinction matters for motion: a held panel's whole size lives in one
 * property, so that property has to be interpolable for the panel to animate.
 */
export interface PanelFlex {
  grow: number;
  shrink: number;
  basis: string;
}

export interface PanelFlexInput {
  fixedSize?: string;
  preferredSize?: string;
  defaultSize?: number;
}

export function resolvePanelFlex(
  panel: PanelFlexInput,
  options: { flexShare?: number; manuallySized?: boolean }
): PanelFlex {
  if (panel.fixedSize) {
    return { grow: 0, shrink: 0, basis: panel.fixedSize };
  }

  if (panel.preferredSize && !options.manuallySized) {
    return { grow: 0, shrink: 0, basis: panel.preferredSize };
  }

  return {
    grow: options.flexShare ?? panel.defaultSize ?? 1,
    shrink: 1,
    basis: "0px",
  };
}

export function panelFlexStyle(flex: PanelFlex): string {
  return `flex-grow: ${flex.grow}; flex-shrink: ${flex.shrink}; flex-basis: ${flex.basis}`;
}

export function isHeldPanel(flex: PanelFlex): boolean {
  return flex.grow === 0 && flex.shrink === 0;
}

/**
 * Whether a size change has to be measured before it can be animated.
 *
 * `flex-basis: 480px -> auto` is a discrete change: CSS has no interpolable
 * midpoint between a length and a content keyword, so the group re-lays out in
 * a single frame and every panel after the changed one teleports. Measuring
 * both ends in pixels turns it back into an ordinary length transition.
 *
 * This only holds while the panel is held at both ends. Once a panel takes a
 * flex share its basis is no longer its size, so pinning the basis would fight
 * the share instead of carrying the motion, and the declared grow transition is
 * already the right owner.
 */
export function needsMeasuredBasisHandoff(
  previous: PanelFlex,
  next: PanelFlex
): boolean {
  if (previous.basis === next.basis) return false;
  return isHeldPanel(previous) && isHeldPanel(next);
}
