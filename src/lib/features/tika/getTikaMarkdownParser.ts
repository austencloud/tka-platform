import { TikaMarkdownParser } from './services/implementations/TikaMarkdownParser';

let instance: TikaMarkdownParser | null = null;
export function getTikaMarkdownParser(): TikaMarkdownParser {
  return instance ??= new TikaMarkdownParser();
}
