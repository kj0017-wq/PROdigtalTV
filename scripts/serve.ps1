param(
  [int]$Port = 4173,
  [string]$RootFolder = "dist"
)

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$root = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $RootFolder))
if (-not $root.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Der Server darf nur Projektdateien ausliefern."
}

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
}
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "PROdigitalTV preview: http://localhost:$Port"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $path = $context.Request.Url.AbsolutePath.TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($path)) { $path = "index.html" }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $path))
    if (-not $file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
      $file = Join-Path $root "index.html"
    }
    $extension = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
    $context.Response.ContentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}
