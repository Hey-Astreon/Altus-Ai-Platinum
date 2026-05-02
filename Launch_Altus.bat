@echo off
title Altus AI Platinum — Stealth AI Interview Assistant
color 0A

echo.
echo  ================================================================
echo    █████╗ ██╗  ████████╗██╗   ██╗███████╗     █████╗ ██╗
echo   ██╔══██╗██║  ╚══██╔══╝██║   ██║██╔════╝    ██╔══██╗██║
echo   ███████║██║     ██║   ██║   ██║███████╗    ███████║██║
echo   ██╔══██║██║     ██║   ██║   ██║╚════██║    ██╔══██║██║
echo   ██║  ██║███████╗██║   ╚██████╔╝███████║    ██║  ██║██║
echo   ╚═╝  ╚═╝╚══════╝╚═╝    ╚═════╝ ╚══════╝    ╚═╝  ╚═╝╚═╝
echo.
echo   [ ELITE EDITION v3.0.26 ]  --  Autonomous Mode: ONLINE
echo  ================================================================
echo.

:: Always navigate to the folder where this .bat file lives
cd /d "%~dp0"

:: Kill any leftover session ghosts (Standard & Morphed)
echo  [*] Clearing prior session ghosts...
taskkill /F /IM electron.exe /T >nul 2>&1
taskkill /F /IM win_hdaudio_ext.exe /T >nul 2>&1
taskkill /F /IM sys_diag_helper.exe /T >nul 2>&1
taskkill /F /IM svchost_runtime.exe /T >nul 2>&1
taskkill /F /IM nv_container_svc.exe /T >nul 2>&1
taskkill /F /IM WinDiagnostic_Accessibility_Service.exe /T >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Verify Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [!] ERROR: Node.js is not installed or not in PATH.
    echo  [!] Download from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

:: Install dependencies if missing
if not exist "node_modules" (
    echo  [*] First run detected. Installing dependencies...
    echo.
    call npm i --silent
    if errorlevel 1 (
        echo.
        echo  [!] npm install FAILED. Check your internet connection.
        pause
        exit /b 1
    )
    echo.
)

:: Compile the Electron TypeScript layer
echo  [*] Compiling Electron V3.0 Core...
call npm run build:electron
if errorlevel 1 (
    echo.
    echo  [!] TypeScript build FAILED. Check the errors above.
    echo.
    pause
    exit /b 1
)

echo.
echo  [*] All systems nominal. Igniting Altus AI Platinum...
echo  [*] MODE: DEVELOPMENT (Console Logs Enabled)
echo  ----------------------------------------------------------------
echo    Press Ctrl+C in this window to SHUT DOWN Altus AI fully.
echo  ----------------------------------------------------------------
echo.

:: Launch in Dev Mode
call npm run start

echo.
echo  ================================================================
echo    Altus AI has exited cleanly. Ghost protocol terminated.
echo  ================================================================
echo.
pause
