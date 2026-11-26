# Build an installable Android APK of Kwenta (Windows PowerShell).
#
#   powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1 -Url https://your-kwenta.vercel.app
#   ... -Install     also installs it on the running emulator / USB phone
#
# The APK is a thin Android shell (Capacitor) that opens your DEPLOYED Kwenta website full screen, so it always
# shows the latest version and the server pieces (receipt scan API, sign-in) keep working. It needs internet for
# the first load; after that the site's own offline cache applies. -Url must be your live https address.
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [string]$AppId = "app.kwenta.android",
  [switch]$Install
)

$ErrorActionPreference = "Stop"
if ($Url -notmatch "^https://") { Write-Host "Url must start with https://" -ForegroundColor Red; exit 1 }
$Url = $Url.TrimEnd("/")
$app = Join-Path (Split-Path -Parent $PSScriptRoot) "android-app"

# Java 17 to 23 is needed: this Gradle version cannot read Java 24+ (Android Studio may bundle a newer one).
function Get-JavaMajor([string]$home_) {
  $rel = Join-Path $home_ "release"
  if (-not (Test-Path (Join-Path $home_ "bin\java.exe")) -or -not (Test-Path $rel)) { return 0 }
  $m = Select-String -Path $rel -Pattern 'JAVA_VERSION="(\d+)' | Select-Object -First 1
  if ($m) { return [int]$m.Matches[0].Groups[1].Value } else { return 0 }
}
$cands = @($env:JAVA_HOME)
foreach ($d in (Get-PSDrive -PSProvider FileSystem).Root) {
  foreach ($vendor in "Eclipse Adoptium", "Microsoft", "Java", "Amazon Corretto", "Zulu") {
    $cands += @(Get-ChildItem (Join-Path $d "Program Files\$vendor") -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
  }
  $cands += "$($d)Program Files\Android\Android Studio\jbr"
}
$cands += "$env:LOCALAPPDATA\Programs\Android Studio\jbr"
$env:JAVA_HOME = $null
foreach ($c in $cands) {
  if (-not $c) { continue }
  $v = Get-JavaMajor $c
  if ($v -ge 17 -and $v -le 23) { $env:JAVA_HOME = $c; break }
}
if (-not $env:JAVA_HOME) {
  Write-Host "No suitable Java found (need Java 17 to 23; yours is probably newer)." -ForegroundColor Red
  Write-Host "Install one, then run this again:  winget install EclipseAdoptium.Temurin.21.JDK" -ForegroundColor Yellow
  exit 1
}
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not (Test-Path $sdk)) { Write-Host "Android SDK not found at $sdk (set ANDROID_HOME)." -ForegroundColor Red; exit 1 }
$env:ANDROID_HOME = $sdk

Set-Location $app

# Capacitor config: open the live site, only allow Kwenta's own address inside the app.
$hostName = ([Uri]$Url).Host
$config = @{
  appId     = $AppId
  appName   = "Kwenta"
  webDir    = "www"
  server    = @{ url = $Url; cleartext = $false; allowNavigation = @($hostName, "*.supabase.co") }
  android   = @{ allowMixedContent = $false }
} | ConvertTo-Json -Depth 5
Set-Content -Path "capacitor.config.json" -Value $config -Encoding utf8

if (-not (Test-Path "node_modules")) { npm install; if ($LASTEXITCODE) { exit 1 } }
if (-not (Test-Path "android")) { npx cap add android; if ($LASTEXITCODE) { exit 1 } }
npx cap sync android; if ($LASTEXITCODE) { exit 1 }

# Replace the default Capacitor icon with Kwenta's.
Push-Location (Split-Path -Parent $app)
node scripts\android-icons.mjs
$iconCode = $LASTEXITCODE
Pop-Location
if ($iconCode) { Write-Host "Couldn't write the app icon (the APK would use the default one)." -ForegroundColor Red; exit 1 }

# Tell Gradle where the SDK is.
Set-Content -Path "android\local.properties" -Value ("sdk.dir=" + ($sdk -replace "\\", "/")) -Encoding ascii

Push-Location android
.\gradlew.bat assembleDebug
$code = $LASTEXITCODE
Pop-Location
if ($code) { Write-Host "Build failed. Read the error above and send it to me." -ForegroundColor Red; exit 1 }

$apk = Join-Path $app "android\app\build\outputs\apk\debug\app-debug.apk"
$out = Join-Path (Split-Path -Parent $PSScriptRoot) "kwenta.apk"
Copy-Item $apk $out -Force
Write-Host "APK ready: $out" -ForegroundColor Green

if ($Install) {
  & (Join-Path $sdk "platform-tools\adb.exe") install -r $out
}
