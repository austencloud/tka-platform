$port = New-Object System.IO.Ports.SerialPort 'COM3', 115200, 'None', 8, 'One'
$port.ReadTimeout = 1000
$port.ReadBufferSize = 65536

function ProbePort {
    param($port, $label, [byte[]]$data, $waitMs = 500)
    $hexSent = ($data | ForEach-Object { $_.ToString('x2') }) -join ' '
    Write-Host "Sending $label : $hexSent"
    $port.Write($data, 0, $data.Length)
    Start-Sleep -Milliseconds $waitMs
    $avail = $port.BytesToRead
    if ($avail -gt 0) {
        $buf = New-Object byte[] $avail
        $read = $port.Read($buf, 0, $avail)
        $hex = ($buf[0..($read-1)] | ForEach-Object { $_.ToString('x2') }) -join ' '
        Write-Host "  RESPONSE ($read bytes): $hex"
    } else {
        Write-Host "  (no response)"
    }
}

try {
    $port.Open()
    Write-Host "COM3 OPEN - Binary probe sequence"
    Write-Host ""

    ProbePort $port "Open-Pixel-Poi version" @(0xD0, 0x09, 0xD1)
    ProbePort $port "STM32 bootloader sync" @(0x7F)
    ProbePort $port "AA 55 handshake" @(0xAA, 0x55)
    ProbePort $port "FE 01 00 query" @(0xFE, 0x01, 0x00)
    ProbePort $port "Null byte" @(0x00)
    ProbePort $port "SOH query" @(0x01, 0x00, 0x00)
    ProbePort $port "FF FF sync" @(0xFF, 0xFF)
    ProbePort $port "55 AA 00 01" @(0x55, 0xAA, 0x00, 0x01)
    ProbePort $port "COBS frame" @(0x01, 0x01, 0x00)
    ProbePort $port "AT command" @(0x41, 0x54, 0x0D, 0x0A)

    Write-Host ""
    Write-Host "=== PROBE COMPLETE ==="
    $port.Close()
    Write-Host "Port closed safely"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($port.IsOpen) { $port.Close() }
}
