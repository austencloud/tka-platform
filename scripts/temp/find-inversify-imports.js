/**
 * Find all files importing from inversify in learn and feedback modules
 */

const fs = require('fs');
const path = require('path');

const basePath = 'F:\\_THE KINETIC ALPHABET\\_TKA-SCRIBE\\src\\lib\\features';
const modules = ['learn', 'feedback'];

function findInversifyImports(dirPath, results = []) {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);

    if (file.isDirectory()) {
      findInversifyImports(fullPath, results);
    } else if (file.name.endsWith('.ts') || file.name.endsWith('.svelte')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('from "$lib/shared/inversify') ||
          content.includes('from "../../../shared/inversify') ||
          content.includes('from "../../shared/inversify')) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

// Find all files
const results = [];
for (const module of modules) {
  const modulePath = path.join(basePath, module);
  findInversifyImports(modulePath, results);
}

console.log(`Found ${results.length} files with inversify imports:\n`);
results.forEach(file => console.log(file));
