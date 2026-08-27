#!/usr/bin/env node
/**
 * i18n Validation Script
 *
 * Runs comprehensive validation checks on the i18n system:
 * 1. Locale completeness - all locales have same keys as en.json
 * 2. Unused key detection - find dead translation keys
 * 3. Parameter consistency - same {param} placeholders across locales
 * 4. Locale file linting - valid JSON, sorted keys
 * 5. Coverage report - % of app using i18n vs hardcoded strings
 *
 * Usage:
 *   node scripts/validate-i18n.cjs              Run all checks
 *   node scripts/validate-i18n.cjs --fix        Auto-fix sortable issues
 *   node scripts/validate-i18n.cjs --coverage   Coverage report only
 *   node scripts/validate-i18n.cjs --ci         CI mode (exit 1 on errors)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');


const MESSAGES_DIR = path.resolve(__dirname, '../messages');
const SRC_DIR = path.resolve(__dirname, '../src');
const BASE_LOCALE = 'en';

const args = process.argv.slice(2);
const CI_MODE = args.includes('--ci');
const FIX_MODE = args.includes('--fix');
const COVERAGE_ONLY = args.includes('--coverage');

let errorCount = 0;
let warningCount = 0;


function error(message) {
  console.error(`\n❌ ERROR: ${message}`);
  errorCount++;
}

function warn(message) {
  console.warn(`\n⚠️  WARNING: ${message}`);
  warningCount++;
}

function success(message) {
  console.log(`\n✅ ${message}`);
}

function info(message) {
  console.log(`\n💡 ${message}`);
}

function header(title) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

// ============================================================================
// CHECK 1: LOCALE COMPLETENESS
// ============================================================================

function checkLocaleCompleteness() {
  header('CHECK 1: Locale Completeness');

  const baseFile = path.join(MESSAGES_DIR, `${BASE_LOCALE}.json`);
  const baseMessages = JSON.parse(fs.readFileSync(baseFile, 'utf-8'));
  const baseKeys = Object.keys(baseMessages).filter(k => !k.startsWith('$'));

  const localeFiles = fs.readdirSync(MESSAGES_DIR)
    .filter(f => f.endsWith('.json') && f !== `${BASE_LOCALE}.json`);

  let allComplete = true;

  for (const file of localeFiles) {
    const locale = file.replace('.json', '');
    const filePath = path.join(MESSAGES_DIR, file);
    const messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const keys = Object.keys(messages).filter(k => !k.startsWith('$'));

    // Missing keys in this locale
    const missingKeys = baseKeys.filter(k => !keys.includes(k));

    // Extra keys in this locale (not in base)
    const extraKeys = keys.filter(k => !baseKeys.includes(k));

    if (missingKeys.length > 0) {
      error(`${locale}.json is missing ${missingKeys.length} keys:`);
      console.log(`   ${missingKeys.slice(0, 10).join(', ')}${missingKeys.length > 10 ? '...' : ''}`);
      allComplete = false;
    }

    if (extraKeys.length > 0) {
      warn(`${locale}.json has ${extraKeys.length} extra keys not in ${BASE_LOCALE}.json:`);
      console.log(`   ${extraKeys.slice(0, 10).join(', ')}${extraKeys.length > 10 ? '...' : ''}`);
      allComplete = false;
    }

    if (missingKeys.length === 0 && extraKeys.length === 0) {
      success(`${locale}.json: ${keys.length} keys (complete)`);
    }
  }

  if (allComplete) {
    success(`All ${localeFiles.length} locale files are complete with ${baseKeys.length} keys`);
  }

  return allComplete;
}

// ============================================================================
// CHECK 2: UNUSED KEY DETECTION
// ============================================================================

function findUnusedKeys() {
  header('CHECK 2: Unused Key Detection');

  const baseFile = path.join(MESSAGES_DIR, `${BASE_LOCALE}.json`);
  const baseMessages = JSON.parse(fs.readFileSync(baseFile, 'utf-8'));
  const allKeys = Object.keys(baseMessages).filter(k => !k.startsWith('$'));

  info(`Searching ${SRC_DIR} for key usage...`);

  const unusedKeys = [];

  for (const key of allKeys) {
    // Search for key usage in src directory
    // Look for: t("key") or t('key') or tDynamic("key") or tDynamic('key')
    try {
      const result = execSync(
        `grep -r "t(\\"${key}\\"\\|t('${key}'\\|tDynamic(\\"${key}\\"\\|tDynamic('${key}')" "${SRC_DIR}" 2>&1`,
        { encoding: 'utf-8' }
      );
      // If grep found it, key is used
    } catch (e) {
      // grep exits with 1 if no matches found
      if (e.status === 1) {
        unusedKeys.push(key);
      }
    }
  }

  if (unusedKeys.length > 0) {
    warn(`Found ${unusedKeys.length} potentially unused translation keys:`);
    console.log(`\n   ${unusedKeys.slice(0, 20).join('\n   ')}`);
    if (unusedKeys.length > 20) {
      console.log(`   ... and ${unusedKeys.length - 20} more`);
    }
    info(`Review these keys - they may be dynamically constructed or truly unused.`);
  } else {
    success(`All ${allKeys.length} translation keys are in use!`);
  }

  return unusedKeys;
}

// ============================================================================
// CHECK 3: PARAMETER CONSISTENCY
// ============================================================================

function checkParameterConsistency() {
  header('CHECK 3: Parameter Consistency');

  const baseFile = path.join(MESSAGES_DIR, `${BASE_LOCALE}.json`);
  const baseMessages = JSON.parse(fs.readFileSync(baseFile, 'utf-8'));

  const localeFiles = fs.readdirSync(MESSAGES_DIR)
    .filter(f => f.endsWith('.json'));

  const localeMessages = {};
  for (const file of localeFiles) {
    const locale = file.replace('.json', '');
    localeMessages[locale] = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, file), 'utf-8'));
  }

  // Extract parameters from a translation string: {param1}, {param2}
  function extractParams(text) {
    const matches = text.match(/\{(\w+)\}/g);
    return matches ? matches.map(m => m.slice(1, -1)).sort() : [];
  }

  let inconsistentCount = 0;

  for (const [key, baseValue] of Object.entries(baseMessages)) {
    if (key.startsWith('$')) continue;

    const baseParams = extractParams(baseValue);
    if (baseParams.length === 0) continue; // No params to check

    for (const [locale, messages] of Object.entries(localeMessages)) {
      if (locale === BASE_LOCALE) continue;
      if (!messages[key]) continue; // Already caught in completeness check

      const localeParams = extractParams(messages[key]);

      // Compare param sets
      const baseSet = new Set(baseParams);
      const localeSet = new Set(localeParams);

      const missing = baseParams.filter(p => !localeSet.has(p));
      const extra = localeParams.filter(p => !baseSet.has(p));

      if (missing.length > 0 || extra.length > 0) {
        error(`Parameter mismatch in key "${key}":`);
        console.log(`   ${BASE_LOCALE}: {${baseParams.join('}, {')}}`);
        console.log(`   ${locale}: {${localeParams.join('}, {')}}`);
        if (missing.length > 0) {
          console.log(`   Missing: {${missing.join('}, {')}}`);
        }
        if (extra.length > 0) {
          console.log(`   Extra: {${extra.join('}, {')}}`);
        }
        inconsistentCount++;
      }
    }
  }

  if (inconsistentCount === 0) {
    success('All translation parameters are consistent across locales!');
  }

  return inconsistentCount === 0;
}

// ============================================================================
// CHECK 4: LOCALE FILE LINTING
// ============================================================================

function lintLocaleFiles() {
  header('CHECK 4: Locale File Linting');

  const localeFiles = fs.readdirSync(MESSAGES_DIR)
    .filter(f => f.endsWith('.json'));

  let allValid = true;

  for (const file of localeFiles) {
    const filePath = path.join(MESSAGES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check 1: Valid JSON
    try {
      JSON.parse(content);
    } catch (e) {
      error(`${file}: Invalid JSON - ${e.message}`);
      allValid = false;
      continue;
    }

    // Check 2: Keys are sorted
    const messages = JSON.parse(content);
    const keys = Object.keys(messages);
    const sortedKeys = [...keys].sort();

    const unsortedKeys = keys.filter((k, i) => k !== sortedKeys[i]);

    if (unsortedKeys.length > 0) {
      warn(`${file}: Keys are not sorted (${unsortedKeys.length} out of order)`);

      if (FIX_MODE) {
        // Sort keys and rewrite file
        const sorted = {};
        for (const key of sortedKeys) {
          sorted[key] = messages[key];
        }
        fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
        success(`${file}: Keys sorted and saved`);
      } else {
        info(`   Run with --fix to auto-sort keys`);
      }
      allValid = false;
    } else {
      success(`${file}: Valid JSON with ${keys.length} sorted keys`);
    }
  }

  return allValid;
}

// ============================================================================
// CHECK 5: COVERAGE REPORT
// ============================================================================

function generateCoverageReport() {
  header('CHECK 5: i18n Coverage Report');

  info('Analyzing codebase for i18n adoption...');

  // Find all .svelte and .ts files
  const allFiles = execSync(
    `find "${SRC_DIR}" -type f \\( -name "*.svelte" -o -name "*.ts" \\) | grep -v ".svelte-kit" | grep -v "node_modules"`,
    { encoding: 'utf-8' }
  ).trim().split('\n').filter(Boolean);

  const totalFiles = allFiles.length;

  // Find files importing i18n
  const i18nFiles = allFiles.filter(file => {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      return /from.*["'].*i18n\.svelte/.test(content) || /from.*["'].*locale-state\.svelte/.test(content);
    } catch (e) {
      return false;
    }
  });

  const coveragePercent = ((i18nFiles.length / totalFiles) * 100).toFixed(1);

  console.log(`\n  Total Files:      ${totalFiles}`);
  console.log(`  Using i18n:       ${i18nFiles.length} (${coveragePercent}%)`);
  console.log(`  Not using i18n:   ${totalFiles - i18nFiles.length}`);

  // Find files with hardcoded strings (simple heuristic: string literals in templates)
  info('\nScanning for potential hardcoded strings...');

  const filesWithHardcodedStrings = [];

  for (const file of allFiles) {
    if (i18nFiles.includes(file)) continue; // Skip files already using i18n

    try {
      const content = fs.readFileSync(file, 'utf-8');
      // Look for string literals that look like UI text (not paths, not single chars)
      const matches = content.match(/"[A-Z][a-z\s]{10,}"/g) || content.match(/'[A-Z][a-z\s]{10,}'/g);
      if (matches && matches.length > 0) {
        filesWithHardcodedStrings.push({ file, count: matches.length });
      }
    } catch (e) {
      // Skip unreadable files
    }
  }

  if (filesWithHardcodedStrings.length > 0) {
    warn(`Found ${filesWithHardcodedStrings.length} files with potential hardcoded UI strings:`);
    filesWithHardcodedStrings
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .forEach(({ file, count }) => {
        const relPath = path.relative(SRC_DIR, file);
        console.log(`   ${relPath}: ~${count} string(s)`);
      });
    if (filesWithHardcodedStrings.length > 10) {
      console.log(`   ... and ${filesWithHardcodedStrings.length - 10} more`);
    }
  }

  // Grade the coverage
  if (coveragePercent >= 80) {
    success(`Excellent coverage: ${coveragePercent}%`);
  } else if (coveragePercent >= 50) {
    info(`Good coverage: ${coveragePercent}% - room for improvement`);
  } else {
    warn(`Low coverage: ${coveragePercent}% - many files still need i18n`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                        i18n VALIDATION SUITE                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  if (COVERAGE_ONLY) {
    generateCoverageReport();
  } else {
    checkLocaleCompleteness();
    findUnusedKeys();
    checkParameterConsistency();
    lintLocaleFiles();
    generateCoverageReport();
  }

  // Summary
  header('VALIDATION SUMMARY');

  if (errorCount > 0) {
    console.log(`\n❌ ${errorCount} error(s) found`);
  }
  if (warningCount > 0) {
    console.log(`⚠️  ${warningCount} warning(s) found`);
  }
  if (errorCount === 0 && warningCount === 0) {
    console.log(`\n✅ All checks passed! i18n system is healthy.`);
  }

  console.log('');

  // Exit code for CI
  if (CI_MODE && errorCount > 0) {
    process.exit(1);
  }
}

main();
