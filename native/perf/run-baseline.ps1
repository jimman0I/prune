param(
    [Parameter(Mandatory)] [string] $Measure,
    [Parameter(Mandatory)] [string] $Exe,
    [Parameter(Mandatory)] [string] $Out,
    [string] $TaskName = 'PruneMeasureBaseline'
)
# Registers a one-shot Interactive / Limited scheduled task for the current
# user that runs prune-measure in the real desktop session, waits for it to
# finish, prints the result, and unregisters the task (also on failure).

$ErrorActionPreference = 'Stop'
$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$log = [System.IO.Path]::ChangeExtension($Out, '.log')

# cmd /c so stderr (the progress lines) lands in a file we can show.
$arg = '/c ""{0}" --exe "{1}" --runs 5 --settle 30 --kill-existing --restore --out "{2}" 2> "{3}""' -f $Measure, $Exe, $Out, $log
$action    = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $arg
$principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

if (Test-Path $Out) { Remove-Item $Out -Force }
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Principal $principal -Settings $settings | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Measuring $Exe in the interactive session (about 5 minutes) ..."
    Start-Sleep -Seconds 3
    while ((Get-ScheduledTask -TaskName $TaskName).State -eq 'Running') { Start-Sleep -Seconds 5 }
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host ("Task finished, last result {0}" -f $info.LastTaskResult)
    if (Test-Path $log) { Get-Content $log }
    if (Test-Path $Out) { Write-Host "Wrote $Out" } else { Write-Host "No result file was written." }
}
finally {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
}
