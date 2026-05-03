import { StepDeriver } from './services/implementations/StepDeriver';

let instance: StepDeriver | null = null;

export function getStepDeriver(): StepDeriver {
	return instance ??= new StepDeriver();
}
