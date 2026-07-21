$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$sig = '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
Add-Type -MemberDefinition $sig -Name U4 -Namespace N4
[N4.U4]::SetProcessDPIAware() | Out-Null

$pb = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$W = 1800; $H = 560
$sx = $pb.Left + [int](($pb.Width - $W) / 2)
$sy = $pb.Bottom - $H

$outDir = Join-Path $PSScriptRoot 'frames-live'
if (Test-Path $outDir) { Remove-Item "$outDir\*.png" -Force -ErrorAction SilentlyContinue } else { New-Item -ItemType Directory $outDir | Out-Null }

$swatch = [System.Diagnostics.Stopwatch]::StartNew()
$prev = $null
$activeUntil = -1
$saved = 0
Write-Host "recording region=$sx,$sy ${W}x${H} for 120s..."

while ($swatch.ElapsedMilliseconds -lt 120000 -and $saved -lt 400) {
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($sx, $sy, 0, 0, (New-Object System.Drawing.Size($W, $H)))
    $g.Dispose()
    $t = $swatch.ElapsedMilliseconds

    $n = 0
    if ($prev -ne $null) {
        for ($y = 8; $y -lt $H; $y += 20) {
            for ($x = 8; $x -lt $W; $x += 20) {
                $a = $prev.GetPixel($x, $y); $b = $bmp.GetPixel($x, $y)
                $d = [Math]::Abs($a.R - $b.R) + [Math]::Abs($a.G - $b.G) + [Math]::Abs($a.B - $b.B)
                if ($d -gt 40) { $n++; if ($n -gt 6) { break } }
            }
            if ($n -gt 6) { break }
        }
    }

    if ($n -gt 6) { $activeUntil = $t + 1500 }

    if ($n -gt 6 -or $t -lt $activeUntil) {
        $bmp.Save((Join-Path $outDir ("t{0:d6}.png" -f $t)), [System.Drawing.Imaging.ImageFormat]::Png)
        $saved++
        if ($prev -ne $null) { $prev.Dispose() }
        $prev = $bmp
    } else {
        if ($prev -ne $null) { $prev.Dispose() }
        $prev = $bmp
    }
}
Write-Host "done. saved=$saved frames"
