@echo off
rem Measures the installed Prune 3.x with prune-measure and writes
rem native\perf\baseline-3.2.0.json.
rem
rem It must run in the real desktop session (an Interactive one-shot
rem scheduled task, Limited run level), because a shell started by a
rem sandboxed tool sees a virtualized copy of the system. This script
rem registers that task, waits for it, and removes it again.
rem
rem WHAT YOU WILL SEE: the running Prune 3.x is closed, then launched and
rem killed 6 times (1 discarded warm-up + 5 measured), about 45 s each,
rem roughly 5 minutes in all, and one Prune is started again at the end
rem (--restore). Do not touch Prune during the run.
rem
rem Run it with no arguments, or "run-baseline.cmd elevated" when Prune is set
rem to always run as administrator (one UAC prompt; the task then runs at the
rem highest level). Optional: set PRUNE_EXE to a different exe, OUT to a
rem different result file.

setlocal
set "HERE=%~dp0"
set "MEASURE=%HERE%..\target\release\prune-measure.exe"
if not defined PRUNE_EXE set "PRUNE_EXE=%LOCALAPPDATA%\Programs\Prune\Prune.exe"
if not defined OUT set "OUT=%HERE%baseline-3.2.0.json"
set "TASK=PruneMeasureBaseline"
set "LEVEL=Limited"
if /i "%~1"=="elevated" set "LEVEL=Highest"

if not exist "%MEASURE%" (
    echo Build the tool first: cargo build --release -p prune-measure   ^(in native^)
    exit /b 2
)
if not exist "%PRUNE_EXE%" (
    echo Not found: %PRUNE_EXE%
    exit /b 2
)

rem Resolve the tool path fully; the task's working directory is not ours.
for %%I in ("%MEASURE%") do set "MEASURE=%%~fI"
for %%I in ("%OUT%") do set "OUT=%%~fI"

powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%run-baseline.ps1" -Measure "%MEASURE%" -Exe "%PRUNE_EXE%" -Out "%OUT%" -TaskName "%TASK%" -RunLevel %LEVEL%
exit /b %ERRORLEVEL%
