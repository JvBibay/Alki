# Run Kwenta in the Android Studio emulator (Windows PowerShell).
#
#   powershell -ExecutionPolicy Bypass -File scripts\android-emulator.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\android-emulator.ps1 -Avd Pixel_7_API_34
#   powershell -ExecutionPolicy Bypass -File scripts\android-emulator.ps1 -Prod     # test the real production build
#
# It starts the app, starts the emulator, then opens Chrome inside it at http://localhost:3000.
# "localhost" is used on purpose (not 10.0.2.2): Chrome treats localhost as a secure address, so the service worker,
# offline mode and "Install app" work. The tunnel is made with `adb reverse`.
param(
  [string]$Avd = "",
  [int]$Port = 3000,
  [switch]$Prod
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# Find the Android SDK (Android Studio > Settings > Languages & Frameworks > Android SDK shows the path).
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$adb = Join-Path $sdk "platform-tools\adb.exe"
$emu = Join-Path $sdk "emulator\emulator.exe"
if (-not (Test-Path $adb) -or -not (Test-Path $emu)) {
  Write-Host "Android SDK not found at $sdk" -ForegroundColor Red
  Write-Host "Set it first, for example:  `$env:ANDROID_HOME = 'D:\Android\Sdk'" -ForegroundColor Yellow
  exit 1
}

# Pick a virtual device.
$avds = @(& $emu -list-avds | Where-Object { $_ -and $_ -notmatch "^(INFO|WARNING)" })
if (-not $avds.Count) { Write-Host "No emulator found. Create one in Android Studio: Device Manager > Create device." -ForegroundColor Red; exit 1 }
if (-not $Avd) { $Avd = $avds[0] }
if ($avds -notcontains $Avd) { Write-Host "No device named $Avd. Available: $($avds -join ', ')" -ForegroundColor Red; exit 1 }

# Start the app (skip if something is already listening on the port).
$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
$server = $null
Set-Location $root
if (-not $listening) {
  if ($Prod) { Write-Host "Building..."; npm run build; if ($LASTEXITCODE) { exit 1 } }
  $cmd = if ($Prod) { "start" } else { "dev" }
  Write-Host "Starting the app (npm run $cmd)..."
  $server = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", $cmd, "--", "-p", "$Port") -WorkingDirectory $root -PassThru -WindowStyle Minimized
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { break }
  }
}

# Start the emulator unless one is already running.
& $adb start-server | Out-Null
$running = (& $adb devices) -match "emulator-\d+\s+device"
if (-not $running) {
  Write-Host "Starting emulator $Avd (first boot can take a minute)..."
  Start-Process -FilePath $emu -ArgumentList @("-avd", $Avd) | Out-Null
}
& $adb wait-for-device
for ($i = 0; $i -lt 120; $i++) {
  if ((& $adb shell getprop sys.boot_completed 2>$null).Trim() -eq "1") { break }
  Start-Sleep -Seconds 2
}

# Phone's localhost:PORT -> this computer's localhost:PORT, then open Chrome there.
& $adb reverse "tcp:$Port" "tcp:$Port" | Out-Null
& $adb shell am start -a android.intent.action.VIEW -d "http://localhost:$Port" com.android.chrome | Out-Null
Write-Host "Kwenta is open in the emulator at http://localhost:$Port" -ForegroundColor Green
Write-Host "Install it: Chrome menu (three dots) > Add to Home screen / Install app."
if ($server) { Write-Host "Press Ctrl+C or close the minimized 'npm' window to stop the app (PID $($server.Id))." }
