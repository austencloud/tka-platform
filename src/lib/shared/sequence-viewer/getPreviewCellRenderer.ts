import { PreviewCellRenderer } from './services/implementations/PreviewCellRenderer';

let instance: PreviewCellRenderer | null = null;
export function getPreviewCellRenderer(): PreviewCellRenderer {
  return instance ??= new PreviewCellRenderer();
}
