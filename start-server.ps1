Write-Host "Starting API server with MongoDB Database Tools..." -ForegroundColor Green
$env:PATH += ";C:\Program Files\MongoDB\Tools\100\bin"
Write-Host "MongoDB tools added to PATH" -ForegroundColor Yellow
npm run dev