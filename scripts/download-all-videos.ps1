# Download all TKA Instagram videos
$videos = @(
    @{name="video-1-OmegaLambda-dash-XJ"; word="ΩΛ-XJ"; url="https://scontent-det1-1.cdninstagram.com/o1/v/t2/f2/m367/AQP_v-WzjhfkLPp8uuk5JxQOTDP5TZ1bfDPgxxtc_Sex9JoRazjQ9XSN07gB9dmcvvsMojSldkpZZdjL16GaUb-NbokVxQKz1Jmoatg.mp4?_nc_cat=103&_nc_sid=9ca052&_nc_ht=scontent-det1-1.cdninstagram.com&_nc_ohc=VE5kPtgDRrUQ7kNvwHftim3&efg=eyJ2ZW5jb2RlX3RhZyI6ImlnLXhwdmRzLmNsaXBzLmMyLUMzLmRhc2hfYmFzZWxpbmVfMV92MSIsInZpZGVvX2lkIjpudWxsLCJvaWxfdXJsZ2VuX2FwcF9pZCI6OTM2NjE5NzQzMzkyNDU5LCJjbGllbnRfbmFtZSI6ImlnIiwieHB2X2Fzc2V0X2lkIjoxMTg5ODg0NDY4NzUyNjAxLCJhc3NldF9hZ2VfZGF5cyI6NDY1LCJ2aV91c2VjYXNlX2lkIjoxMDA5OSwiZHVyYXRpb25fcyI6NDMsImJpdHJhdGUiOjYyODA4NywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&_nc_gid=gXgrz9GhBfB5sLn6qQYaJQ&_nc_zt=28&oh=00_AfqIMFgqdPKP7hFft-XVGu9I_ssE6AF2J1VHJ-E-NtUvtA&oe=6974A3E4"},
    @{name="video-3-ECKPSI-dash"; word="ECKΨ-"; url="https://scontent-det1-1.cdninstagram.com/o1/v/t2/f2/m367/AQOdEVjgOsw2rR9_-lnsZT8Vxs34LPXJPGsbGm2xIhWXY5aFNJ1SW9nmH-U9WP_6aWq3viRNhf9Hro716xiWTYx8DYQTdnfChMdkWc0.mp4?_nc_cat=102&_nc_sid=9ca052&_nc_ht=scontent-det1-1.cdninstagram.com&_nc_ohc=7WIzdQoHaP4Q7kNvwG7Kgti&efg=eyJ2ZW5jb2RlX3RhZyI6ImlnLXhwdmRzLmNsaXBzLmMyLUMzLmRhc2hfYmFzZWxpbmVfMV92MSIsInZpZGVvX2lkIjpudWxsLCJvaWxfdXJsZ2VuX2FwcF9pZCI6OTM2NjE5NzQzMzkyNDU5LCJjbGllbnRfbmFtZSI6ImlnIiwieHB2X2Fzc2V0X2lkIjoxMjU0OTUyMTQ1NTc2MjY0LCJhc3NldF9hZ2VfZGF5cyI6MzQ3LCJ2aV91c2VjYXNlX2lkIjoxMDA5OSwiZHVyYXRpb25fcyI6MzMsImJpdHJhdGUiOjEyOTUyMTcsInVybGdlbl9zb3VyY2UiOiJ3d3cifQ%3D%3D&ccb=17-1&_nc_gid=bu-2pX9oXblW1grGlrrtzA&_nc_zt=28&oh=00_AfqodXBsh-zUUjWcuG6PSaC5Zll5MV8HMYm-E2YN9p06cw&oe=6974D727"},
    @{name="video-4-G-Omega-WL"; word="GΩWL"; url="https://scontent-det1-1.cdninstagram.com/o1/v/t2/f2/m367/AQN4pWVYhgl7CissZwx9-TJT7L0TySvZd9Xu61xLYerKxrTYvvJ2qiMMua7rbSCnqmLRzJM8moZFGDgPiLJkivPd3V26E5ZHSiww_10.mp4?_nc_cat=108&_nc_sid=9ca052&_nc_ht=scontent-det1-1.cdninstagram.com&_nc_ohc=eCAtS3X-ye8Q7kNvwFL5qSp&efg=eyJ2ZW5jb2RlX3RhZyI6ImlnLXhwdmRzLmNsaXBzLmMyLUMzLmRhc2hfYmFzZWxpbmVfMV92MSIsInZpZGVvX2lkIjpudWxsLCJvaWxfdXJsZ2VuX2FwcF9pZCI6OTM2NjE5NzQzMzkyNDU5LCJjbGllbnRfbmFtZSI6ImlnIiwieHB2X2Fzc2V0X2lkIjo1ODE3MDAxNDEzNjQxMjMsImFzc2V0X2FnZV9kYXlzIjozNTYsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0MSwiYml0cmF0ZSI6Nzc5NDYwLCJ1cmxnZW5fc291cmNlIjoid3d3In0%3D&ccb=17-1&_nc_gid=lHAztsXHFboxL2xqEGjGGQ&_nc_zt=28&oh=00_AfroYyFaAUd_REfiBKfDOkpnwNTRtn5ECdwaTrlOBjTBvw&oe=6974B649"}
)

$basePath = "F:\tka-platform"
$downloaded = @()

foreach ($video in $videos) {
    $outFile = Join-Path $basePath "$($video.name).mp4"
    Write-Host "Downloading $($video.word)..."
    try {
        Invoke-WebRequest -Uri $video.url -OutFile $outFile -TimeoutSec 120
        $size = (Get-Item $outFile).Length / 1MB
        Write-Host "  OK: $([math]::Round($size, 2)) MB"
        $downloaded += @{
            file = $outFile
            word = $video.word
            size = $size
        }
    } catch {
        Write-Host "  FAILED: $_"
    }
}

Write-Host "`n=== Downloaded $($downloaded.Count) videos ==="
$downloaded | ForEach-Object { Write-Host "  $($_.word): $([math]::Round($_.size, 2)) MB" }
