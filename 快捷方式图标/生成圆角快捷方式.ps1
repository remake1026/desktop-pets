param(
  [int] $Radius = 85
)

Add-Type -AssemblyName System.Drawing

$desktop = [Environment]::GetFolderPath('Desktop')
$assetDir = $PSScriptRoot
$projectDir = Split-Path -Parent $assetDir
$projectName = 'line puppy'
$sourcePath = Join-Path $assetDir '图标icon.png'
$roundedPngPath = Join-Path $assetDir "$projectName-rounded-${Radius}px.png"
$iconPath = Join-Path $assetDir "$projectName-rounded-${Radius}px.ico"
$shortcutPath = Join-Path $desktop "$projectName.lnk"
$launcher = Get-ChildItem -LiteralPath $projectDir -Filter '*.cmd' | Select-Object -First 1

if (!$launcher) {
  throw "Cannot find launcher .cmd under: $projectDir"
}

New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

function New-RoundedBitmap {
  param(
    [System.Drawing.Bitmap] $Source,
    [int] $Width,
    [int] $Height,
    [int] $Radius
  )

  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = [Math]::Max(1, $Radius * 2)
  $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
  $path.AddArc($Width - $diameter - 1, 0, $diameter, $diameter, 270, 90)
  $path.AddArc($Width - $diameter - 1, $Height - $diameter - 1, $diameter, $diameter, 0, 90)
  $path.AddArc(0, $Height - $diameter - 1, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  $graphics.SetClip($path)
  $graphics.DrawImage($Source, 0, 0, $Width, $Height)
  $graphics.ResetClip()
  $graphics.Dispose()
  $path.Dispose()

  return $bitmap
}

function Get-PngBytes {
  param([System.Drawing.Bitmap] $Bitmap)

  $stream = New-Object System.IO.MemoryStream
  $Bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = [byte[]]$stream.ToArray()
  $stream.Dispose()

  return ,$bytes
}

$source = [System.Drawing.Image]::FromFile($sourcePath)
$sourceBitmap = New-Object System.Drawing.Bitmap $source
$rounded = New-RoundedBitmap -Source $sourceBitmap -Width $sourceBitmap.Width -Height $sourceBitmap.Height -Radius $Radius
$rounded.Save($roundedPngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$sizes = @(256, 128, 64, 48, 32, 16)
$entries = New-Object System.Collections.Generic.List[object]
foreach ($size in $sizes) {
  $scaledRadius = [Math]::Max(1, [int][Math]::Round($Radius * $size / [Math]::Max($sourceBitmap.Width, $sourceBitmap.Height)))
  $iconBitmap = New-RoundedBitmap -Source $sourceBitmap -Width $size -Height $size -Radius $scaledRadius
  $bytes = [byte[]](Get-PngBytes -Bitmap $iconBitmap)
  $entries.Add([PSCustomObject]@{ Size = $size; Bytes = $bytes }) | Out-Null
  $iconBitmap.Dispose()
}

$fileStream = [System.IO.File]::Create($iconPath)
$writer = [System.IO.BinaryWriter]::new($fileStream)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$entries.Count)

$offset = 6 + (16 * $entries.Count)
foreach ($entry in $entries) {
  $sizeByte = if ($entry.Size -eq 256) { 0 } else { $entry.Size }
  $writer.Write([Byte]$sizeByte)
  $writer.Write([Byte]$sizeByte)
  $writer.Write([Byte]0)
  $writer.Write([Byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$entry.Bytes.Length)
  $writer.Write([UInt32]$offset)
  $offset += $entry.Bytes.Length
}
foreach ($entry in $entries) {
  $writer.Write([byte[]]$entry.Bytes)
}
$writer.Dispose()
$fileStream.Dispose()

$source.Dispose()
$sourceBitmap.Dispose()
$rounded.Dispose()

$loadedIcon = New-Object System.Drawing.Icon $iconPath
$loadedIcon.Dispose()

if (Test-Path -LiteralPath $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath -Force
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher.FullName
$shortcut.WorkingDirectory = $projectDir
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = 'Start desktop pet'
$shortcut.WindowStyle = 7
$shortcut.Save()

Get-Item -LiteralPath $roundedPngPath, $iconPath, $shortcutPath | Select-Object FullName, Length, LastWriteTime
