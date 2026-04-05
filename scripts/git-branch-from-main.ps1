# Create a feature branch from the latest origin/main (run from repo root).
# Usage: .\scripts\git-branch-from-main.ps1 [-BranchName feat/pdf-review-port]
param(
  [string]$BranchName = "feat/pdf-review-port"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  Write-Error "git not found. Install Git for Windows and reopen the terminal."
  exit 1
}

Write-Host "Fetching origin..."
git fetch origin main

Write-Host "Checking out main and fast-forwarding..."
git checkout main
git pull origin main --ff-only

Write-Host "Creating branch $BranchName from main..."
git checkout -b $BranchName

Write-Host "Done. Current branch:"
git branch --show-current
git status -sb
