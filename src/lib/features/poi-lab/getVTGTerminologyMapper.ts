import type { IVTGTerminologyMapper } from './services/contracts/IVTGTerminologyMapper';
import { VTGTerminologyMapper } from './services/implementations/VTGTerminologyMapper';

let instance: IVTGTerminologyMapper | null = null;
export function getVTGTerminologyMapper(): IVTGTerminologyMapper {
  return instance ??= new VTGTerminologyMapper();
}
