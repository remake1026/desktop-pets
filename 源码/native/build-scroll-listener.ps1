$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
$source = Join-Path $PSScriptRoot 'ScrollListener.cs'
$output = Join-Path $PSScriptRoot 'ScrollListener.exe'
& $compiler /nologo /target:exe /platform:anycpu /optimize+ /reference:System.Windows.Forms.dll "/out:$output" $source
if ($LASTEXITCODE -ne 0) { throw 'ScrollListener compilation failed.' }
$musicSource = Join-Path $PSScriptRoot 'MusicListener.cs'
$audioSource = Join-Path $PSScriptRoot 'AudioSessions.cs'
$musicOutput = Join-Path $PSScriptRoot 'MusicListener.exe'
$winrt = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\System.Runtime.WindowsRuntime.dll'
& $compiler /nologo /target:exe /platform:anycpu /optimize+ "/reference:$winrt" "/out:$musicOutput" $musicSource $audioSource
if ($LASTEXITCODE -ne 0) { throw 'MusicListener compilation failed.' }
