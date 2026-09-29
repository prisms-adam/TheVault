param(
    [ValidateSet('Start', 'Stop', 'Status')]
    [string]$Action = 'Start'
)

$ErrorActionPreference = 'Stop'
$vaultRoot = Split-Path $PSScriptRoot -Parent
$runtimeDir = Join-Path $vaultRoot '.local'
$stateFile = Join-Path $runtimeDir 'processes.json'
$state = @()
if (Test-Path -LiteralPath $stateFile) {
    $parsedState = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $state = @($parsedState | Where-Object { $_.Name -and $_.Id -and $_.Path -and $_.StartTime })
}

function Get-OwnedProcess($entry) {
    $process = Get-Process -Id $entry.Id -ErrorAction SilentlyContinue
    if ($process -and $process.Path -eq $entry.Path -and
        $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$entry.StartTime).ToUniversalTime().Ticks) {
        return $process
    }
}

if ($Action -eq 'Status') {
    $rows = foreach ($entry in $state) {
        [pscustomobject]@{
            Service = $entry.Name
            PID = $entry.Id
            Running = [bool](Get-OwnedProcess $entry)
        }
    }
    $rows | Format-Table -AutoSize | Out-String | Write-Output
    if ($state.Count -eq 0) { Write-Output 'No local services recorded.' }
    exit
}

if ($Action -eq 'Stop') {
    foreach ($entry in ($state | Sort-Object { $_.Name -eq 'redis' })) {
        $process = Get-OwnedProcess $entry
        if ($process) {
            # Keep a handle so exit can be verified even after the PID disappears.
            $null = $process.Handle
            if ($entry.Name -eq 'redis') {
                $redisCli = Join-Path (Split-Path $entry.Path -Parent) 'redis-cli.exe'
                & $redisCli -h 127.0.0.1 -p $entry.Port shutdown
                if ($LASTEXITCODE -ne 0) { throw 'Redis shutdown failed; process record retained.' }
            } else {
                # FFmpeg children must stop with the verified Node worker.
                & taskkill.exe /PID $process.Id /T /F
                if ($LASTEXITCODE -ne 0) { throw "Failed to stop $($entry.Name) process tree; process records retained." }
            }
            if (-not $process.WaitForExit(10000)) { throw "$($entry.Name) did not exit; process records retained." }
            Write-Output "Stopped $($entry.Name) ($($entry.Id))."
        }
    }
    '[]' | Set-Content -LiteralPath $stateFile -Encoding utf8
    exit
}

foreach ($required in @('.env', 'node_modules/.bin/prisma.cmd', 'frontend/dist/index.html', 'prisma/dev.db')) {
    if (-not (Test-Path -LiteralPath (Join-Path $vaultRoot $required))) {
        throw "Missing $required. Follow LOCAL_SETUP.md first."
    }
}

$settings = @{}
foreach ($line in Get-Content -LiteralPath (Join-Path $vaultRoot '.env') -Encoding UTF8) {
    if ($line -match '^([A-Z_]+)=(.*)$') {
        $settings[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
}
if ($settings['HOST'] -ne '127.0.0.1' -or $settings['REDIS_HOST'] -ne '127.0.0.1') {
    throw 'This launcher is configured for local access. Set HOST and REDIS_HOST to 127.0.0.1.'
}
$apiPort = [int]$settings['PORT']
$redisPort = [int]$settings['REDIS_PORT']
$nodeExe = (Get-Command node.exe).Source
$redisExe = Join-Path $runtimeDir 'redis/redis-server.exe'
if (-not (Test-Path -LiteralPath $redisExe)) { throw "Missing Redis runtime: $redisExe" }
foreach ($directory in @('.local/logs', '.local/redis-data', 'temp', 'uploads')) {
    New-Item -ItemType Directory -Path (Join-Path $vaultRoot $directory) -Force | Out-Null
}

$services = @(
    @{ Name = 'redis'; Path = $redisExe; Port = $redisPort; Directory = (Join-Path $runtimeDir 'redis-data'); Arguments = "--bind 127.0.0.1 --port $redisPort --protected-mode yes --maxmemory-policy noeviction --save 60 1 --appendonly yes" },
    @{ Name = 'api'; Path = $nodeExe; Port = $apiPort; Directory = $vaultRoot; Arguments = 'src/index.js' },
    @{ Name = 'worker'; Path = $nodeExe; Port = 0; Directory = $vaultRoot; Arguments = 'src/worker-process.js' }
)

foreach ($service in $services) {
    $existing = $state | Where-Object Name -eq $service.Name | Select-Object -First 1
    if ($existing -and (Get-OwnedProcess $existing)) {
        Write-Output "$($service.Name) is already running ($($existing.Id))."
        continue
    }
    if ($service.Port -and (Get-NetTCPConnection -State Listen -LocalPort $service.Port -ErrorAction SilentlyContinue)) {
        throw "Port $($service.Port) is occupied by an unrecorded process. Nothing was stopped."
    }
    $process = Start-Process -FilePath $service.Path -ArgumentList $service.Arguments `
        -WorkingDirectory $service.Directory -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $runtimeDir "logs/$($service.Name).out.log") `
        -RedirectStandardError (Join-Path $runtimeDir "logs/$($service.Name).err.log")
    $entry = [pscustomobject]@{
        Name = $service.Name
        Id = $process.Id
        Path = $service.Path
        StartTime = $process.StartTime.ToUniversalTime().ToString('o')
        Port = $service.Port
    }
    $state = @($state | Where-Object Name -ne $service.Name) + $entry
    ConvertTo-Json -InputObject @($state) | Set-Content -LiteralPath $stateFile -Encoding utf8
    Start-Sleep -Milliseconds 800
    $process.Refresh()
    if ($process.HasExited) { throw "$($service.Name) exited. See .local/logs/$($service.Name).err.log." }
    Write-Output "Started $($service.Name) ($($process.Id))."
}

$url = "http://127.0.0.1:$apiPort/vault/"
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri "$($url)api/videos" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) { Write-Output "Ready: $url"; exit }
    } catch { Start-Sleep -Milliseconds 500 }
}
throw 'API readiness check failed. See .local/logs.'
