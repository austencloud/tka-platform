import type { IStepDeriver } from './services/contracts/IStepDeriver';
import { StepDeriver } from './services/implementations/StepDeriver';

let instance: IStepDeriver | null = null;

export function getStepDeriver(): IStepDeriver {
	return instance ??= new StepDeriver();
}
