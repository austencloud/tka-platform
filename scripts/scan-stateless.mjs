import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

function walk(dir, ext, ignore) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      results.push(...walk(full, ext, ignore));
    } else if (entry.name.endsWith(ext) && !ignore.some(p => full.includes(p))) {
      results.push(full);
    }
  }
  return results;
}

const files = walk('src/lib', '.ts', ['.svelte.ts', 'contracts' + '\\']);
const results = [];

for (const f of files) {
  const content = readFileSync(f, 'utf8');
  const classRegex = /export class (\w+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    const clsName = match[1];
    const start = match.index;
    const bracePos = content.indexOf('{', start);
    if (bracePos === -1) continue;
    let depth = 0;
    let end = -1;
    for (let i = bracePos; i < content.length; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) continue;
    const body = content.slice(bracePos, end + 1);

    // Skip if constructor has params
    const ctorMatch = body.match(/constructor\s*\(([^)]*)\)/);
    if (ctorMatch && ctorMatch[1].trim()) continue;

    // Check for instance fields
    const lines = body.split('\n');
    let hasFields = false;
    for (const line of lines) {
      const s = line.trim();
      if (!s || s.startsWith('//') || s.startsWith('/*') || s.startsWith('*')) continue;
      if (s.includes('static ')) continue;
      // Match field declarations (not methods)
      const fm = s.match(/^(?:private|public|protected|readonly)\s+(?!static)(\w+)\s*([(:=;])/);
      if (fm && fm[2] !== '(') {
        hasFields = true;
        break;
      }
    }
    if (hasFields) continue;

    const rel = relative('.', f).replace(/\\/g, '/');
    results.push(rel + '\t' + clsName);
  }
}

results.sort();
results.forEach(r => console.log(r));
console.log('---TOTAL: ' + results.length + '---');
