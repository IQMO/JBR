@echo off
:: ============================================================================
:: JBR Scripts Controller - Windows Command Interface
:: ============================================================================
:: 
:: A simple Windows CMD interface to control the comprehensive JBR scripts
:: infrastructure from anywhere on the system. Provides two main perspectives:
:: - ANALYZE: Comprehensive project analysis and insights
:: - ENHANCE: Code quality improvements and optimizations
::
:: Usage: jbr-scripts.cmd [COMMAND] [OPTIONS]
:: 
:: Created: July 5, 2025
:: Project: Jabbr Trading Bot Platform
:: ============================================================================

setlocal enabledelayedexpansion

:: Set project root (auto-detect or use current directory)
set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

:: Colors for output (if supported)
set "GREEN=[32m"
set "YELLOW=[33m"
set "RED=[31m"
set "BLUE=[34m"
set "CYAN=[36m"
set "RESET=[0m"

:: Main command dispatcher
if "%1"=="" goto :show_help
if /i "%1"=="help" goto :show_help
if /i "%1"=="--help" goto :show_help
if /i "%1"=="-h" goto :show_help
if /i "%1"=="analyze" goto :analyze_mode
if /i "%1"=="enhance" goto :enhance_mode
if /i "%1"=="status" goto :show_status
if /i "%1"=="list" goto :list_scripts
if /i "%1"=="quick" goto :quick_check
if /i "%1"=="full" goto :full_analysis

echo %RED%Error: Unknown command '%1'%RESET%
echo Run 'jbr-scripts help' for usage information.
exit /b 1

:: ============================================================================
:: HELP SYSTEM
:: ============================================================================
:show_help
echo.
echo %CYAN%═══════════════════════════════════════════════════════════════════════════════%RESET%
echo %CYAN%                        JBR SCRIPTS CONTROLLER                                %RESET%
echo %CYAN%═══════════════════════════════════════════════════════════════════════════════%RESET%
echo.
echo %YELLOW%🎯 MAIN COMMANDS:%RESET%
echo.
echo   %GREEN%analyze%RESET%           📊 Run comprehensive project analysis
echo   %GREEN%enhance%RESET%           🔧 Execute code quality improvements  
echo   %GREEN%status%RESET%            📋 Show current project status
echo   %GREEN%list%RESET%              📄 List all available scripts
echo   %GREEN%quick%RESET%             ⚡ Quick health check (2-3 minutes)
echo   %GREEN%full%RESET%              🚀 Full validation suite (10-15 minutes)
echo.
echo %YELLOW%🔍 ANALYSIS PERSPECTIVE:%RESET%
echo.
echo   %CYAN%jbr-scripts analyze%RESET%              Run complete analysis suite
echo   %CYAN%jbr-scripts analyze --architectural%RESET%  Deep architectural analysis
echo   %CYAN%jbr-scripts analyze --performance%RESET%    Performance bottleneck detection
echo   %CYAN%jbr-scripts analyze --duplicates%RESET%     Code duplication analysis
echo   %CYAN%jbr-scripts analyze --quality%RESET%        Code quality assessment
echo.
echo %YELLOW%🔧 ENHANCEMENT PERSPECTIVE:%RESET%
echo.
echo   %CYAN%jbr-scripts enhance%RESET%                  Run enhancement workflows
echo   %CYAN%jbr-scripts enhance --production%RESET%     Production readiness check
echo   %CYAN%jbr-scripts enhance --documentation%RESET%  Documentation validation
echo   %CYAN%jbr-scripts enhance --naming%RESET%         Naming convention validation
echo   %CYAN%jbr-scripts enhance --monitoring%RESET%     System monitoring checks
echo.
echo %YELLOW%💡 EXAMPLES:%RESET%
echo.
echo   %GREEN%jbr-scripts quick%RESET%                   Fast project health check
echo   %GREEN%jbr-scripts analyze --performance%RESET%   Find performance issues
echo   %GREEN%jbr-scripts enhance --production%RESET%    Ensure production readiness
echo   %GREEN%jbr-scripts status%RESET%                  Current project overview
echo.
echo %YELLOW%📁 Project Root: %RESET%%PROJECT_ROOT%
echo.
goto :eof

