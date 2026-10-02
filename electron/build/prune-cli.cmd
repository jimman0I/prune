@echo off
rem Prune's command line: prune-cli list | preview | clean   (prune-cli help)
rem
rem Prune.exe is a windowed program and cannot print to a console by itself, so
rem this runs it as plain Node on the CLI script that ships inside it -- the
rem same way VS Code's own "code" command works. setlocal keeps the variable
rem out of the caller's shell; the exit code is handed back as it was.
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0Prune.exe" "%~dp0resources\backend\src\cli.js" %*
exit /b %errorlevel%
