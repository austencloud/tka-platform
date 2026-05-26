export enum LocomotionMode {
	Anguilliform = 0,
	Subcarangiform = 1,
	Carangiform = 2,
	Thunniform = 3,
	Ostraciiform = 4,
	Labriform = 5,
}

export interface LocomotionModeParams {
	swimFreq: number;
	waveK: number;
	baseAmplitude: number;
	stiffness: number;
	ampExponent: number;
	strideAmp: number;
	rollAmp: number;
	pectoralFreq: number;
	pectoralAmp: number;
}

export const LOCOMOTION_PARAMS: Record<LocomotionMode, LocomotionModeParams> = {
	[LocomotionMode.Anguilliform]: {
		swimFreq: 1.5,
		waveK: 1.6,
		baseAmplitude: 0.07,
		stiffness: 0,
		ampExponent: 1.0,
		strideAmp: 0.03,
		rollAmp: 0.05,
		pectoralFreq: 0,
		pectoralAmp: 0,
	},
	[LocomotionMode.Subcarangiform]: {
		swimFreq: 3.0,
		waveK: 1.1,
		baseAmplitude: 0.1,
		stiffness: 0.4,
		ampExponent: 2.0,
		strideAmp: 0.02,
		rollAmp: 0.04,
		pectoralFreq: 3.0,
		pectoralAmp: 0.05,
	},
	[LocomotionMode.Carangiform]: {
		swimFreq: 4.0,
		waveK: 1.0,
		baseAmplitude: 0.12,
		stiffness: 0.65,
		ampExponent: 3.0,
		strideAmp: 0.01,
		rollAmp: 0.02,
		pectoralFreq: 0,
		pectoralAmp: 0,
	},
	[LocomotionMode.Thunniform]: {
		swimFreq: 5.0,
		waveK: 1.0,
		baseAmplitude: 0.2,
		stiffness: 0.85,
		ampExponent: 4.0,
		strideAmp: 0.005,
		rollAmp: 0.01,
		pectoralFreq: 0,
		pectoralAmp: 0,
	},
	[LocomotionMode.Ostraciiform]: {
		swimFreq: 2.0,
		waveK: 0,
		baseAmplitude: 0.07,
		stiffness: 0.95,
		ampExponent: 1.0,
		strideAmp: 0,
		rollAmp: 0,
		pectoralFreq: 4.0,
		pectoralAmp: 0.08,
	},
	[LocomotionMode.Labriform]: {
		swimFreq: 1.5,
		waveK: 0.3,
		baseAmplitude: 0.03,
		stiffness: 0.85,
		ampExponent: 1.5,
		strideAmp: 0.01,
		rollAmp: 0.02,
		pectoralFreq: 6.0,
		pectoralAmp: 0.12,
	},
};

export const LOCOMOTION_MODE_COUNT = Object.keys(LOCOMOTION_PARAMS).length;