:: ============================================================================
:: ANALYSIS PERSPECTIVE
:: ============================================================================
:analyze_mode
echo.
echo %CYAN%📊 ANALYSIS PERSPECTIVE - Project Insights%RESET%
echo %CYAN%═══════════════════════════════════════════%RESET%

if "%2"=="" goto :analyze_comprehensive
if /i "%2"=="--architectural" goto :analyze_architectural
if /i "%2"=="--performance" goto :analyze_performance
if /i "%2"=="--duplicates" goto :analyze_duplicates
if /i "%2"=="--quality" goto :analyze_quality

echo %RED%Error: Unknown analysis option '%2'%RESET%
echo Use: analyze [--architectural^|--performance^|--duplicates^|--quality]
exit /b 1

:analyze_comprehensive
echo.
echo %YELLOW%🔍 Running comprehensive project analysis...%RESET%
echo %BLUE%This will analyze architecture, performance, code quality, and duplications%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npm run workflow:analysis
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Comprehensive analysis completed successfully!%RESET%
    echo %CYAN%📋 Check scripts/analysis/reports/ for detailed findings%RESET%
) else (
    echo.
    echo %RED%❌ Analysis failed with errors%RESET%
)
goto :eof

:analyze_architectural
echo.
echo %YELLOW%🏗️ Running architectural analysis...%RESET%
echo %BLUE%Deep dive into project structure and dependencies%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npx tsx scripts/analysis/architectural-analyzer.ts
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Architectural analysis completed!%RESET%
) else (
    echo.
    echo %RED%❌ Architectural analysis failed%RESET%
)
goto :eof

:analyze_performance
echo.
echo %YELLOW%⚡ Running performance analysis...%RESET%
echo %BLUE%Identifying bottlenecks and optimization opportunities%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npx tsx scripts/testing/performance/performance-analyzer.ts
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Performance analysis completed!%RESET%
) else (
    echo.
    echo %RED%❌ Performance analysis failed%RESET%
)
goto :eof

:analyze_duplicates
echo.
echo %YELLOW%🔍 Running duplication analysis...%RESET%
echo %BLUE%Detecting code duplications and consolidation opportunities%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npm run detect:duplicates
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Duplication analysis completed!%RESET%
) else (
    echo.
    echo %RED%❌ Duplication analysis failed%RESET%
)
goto :eof

:analyze_quality
echo.
echo %YELLOW%🎯 Running quality analysis...%RESET%
echo %BLUE%Comprehensive code quality assessment%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npm run quality:analyze
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Quality analysis completed!%RESET%
) else (
    echo.
    echo %RED%❌ Quality analysis failed%RESET%
)
goto :eof

:: ============================================================================
:: ENHANCEMENT PERSPECTIVE
:: ============================================================================
:enhance_mode
echo.
echo %CYAN%🔧 ENHANCEMENT PERSPECTIVE - Code Quality Improvements%RESET%
echo %CYAN%═══════════════════════════════════════════════════════════%RESET%

if "%2"=="" goto :enhance_comprehensive
if /i "%2"=="--production" goto :enhance_production
if /i "%2"=="--documentation" goto :enhance_documentation
if /i "%2"=="--naming" goto :enhance_naming
if /i "%2"=="--monitoring" goto :enhance_monitoring

echo %RED%Error: Unknown enhancement option '%2'%RESET%
echo Use: enhance [--production^|--documentation^|--naming^|--monitoring]
exit /b 1

:enhance_comprehensive
echo.
echo %YELLOW%🚀 Running comprehensive enhancement workflow...%RESET%
echo %BLUE%This will check production readiness, documentation, and naming conventions%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npm run workflow:production
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Enhancement workflow completed successfully!%RESET%
    echo %CYAN%📋 System is optimized and production-ready%RESET%
) else (
    echo.
    echo %RED%❌ Enhancement workflow encountered issues%RESET%
)
goto :eof

:enhance_production
echo.
echo %YELLOW%🏭 Running production readiness check...%RESET%
echo %BLUE%Validating production deployment readiness%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npm run production:check
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Production readiness check completed!%RESET%
) else (
    echo.
    echo %RED%❌ Production readiness issues found%RESET%
)
goto :eof

