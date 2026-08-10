export function sampleAutumnLanternFlicker(time: number): number {
  const slowBreath = Math.sin(time * 1.37 + 0.4) * 0.035;
  const flameFlutter = Math.sin(time * 6.73 + 1.1) * 0.018;
  const tinyIrregularity = Math.sin(time * 12.91 + 2.2) * 0.007;
  return Math.min(
    1.07,
    Math.max(0.93, 1 + slowBreath + flameFlutter + tinyIrregularity)
  );
}
