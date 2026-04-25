import type { ITikaMarkdownParser } from './services/contracts/ITikaMarkdownParser';
import { TikaMarkdownParser } from './services/implementations/TikaMarkdownParser';

let instance: ITikaMarkdownParser | null = null;
export function getTikaMarkdownParser(): ITikaMarkdownParser {
  return instance ??= new TikaMarkdownParser();
}
