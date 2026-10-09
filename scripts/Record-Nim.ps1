# Records every Nim line into its own mp3. Your ElevenLabs key stays on this computer.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$linesPath = Join-Path $here 'nim-lines.json'
if (-not (Test-Path $linesPath)) {
  Write-Host ''
  Write-Host 'I cannot find nim-lines.json in this folder.'
  Write-Host 'Save Record-Nim.bat, Record-Nim.ps1, and nim-lines.json in the same folder, then try again.'
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
Write-Host 'First, open this page and create a key, then copy it:'
Write-Host 'https://elevenlabs.io/app/settings/api-keys'
Write-Host ''
$key = Read-Host 'Paste your API key and press Enter'
Write-Host ''
Write-Host 'Next, in ElevenLabs click Voices, then My Voices, then Nim.'
Write-Host 'Click Copy voice ID. It is a long code, not the word Nim.'
Write-Host ''
$voiceId = Read-Host 'Paste the voice ID and press Enter'
Write-Host ''
Write-Host 'Press Enter to start.'
[void](Read-Host)

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
  $json = $index | ConvertTo-Json -Depth 3
  [System.IO.File]::WriteAllText((Join-Path $out 'index.json'), $json, $utf8)
}

$i = 0
foreach ($line in $lines) {
  $i += 1
  $name = Name-For $line
  $dest = Join-Path $out $name
  if (Test-Path $dest) {
    $index[$line] = $name
    Write-Host "$i of $($lines.Count) already saved"
    continue
  }
  $safe = $line.Replace('\', '\\').Replace('"', '\"')
  $body = "{`"text`":`"$safe`",`"model_id`":`"$model`",`"voice_settings`":{`"stability`":0.5,`"similarity_boost`":0.75,`"style`":0.0,`"use_speaker_boost`":true,`"speed`":1.0}}"
  $ok = $false
  for ($try = 1; $try -le 5; $try++) {
    $tmp = Join-Path $out ($name + '.part')
    try {
      Invoke-WebRequest -Method Post -Uri "https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128" -Headers @{ 'xi-api-key' = $key; 'Content-Type' = 'application/json'; 'Accept' = 'audio/mpeg' } -Body $body -OutFile $tmp -UseBasicParsing | Out-Null
      Move-Item -Force $tmp $dest
      $ok = $true
      break
    } catch {
      if (Test-Path $tmp) { Remove-Item -Force $tmp }
      $code = 0
      $detail = $_.Exception.Message
      if ($_.Exception.Response) {
        $code = [int]$_.Exception.Response.StatusCode
        try {
          $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
          $detail = $reader.ReadToEnd()
          $reader.Close()
        } catch {}
      }
      if ($code -eq 401) {
        Write-Host ''
        Write-Host 'That API key was not accepted. Create a new key and run this again.'
        Write-Host 'Lines already saved are still in the Nim-Voice folder on your Desktop.'
        exit 1
      }
      if ($model -eq 'eleven_v4' -and $detail -match 'model') {
        $model = 'eleven_multilingual_v2'
        $body = "{`"text`":`"$safe`",`"model_id`":`"$model`",`"voice_settings`":{`"stability`":0.5,`"similarity_boost`":0.75,`"style`":0.0,`"use_speaker_boost`":true,`"speed`":1.0}}"
        continue
      }
      if ($code -eq 429 -or $code -ge 500 -or $code -eq 0) {
        Write-Host "Waiting, then trying sentence $i again."
        Start-Sleep -Seconds (8 * $try)
        continue
      }
      Write-Host "Could not record sentence $i."
      Write-Host $detail
      break
    }
  }
  if ($ok) {
    $index[$line] = $name
    Write-Host "$i of $($lines.Count)"
    if (($i % 25) -eq 0) { Save-Index }
    Start-Sleep -Milliseconds 350
  } else {
    $failed.Add($line)
  }
}

Save-Index
if ($failed.Count -gt 0) {
  [System.IO.File]::WriteAllLines((Join-Path $out 'not-recorded.txt'), $failed, $utf8)
  Write-Host ''
  Write-Host "$($failed.Count) sentences did not record. Run this again and it will try only those."
} else {
  Write-Host ''
  Write-Host 'Done.'
}
Write-Host 'The recordings are in a folder on your Desktop called Nim-Voice.'
Write-Host 'Right-click that folder, choose Send to, then Compressed (zipped) folder.'
Write-Host 'Drag that zip into the chat.'
Write-Host ''
