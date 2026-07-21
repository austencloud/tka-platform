$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$sig = '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
Add-Type -MemberDefinition $sig -Name U -Namespace N
[N.U]::SetProcessDPIAware() | Out-Null

$cur = [System.Windows.Forms.Cursor]::Position
$vs  = [System.Windows.Forms.SystemInformation]::VirtualScreen

$W = 1100; $H = 800
$sx = [Math]::Max($vs.Left, [Math]::Min($cur.X - 550, $vs.Right - $W))
$sy = [Math]::Max($vs.Top,  [Math]::Min($cur.Y - 700, $vs.Bottom - $H))

$outDir = Join-Path $PSScriptRoot 'frames'
if (Test-Path $outDir) { Remove-Item "$outDir\*.png" -Force -ErrorAction SilentlyContinue } else { New-Item -ItemType Directory $outDir | Out-Null }

$stamp = Join-Path $PSScriptRoot 'popstamp.txt'
$line = "E:\tka-platform|TKA Platform|E:\launchers\icons\tka-platform.ico|$stamp|" + [DateTime]::Now.Ticks

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

# baseline frames
1..3 | ForEach-Object { Grab }

# ping the host
$pc = New-Object System.IO.Pipes.NamedPipeClientStream('.', 'AgentChooserPipe', [System.IO.Pipes.PipeDirection]::Out)
$pc.Connect(2000)
$w2 = New-Object System.IO.StreamWriter($pc)
$w2.WriteLine($line); $w2.Flush(); $w2.Dispose()
$pingMs = $swatch.ElapsedMilliseconds

while ($swatch.ElapsedMilliseconds - $pingMs -lt 1300) { Grab }

Write-Host "cursor=$($cur.X),$($cur.Y) region=$sx,$sy ping@${pingMs}ms frames=$($frames.Count)"

# analyze: diff each frame vs frame0, stride-8 sampling, bbox of changed pixels
$base = $frames[0]
for ($i = 0; $i -lt $frames.Count; $i++) {
    $f = $frames[$i]
    $diff = 0; $minX = 99999; $minY = 99999; $maxX = -1; $maxY = -1; $n = 0
    for ($y = 0; $y -lt $H; $y += 8) {
        for ($x = 0; $x -lt $W; $x += 8) {
            $a = $base.GetPixel($x, $y); $b = $f.GetPixel($x, $y)
            $d = [Math]::Abs($a.R - $b.R) + [Math]::Abs($a.G - $b.G) + [Math]::Abs($a.B - $b.B)
            if ($d -gt 40) {
                $n++
                $diff += $d
                if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    $bw = if ($maxX -ge 0) { $maxX - $minX } else { 0 }
    $bh = if ($maxX -ge 0) { $maxY - $minY } else { 0 }
    $rel = $times[$i] - $pingMs
    Write-Host ("f{0:d2} t={1,5}ms px={2,5} bbox={3}x{4} @({5},{6})" -f $i, $rel, $n, $bw, $bh, $minX, $minY)
    $f.Save((Join-Path $outDir ("f{0:d2}_{1}ms.png" -f $i, $rel)), [System.Drawing.Imaging.ImageFormat]::Png)
}
