[CmdletBinding()]
param(
    [string[]] $Job = @()
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$blender = 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe'
if (-not (Test-Path -LiteralPath $blender)) {
    throw "Blender is missing: $blender"
}
$jobArguments = @()
foreach ($jobId in $Job) {
    $jobArguments += "--job=$jobId"
}

Push-Location $projectRoot
try {
    & $blender --background --python scripts/condition-forest-plantcatalog-bridge.py -- @jobArguments
    if ($LASTEXITCODE -ne 0) { throw "PlantCatalog conditioning failed with exit code $LASTEXITCODE" }
    & node scripts/optimize-forest-plantcatalog-bridge.mjs @jobArguments
    if ($LASTEXITCODE -ne 0) { throw "PlantCatalog optimization failed with exit code $LASTEXITCODE" }
    & $blender --background --python scripts/render-forest-plantcatalog-bridge.py -- @jobArguments
    if ($LASTEXITCODE -ne 0) { throw "PlantCatalog proof rendering failed with exit code $LASTEXITCODE" }
    & node scripts/contact-sheet-forest-plantcatalog-bridge.mjs @jobArguments
    if ($LASTEXITCODE -ne 0) { throw "PlantCatalog contact sheet failed with exit code $LASTEXITCODE" }
    & node scripts/verify-forest-plantcatalog-bridge.mjs --phase=proof
    if ($LASTEXITCODE -ne 0) { throw "PlantCatalog proof verification failed with exit code $LASTEXITCODE" }
}
finally {
    Pop-Location
}
