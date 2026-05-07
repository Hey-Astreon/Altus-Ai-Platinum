@echo off
title Windows Diagnostic Framework
color 0A

echo.
echo  ================================================================
echo    WINDOWS DIAGNOSTIC ACCESSIBILITY BRIDGE - SOVEREIGN v4.1
echo  ================================================================
echo.

:: Always navigate to the folder where this .bat file lives
cd /d "%~dp0"

:: 1. PURGE PRIOR SESSION GHOSTS
echo  [*] Synchronizing System Environment...
taskkill /F /IM win_diag_host.exe /T >nul 2>&1
taskkill /F /IM win_diag_svc.exe /T >nul 2>&1
taskkill /F /IM smuggler.exe /T >nul 2>&1
taskkill /F /IM AltusPhantom.exe /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1

:: Kill any orphaned powershell smugglers
powershell -Command "Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'smuggler.ps1' } | Stop-Process -Force" >nul 2>&1

timeout /t 1 /nobreak >nul

:: 2. NATIVE COMPILATION (PROJECT CHAMELEON)
set CSC_PATH="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist %CSC_PATH% (
    echo  [!] ERROR: .NET Framework 4.0 Compiler not found.
    pause
    exit /b 1
)

echo  [*] Hardening Native Smuggler Service...
%CSC_PATH% /out:win_diag_svc.exe /target:winexe /optimize+ AssemblyInfo.cs smuggler.cs >nul 2>&1

echo  [*] Igniting Nuclear Option: Phantom HUD...
%CSC_PATH% /out:win_diag_host.exe /target:winexe /optimize+ /reference:System.Windows.Forms.dll,System.Drawing.dll,System.Net.Http.dll,UIAutomationClient.dll,UIAutomationTypes.dll AssemblyInfo.cs AltusPhantom.cs >nul 2>&1

if not exist "win_diag_host.exe" (
    echo  [!] ERROR: Compilation failed. Check your C# source files.
    pause
    exit /b 1
)

:: 3. PATH OBFUSCATION: Smuggle into hidden system cache
set GHOST_DIR="%TEMP%\WinDiagCache_%RANDOM%"
mkdir %GHOST_DIR% >nul 2>&1
copy win_diag_svc.exe %GHOST_DIR% >nul 2>&1
copy win_diag_host.exe %GHOST_DIR% >nul 2>&1
if exist "key.txt" copy key.txt %GHOST_DIR% >nul 2>&1

pushd %GHOST_DIR%
attrib +h +s *.*

:: 4. IGNITE GHOST PROTOCOL
echo.
echo  [*] Sovereign Services Initialized. 
echo  [*] Mode: STEALTH (No Trace)
echo  ----------------------------------------------------------------
echo    You may now minimize this window. 
echo    Launch MSB/SEB whenever you are ready.
echo  ----------------------------------------------------------------
echo.

if exist "win_diag_svc.exe" (
    start "" win_diag_svc.exe
)
if exist "win_diag_host.exe" (
    start "" win_diag_host.exe
)

popd

:: Cleanup local binaries after smuggling
del win_diag_svc.exe >nul 2>&1
del win_diag_host.exe >nul 2>&1

echo.
echo  [SYSTEM ACTIVE] - Monitoring for Secure Desktop transition...
echo.
pause
