import type { IPreviewCellRenderer } from './services/contracts/IPreviewCellRenderer';
import { PreviewCellRenderer } from './services/implementations/PreviewCellRenderer';

let instance: IPreviewCellRenderer | null = null;
export function getPreviewCellRenderer(): IPreviewCellRenderer {
  return instance ??= new PreviewCellRenderer();
}
