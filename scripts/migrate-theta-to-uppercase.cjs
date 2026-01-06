/**
 * Migration script: Replace lowercase θ with uppercase Θ
 *
 * Targets:
 * 1. Static JSON data files (content replacement)
 * 2. Arrow placement files (rename files with θ in filename)
 * 3. Gallery folders (rename folders with θ)
 * 4. Gallery meta.json files (content replacement)
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const log = (msg) => console.log(msg);
const verbose = (msg) => VERBOSE && console.log(`  ${msg}`);

// Stats tracking
const stats = {
  filesUpdated: 0,
  filesRenamed: 0,
  foldersRenamed: 0,
  errors: []
};

/**
 * Replace θ with Θ in file content
 */
function replaceInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('θ')) {
      return false;
    }

    const newContent = content.replace(/θ-/g, 'Θ-').replace(/θ/g, 'Θ');

    if (content !== newContent) {
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, newContent, 'utf8');
      }
      verbose(`Updated content: ${filePath}`);
      stats.filesUpdated++;
      return true;
    }
    return false;
  } catch (err) {
    stats.errors.push(`Error updating ${filePath}: ${err.message}`);
    return false;
  }
}

/**
 * Rename file if it contains θ in the filename
 */
function renameFileIfNeeded(filePath) {
  const dir = path.dirname(filePath);
  const filename = path.basename(filePath);

  if (!filename.includes('θ')) {
    return filePath;
  }

  const newFilename = filename.replace(/θ-/g, 'Θ-').replace(/θ/g, 'Θ');
  const newPath = path.join(dir, newFilename);

  try {
    if (!DRY_RUN) {
      fs.renameSync(filePath, newPath);
    }
    verbose(`Renamed file: ${filename} → ${newFilename}`);
    stats.filesRenamed++;
    return newPath;
  } catch (err) {
    stats.errors.push(`Error renaming ${filePath}: ${err.message}`);
    return filePath;
  }
}

/**
 * Rename folder if it contains θ in the name
 */
function renameFolderIfNeeded(folderPath) {
  const parent = path.dirname(folderPath);
  const folderName = path.basename(folderPath);

  if (!folderName.includes('θ')) {
    return folderPath;
  }

  const newFolderName = folderName.replace(/θ-/g, 'Θ-').replace(/θ/g, 'Θ');
  const newPath = path.join(parent, newFolderName);

  try {
    if (!DRY_RUN) {
      fs.renameSync(folderPath, newPath);
    }
    verbose(`Renamed folder: ${folderName} → ${newFolderName}`);
    stats.foldersRenamed++;
    return newPath;
  } catch (err) {
    stats.errors.push(`Error renaming folder ${folderPath}: ${err.message}`);
    return folderPath;
  }
}

/**
 * Process arrow placement special folders
 */
function processArrowPlacementFiles() {
  log('\n📁 Processing arrow placement files...');

  const baseDirs = [
    'static/data/arrow_placement/box/special',
    'static/data/arrow_placement/diamond/special'
  ];

  for (const baseDir of baseDirs) {
    if (!fs.existsSync(baseDir)) continue;

    const layerDirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(baseDir, d.name));

    for (const layerDir of layerDirs) {
      const files = fs.readdirSync(layerDir)
        .filter(f => f.endsWith('.json') && f.includes('θ'));

      for (const file of files) {
        const filePath = path.join(layerDir, file);
        // First update content, then rename
        replaceInFile(filePath);
        renameFileIfNeeded(filePath);
      }
    }
  }
}

/**
 * Process sequence index files
 */
function processSequenceIndexFiles() {
  log('\n📁 Processing sequence index files...');

  const files = [
    'static/data/sequence-index.json',
    'static/data/sequence-index.backup.json',
    'static/data/sequence-index.before-startpos-removal.json',
    'static/data/gallery-manifest.json'
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      replaceInFile(file);
    }
  }
}

/**
 * Process gallery folders and their meta.json files
 */
function processGalleryFolders() {
  log('\n📁 Processing gallery folders...');

  const galleryDir = 'static/gallery';
  if (!fs.existsSync(galleryDir)) {
    log('  Gallery directory not found, skipping...');
    return;
  }

  // Get all folders that contain θ
  const folders = fs.readdirSync(galleryDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.includes('θ'))
    .map(d => d.name);

  log(`  Found ${folders.length} folders with θ in name`);

  for (const folder of folders) {
    const folderPath = path.join(galleryDir, folder);

    // First, update any meta.json files inside
    const metaPath = path.join(folderPath, 'meta.json');
    if (fs.existsSync(metaPath)) {
      replaceInFile(metaPath);
    }

    // Update any other JSON files
    try {
      const files = fs.readdirSync(folderPath)
        .filter(f => f.endsWith('.json') || f.endsWith('.meta.json'));

      for (const file of files) {
        replaceInFile(path.join(folderPath, file));
      }

      // Rename files with θ in the filename
      const allFiles = fs.readdirSync(folderPath);
      for (const file of allFiles) {
        if (file.includes('θ')) {
          renameFileIfNeeded(path.join(folderPath, file));
        }
      }
    } catch (err) {
      stats.errors.push(`Error processing folder ${folder}: ${err.message}`);
    }

    // Finally, rename the folder itself
    renameFolderIfNeeded(folderPath);
  }
}

/**
 * Main execution
 */
function main() {
  log('═══════════════════════════════════════════════════════════');
  log('  θ → Θ Migration Script');
  log('═══════════════════════════════════════════════════════════');

  if (DRY_RUN) {
    log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  processArrowPlacementFiles();
  processSequenceIndexFiles();
  processGalleryFolders();

  // Summary
  log('\n═══════════════════════════════════════════════════════════');
  log('  Summary');
  log('═══════════════════════════════════════════════════════════');
  log(`  Files updated (content):  ${stats.filesUpdated}`);
  log(`  Files renamed:            ${stats.filesRenamed}`);
  log(`  Folders renamed:          ${stats.foldersRenamed}`);

  if (stats.errors.length > 0) {
    log(`\n  ⚠️  Errors (${stats.errors.length}):`);
    stats.errors.forEach(e => log(`    - ${e}`));
  }

  if (DRY_RUN) {
    log('\n  Run without --dry-run to apply changes.');
  } else {
    log('\n  ✅ Migration complete!');
  }
}

main();
