# Push local commits to GitHub (run from repo root: .\scripts\push-github.ps1)
# Requires: Git for Windows in PATH, and credentials (HTTPS token or SSH).
param(
  [string]$Remote = "origin",
  [string]$Branch = "main",
  [string]$CommitMessage = "feat: PDF review alignment — health/metrics auth bypass, proxy body, metrics, Dependabot, CodeQL"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  Write-Error "找不到 git。請安裝 Git for Windows：https://git-scm.com/download/win"
  exit 1
}

& git status
$changes = & git status --porcelain
if ([string]::IsNullOrWhiteSpace($changes)) {
  Write-Host "沒有未提交變更。若已提交，直接 push："
  & git push $Remote $Branch
  exit $LASTEXITCODE
}

& git add -A
& git commit -m $CommitMessage
& git push $Remote $Branch
