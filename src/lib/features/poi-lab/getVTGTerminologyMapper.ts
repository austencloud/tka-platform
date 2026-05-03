import { VTGTerminologyMapper } from './services/implementations/VTGTerminologyMapper';

let instance: VTGTerminologyMapper | null = null;
export function getVTGTerminologyMapper(): VTGTerminologyMapper {
  return instance ??= new VTGTerminologyMapper();
}
