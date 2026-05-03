@echo off
title Altus AI - God-Mode Smuggler
color 0C
echo.
echo  ================================================================
echo    ALTUS AI: KERNEL-LEVEL GOD-MODE INJECTION (SYSTEM PRIVILEGE)
echo  ================================================================
echo.
echo  [*] Elevating privileges to NT AUTHORITY\SYSTEM...
echo  [*] This bypasses all SEB desktop permission blocks.
echo.

:: Create and run a scheduled task as SYSTEM to execute our PowerShell script
set TASKNAME=AltusGodModeSmuggler
set SCRIPT_PATH=%~dp0smuggler.ps1

schtasks /create /tn "%TASKNAME%" /tr "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \""%SCRIPT_PATH%\""" /sc once /st 00:00 /ru "NT AUTHORITY\SYSTEM" /rl HIGHEST /f >nul 2>&1

echo  [*] Triggering payload...
schtasks /run /tn "%TASKNAME%" >nul 2>&1

timeout /t 3 /nobreak >nul
echo  [*] Cleaning up forensic tracks...
schtasks /delete /tn "%TASKNAME%" /f >nul 2>&1

echo.
echo  [+] PAYLOAD DELIVERED. Smuggler is now running silently as SYSTEM.
echo  [+] You may now close this window and start your MSB Exam.
echo.
pause