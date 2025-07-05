@echo off
:: ============================================================================
:: JBR Scripts Global Launcher
:: ============================================================================
:: 
:: A portable Windows CMD launcher that can be placed anywhere on your system.
:: Automatically detects the JBR project and provides global access to the
:: scripts infrastructure.
::
:: Installation:
:: 1. Place this file anywhere in your PATH (e.g., C:\Windows\System32\)
:: 2. Rename to 'jbr.cmd' for shorter commands
:: 3. Run from anywhere: jbr analyze, jbr enhance, etc.
::
:: Usage: jbr [COMMAND] [OPTIONS]
:: ============================================================================

setlocal enabledelayedexpansion

:: Auto-detect JBR project location
set "JBR_PROJECT="

:: Method 1: Check if we're already in a JBR project
if exist "%CD%\scripts\orchestrator.ts" (
    set "JBR_PROJECT=%CD%"
    goto :found_project
)

:: Method 2: Check parent directories
set "CURRENT_DIR=%CD%"
:check_parent
if exist "%CURRENT_DIR%\scripts\orchestrator.ts" (
    set "JBR_PROJECT=%CURRENT_DIR%"
    goto :found_project
)
for %%I in ("%CURRENT_DIR%") do set "PARENT_DIR=%%~dpI"
if "%PARENT_DIR%"=="%CURRENT_DIR%" goto :not_found
set "CURRENT_DIR=%PARENT_DIR:~0,-1%"
goto :check_parent

:: Method 3: Check common locations
:not_found
set "SEARCH_PATHS=E:\M.U. Kamal\Programing\0TS\JBR;C:\Projects\JBR;D:\Projects\JBR;%USERPROFILE%\Projects\JBR"
for %%P in ("%SEARCH_PATHS:;=" "%") do (
    if exist "%%~P\scripts\orchestrator.ts" (
        set "JBR_PROJECT=%%~P"
        goto :found_project
    )
)

:: Project not found
echo [31mError: JBR project not found![0m
echo.
echo [33mSearched locations:[0m
echo   - Current directory and parents
echo   - E:\M.U. Kamal\Programing\0TS\JBR
echo   - C:\Projects\JBR
echo   - D:\Projects\JBR
echo   - %USERPROFILE%\Projects\JBR
echo.
echo [36mTo fix this:[0m
echo   1. Navigate to your JBR project directory
echo   2. Run: jbr-scripts.cmd instead
echo   3. Or update the SEARCH_PATHS in this script
exit /b 1

:found_project
echo [32m📁 JBR Project: %JBR_PROJECT%[0m
echo.

:: Change to project directory and run the main controller
cd /d "%JBR_PROJECT%"
call "%JBR_PROJECT%\jbr-scripts.cmd" %*

:: Return to original directory
cd /d "%~dp0"
