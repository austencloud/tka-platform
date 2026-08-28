<#
  Creates profile-specific Chrome desktop shortcuts without touching the
  currently focused window or restarting Explorer.

  Windows groups taskbar windows by AppUserModelID. Chrome derives the ID for a
  custom user-data directory from the sanitized user-data and profile folder
  names, so the Agent DevTools shortcut must carry the same ID as its window.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$DesktopPath = [Environment]::GetFolderPath('Desktop'),
  [string]$AgentUserDataDir = "$env:USERPROFILE\.claude\chrome-profile",
  [string]$AgentProfileDirectory = 'Profile 1',
  [string]$ChromeBaseAppId = 'Chrome'
)

$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$sourceIcon = Join-Path $PSScriptRoot 'assets\agent-devtools-browser.ico'
$installedIconDir = Join-Path $env:LOCALAPPDATA 'TKA\agent-browser'
$installedIcon = Join-Path $installedIconDir 'agent-devtools-browser.ico'

foreach ($requiredPath in @($chrome, $sourceIcon, $AgentUserDataDir)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required path not found: $requiredPath"
  }
}

if (-not (Test-Path -LiteralPath $DesktopPath)) {
  throw "Desktop path not found: $DesktopPath"
}

if (-not ('Tka.WindowsShortcutProperties' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace Tka {
  public static class WindowsShortcutProperties {
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct PropertyKey {
      public Guid FormatId;
      public uint PropertyId;
    }

    [StructLayout(LayoutKind.Explicit, Size = 24)]
    private struct PropVariant {
      [FieldOffset(0)] public ushort VariantType;
      [FieldOffset(8)] public IntPtr PointerValue;
    }

    [ComImport]
    [Guid("00021401-0000-0000-C000-000000000046")]
    private class ShellLink { }

    [ComImport]
    [Guid("0000010b-0000-0000-C000-000000000046")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPersistFile {
      void GetClassID(out Guid classId);
      [PreserveSig] int IsDirty();
      void Load([MarshalAs(UnmanagedType.LPWStr)] string fileName, uint mode);
      void Save([MarshalAs(UnmanagedType.LPWStr)] string fileName, bool remember);
      void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string fileName);
      void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string fileName);
    }

    [ComImport]
    [Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore {
      void GetCount(out uint propertyCount);
      void GetAt(uint propertyIndex, out PropertyKey key);
      void GetValue(ref PropertyKey key, out PropVariant value);
      void SetValue(ref PropertyKey key, ref PropVariant value);
      void Commit();
    }

    private static void SetString(IPropertyStore store, uint propertyId, string value) {
      var key = new PropertyKey {
        FormatId = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),
        PropertyId = propertyId,
      };
      var variant = new PropVariant {
        VariantType = 31, // VT_LPWSTR
        PointerValue = Marshal.StringToCoTaskMemUni(value),
      };
      try {
        store.SetValue(ref key, ref variant);
      } finally {
        Marshal.FreeCoTaskMem(variant.PointerValue);
      }
    }

    public static void SetAppIdentity(
      string shortcutPath,
      string appUserModelId,
      string relaunchCommand,
      string relaunchIconResource) {
      object shellLink = new ShellLink();
      try {
        var persistFile = (IPersistFile)shellLink;
        persistFile.Load(shortcutPath, 2); // STGM_READWRITE
        var propertyStore = (IPropertyStore)shellLink;
        SetString(propertyStore, 5, appUserModelId);
        SetString(propertyStore, 2, relaunchCommand);
        SetString(propertyStore, 3, relaunchIconResource);
        propertyStore.Commit();
        persistFile.Save(shortcutPath, true);
      } finally {
        if (Marshal.IsComObject(shellLink)) {
          Marshal.FinalReleaseComObject(shellLink);
        }
      }
    }
  }
}
'@
}

function Get-ChromeProfileId {
  param(
    [Parameter(Mandatory)] [string]$UserDataDir,
    [Parameter(Mandatory)] [string]$ProfileDirectory
  )

  $userDataName = Split-Path -Leaf ([IO.Path]::GetFullPath($UserDataDir))
  $basenames = "$userDataName.$ProfileDirectory"
  return $basenames -replace '[^A-Za-z0-9.]', ''
}

function New-ChromeProfileShortcut {
  param(
    [Parameter(Mandatory)] [string]$ShortcutPath,
    [Parameter(Mandatory)] [string]$Arguments,
    [Parameter(Mandatory)] [string]$IconLocation,
    [Parameter(Mandatory)] [string]$AppUserModelId,
    [Parameter(Mandatory)] [string]$Description
  )

  $wshShell = New-Object -ComObject WScript.Shell
  try {
    $shortcut = $wshShell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $chrome
    $shortcut.Arguments = $Arguments
    $shortcut.WorkingDirectory = Split-Path -Parent $chrome
    $shortcut.IconLocation = $IconLocation
    $shortcut.Description = $Description
    $shortcut.Save()
  } finally {
    if ($null -ne $wshShell) {
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($wshShell)
    }
  }

  $relaunchCommand = "`"$chrome`" $Arguments"
  [Tka.WindowsShortcutProperties]::SetAppIdentity(
    $ShortcutPath,
    $AppUserModelId,
    $relaunchCommand,
    "$IconLocation,0"
  )
}

$agentUserDataDir = [IO.Path]::GetFullPath($AgentUserDataDir)
$agentProfilePath = [IO.Path]::GetFullPath((Join-Path $agentUserDataDir $AgentProfileDirectory))
if (-not $agentProfilePath.StartsWith($agentUserDataDir.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw "Agent profile escaped its user-data directory: $agentProfilePath"
}
if (-not (Test-Path -LiteralPath $agentProfilePath)) {
  throw "Agent profile not found: $agentProfilePath"
}

$agentProfileId = Get-ChromeProfileId -UserDataDir $agentUserDataDir -ProfileDirectory $AgentProfileDirectory
$agentAppUserModelId = "$ChromeBaseAppId.$agentProfileId"
$austenShortcut = Join-Path $DesktopPath 'Austen - Chrome.lnk'
$agentShortcut = Join-Path $DesktopPath 'Agent DevTools - Chrome.lnk'

if ($PSCmdlet.ShouldProcess($installedIcon, 'Install Agent DevTools taskbar icon')) {
  New-Item -ItemType Directory -Force -Path $installedIconDir | Out-Null
  Copy-Item -LiteralPath $sourceIcon -Destination $installedIcon -Force
}

if ($PSCmdlet.ShouldProcess($austenShortcut, 'Create Austen Chrome profile shortcut')) {
  New-ChromeProfileShortcut `
    -ShortcutPath $austenShortcut `
    -Arguments '--profile-directory="Default"' `
    -IconLocation $chrome `
    -AppUserModelId $ChromeBaseAppId `
    -Description 'Open Austen Chrome'
}

if ($PSCmdlet.ShouldProcess($agentShortcut, 'Create Agent DevTools Chrome profile shortcut')) {
  $agentArguments = "--user-data-dir=`"$agentUserDataDir`" --profile-directory=`"$AgentProfileDirectory`""
  New-ChromeProfileShortcut `
    -ShortcutPath $agentShortcut `
    -Arguments $agentArguments `
    -IconLocation $installedIcon `
    -AppUserModelId $agentAppUserModelId `
    -Description 'Open the shared Agent DevTools Chrome profile'
}

[pscustomobject]@{
  AustenShortcut = $austenShortcut
  AustenAppUserModelId = $ChromeBaseAppId
  AgentShortcut = $agentShortcut
  AgentAppUserModelId = $agentAppUserModelId
  AgentIcon = $installedIcon
}
