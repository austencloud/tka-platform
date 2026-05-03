import { SequenceDataProvider } from './services/implementations/SequenceDataProvider';
import { getSequenceRepository } from '$lib/features/create/shared/getSequenceRepository';
import { getBrowseLoader } from '$lib/features/browse/sequences/display/getBrowseLoader';

let instance: SequenceDataProvider | null = null;
export function getSequenceDataProvider(): SequenceDataProvider {
  return instance ??= new SequenceDataProvider(getSequenceRepository(), getBrowseLoader());
}
