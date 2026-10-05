<#
  HomeCal – installe le « PC de référence » Ollama (relais + tunnel Tailscale Funnel).

  Usage (PowerShell, sur le PC qui doit héberger Ollama) :
    .\setup.ps1 -Token "<le même jeton que OLLAMA_TUNNEL_TOKEN sur Vercel>"
    .\setup.ps1                # génère un nouveau jeton (à reporter ensuite sur Vercel)

  Prérequis : Node.js >= 18, Ollama, Tailscale (connecté : `tailscale login`).
  Changer de PC : lancer ce script sur le nouveau PC avec le même -Token, puis dans la console
  Tailscale, renommer la machine en « homecal-ollama » (et supprimer l'ancienne).
#>
param(
  [string]$Token = "",
  [string]$Model = "qwen3:4b-instruct",
  [int]$Port = 11435
)

$ErrorActionPreference = "Stop"
function Step($msg) { Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Find-Exe($name, $candidates) {
  $c = Get-Command $name -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in $candidates) { if (Test-Path $p) { return $p } }
  return $null
}

$node = Find-Exe "node" @("$env:ProgramFiles\nodejs\node.exe")
$ollama = Find-Exe "ollama" @("$env:LOCALAPPDATA\Programs\Ollama\ollama.exe")
$tailscale = Find-Exe "tailscale" @("$env:ProgramFiles\Tailscale\tailscale.exe")
if (-not $node) { throw "Node.js introuvable : installez-le (winget install OpenJS.NodeJS.LTS)." }
if (-not $ollama) { throw "Ollama introuvable : installez-le depuis https://ollama.com." }
if (-not $tailscale) { throw "Tailscale introuvable : installez-le (winget install Tailscale.Tailscale) puis 'tailscale login'." }

Step "Modèle $Model"
& $ollama pull $Model

Step "Réglages Ollama (GPU ≤ 4 Go : flash attention + cache q8)"
[Environment]::SetEnvironmentVariable("OLLAMA_FLASH_ATTENTION", "1", "User")
[Environment]::SetEnvironmentVariable("OLLAMA_KV_CACHE_TYPE", "q8_0", "User")

Step "Relais HomeCal"
if (-not $Token) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $Token = ([Convert]::ToBase64String($bytes) -replace '[+/=]', '').Substring(0, 40)
  $generated = $true
}
$dir = Join-Path $env:LOCALAPPDATA "HomeCal-Relay"
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item (Join-Path $PSScriptRoot "relay.mjs") $dir -Force
[IO.File]::WriteAllText((Join-Path $dir "relay.env"), "HOMECAL_RELAY_TOKEN=$Token`nHOMECAL_RELAY_PORT=$Port`n", (New-Object Text.UTF8Encoding $false))

# Démarrage automatique à l'ouverture de session (sans droits administrateur), fenêtre cachée
$startup = [Environment]::GetFolderPath("Startup")
$vbs = Join-Path $startup "HomeCal-Relay.vbs"
$vbsLine = 'CreateObject("WScript.Shell").Run """' + $node + '"" ""' + (Join-Path $dir "relay.mjs") + '""", 0, False'
[IO.File]::WriteAllText($vbs, $vbsLine + "`r`n")

# (Re)démarrer le relais maintenant
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*HomeCal-Relay*relay.mjs*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Process wscript.exe -ArgumentList "`"$vbs`"" -WindowStyle Hidden
Start-Sleep 2
$health = Invoke-RestMethod "http://127.0.0.1:$Port/health" -Headers @{ Authorization = "Bearer $Token" }
if (-not $health.ok) { throw "Le relais ne répond pas (voir $dir\relay.log)." }
Write-Host "Relais OK sur 127.0.0.1:$Port"

Step "Tunnel Tailscale Funnel (HTTPS public → relais)"
& $tailscale funnel --bg $Port
$status = & $tailscale status --json | ConvertFrom-Json
$dns = $status.Self.DNSName.TrimEnd(".")
$url = "https://$dns"

Step "Terminé"
Write-Host "Adresse du tunnel : $url" -ForegroundColor Green
if ($generated) {
  Write-Host "Nouveau jeton : $Token" -ForegroundColor Yellow
  Write-Host "À enregistrer sur Vercel :"
  Write-Host "  vercel env add OLLAMA_TUNNEL_URL production --value `"$url`" --force"
  Write-Host "  vercel env add OLLAMA_TUNNEL_TOKEN production --value `"<jeton>`" --sensitive --force"
  Write-Host "  vercel deploy --prod"
} else {
  Write-Host "Si l'adresse a changé, mettez à jour OLLAMA_TUNNEL_URL sur Vercel (ou renommez la machine « homecal-ollama » dans Tailscale)."
}
Write-Host "Redémarrez Ollama (icône → Quit, puis relancer) pour appliquer les réglages GPU."
