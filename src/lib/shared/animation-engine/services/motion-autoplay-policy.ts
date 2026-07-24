export interface MotionAutoplayPreferences {
  readonly reducedMotionSetting: boolean;
  readonly systemPrefersReducedMotion: boolean;
}

export function shouldAutoplayMotion({
  reducedMotionSetting,
  systemPrefersReducedMotion,
}: MotionAutoplayPreferences): boolean {
  return !reducedMotionSetting && !systemPrefersReducedMotion;
}
