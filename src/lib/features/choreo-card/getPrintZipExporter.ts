import type { IPrintZipExporter } from './services/contracts/IPrintZipExporter';
import { PrintZipExporter } from './services/implementations/PrintZipExporter';

let instance: IPrintZipExporter | null = null;
export function getPrintZipExporter(): IPrintZipExporter {
  return instance ??= new PrintZipExporter();
}
