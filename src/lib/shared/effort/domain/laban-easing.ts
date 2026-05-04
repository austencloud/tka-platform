/**
 * Laban Weight easing: controls force/attack of movement.
 * weight: 0 = maximally light (gentle ease-out), 1 = maximally strong (aggressive attack)
 */
export function applyWeightEasing(t: number, weight: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;

	const easeOut = 1 - Math.pow(1 - t, 3);
	const easeIn = Math.pow(t, 3);
	return easeOut * (1 - weight) + easeIn * weight;
}

/**
 * Laban Time easing: controls speed distribution.
 * time: 0 = maximally sustained (even distribution), 1 = maximally sudden (sharp acceleration)
 */
export function applyTimeEasing(t: number, time: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;

	const exponent = 1 + time * 3;
	return Math.pow(t, exponent);
}

/**
 * Compound Laban easing: Weight applied over Time.
 */
export function applyLabanEasing(
	t: number,
	weight: number,
	time: number
): number {
	return applyWeightEasing(applyTimeEasing(t, time), weight);
}
