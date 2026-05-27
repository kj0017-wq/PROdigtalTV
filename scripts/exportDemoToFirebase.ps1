param(
  [Parameter(Mandatory = $true)]
  [string]$ServiceAccount,

  [string]$DataFile = ".\.secrets\demoDatabase-export.json",

  [string]$AdminEmail = "",

  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function ConvertTo-Base64Url([byte[]]$Bytes) {
  return [Convert]::ToBase64String($Bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Convert-TextToBase64Url([string]$Text) {
  return ConvertTo-Base64Url ([System.Text.Encoding]::UTF8.GetBytes($Text))
}

function ConvertTo-FirestoreValue($Value) {
  if ($null -eq $Value) {
    return @{ nullValue = $null }
  }
  if ($Value -is [bool]) {
    return @{ booleanValue = $Value }
  }
  if ($Value -is [int] -or $Value -is [long]) {
    return @{ integerValue = "$Value" }
  }
  if ($Value -is [double] -or $Value -is [decimal] -or $Value -is [single]) {
    return @{ doubleValue = [double]$Value }
  }
  if ($Value -is [array]) {
    return @{ arrayValue = @{ values = @($Value | ForEach-Object { ConvertTo-FirestoreValue $_ }) } }
  }
  if ($Value -is [pscustomobject]) {
    $fields = @{}
    foreach ($property in $Value.PSObject.Properties) {
      if ($property.Name -ne "sourceUrl" -and $property.Value -ne $null) {
        $fields[$property.Name] = ConvertTo-FirestoreValue $property.Value
      }
    }
    return @{ mapValue = @{ fields = $fields } }
  }
  return @{ stringValue = "$Value" }
}

function ConvertTo-FirestoreFields($Record) {
  $fields = @{}
  foreach ($property in $Record.PSObject.Properties) {
    if ($property.Name -in @("id", "sourceUrl")) {
      continue
    }
    if ($property.Value -ne $null) {
      $fields[$property.Name] = ConvertTo-FirestoreValue $property.Value
    }
  }
  $fields["demo"] = @{ booleanValue = $true }
  $fields["importedAt"] = @{ stringValue = (Get-Date).ToUniversalTime().ToString("o") }
  return $fields
}

$serviceAccountPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $ServiceAccount))
$dataFilePath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $DataFile))

$serviceAccountJson = Get-Content -LiteralPath $serviceAccountPath -Raw | ConvertFrom-Json
$demoDatabase = Get-Content -LiteralPath $dataFilePath -Raw | ConvertFrom-Json
$projectId = $serviceAccountJson.project_id

if ($DryRun) {
  $count = 0
  foreach ($collection in $demoDatabase.PSObject.Properties) {
    if ($collection.Value -is [array]) {
      $count += $collection.Value.Count
    }
  }
  Write-Output (@{ projectId = $projectId; dryRun = $true; documents = $count; dataFile = $dataFilePath } | ConvertTo-Json -Depth 5)
  exit 0
}

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$jwtHeader = Convert-TextToBase64Url (@{ alg = "RS256"; typ = "JWT" } | ConvertTo-Json -Compress)
$jwtPayload = Convert-TextToBase64Url (@{
  iss = $serviceAccountJson.client_email
  scope = "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase"
  aud = "https://oauth2.googleapis.com/token"
  iat = $now
  exp = $now + 3600
} | ConvertTo-Json -Compress)
$signingInput = "$jwtHeader.$jwtPayload"

$privateKey = $serviceAccountJson.private_key -replace "-----BEGIN PRIVATE KEY-----", "" -replace "-----END PRIVATE KEY-----", "" -replace "\s", ""
$privateKeyBytes = [Convert]::FromBase64String($privateKey)
$rsa = [System.Security.Cryptography.RSA]::Create()
$bytesRead = 0
$rsa.ImportPkcs8PrivateKey($privateKeyBytes, [ref]$bytesRead)
$signatureBytes = $rsa.SignData([System.Text.Encoding]::UTF8.GetBytes($signingInput), [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$jwt = "$signingInput.$(ConvertTo-Base64Url $signatureBytes)"

$tokenResponse = Invoke-RestMethod -Method Post -Uri "https://oauth2.googleapis.com/token" -ContentType "application/x-www-form-urlencoded" -Body @{
  grant_type = "urn:ietf:params:oauth:grant-type:jwt-bearer"
  assertion = $jwt
}
$accessToken = $tokenResponse.access_token

$writes = New-Object System.Collections.Generic.List[object]
foreach ($collection in $demoDatabase.PSObject.Properties) {
  if (-not ($collection.Value -is [array])) {
    continue
  }
  foreach ($record in $collection.Value) {
    if (-not $record.id) {
      continue
    }
    $writes.Add(@{
      update = @{
        name = "projects/$projectId/databases/(default)/documents/$($collection.Name)/$($record.id)"
        fields = ConvertTo-FirestoreFields $record
      }
    })
  }
}

$commitUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents:commit"
$imported = 0
for ($index = 0; $index -lt $writes.Count; $index += 450) {
  $end = [Math]::Min($index + 449, $writes.Count - 1)
  $chunk = @($writes[$index..$end])
  $body = @{ writes = $chunk } | ConvertTo-Json -Depth 100
  Invoke-RestMethod -Method Post -Uri $commitUrl -Headers @{ Authorization = "Bearer $accessToken" } -ContentType "application/json" -Body $body | Out-Null
  $imported += $chunk.Count
}

Write-Output (@{ projectId = $projectId; importedDocuments = $imported; adminEmail = $AdminEmail } | ConvertTo-Json -Depth 5)
