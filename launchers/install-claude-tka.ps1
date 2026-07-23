<#
    Tightens Claude Code's built-in bare /rename prompt to an accurate two- or
    three-word title. Explicit `/rename My Name` behavior is unchanged.

    Claude Code does not expose this prompt through settings or hooks. This
    installer makes a same-length replacement in the packaged executable,
    verifies both bundled copies, smoke-tests the staged binary, and keeps a
    checksum-addressed backup before swapping it into place.
#>

[CmdletBinding()]
param(
    [string]$ClaudeExe,
    [switch]$Check,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$OriginalPrompt = 'Generate a short kebab-case name (2-4 words) that captures the main topic of this conversation. Use lowercase words separated by hyphens. Examples: "fix-login-bug", "add-auth-feature", "refactor-api-client", "debug-test-failures". Return JSON with a "name" field.'
$TkaPrompt = 'Generate a short title-case name (2-3 words) that captures the main topic of this conversation. Use title case words separated by spaces. Examples: "Fix Login Bug", "Add Auth Feature", "Refactor API Client", "Debug Test Failures". Return JSON with a "name" field.'
$ExpectedPromptCopies = 2
$TkaRoot = Join-Path $env:LOCALAPPDATA 'TKA\claude-rename'
$BackupRoot = Join-Path $TkaRoot 'backups'
$MetadataPath = Join-Path $TkaRoot 'claude-rename.json'

function Write-InstallMessage([string]$Message) {
    if (-not $Quiet) { Write-Host $Message }
}

function Resolve-ClaudeExecutable {
    if ($ClaudeExe) {
        if (-not (Test-Path -LiteralPath $ClaudeExe -PathType Leaf)) {
            throw "Claude executable does not exist: $ClaudeExe"
        }
        return (Resolve-Path -LiteralPath $ClaudeExe).Path
    }

    $onPath = (Get-Command claude.exe -ErrorAction SilentlyContinue).Source
    if ($onPath -and (Test-Path -LiteralPath $onPath -PathType Leaf)) {
        return (Resolve-Path -LiteralPath $onPath).Path
    }

    $npmNative = Join-Path $env:APPDATA 'npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe'
    if (Test-Path -LiteralPath $npmNative -PathType Leaf) {
        return (Resolve-Path -LiteralPath $npmNative).Path
    }

    $native = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
    if (Test-Path -LiteralPath $native -PathType Leaf) {
        return (Resolve-Path -LiteralPath $native).Path
    }

    $versionsDir = Join-Path $env:USERPROFILE '.local\share\claude\versions'
    if (Test-Path -LiteralPath $versionsDir -PathType Container) {
        $candidate = Get-ChildItem -LiteralPath $versionsDir -Filter 'claude.exe' -Recurse -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($candidate) { return $candidate.FullName }
    }

    throw 'Could not find claude.exe. Install Claude Code, then rerun this installer.'
}

if (-not ('TkaClaudePromptPatcher' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;

public static class TkaClaudePromptPatcher
{
    public static long[] FindOffsets(string path, byte[] pattern)
    {
        const int chunkSize = 4 * 1024 * 1024;
        byte[] buffer = new byte[chunkSize + pattern.Length - 1];
        List<long> offsets = new List<long>();
        int carry = 0;
        long bufferOffset = 0;

        using (FileStream stream = new FileStream(
            path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete,
            chunkSize, FileOptions.SequentialScan))
        {
            while (true)
            {
                int read = stream.Read(buffer, carry, chunkSize);
                int total = carry + read;
                int lastStart = total - pattern.Length;

                for (int index = 0; index <= lastStart; index++)
                {
                    if (buffer[index] != pattern[0]) { continue; }
                    int patternIndex = 1;
                    while (patternIndex < pattern.Length &&
                           buffer[index + patternIndex] == pattern[patternIndex])
                    {
                        patternIndex++;
                    }
                    if (patternIndex == pattern.Length)
                    {
                        offsets.Add(bufferOffset + index);
                    }
                }

                if (read == 0) { break; }
                carry = Math.Min(pattern.Length - 1, total);
                Buffer.BlockCopy(buffer, total - carry, buffer, 0, carry);
                bufferOffset += total - carry;
            }
        }

        return offsets.ToArray();
    }

    public static void ReplaceAt(string path, long[] offsets, byte[] replacement)
    {
        using (FileStream stream = new FileStream(
            path, FileMode.Open, FileAccess.Write, FileShare.Read,
            4096, FileOptions.RandomAccess))
        {
            foreach (long offset in offsets)
            {
                stream.Position = offset;
                stream.Write(replacement, 0, replacement.Length);
            }
            stream.Flush(true);
        }
    }
}
'@
}

$ascii = [Text.Encoding]::ASCII
$originalBytes = $ascii.GetBytes($OriginalPrompt)
$tkaBytes = $ascii.GetBytes($TkaPrompt)
if ($originalBytes.Length -ne $tkaBytes.Length) {
    throw "Claude rename prompts must have identical byte lengths ($($originalBytes.Length) != $($tkaBytes.Length))."
}

$resolvedClaudeExe = Resolve-ClaudeExecutable
$originalOffsets = @([TkaClaudePromptPatcher]::FindOffsets($resolvedClaudeExe, $originalBytes))
$tkaOffsets = @([TkaClaudePromptPatcher]::FindOffsets($resolvedClaudeExe, $tkaBytes))

if ($originalOffsets.Count -eq 0 -and $tkaOffsets.Count -eq $ExpectedPromptCopies) {
    Write-InstallMessage "Claude bare /rename is current: $resolvedClaudeExe"
    return
}

if ($Check) {
    throw "Claude bare /rename is not installed: found $($originalOffsets.Count) stock and $($tkaOffsets.Count) TKA prompt copies."
}

if ($originalOffsets.Count -ne $ExpectedPromptCopies -or $tkaOffsets.Count -ne 0) {
    throw "Refusing to patch an unknown Claude build: expected $ExpectedPromptCopies stock and 0 TKA prompt copies; found $($originalOffsets.Count) stock and $($tkaOffsets.Count) TKA copies."
}

New-Item -ItemType Directory -Force -Path $TkaRoot, $BackupRoot | Out-Null
$originalHash = (Get-FileHash -LiteralPath $resolvedClaudeExe -Algorithm SHA256).Hash
$versionText = (& $resolvedClaudeExe --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $versionText) {
    throw "Claude smoke test failed before patching: $versionText"
}
$safeVersion = ($versionText -replace '[^A-Za-z0-9._-]+', '-')
$backupPath = Join-Path $BackupRoot "$safeVersion-$originalHash.exe"
if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
    Copy-Item -LiteralPath $resolvedClaudeExe -Destination $backupPath
}
if ((Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash -ne $originalHash) {
    throw "Claude backup checksum mismatch: $backupPath"
}

$claudeDirectory = Split-Path -Parent $resolvedClaudeExe
$claudeBaseName = [IO.Path]::GetFileNameWithoutExtension($resolvedClaudeExe)
$stagePath = Join-Path $claudeDirectory "$claudeBaseName.tka-next-$PID.exe"
$previousPath = Join-Path $claudeDirectory "$claudeBaseName.tka-previous-$($originalHash.Substring(0, 12))-$PID.exe"
if (Test-Path -LiteralPath $stagePath) {
    throw "Refusing to replace existing staging file: $stagePath"
}

try {
    Copy-Item -LiteralPath $resolvedClaudeExe -Destination $stagePath
    [TkaClaudePromptPatcher]::ReplaceAt($stagePath, [long[]]$originalOffsets, $tkaBytes)

    $stagedOriginalOffsets = @([TkaClaudePromptPatcher]::FindOffsets($stagePath, $originalBytes))
    $stagedTkaOffsets = @([TkaClaudePromptPatcher]::FindOffsets($stagePath, $tkaBytes))
    if ($stagedOriginalOffsets.Count -ne 0 -or $stagedTkaOffsets.Count -ne $ExpectedPromptCopies) {
        throw "Staged Claude verification failed: found $($stagedOriginalOffsets.Count) stock and $($stagedTkaOffsets.Count) TKA prompt copies."
    }

    $stagedVersion = (& $stagePath --version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $stagedVersion -ne $versionText) {
        throw "Staged Claude smoke test failed: expected '$versionText', got '$stagedVersion'."
    }

    Move-Item -LiteralPath $resolvedClaudeExe -Destination $previousPath
    try {
        Move-Item -LiteralPath $stagePath -Destination $resolvedClaudeExe
    } catch {
        Move-Item -LiteralPath $previousPath -Destination $resolvedClaudeExe -ErrorAction SilentlyContinue
        throw
    }

    $installedOriginalOffsets = @([TkaClaudePromptPatcher]::FindOffsets($resolvedClaudeExe, $originalBytes))
    $installedTkaOffsets = @([TkaClaudePromptPatcher]::FindOffsets($resolvedClaudeExe, $tkaBytes))
    if ($installedOriginalOffsets.Count -ne 0 -or $installedTkaOffsets.Count -ne $ExpectedPromptCopies) {
        throw 'Installed Claude prompt verification failed after the executable swap.'
    }

    $installedVersion = (& $resolvedClaudeExe --version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $installedVersion -ne $versionText) {
        throw "Installed Claude smoke test failed: expected '$versionText', got '$installedVersion'."
    }

    $installedHash = (Get-FileHash -LiteralPath $resolvedClaudeExe -Algorithm SHA256).Hash
    [ordered]@{
        claudeVersion = $versionText
        executablePath = $resolvedClaudeExe
        originalSha256 = $originalHash
        patchedSha256 = $installedHash
        promptCopies = $ExpectedPromptCopies
        backupPath = $backupPath
        installedAt = [DateTimeOffset]::Now.ToString('o')
    } | ConvertTo-Json | Set-Content -LiteralPath $MetadataPath -Encoding utf8

    Remove-Item -LiteralPath $previousPath -Force -ErrorAction SilentlyContinue
    Write-InstallMessage "Installed Claude two/three-word bare /rename: $resolvedClaudeExe"
    Write-InstallMessage "Original backup: $backupPath"
} finally {
    if (Test-Path -LiteralPath $stagePath) {
        Remove-Item -LiteralPath $stagePath -Force -ErrorAction SilentlyContinue
    }
}
