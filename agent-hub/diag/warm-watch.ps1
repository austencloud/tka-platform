$sig = @"
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
[DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
public delegate bool EnumProc(IntPtr h, IntPtr p);
"@
Add-Type -MemberDefinition $sig -Name W -Namespace NW
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$sightings = @{}
while ($sw.ElapsedMilliseconds -lt 35000) {
    $found = New-Object System.Collections.ArrayList
    $cb = [NW.W+EnumProc]{ param($h, $p)
        $sb = New-Object System.Text.StringBuilder 256
        [NW.W]::GetWindowText($h, $sb, 256) | Out-Null
        $t = $sb.ToString()
        if ($t -like '*AGENTWARM*') { [void]$script:found.Add(@{H=$h; T=$t; V=[NW.W]::IsWindowVisible($h)}) }
        $true }
    [NW.W]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
    foreach ($f in $found) {
        $k = "$($f.H)"
        if (-not $sightings.ContainsKey($k)) { $sightings[$k] = @{First=$sw.ElapsedMilliseconds; T=$f.T; EverVisible=$false} ; Write-Host ("{0}ms NEW {1} title={2} visible={3}" -f $sw.ElapsedMilliseconds, $f.H, $f.T, $f.V) }
        if ($f.V -and -not $sightings[$k].EverVisible) { $sightings[$k].EverVisible = $true; Write-Host ("{0}ms *** VISIBLE *** {1}" -f $sw.ElapsedMilliseconds, $f.H) }
    }
    Start-Sleep -Milliseconds 25
}
Write-Host "watch done. windows seen: $($sightings.Count); everVisible: $(@($sightings.Values | Where-Object {$_.EverVisible}).Count)"
