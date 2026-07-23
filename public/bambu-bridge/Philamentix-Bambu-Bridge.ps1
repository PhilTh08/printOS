param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$BridgeUri
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Windows.Forms

function Show-BridgeError([string]$Message) {
  [System.Windows.Forms.MessageBox]::Show(
    $Message,
    "Philamentix Bambu-Bridge",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  ) | Out-Null
}

function Find-BambuStudio {
  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Bambu Studio\bambu-studio.exe",
    "$env:ProgramFiles\Bambu Studio\bambu-studio.exe",
    "${env:ProgramFiles(x86)}\Bambu Studio\bambu-studio.exe",
    "$env:LOCALAPPDATA\Programs\Bambu Studio\BambuStudio.exe",
    "$env:ProgramFiles\Bambu Studio\BambuStudio.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  $appPathKeys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\bambu-studio.exe",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\bambu-studio.exe"
  )

  foreach ($key in $appPathKeys) {
    try {
      $value = (Get-ItemProperty -LiteralPath $key -ErrorAction Stop).'(default)'
      if ($value -and (Test-Path -LiteralPath $value)) {
        return $value
      }
    } catch {}
  }

  return $null
}

try {
  $uri = [Uri]$BridgeUri
  if ($uri.Scheme -ne "philamentix-bambu" -or $uri.Host -ne "open") {
    throw "Ungültiger Bridge-Aufruf."
  }

  $query = [System.Web.HttpUtility]::ParseQueryString($uri.Query)
  $sourceUrl = $query.Get("url")
  $fileName = [IO.Path]::GetFileName($query.Get("name"))

  if ([string]::IsNullOrWhiteSpace($sourceUrl) -or [string]::IsNullOrWhiteSpace($fileName)) {
    throw "Datei oder Downloadadresse fehlt."
  }

  $downloadUri = [Uri]$sourceUrl
  if ($downloadUri.Scheme -ne "https") {
    throw "Aus Sicherheitsgründen sind nur HTTPS-Downloads erlaubt."
  }

  $extension = [IO.Path]::GetExtension($fileName).ToLowerInvariant()
  if ($extension -notin @(".stl", ".3mf")) {
    throw "Die Bambu-Bridge unterstützt nur STL- und 3MF-Dateien."
  }

  $answer = [System.Windows.Forms.MessageBox]::Show(
    "Datei '$fileName' von $($downloadUri.Host) herunterladen und in Bambu Studio öffnen?",
    "Philamentix Bambu-Bridge",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
  )

  if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) {
    exit 0
  }

  $targetDirectory = Join-Path $env:LOCALAPPDATA "Philamentix\BambuBridge\Downloads"
  New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
  $targetPath = Join-Path $targetDirectory $fileName

  Invoke-WebRequest -Uri $sourceUrl -OutFile $targetPath -UseBasicParsing

  $bambuStudio = Find-BambuStudio
  if ($bambuStudio) {
    Start-Process -FilePath $bambuStudio -ArgumentList @($targetPath)
  } else {
    Start-Process -FilePath $targetPath
  }
} catch {
  Show-BridgeError $_.Exception.Message
  exit 1
}
