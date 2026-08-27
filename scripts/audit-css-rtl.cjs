#!/usr/bin/env node
/**
 * CSS RTL Audit Script
 *
 * Scans CSS for directional properties that should be migrated to logical properties
 * for RTL language support.
 *
 * Directional Properties (LTR-specific):
 *   margin-left/right → margin-inline-start/end
 *   padding-left/right → padding-inline-start/end
 *   left/right → inset-inline-start/end
 *   border-left/right → border-inline-start/end
 *   text-align: left/right → text-align: start/end
 *
 * Usage:
 *   node scripts/audit-css-rtl.cjs              Scan all CSS
 *   node scripts/audit-css-rtl.cjs --summary    Show summary only
 *   node scripts/audit-css-rtl.cjs --fix        Auto-migrate (coming soon)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');


const SRC_DIR = path.resolve(__dirname, '../src');

const args = process.argv.slice(2);
const SUMMARY_ONLY = args.includes('--summary');
const FIX_MODE = args.includes('--fix');


const DIRECTIONAL_PATTERNS = {
  // Margin
  'margin-left': {
    logical: 'margin-inline-start',
    category: 'spacing',
    severity: 'high',
  },
  'margin-right': {
    logical: 'margin-inline-end',
    category: 'spacing',
    severity: 'high',
  },

  // Padding
  'padding-left': {
    logical: 'padding-inline-start',
    category: 'spacing',
    severity: 'high',
  },
  'padding-right': {
    logical: 'padding-inline-end',
    category: 'spacing',
    severity: 'high',
  },

  // Position
  left: {
    logical: 'inset-inline-start',
    category: 'position',
    severity: 'high',
    note: 'Only in position context (absolute/relative/fixed)',
  },
  right: {
    logical: 'inset-inline-end',
    category: 'position',
    severity: 'high',
    note: 'Only in position context (absolute/relative/fixed)',
  },

  // Border
  'border-left': {
    logical: 'border-inline-start',
    category: 'border',
    severity: 'medium',
  },
  'border-right': {
    logical: 'border-inline-end',
    category: 'border',
    severity: 'medium',
  },
  'border-left-width': {
    logical: 'border-inline-start-width',
    category: 'border',
    severity: 'medium',
  },
  'border-right-width': {
    logical: 'border-inline-end-width',
    category: 'border',
    severity: 'medium',
  },
  'border-left-color': {
    logical: 'border-inline-start-color',
    category: 'border',
    severity: 'medium',
  },
  'border-right-color': {
    logical: 'border-inline-end-color',
    category: 'border',
    severity: 'medium',
  },
  'border-left-style': {
    logical: 'border-inline-start-style',
    category: 'border',
    severity: 'medium',
  },
  'border-right-style': {
    logical: 'border-inline-end-style',
    category: 'border',
    severity: 'medium',
  },

  // Border radius
  'border-top-left-radius': {
    logical: 'border-start-start-radius',
    category: 'border',
    severity: 'low',
  },
  'border-top-right-radius': {
    logical: 'border-start-end-radius',
    category: 'border',
    severity: 'low',
  },
  'border-bottom-left-radius': {
    logical: 'border-end-start-radius',
    category: 'border',
    severity: 'low',
  },
  'border-bottom-right-radius': {
    logical: 'border-end-end-radius',
    category: 'border',
    severity: 'low',
  },

  // Text align (value-based)
  'text-align: left': {
    logical: 'text-align: start',
    category: 'text',
    severity: 'high',
  },
  'text-align: right': {
    logical: 'text-align: end',
    category: 'text',
    severity: 'high',
  },
};


function header(title) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

function info(message) {
  console.log(`\n💡 ${message}`);
}

// ============================================================================
// SCAN CSS FILES
// ============================================================================

function scanCssFiles() {
  header('CSS RTL AUDIT');

  info('Scanning for directional CSS properties...');

  // Find all .svelte and .css files
  const cssFiles = execSync(
    `find "${SRC_DIR}" -type f \\( -name "*.svelte" -o -name "*.css" \\) | grep -v ".svelte-kit" | grep -v "node_modules"`,
    { encoding: 'utf-8' }
  )
    .trim()
    .split('\n')
    .filter(Boolean);

  const findings = {
    high: [],
    medium: [],
    low: [],
  };

  const fileStats = {};

  for (const file of cssFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];

        // Check each directional pattern
        for (const [pattern, info] of Object.entries(DIRECTIONAL_PATTERNS)) {
          // Simple regex check (not perfect but catches most cases)
          const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

          if (regex.test(line)) {
            const relPath = path.relative(SRC_DIR, file);

            findings[info.severity].push({
              file: relPath,
              line: lineNum + 1,
              pattern,
              logical: info.logical,
              category: info.category,
              code: line.trim(),
              note: info.note,
            });

            // Track file stats
            if (!fileStats[relPath]) {
              fileStats[relPath] = { high: 0, medium: 0, low: 0 };
            }
            fileStats[relPath][info.severity]++;
          }
        }
      }
    } catch (e) {
      // Skip unreadable files
    }
  }

  return { findings, fileStats, totalFiles: cssFiles.length };
}

// ============================================================================
// DISPLAY RESULTS
// ============================================================================

function displayResults({ findings, fileStats, totalFiles }) {
  const totalFindings = findings.high.length + findings.medium.length + findings.low.length;

  if (totalFindings === 0) {
    console.log('\n✅ No directional CSS properties found - ready for RTL!');
    return;
  }

  if (!SUMMARY_ONLY) {
    // Show detailed findings by severity
    if (findings.high.length > 0) {
      header('🔴 HIGH PRIORITY (Layout-Breaking in RTL)');
      findings.high.slice(0, 20).forEach((f) => {
        console.log(`\n  ${f.file}:${f.line}`);
        console.log(`    ${f.pattern} → ${f.logical}`);
        console.log(`    ${f.code}`);
        if (f.note) {
          console.log(`    Note: ${f.note}`);
        }
      });
      if (findings.high.length > 20) {
        console.log(`\n  ... and ${findings.high.length - 20} more high priority issues`);
      }
    }

    if (findings.medium.length > 0 && findings.medium.length <= 50) {
      header('🟡 MEDIUM PRIORITY (Visual Issues in RTL)');
      findings.medium.slice(0, 10).forEach((f) => {
        console.log(`\n  ${f.file}:${f.line}`);
        console.log(`    ${f.pattern} → ${f.logical}`);
      });
      if (findings.medium.length > 10) {
        console.log(`\n  ... and ${findings.medium.length - 10} more medium priority issues`);
      }
    }
  }

  // Summary
  header('SUMMARY');

  console.log(`\n  Total Files Scanned:    ${totalFiles}`);
  console.log(`  Files with Issues:      ${Object.keys(fileStats).length}`);
  console.log(`  Total Findings:         ${totalFindings}`);
  console.log(`\n  By Severity:`);
  console.log(`    🔴 High:    ${findings.high.length} (must fix for RTL)`);
  console.log(`    🟡 Medium:  ${findings.medium.length} (visual inconsistencies)`);
  console.log(`    🟢 Low:     ${findings.low.length} (minor corner radius)`);

  console.log(`\n  By Category:`);
  const byCategory = {};
  [...findings.high, ...findings.medium, ...findings.low].forEach((f) => {
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  });
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`    ${cat.padEnd(12)}: ${count}`);
  }

  // Top files needing attention
  console.log(`\n  Files Needing Most Attention:`);
  const sortedFiles = Object.entries(fileStats)
    .sort((a, b) => b[1].high - a[1].high || b[1].medium - a[1].medium)
    .slice(0, 10);

  sortedFiles.forEach(([file, stats]) => {
    const total = stats.high + stats.medium + stats.low;
    console.log(`    ${file} (${total} issues: ${stats.high}H ${stats.medium}M ${stats.low}L)`);
  });

  // Migration guide
  info('Migration Guide:');
  console.log(`
  Replace directional properties with logical equivalents:

  Spacing:
    margin-left   → margin-inline-start
    margin-right  → margin-inline-end
    padding-left  → padding-inline-start
    padding-right → padding-inline-end

  Position:
    left   → inset-inline-start  (in position context)
    right  → inset-inline-end    (in position context)

  Text:
    text-align: left  → text-align: start
    text-align: right → text-align: end

  Border:
    border-left   → border-inline-start
    border-right  → border-inline-end

  Learn more: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties
  `);

  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                        CSS RTL AUDIT                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  const results = scanCssFiles();
  displayResults(results);

  if (FIX_MODE) {
    console.log('\n⚠️  Auto-fix not yet implemented. Manual migration required.');
    console.log('   Follow the migration guide above to update CSS properties.\n');
  }
}

main();
