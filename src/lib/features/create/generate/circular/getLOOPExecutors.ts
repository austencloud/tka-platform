/**
 * Module singleton getters for all 15 LOOP executor variations + the selector.
 */
import { browser } from '$app/environment';
import { orientationCalculator } from '$lib/shared/pictograph/prop/services/implementations/OrientationCalculator';
import { gridPositionDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver';
import { getLOOPParameterProvider } from '$lib/features/create/generate/shared/getLOOPParameterProvider';

import { StrictRotatedLOOPExecutor } from './services/implementations/StrictRotatedLOOPExecutor';
import { StrictMirroredLOOPExecutor } from './services/implementations/StrictMirroredLOOPExecutor';
import { StrictFlippedLOOPExecutor } from './services/implementations/StrictFlippedLOOPExecutor';
import { StrictSwappedLOOPExecutor } from './services/implementations/StrictSwappedLOOPExecutor';
import { StrictInvertedLOOPExecutor } from './services/implementations/StrictInvertedLOOPExecutor';
import { MirroredSwappedLOOPExecutor } from './services/implementations/MirroredSwappedLOOPExecutor';
import { SwappedInvertedLOOPExecutor } from './services/implementations/SwappedInvertedLOOPExecutor';
import { MirroredInvertedLOOPExecutor } from './services/implementations/MirroredInvertedLOOPExecutor';
import { RotatedSwappedLOOPExecutor } from './services/implementations/RotatedSwappedLOOPExecutor';
import { RotatedInvertedLOOPExecutor } from './services/implementations/RotatedInvertedLOOPExecutor';
import { MirroredRotatedLOOPExecutor } from './services/implementations/MirroredRotatedLOOPExecutor';
import { MirroredRotatedInvertedLOOPExecutor } from './services/implementations/MirroredRotatedInvertedLOOPExecutor';
import { MirroredSwappedInvertedLOOPExecutor } from './services/implementations/MirroredSwappedInvertedLOOPExecutor';
import { MirroredRotatedInvertedSwappedLOOPExecutor } from './services/implementations/MirroredRotatedInvertedSwappedLOOPExecutor';
import { RewoundLOOPExecutor } from './services/implementations/RewoundLOOPExecutor';
import { LOOPExecutorSelector } from './services/implementations/LOOPExecutorSelector';
import type { ILOOPExecutorSelector } from './services/contracts/ILOOPExecutorSelector';

// Basic executors (orientationCalculator only)
let _strictMirrored: StrictMirroredLOOPExecutor | null = null;
let _strictFlipped: StrictFlippedLOOPExecutor | null = null;
let _strictInverted: StrictInvertedLOOPExecutor | null = null;
let _mirroredSwapped: MirroredSwappedLOOPExecutor | null = null;
let _swappedInverted: SwappedInvertedLOOPExecutor | null = null;

// Executors needing gridPositionDeriver too
let _strictRotated: StrictRotatedLOOPExecutor | null = null;
let _strictSwapped: StrictSwappedLOOPExecutor | null = null;
let _rotatedSwapped: RotatedSwappedLOOPExecutor | null = null;

// Executors needing LOOPParameterProvider
let _mirroredInverted: MirroredInvertedLOOPExecutor | null = null;
let _rotatedInverted: RotatedInvertedLOOPExecutor | null = null;
let _mirroredSwappedInverted: MirroredSwappedInvertedLOOPExecutor | null = null;

// Composite executors
let _mirroredRotated: MirroredRotatedLOOPExecutor | null = null;
let _mirroredRotatedInverted: MirroredRotatedInvertedLOOPExecutor | null = null;
let _mirroredRotatedInvertedSwapped: MirroredRotatedInvertedSwappedLOOPExecutor | null = null;

// Other
let _rewound: RewoundLOOPExecutor | null = null;

// Selector
let _selector: ILOOPExecutorSelector | null = null;

function _check() {
	if (!browser) throw new Error('LOOP executors are browser-only');
}

export function getStrictRotatedLOOPExecutor() {
	_check();
	return _strictRotated ??= new StrictRotatedLOOPExecutor(orientationCalculator, gridPositionDeriver);
}
export function getStrictMirroredLOOPExecutor() {
	_check();
	return _strictMirrored ??= new StrictMirroredLOOPExecutor(orientationCalculator);
}
export function getStrictFlippedLOOPExecutor() {
	_check();
	return _strictFlipped ??= new StrictFlippedLOOPExecutor(orientationCalculator);
}
export function getStrictSwappedLOOPExecutor() {
	_check();
	return _strictSwapped ??= new StrictSwappedLOOPExecutor(orientationCalculator, gridPositionDeriver);
}
export function getStrictInvertedLOOPExecutor() {
	_check();
	return _strictInverted ??= new StrictInvertedLOOPExecutor(orientationCalculator);
}
export function getMirroredSwappedLOOPExecutor() {
	_check();
	return _mirroredSwapped ??= new MirroredSwappedLOOPExecutor(orientationCalculator);
}
export function getSwappedInvertedLOOPExecutor() {
	_check();
	return _swappedInverted ??= new SwappedInvertedLOOPExecutor(orientationCalculator);
}
export function getRotatedSwappedLOOPExecutor() {
	_check();
	return _rotatedSwapped ??= new RotatedSwappedLOOPExecutor(orientationCalculator, gridPositionDeriver);
}
export function getRewoundLOOPExecutor() {
	_check();
	return _rewound ??= new RewoundLOOPExecutor();
}

// Executors that need LOOPParameterProvider
export function getMirroredInvertedLOOPExecutor() {
	_check();
	return _mirroredInverted ??= new MirroredInvertedLOOPExecutor(orientationCalculator, getLOOPParameterProvider());
}
export function getRotatedInvertedLOOPExecutor() {
	_check();
	return _rotatedInverted ??= new RotatedInvertedLOOPExecutor(orientationCalculator, gridPositionDeriver, getLOOPParameterProvider());
}
export function getMirroredSwappedInvertedLOOPExecutor() {
	_check();
	return _mirroredSwappedInverted ??= new MirroredSwappedInvertedLOOPExecutor(orientationCalculator, getLOOPParameterProvider());
}

// Composite executors
export function getMirroredRotatedLOOPExecutor() {
	_check();
	return _mirroredRotated ??= new MirroredRotatedLOOPExecutor(getStrictRotatedLOOPExecutor(), getStrictMirroredLOOPExecutor());
}
export function getMirroredRotatedInvertedLOOPExecutor() {
	_check();
	return _mirroredRotatedInverted ??= new MirroredRotatedInvertedLOOPExecutor(getStrictRotatedLOOPExecutor(), getMirroredInvertedLOOPExecutor());
}
export function getMirroredRotatedInvertedSwappedLOOPExecutor() {
	_check();
	return _mirroredRotatedInvertedSwapped ??= new MirroredRotatedInvertedSwappedLOOPExecutor(getStrictRotatedLOOPExecutor(), getMirroredSwappedInvertedLOOPExecutor());
}

// The selector — needs all 15 executors
export function getLOOPExecutorSelector(): ILOOPExecutorSelector {
	_check();
	return _selector ??= new LOOPExecutorSelector(
		getStrictRotatedLOOPExecutor(),
		getStrictMirroredLOOPExecutor(),
		getStrictFlippedLOOPExecutor(),
		getStrictSwappedLOOPExecutor(),
		getStrictInvertedLOOPExecutor(),
		getMirroredSwappedLOOPExecutor(),
		getSwappedInvertedLOOPExecutor(),
		getMirroredInvertedLOOPExecutor(),
		getRotatedSwappedLOOPExecutor(),
		getRotatedInvertedLOOPExecutor(),
		getMirroredRotatedLOOPExecutor(),
		getMirroredRotatedInvertedLOOPExecutor(),
		getMirroredSwappedInvertedLOOPExecutor(),
		getMirroredRotatedInvertedSwappedLOOPExecutor(),
		getRewoundLOOPExecutor()
	);
}
