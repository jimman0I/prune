param(
    [Parameter(Mandatory)] [string] $Measure,
    [Parameter(Mandatory)] [string] $Exe,
    [Parameter(Mandatory)] [string] $Out,
    [string] $TaskName = 'PruneMeasureBaseline',
    # Highest when Prune is set to always run as administrator: a limited task
    # cannot start it (ERROR_ELEVATION_REQUIRED). Registering a Highest task
    # needs this script itself to be elevated; run-baseline.cmd elevated does that.
    [ValidateSet('Limited', 'Highest')] [string] $RunLevel = 'Limited'
)
# Registers a one-shot Interactive scheduled task (Limited, or Highest) for the current
# user that runs prune-measure in the real desktop session, waits until the
# task has run AND finished, prints the result, and unregisters the task.
# The result is written beside $Out and moved into place only on success, so
# a failed run never replaces an earlier baseline. If this script is stopped
# while the task is still running, the task is stopped too.

$ErrorActionPreference = 'Stop'

# Highest needs an elevated caller. Ask once (one UAC prompt), run this same
# script elevated with the same arguments, wait for it, and show what it wrote.
$elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if ($RunLevel -eq 'Highest' -and -not $elevated) {
    $q = { param($v) '"' + $v + '"' }
    $argv = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (& $q $PSCommandPath),
        '-Measure', (& $q $Measure), '-Exe', (& $q $Exe), '-Out', (& $q $Out),
        '-TaskName', $TaskName, '-RunLevel', 'Highest')
    Write-Host 'Asking Windows for administrator rights once (Prune is set to always run as administrator) ...'
    try {
        $p = Start-Process powershell.exe -Verb RunAs -ArgumentList $argv -WindowStyle Minimized -Wait -PassThru
    } catch {
        Write-Host 'The administrator prompt was declined; nothing was measured.'
        exit 1
    }
    $logFile = [System.IO.Path]::ChangeExtension($Out, '.log')
    if (Test-Path $logFile) { Get-Content $logFile }
    if (Test-Path $Out) { Write-Host "Result: $Out" }
    exit $p.ExitCode
}

$me  =[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$log = [System.IO.Path]::ChangeExtension($Out, '.log')
$tmp = "$Out.tmp"

# cmd /c so stderr (the progress lines) lands in a file we can show.
$arg = '/c ""{0}" --exe "{1}" --runs 5 --settle 30 --kill-existing --restore --out "{2}" 2> "{3}""' -f $Measure, $Exe, $tmp, $log
$action    = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $arg
$principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel $RunLevel
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

# 267009 = running, 267011 = never run yet, 267010 = disabled, 267008 = ready.
$notYetResult = @(267008, 267009, 267010, 267011)

Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Principal $principal -Settings $settings | Out-Null
    $before = (Get-ScheduledTaskInfo -TaskName $TaskName).LastRunTime
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Measuring $Exe in the interactive session (about 5 minutes) ..."

    # 1. Wait until the task has actually started (Queued / Ready is not it).
    $started = $false
    $deadline = (Get-Date).AddSeconds(120)
    while (-not $started) {
        $state = (Get-ScheduledTask -TaskName $TaskName).State
        $info  = Get-ScheduledTaskInfo -TaskName $TaskName
        if ($state -eq 'Running') { $started = $true }
        elseif ($info.LastRunTime -ne $before -and ($notYetResult -notcontains $info.LastTaskResult)) { $started = $true }  # already ran and ended
        elseif ((Get-Date) -gt $deadline) { throw "The task did not start within 120 s (state: $state); nothing was measured." }
        else { Start-Sleep -Milliseconds 500 }
    }

    # 2. Wait until it ends.
    while ((Get-ScheduledTask -TaskName $TaskName).State -eq 'Running') { Start-Sleep -Seconds 5 }

    $result = (Get-ScheduledTaskInfo -TaskName $TaskName).LastTaskResult
    Write-Host ("Task finished, last result {0}" -f $result)
    if (Test-Path $log) { Get-Content $log }
    if ($result -eq 0 -and (Test-Path $tmp)) {
        Move-Item $tmp $Out -Force
        Write-Host "Wrote $Out"
    }
    elseif (Test-Path $tmp) {
        $partial = [System.IO.Path]::ChangeExtension($Out, '.partial.json')
        Move-Item $tmp $partial -Force
        Write-Host "The run was not clean (see the log above). Kept as $partial; $Out was not touched."
    }
    else {
        Write-Host "No result file was written; $Out was not touched."
    }
}
finally {
    $t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($t -and $t.State -eq 'Running') {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Write-Host "Stopped the measuring task. Prune may be closed; start it again from the Start menu."
    }
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
}
