$ErrorActionPreference = "Stop"
$P = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $P
npm ci
