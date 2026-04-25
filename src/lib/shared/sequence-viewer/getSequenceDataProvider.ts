import type { ISequenceDataProvider } from './services/contracts/ISequenceDataProvider';
import { SequenceDataProvider } from './services/implementations/SequenceDataProvider';
import { getSequenceRepository } from '$lib/features/create/shared/getSequenceRepository';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: ISequenceDataProvider | null = null;
export function getSequenceDataProvider(): ISequenceDataProvider {
  return instance ??= new SequenceDataProvider(getSequenceRepository(), getBrowseLoader());
}