:enhance_documentation
echo.
echo %YELLOW%📚 Running documentation validation...%RESET%
echo %BLUE%Ensuring documentation accuracy and completeness%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npm run validate:docs:comprehensive
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Documentation validation completed!%RESET%
) else (
    echo.
    echo %RED%❌ Documentation issues found%RESET%
)
goto :eof

:enhance_naming
echo.
echo %YELLOW%🏷️ Running naming convention validation...%RESET%
echo %BLUE%Checking code naming standards and consistency%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npm run validate:naming
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Naming validation completed!%RESET%
) else (
    echo.
    echo %RED%❌ Naming convention issues found%RESET%
)
goto :eof

:enhance_monitoring
echo.
echo %YELLOW%📊 Running monitoring validation...%RESET%
echo %BLUE%Checking system monitoring and health checks%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npm run validate:post-implementation
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Monitoring validation completed!%RESET%
) else (
    echo.
    echo %RED%❌ Monitoring issues found%RESET%
)
goto :eof

:: ============================================================================
:: UTILITY COMMANDS
:: ============================================================================
:show_status
echo.
echo %CYAN%📋 JBR PROJECT STATUS%RESET%
echo %CYAN%═══════════════════════%RESET%
echo.
echo %YELLOW%📁 Project Root:%RESET% %PROJECT_ROOT%
echo %YELLOW%🕒 Date/Time:%RESET% %DATE% %TIME%
echo.
cd /d "%PROJECT_ROOT%"
call npm run scripts:status
goto :eof

:list_scripts
echo.
echo %CYAN%📄 AVAILABLE SCRIPTS%RESET%
echo %CYAN%═══════════════════════%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npm run scripts:list
goto :eof

:quick_check
echo.
echo %CYAN%⚡ QUICK HEALTH CHECK%RESET%
echo %CYAN%══════════════════════%RESET%
echo.
echo %YELLOW%🔍 Running quick project health assessment...%RESET%
echo %BLUE%This will take 2-3 minutes%RESET%
echo.
cd /d "%PROJECT_ROOT%"
call npm run workflow:health
if %ERRORLEVEL% EQU 0 (
    echo.
    echo %GREEN%✅ Quick health check completed!%RESET%
    echo %CYAN%💡 For detailed analysis, run: jbr-scripts analyze%RESET%
) else (
    echo.
    echo %RED%❌ Health check found issues%RESET%
    echo %CYAN%💡 Run full analysis: jbr-scripts analyze%RESET%
)
goto :eof

:full_analysis
echo.
echo %CYAN%🚀 FULL VALIDATION SUITE%RESET%
echo %CYAN%═══════════════════════════%RESET%
echo.
echo %YELLOW%🔍 Running complete project validation...%RESET%
echo %BLUE%This will take 10-15 minutes%RESET%
echo.
echo %YELLOW%Phase 1: Analysis%RESET%
cd /d "%PROJECT_ROOT%"
call npm run workflow:analysis
echo.
echo %YELLOW%Phase 2: Enhancement%RESET%
call npm run workflow:production
echo.
if %ERRORLEVEL% EQU 0 (
    echo %GREEN%✅ Full validation suite completed successfully!%RESET%
    echo %CYAN%🎉 Project is fully analyzed and optimized%RESET%
) else (
    echo %RED%❌ Full validation found issues to address%RESET%
)
goto :eof

:: ============================================================================
:: UTILITIES
:: ============================================================================
:check_project_root
if not exist "%PROJECT_ROOT%\package.json" (
    echo %RED%Error: Not a valid JBR project directory%RESET%
    echo %YELLOW%Expected package.json in: %PROJECT_ROOT%%RESET%
    exit /b 1
)
if not exist "%PROJECT_ROOT%\scripts\orchestrator.ts" (
    echo %RED%Error: Scripts infrastructure not found%RESET%
    echo %YELLOW%Expected orchestrator.ts in: %PROJECT_ROOT%\scripts\%RESET%
    exit /b 1
)
goto :eof

:: End of script
