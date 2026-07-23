$ErrorActionPreference = "Stop"

$installDirectory = Join-Path $env:LOCALAPPDATA "Philamentix\BambuBridge"
New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null

$sourceHandler = Join-Path $PSScriptRoot "Philamentix-Bambu-Bridge.ps1"
$targetHandler = Join-Path $installDirectory "Philamentix-Bambu-Bridge.ps1"
Copy-Item -LiteralPath $sourceHandler -Destination $targetHandler -Force

$protocolRoot = "HKCU:\Software\Classes\philamentix-bambu"
New-Item -Path $protocolRoot -Force | Out-Null
Set-Item -Path $protocolRoot -Value "URL:Philamentix Bambu-Bridge"
New-ItemProperty -Path $protocolRoot -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
New-Item -Path "$protocolRoot\DefaultIcon" -Force | Out-Null
Set-Item -Path "$protocolRoot\DefaultIcon" -Value "powershell.exe,0"
New-Item -Path "$protocolRoot\shell\open\command" -Force | Out-Null
$command = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $targetHandler + '" "%1"'
Set-Item -Path "$protocolRoot\shell\open\command" -Value $command

Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show(
  "Die Philamentix Bambu-Bridge wurde installiert. STL- und 3MF-Dateien können jetzt direkt aus Philamentix geöffnet werden.",
  "Philamentix Bambu-Bridge",
  [System.Windows.Forms.MessageBoxButtons]::OK,
  [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
