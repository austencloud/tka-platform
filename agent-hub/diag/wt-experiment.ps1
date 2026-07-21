$ErrorActionPreference = 'Stop'
$sig = @'
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
[DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
[DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint flags);
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
public struct RECT { public int L; public int T; public int R; public int B; }
public delegate bool EnumProc(IntPtr h, IntPtr p);
'@
Add-Type -MemberDefinition $sig -Name W -Namespace WTX

function Find-Marker([string]$marker) {
    $global:mkH = [IntPtr]::Zero; $global:mkCls = ''; $global:mkVis = $false; $global:mkT = $marker
    $cb = [WTX.W+EnumProc]{ param($h, $p)
        $sb = New-Object System.Text.StringBuilder 512
        [WTX.W]::GetWindowText($h, $sb, 512) | Out-Null
        if ($sb.ToString().Contains($global:mkT)) {
            $cs = New-Object System.Text.StringBuilder 128
            [WTX.W]::GetClassName($h, $cs, 128) | Out-Null
            $global:mkH = $h; $global:mkCls = $cs.ToString(); $global:mkVis = [WTX.W]::IsWindowVisible($h)
            return $false
        }
        $true }
    [WTX.W]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
}

$marker = 'AGENTWARM_WTTEST2'
$fgBefore = [WTX.W]::GetForegroundWindow()
"fg before: $fgBefore"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
Start-Process wt.exe -ArgumentList "-w $marker --pos `"-30000,-30000`" nt -d E:\ cmd /s /c `"title $marker & timeout /t 180`""

$fgSteals = 0
$foundMs = -1
while ($sw.ElapsedMilliseconds -lt 12000) {
    Find-Marker $marker
    $fgNow = [WTX.W]::GetForegroundWindow()
    if ($fgNow -ne $fgBefore) { $fgSteals++; "fg changed -> $fgNow at $($sw.ElapsedMilliseconds)ms"; $fgBefore = $fgNow }
    if ($global:mkH -ne [IntPtr]::Zero) { $foundMs = $sw.ElapsedMilliseconds; break }
    Start-Sleep -Milliseconds 60
}
if ($global:mkH -eq [IntPtr]::Zero) { "CAPTURE FAILED after 12s"; exit 1 }

$rect = New-Object WTX.W+RECT
[WTX.W]::GetWindowRect($global:mkH, [ref]$rect) | Out-Null
"found @${foundMs}ms hwnd=$($global:mkH) class=$($global:mkCls) visible=$($global:mkVis) rect=$($rect.L),$($rect.T)..$($rect.R),$($rect.B) fgChanges=$fgSteals"

[WTX.W]::ShowWindow($global:mkH, 0) | Out-Null
Start-Sleep -Milliseconds 300
"after SW_HIDE: visible=$([WTX.W]::IsWindowVisible($global:mkH))"

Start-Sleep -Milliseconds 800
[WTX.W]::ShowWindow($global:mkH, 9) | Out-Null
[WTX.W]::SetWindowPos($global:mkH, [IntPtr]::Zero, 600, 300, 0, 0, 0x0001 -bor 0x0004) | Out-Null
Start-Sleep -Milliseconds 400
[WTX.W]::GetWindowRect($global:mkH, [ref]$rect) | Out-Null
"after RESTORE: visible=$([WTX.W]::IsWindowVisible($global:mkH)) rect=$($rect.L),$($rect.T)..$($rect.R),$($rect.B)"

Start-Sleep -Milliseconds 600
[WTX.W]::PostMessage($global:mkH, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
Start-Sleep -Milliseconds 1000
Find-Marker $marker
"after WM_CLOSE: stillFound=$($global:mkH -ne [IntPtr]::Zero)"
