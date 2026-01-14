# Rename LOOP references to LOOP throughout the codebase
# Careful pattern matching to avoid false positives

$ErrorActionPreference = "Stop"

# Backup directory
$backupDir = "scripts/temp/cap-rename-backup-$(Get-Date -Format 'yyyy-MM-dd-HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Write-Host "Scanning for LOOP references..." -ForegroundColor Cyan

# Define replacement patterns (order matters - most specific first)
$patterns = @(
    # Function names
    @{ Pattern = '\bdetectLOOPType\b'; Replacement = 'detectLOOPType'; Description = 'detectLOOPType to detectLOOPType' }
    @{ Pattern = '\bvalidateLOOPConfiguration\b'; Replacement = 'validateLOOPConfiguration'; Description = 'validateLOOPConfiguration to validateLOOPConfiguration' }
    @{ Pattern = '\bmapComponentsToLOOPType\b'; Replacement = 'mapComponentsToLOOPType'; Description = 'mapComponentsToLOOPType to mapComponentsToLOOPType' }
    @{ Pattern = '\bnormalizeLOOPType\b'; Replacement = 'normalizeLOOPType'; Description = 'normalizeLOOPType to normalizeLOOPType' }

    # Type names
    @{ Pattern = '\bLOOPType\b'; Replacement = 'LOOPType'; Description = 'LOOPType to LOOPType' }
    @{ Pattern = '\bLOOPLabel\b'; Replacement = 'LOOPLabel'; Description = 'LOOPLabel to LOOPLabel' }
    @{ Pattern = '\bLOOPComponent\b'; Replacement = 'LOOPComponent'; Description = 'LOOPComponent to LOOPComponent' }

    # Variable names (camelCase)
    @{ Pattern = '\bcapType\b'; Replacement = 'loopType'; Description = 'capType to loopType' }
    @{ Pattern = '\bcapLabel\b'; Replacement = 'loopLabel'; Description = 'capLabel to loopLabel' }
    @{ Pattern = '\bcapParamProvider\b'; Replacement = 'loopParamProvider'; Description = 'capParamProvider to loopParamProvider' }
    @{ Pattern = '\bcapColumnSpan\b'; Replacement = 'loopColumnSpan'; Description = 'capColumnSpan to loopColumnSpan' }
    @{ Pattern = '\bcapSelectedComponents\b'; Replacement = 'loopSelectedComponents'; Description = 'capSelectedComponents to loopSelectedComponents' }
    @{ Pattern = '\bcapCurrentType\b'; Replacement = 'loopCurrentType'; Description = 'capCurrentType to loopCurrentType' }
    @{ Pattern = '\bcapOnChange\b'; Replacement = 'loopOnChange'; Description = 'capOnChange to loopOnChange' }
    @{ Pattern = '\bcapValidation\b'; Replacement = 'loopValidation'; Description = 'capValidation to loopValidation' }
    @{ Pattern = '\bcapTypeCounts\b'; Replacement = 'loopTypeCounts'; Description = 'capTypeCounts to loopTypeCounts' }

    # HTML/Component IDs and keys
    @{ Pattern = '"cap-type"'; Replacement = '"loop-type"'; Description = 'cap-type ID to loop-type' }
    @{ Pattern = "'cap-type'"; Replacement = "'loop-type'"; Description = 'cap-type key to loop-type' }

    # Comments and documentation (case-insensitive acronym)
    @{ Pattern = '\bLOOP \(Circular Assembly Pattern\)'; Replacement = 'LOOP (Linked Orbital Offset Pattern)'; Description = 'LOOP acronym expansion' }
    @{ Pattern = '\bLOOP type'; Replacement = 'LOOP type'; Description = 'LOOP type to LOOP type' }
    @{ Pattern = '\bLOOP Type'; Replacement = 'LOOP Type'; Description = 'LOOP Type to LOOP Type' }
)

# File extensions to process
$extensions = @('*.ts', '*.svelte', '*.js', '*.cjs', '*.json', '*.md', '*.yaml')

# Directories to exclude
$excludeDirs = @('node_modules', '.git', 'build', 'dist', '.svelte-kit', 'scripts\temp')

# Find all files
$files = @()
foreach ($ext in $extensions) {
    $found = Get-ChildItem -Path . -Filter $ext -Recurse -File | Where-Object {
        $path = $_.FullName
        $shouldExclude = $false
        foreach ($excludeDir in $excludeDirs) {
            if ($path -like "*\$excludeDir\*") {
                $shouldExclude = $true
                break
            }
        }
        -not $shouldExclude
    }
    $files += $found
}

Write-Host "Found $($files.Count) files to process" -ForegroundColor Cyan

$stats = @{
    FilesModified = 0
    TotalReplacements = 0
    PatternCounts = @{}
}

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $originalContent = $content
        $fileModified = $false

        foreach ($pattern in $patterns) {
            $regex = [regex]::new($pattern.Pattern)
            $matches = $regex.Matches($content)

            if ($matches.Count -gt 0) {
                $content = $regex.Replace($content, $pattern.Replacement)
                $fileModified = $true

                # Track statistics
                if (-not $stats.PatternCounts.ContainsKey($pattern.Description)) {
                    $stats.PatternCounts[$pattern.Description] = 0
                }
                $stats.PatternCounts[$pattern.Description] += $matches.Count
                $stats.TotalReplacements += $matches.Count
            }
        }

        if ($fileModified) {
            # Backup original file
            $relativePath = $file.FullName.Replace((Get-Location).Path + '\', '')
            $backupPath = Join-Path $backupDir $relativePath
            $backupParent = Split-Path $backupPath -Parent
            if (-not (Test-Path $backupParent)) {
                New-Item -ItemType Directory -Path $backupParent -Force | Out-Null
            }
            Copy-Item $file.FullName $backupPath -Force

            # Write modified content
            Set-Content $file.FullName -Value $content -Encoding UTF8 -NoNewline

            $stats.FilesModified++
            Write-Host "  $relativePath" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  Failed to process $($file.FullName): $_" -ForegroundColor Red
    }
}

Write-Host "`nRename Summary:" -ForegroundColor Cyan
Write-Host "  Files modified: $($stats.FilesModified)" -ForegroundColor Yellow
Write-Host "  Total replacements: $($stats.TotalReplacements)" -ForegroundColor Yellow

Write-Host "`nReplacements by pattern:" -ForegroundColor Cyan
foreach ($pattern in $stats.PatternCounts.GetEnumerator() | Sort-Object Value -Descending) {
    Write-Host "  $($pattern.Key): $($pattern.Value)" -ForegroundColor Gray
}

Write-Host "`nBackups saved to: $backupDir" -ForegroundColor Green
Write-Host "`nDone! Please review changes and run tests." -ForegroundColor Green
