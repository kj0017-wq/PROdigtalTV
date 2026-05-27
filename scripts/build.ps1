$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$dist = [System.IO.Path]::GetFullPath((Join-Path $root "dist"))

if (-not $dist.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Das Build-Ziel liegt ausserhalb des Projektordners."
}

if (Test-Path -LiteralPath $dist) {
  Remove-Item -LiteralPath $dist -Recurse -Force
}

New-Item -ItemType Directory -Path $dist | Out-Null
Copy-Item -Path (Join-Path $root "public\*") -Destination $dist -Recurse
Copy-Item -Path (Join-Path $root "src") -Destination $dist -Recurse
Write-Output "PROdigitalTV build ready in dist/"
