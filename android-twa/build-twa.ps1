# Build TWA Script
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot"
$env:ANDROID_HOME = "C:\Users\Austen\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\build-tools\34.0.0;$env:PATH"

Write-Host "Building Flow Arts Composer TWA..."
Write-Host "JAVA_HOME: $env:JAVA_HOME"
Write-Host "ANDROID_HOME: $env:ANDROID_HOME"

Set-Location $PSScriptRoot

# Build using bubblewrap
bubblewrap build --skipPwaValidation

Write-Host "Build complete!"
