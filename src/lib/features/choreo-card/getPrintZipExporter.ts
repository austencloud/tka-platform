
import { PrintZipExporter } from './services/implementations/PrintZipExporter';

let instance: PrintZipExporter | null = null;
export function getPrintZipExporter(): PrintZipExporter {
  return instance ??= new PrintZipExporter();
}
