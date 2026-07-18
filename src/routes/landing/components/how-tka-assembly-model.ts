interface PlaybackActivation {
  active: boolean;
  sectionVisible: boolean;
  documentVisible: boolean;
  reducedMotion: boolean;
}

export function shouldEnableAssemblyPlayback({
  active,
  sectionVisible,
  documentVisible,
  reducedMotion,
}: PlaybackActivation): boolean {
  return active && sectionVisible && documentVisible && !reducedMotion;
}
