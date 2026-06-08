# spot-report auto-scrape task registration
# Run as admin: powershell -ExecutionPolicy Bypass -File register-task.ps1

$TaskName = "SpotReport-DailyScrape"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeExe = (Get-Command node).Source
$Script = Join-Path $ScriptDir "scrape-all.mjs"

# Daily trigger at 7:00 JST
$Trigger = New-ScheduledTaskTrigger -Daily -At "7:00AM"

# Action
$Action = New-ScheduledTaskAction -Execute $NodeExe -Argument "`"$Script`"" -WorkingDirectory $ScriptDir

# Settings (one-line, no backtick continuation)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

# Remove existing task if any
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing task" -ForegroundColor Yellow
}

# Register (runs as current user)
Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Settings $Settings -User "$env:USERDOMAIN\$env:USERNAME" -Description "spot-report daily scrape: Google Ads + Instagram"

Write-Host ""
Write-Host "Task '$TaskName' registered successfully" -ForegroundColor Green
Write-Host "  Time: Daily 7:00 AM JST" -ForegroundColor Green
Write-Host "  Node: $NodeExe" -ForegroundColor Green
Write-Host "  Script: $Script" -ForegroundColor Green
Write-Host ""
Write-Host "Verify:" -ForegroundColor Cyan
Write-Host "  Get-ScheduledTask -TaskName SpotReport-DailyScrape" -ForegroundColor Cyan
Write-Host "  Start-ScheduledTask -TaskName SpotReport-DailyScrape" -ForegroundColor Cyan
