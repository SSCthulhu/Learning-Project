# Records every Nim line into its own mp3. Your ElevenLabs key stays on this computer.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$linesPath = Join-Path $here 'nim-lines.json'
if (-not (Test-Path $linesPath)) {
  Write-Host ''
  Write-Host 'I cannot find nim-lines.json in this folder.'
  Write-Host 'Save Record-Nim.ps1 and nim-lines.json in the same folder, then try again.'
  Write-Host ''
  exit 1
}

$lines = Get-Content -Raw -Encoding UTF8 $linesPath | ConvertFrom-Json
$chars = 0
foreach ($line in $lines) { $chars += $line.Length }

Write-Host ''
Write-Host 'This will record every sentence Nim says.'
Write-Host "There are $($lines.Count) sentences, about $chars characters."
Write-Host 'ElevenLabs will use that many characters from your account.'
Write-Host 'Leave this window open until it says Done. That can take a while.'
Write-Host ''
Write-Host 'Paste the same API key as before. If you did not save it, create a new one.'
Write-Host 'Text to Speech must be set to Access.'
Write-Host 'https://elevenlabs.io/app/settings/api-keys'
Write-Host ''
$key = (Read-Host 'Paste your API key and press Enter').Trim().Trim('"')
Write-Host ''
Write-Host 'Paste Nim''s voice ID again. It is a long code, not the word Nim.'
Write-Host ''
$voiceId = (Read-Host 'Paste the voice ID and press Enter').Trim().Trim('"')
Write-Host ''
Write-Host 'Press Enter to start.'
[void](Read-Host)

if ($key.Length -lt 10) {
  Write-Host 'That does not look like an API key. Copy the key from the ElevenLabs page and run this again.'
  exit 1
}
if ($voiceId -notmatch '^[A-Za-z0-9]{15,}$') {
  Write-Host 'That does not look like a voice ID. In Voices, click Nim, then Copy voice ID.'
  exit 1
}

Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(120)
[void]$client.DefaultRequestHeaders.TryAddWithoutValidation('xi-api-key', $key)
[void]$client.DefaultRequestHeaders.TryAddWithoutValidation('Accept', 'audio/mpeg')

$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Nim-Voice'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding $false
$model = 'eleven_v4'
$failed = New-Object System.Collections.Generic.List[string]
$index = @{}

function Name-For([string]$text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $hash = $sha.ComputeHash($bytes)
  $hex = -join ($hash | ForEach-Object { $_.ToString('x2') })
  return $hex.Substring(0, 16) + '.mp3'
}

function Save-Index {
  $json = $index | ConvertTo-Json -Depth 4
  [System.IO.File]::WriteAllText((Join-Path $out 'index.json'), $json, $utf8)
}

function Explain-Failure([int]$code, [string]$detail) {
  $text = $detail.ToLower()
  if ($code -eq 401) {
    return 'That API key was not accepted. Create a new key, set Text to Speech to Access, and run this again.'
  }
  if ($code -eq 403 -or $text -match 'permission|missing_permissions|unauthorized') {
    return 'This key is not allowed to make speech. Create a new key and set Text to Speech to Access.'
  }
  if ($text -match 'quota|credit|limit exceeded|insufficient') {
    return 'Your ElevenLabs account is out of characters. Stop here and tell me. The sentences already saved are kept.'
  }
  if ($text -match 'voice_not_found|voice not found') {
    return 'ElevenLabs could not find that voice. Click Nim, then Copy voice ID, and run this again.'
  }
  if ($detail.Length -gt 500) { $detail = $detail.Substring(0, 500) }
  return "ElevenLabs said no. $detail"
}

function Send-Line([string]$text, [string]$modelId) {
  $payload = @{
    text = $text
    model_id = $modelId
    voice_settings = @{
      stability = 0.5
      similarity_boost = 0.75
      speed = 1.0
    }
  } | ConvertTo-Json -Compress -Depth 4
  $content = New-Object System.Net.Http.StringContent($payload, [Text.Encoding]::UTF8, 'application/json')
  $url = "https://api.elevenlabs.io/v1/text-to-speech/$voiceId"
  $response = $client.PostAsync($url, $content).GetAwaiter().GetResult()
  $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
  $code = [int]$response.StatusCode
  $detail = ''
  if (-not $response.IsSuccessStatusCode) {
    $detail = [Text.Encoding]::UTF8.GetString($bytes)
  }
  return @{ Code = $code; Bytes = $bytes; Detail = $detail }
}

$i = 0
foreach ($line in $lines) {
  $i += 1
  $name = Name-For $line
  $dest = Join-Path $out $name
  if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt 500)) {
    $index[$line] = $name
    Write-Host "$i of $($lines.Count) already saved"
    continue
  }
  $ok = $false
  for ($try = 1; $try -le 4; $try++) {
    $result = Send-Line $line $model
    if ($result.Code -eq 200 -and $result.Bytes.Length -gt 500) {
      [System.IO.File]::WriteAllBytes($dest, $result.Bytes)
      $ok = $true
      break
    }
    $detail = [string]$result.Detail
    if ($model -eq 'eleven_v4' -and $detail -match 'model') {
      $model = 'eleven_multilingual_v2'
      Write-Host 'Switching to the other Nim voice model.'
      continue
    }
    if ($result.Code -eq 429 -or $result.Code -ge 500) {
      Write-Host "Waiting, then trying sentence $i again."
      Start-Sleep -Seconds (8 * $try)
      continue
    }
    Write-Host ''
    Write-Host (Explain-Failure $result.Code $detail)
    Write-Host "Stopped at sentence $i of $($lines.Count)."
    Save-Index
    exit 1
  }
  if (-not $ok) {
    $failed.Add($line)
    Write-Host "Skipped sentence $i after several tries. The rest will still be recorded."
    continue
  }
  $index[$line] = $name
  Write-Host "$i of $($lines.Count)"
  if (($i % 25) -eq 0) { Save-Index }
  Start-Sleep -Milliseconds 300
}

Save-Index
Write-Host ''
if ($failed.Count -gt 0) {
  [System.IO.File]::WriteAllLines((Join-Path $out 'not-recorded.txt'), $failed, $utf8)
  Write-Host "Done, except $($failed.Count) sentences. Run this again to try those."
} else {
  Write-Host 'Done.'
}
Write-Host 'The recordings are in a folder on your Desktop called Nim-Voice.'
Write-Host 'Right-click that folder, choose Send to, then Compressed (zipped) folder.'
Write-Host 'Drag that zip into the chat.'
Write-Host ''
