@echo off
echo =========================================
echo   VibeCodingWorkbook API Key Changer
echo =========================================
echo.

set /p KEY="Enter API key (sk-ant-...): "
if "%KEY%"=="" (
    echo No key entered.
    pause
    exit /b
)

:: Find config.txt
set "FOUND="
if exist "%~dp0config.txt" set "FOUND=%~dp0config.txt"
if exist "%~dp0..\config.txt" set "FOUND=%~dp0..\config.txt"
if exist "%~dp0..\src-tauri\resources\config.txt" set "FOUND=%~dp0..\src-tauri\resources\config.txt"
if exist "%~dp0..\src-tauri\target\release\config.txt" set "FOUND=%~dp0..\src-tauri\target\release\config.txt"

if not defined FOUND (
    echo [!] config.txt not found.
    echo     Place this file next to the app.
    pause
    exit /b
)

echo ANTHROPIC_API_KEY=%KEY%> "%FOUND%"
echo.
echo [OK] Updated: %FOUND%
echo.
echo Restart the app to apply.
pause
