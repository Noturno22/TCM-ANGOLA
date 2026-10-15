<#
.SYNOPSIS
  Aplica uma migração SQL ao projeto Supabase via Management API.

.DESCRIPTION
  Uso (sem precisar da password da BD nem de Docker):

    .\scripts\apply-supabase-migration.ps1 supabase\migrations\0009_friends.sql

  O access token da CLI é lido de %USERPROFILE%\.supabase\access-token
  (após `supabase login`). O projeto vem por omissão de `supabase/config.toml`
  quando existir, senão usa o valor de -ProjectRef.

.NOTES
  Usa WebRequest + escape manual porque `ConvertTo-Json` do PowerShell 5.1
  converte strings grandes em {"value":"..."} e a API rejeita com 400.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$File,

  [string]$ProjectRef = 'ogqnbhuvoypmqefxbijr'
)

$ErrorActionPreference = 'Stop'

function ConvertTo-JsonString([string]$Value) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append('"')
  foreach ($ch in $Value.ToCharArray()) {
    switch ($ch) {
      '"'  { [void]$sb.Append('\"') }
      '\'  { [void]$sb.Append('\\') }
      "`n" { [void]$sb.Append('\n') }
      "`r" { [void]$sb.Append('\r') }
      "`t" { [void]$sb.Append('\t') }
      default { [void]$sb.Append($ch) }
    }
  }
  [void]$sb.Append('"')
  return $sb.ToString()
}

if (-not (Test-Path -LiteralPath $File)) {
  Write-Error "Ficheiro nao encontrado: $File"
  exit 1
}

$tokenPath = Join-Path $env:USERPROFILE '.supabase\access-token'
if (-not (Test-Path -LiteralPath $tokenPath)) {
  Write-Error "Sem access token. Corre 'supabase login' primeiro."
  exit 1
}

$token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()
$sql = Get-Content -LiteralPath $File -Raw -Encoding UTF8
$body = '{"query":' + (ConvertTo-JsonString $sql) + '}'

$uri = "https://api.supabase.com/v1/projects/$ProjectRef/database/query"
$wc = New-Object System.Net.WebClient
$wc.Headers['Authorization'] = "Bearer $token"
$wc.Headers['Content-Type'] = 'application/json'
$wc.Encoding = [System.Text.Encoding]::UTF8

try {
  $resp = $wc.UploadString($uri, 'POST', $body)
  Write-Host "OK  $File"
  if ($resp -and $resp -ne '[]') { Write-Host "  -> $resp" }
  exit 0
}
catch {
  $inner = $_.Exception.InnerException
  if ($inner -and $inner.Response) {
    $reader = New-Object System.IO.StreamReader($inner.Response.GetResponseStream())
    $err = $reader.ReadToEnd()
    Write-Error "ERR $File`n  $err"
  }
  else {
    Write-Error "ERR $File`n  $($_.Exception.Message)"
  }
  exit 1
}
