$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$sig = @'
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
'@
Add-Type -MemberDefinition $sig -Name U3 -Namespace N3
[N3.U3]::SetProcessDPIAware() | Out-Null

$orig = [System.Windows.Forms.Cursor]::Position
$pb = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$cx = $pb.Left + [int]($pb.Width / 2)
$cy = $pb.Bottom - 25
[N3.U3]::SetCursorPos($cx, $cy) | Out-Null
Start-Sleep -Milliseconds 150

# small fast region: 760x460 covering popover area (real popover bbox was 712x384 @ y 1691..2075 abs)
$W = 760; $H = 460
$sx = $cx - 380
$sy = $cy - 480

$outDir = Join-Path $PSScriptRoot 'frames3'
if (Test-Path $outDir) { Remove-Item "$outDir\*.png" -Force -ErrorAction SilentlyContinue } else { New-Item -ItemType Directory $outDir | Out-Null }

$stamp = Join-Path $PSScriptRoot 'popstamp3.txt'
$frames = New-Object System.Collections.ArrayList
$times  = New-Object System.Collections.ArrayList
$swatch = [System.Diagnostics.Stopwatch]::StartNew()

function Grab {
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($sx, $sy, 0, 0, (New-Object System.Drawing.Size($W, $H)))
    $g.Dispose()
    [void]$script:frames.Add($bmp)
    [void]$script:times.Add($script:swatch.ElapsedMilliseconds)
}

1..3 | ForEach-Object { Grab }
Start-Process -FilePath 'E:\launchers\AgentChooserStub.exe' -ArgumentList @(
    '-Project','"E:\tka-platform"','-Name','"TKA Platform"','-Icon','"E:\launchers\icons\tka-platform.ico"','-StampFile',"`"$stamp`""
)
$pingMs = $swatch.ElapsedMilliseconds
while ($swatch.ElapsedMilliseconds - $pingMs -lt 700) { Grab }
[N3.U3]::SetCursorPos($orig.X, $orig.Y) | Out-Null
Write-Host "region=$sx,$sy stub@${pingMs}ms frames=$($frames.Count)"

$base = $frames[0]
$prev = $null
for ($i = 0; $i -lt $frames.Count; $i++) {
    $f = $frames[$i]
    $minX = 99999; $minY = 99999; $maxX = -1; $maxY = -1; $n = 0
    for ($y = 0; $y -lt $H; $y += 6) {
        for ($x = 0; $x -lt $W; $x += 6) {
            $a = $base.GetPixel($x, $y); $b = $f.GetPixel($x, $y)
            $d = [Math]::Abs($a.R - $b.R) + [Math]::Abs($a.G - $b.G) + [Math]::Abs($a.B - $b.B)
            if ($d -gt 40) {
                $n++
                if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    $bw = if ($maxX -ge 0) { $maxX - $minX } else { 0 }
    $bh = if ($maxX -ge 0) { $maxY - $minY } else { 0 }
    $rel = $times[$i] - $pingMs
    Write-Host ("f{0:d3} t={1,4}ms px={2,5} bbox={3}x{4} @({5},{6})" -f $i, $rel, $n, $bw, $bh, $minX, $minY)
    $f.Save((Join-Path $outDir ("f{0:d3}_{1}ms.png" -f $i, $rel)), [System.Drawing.Imaging.ImageFormat]::Png)
}
