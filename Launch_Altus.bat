@echo off
title Altus AI — Stealth AI Interview Assistant
color 0B

echo.
echo  ============================================
echo   ALTUS AI — Stealth AI Interview Assistant
echo  ============================================
echo.

:: Change to the script's own directory so it works from any location
cd /d "%~dp0"

:: Absolute Cleanup: Kill any hanging processes from previous sessions
echo  [*] Cleaning up previous Altus AI instances...
taskkill /F /IM electron.exe /T >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Check if node_modules exists, install if missing
if not exist "node_modules" (
    echo  [*] First run detected. Installing dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  [!] npm install FAILED. Make sure Node.js ^(v18+^) is installed.
        pause
        exit /b 1
    )
)

:: Build the Electron main process TypeScript
echo  [*] Compiling Electron main process...
call npm run build:electron
if errorlevel 1 (
    echo.
    echo  [!] TypeScript build FAILED. Check the errors above.
    pause
    exit /b 1
)

echo.
echo  [*] Launching Altus AI...
echo  [*] Use Ctrl+Shift+V to toggle visibility.
echo  [*] Use Ctrl+Shift+Q for emergency quit.
echo.

:: Start the full dev environment (Vite + Electron concurrently)
call npm run start

echo.
echo  Altus AI has exited.
pause
