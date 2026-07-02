import { describe, it, expect } from 'vitest';
import {
	viewerModeOptions,
	coerce3DContent,
	coerce3DSplit
} from './viewer-modes';

const has = (webgl2: boolean, fits3D: boolean) =>
	viewerModeOptions(webgl2, fits3D).some((m) => m.id === 'animation-3d');

describe('viewerModeOptions', () => {
	it('shows 3D only when WebGL2 is available AND the viewport fits', () => {
		expect(has(true, true)).toBe(true);
		expect(has(true, false)).toBe(false); // small screen: no 3D
		expect(has(false, true)).toBe(false); // no WebGL2: no 3D
		expect(has(false, false)).toBe(false);
	});

	it('defaults viewportFits3D to true (back-compat with single-arg callers)', () => {
		expect(viewerModeOptions(true).some((m) => m.id === 'animation-3d')).toBe(true);
	});

	it('never drops the always-available 2D modes', () => {
		const ids = viewerModeOptions(false, false).map((m) => m.id);
		expect(ids).toContain('animation');
		expect(ids).toContain('card');
		expect(ids).toContain('split');
	});
});

describe('coerce3DContent', () => {
	it('maps animation-3d to animation only when the viewport does not fit', () => {
		expect(coerce3DContent('animation-3d', false)).toBe('animation');
		expect(coerce3DContent('animation-3d', true)).toBe('animation-3d');
	});

	it('leaves non-3D content untouched regardless of fit', () => {
		expect(coerce3DContent('card', false)).toBe('card');
		expect(coerce3DContent('animation', false)).toBe('animation');
		expect(coerce3DContent('mandala', true)).toBe('mandala');
	});
});

describe('coerce3DSplit', () => {
	it('coerces both panes away from 3D when the viewport does not fit', () => {
		expect(coerce3DSplit({ leftPane: 'animation-3d', rightPane: 'card' }, false)).toEqual({
			leftPane: 'animation',
			rightPane: 'card'
		});
		expect(coerce3DSplit({ leftPane: 'animation', rightPane: 'animation-3d' }, false)).toEqual({
			leftPane: 'animation',
			rightPane: 'animation'
		});
	});

	it('returns the config unchanged when the viewport fits', () => {
		const cfg = { leftPane: 'animation-3d', rightPane: 'card' } as const;
		expect(coerce3DSplit(cfg, true)).toBe(cfg);
	});
});
