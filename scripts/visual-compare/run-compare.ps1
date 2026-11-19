$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Nortuno\Desktop\DEV\TCM'
$tmp = 'C:\Users\Nortuno\AppData\Local\Temp\opencode'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$mobile = Join-Path $root 'apps\mobile'

$env:EXPO_NO_TELEMETRY = '1'

$next = Start-Process -PassThru -WindowStyle Hidden -WorkingDirectory $root -FilePath 'cmd.exe' `
  -ArgumentList '/c', "npm run dev > `"$tmp\next-dev.log`" 2>&1"
$expo = Start-Process -PassThru -WindowStyle Hidden -WorkingDirectory $mobile -FilePath 'cmd.exe' `
  -ArgumentList '/c', "npx expo start --port 8081 > `"$tmp\expo-web.log`" 2>&1"

function Wait-Port($port, $name) {
  for ($i = 0; $i -lt 90; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 5
      if ($r.StatusCode -ge 200) { Write-Output "$name up ($($r.StatusCode))"; return }
    } catch { }
    Start-Sleep -Seconds 2
  }
  Write-Output "$name TIMEOUT"
}
Wait-Port 3000 'next'
Wait-Port 8081 'expo'

node "$here\compare.js"
$code = $LASTEXITCODE

taskkill /F /T /PID $next.Id 2>$null
taskkill /F /T /PID $expo.Id 2>$null
exit $code
