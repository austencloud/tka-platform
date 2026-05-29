import { SequenceDataProvider } from './services/sequence-data-provider';
import { getSequenceRepository } from '$lib/shared/create/getSequenceRepository';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';

let instance: SequenceDataProvider | null = null;
export function getSequenceDataProvider(): SequenceDataProvider {
  return instance ??= new SequenceDataProvider(getSequenceRepository(), getBrowseLoader());
}
