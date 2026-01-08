/**
 * Generate Paraglide translations and fix any issues
 *
 * Run with: npm run paraglide
 *
 * This script:
 * 1. Compiles Paraglide from messages/*.json
 * 2. Fixes line endings (CRLF -> LF)
 * 3. Ensures trailing newlines
 * 4. Removes source map references (they don't exist)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PARAGLIDE_DIR = path.join(__dirname, '..', 'src', 'lib', 'paraglide');

console.log('🌐 Generating Paraglide translations...\n');

// Step 1: Run Paraglide compiler
try {
  execSync('npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
} catch (error) {
  console.error('❌ Paraglide compilation failed');
  process.exit(1);
}

// Step 2: Fix all generated files
console.log('\n🔧 Fixing generated files...');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalLength = content.length;

  // Convert CRLF to LF
  content = content.replace(/\r\n/g, '\n');

  // Remove source map references (the maps don't exist)
  content = content.replace(/\/\/# sourceMappingURL=.*\.map\n?/g, '');

  // Ensure single trailing newline
  content = content.trimEnd() + '\n';

  fs.writeFileSync(filePath, content, 'utf8');

  if (content.length !== originalLength) {
    console.log(`  Fixed: ${path.basename(filePath)}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.js') || file.endsWith('.ts')) {
      fixFile(filePath);
    }
  }
}

walkDir(PARAGLIDE_DIR);

console.log('\n✅ Translations generated successfully!');
console.log('   Files are in: src/lib/paraglide/');
console.log('   Commit these files to git.\n');
