param (
    [string]$Message = "",
    [switch]$Build
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Icyerekezo OMS - GitHub & Hostinger Deploy  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Build assets if requested
if ($Build) {
    Write-Host "[1/4] Building production assets (Vite)..." -ForegroundColor Yellow
    npm run build
}

# 2. Stage and commit changes if message is provided
$status = git status --porcelain
if ($status) {
    if ($Message -ne "") {
        Write-Host "[2/4] Staging and committing changes..." -ForegroundColor Yellow
        git add -A
        git commit -m "$Message"
    } else {
        Write-Host "Notice: Uncommitted changes detected. Committing with default message..." -ForegroundColor Yellow
        git add -A
        git commit -m "update: deploy latest changes $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
} else {
    Write-Host "[2/4] Working tree clean, proceeding to push..." -ForegroundColor Green
}

# 3. Push to GitHub
Write-Host "[3/4] Pushing to GitHub (origin/main)..." -ForegroundColor Yellow
git push origin main
Write-Host "GitHub push completed successfully!" -ForegroundColor Green

# 4. Deploy to Hostinger via SSH
Write-Host "[4/4] Updating Hostinger server..." -ForegroundColor Yellow
$remoteCommands = @'
cd domains/icyerekezooms.com/public_html
echo "--> Pulling latest changes from GitHub..."
git pull origin main
echo "--> Optimizing Laravel caches..."
php artisan optimize:clear
echo "--> Deployment complete on Hostinger!"
'@

ssh hostinger $remoteCommands

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " SUCCESS: Synchronized to GitHub and Hostinger!" -ForegroundColor Green
Write-Host " Live site: https://icyerekezooms.com" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
