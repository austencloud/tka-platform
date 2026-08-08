interface PropsVisibilityState {
  getVisibility(key: "props"): boolean;
  setVisibility(key: "props", visible: boolean): void;
}

interface TrailOnlyState {
  readonly trail: {
    readonly hideProps: boolean;
  };
  setHideProps(hide: boolean): void;
}

/**
 * A person sees one Props control even though playback has two reasons to hide
 * the props. The control must report what the canvas can actually draw.
 */
export function resolveEffectivePropsVisibility(
  propsEnabled: boolean,
  hidePropsForTrails: boolean
): boolean {
  return propsEnabled && !hidePropsForTrails;
}

/**
 * "Show props" is an explicit request, so it also leaves trail-only mode. This
 * prevents a control from lighting up while a persisted effect setting keeps
 * the canvas unchanged.
 */
export function setEffectivePropsVisibility(
  visibility: PropsVisibilityState,
  trailOnly: TrailOnlyState,
  visible: boolean
): void {
  if (visible && trailOnly.trail.hideProps) {
    trailOnly.setHideProps(false);
  }

  visibility.setVisibility("props", visible);
}

export function toggleEffectivePropsVisibility(
  visibility: PropsVisibilityState,
  trailOnly: TrailOnlyState
): void {
  const currentlyVisible = resolveEffectivePropsVisibility(
    visibility.getVisibility("props"),
    trailOnly.trail.hideProps
  );
  setEffectivePropsVisibility(visibility, trailOnly, !currentlyVisible);
}
