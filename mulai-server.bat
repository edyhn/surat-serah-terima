@echo off
cd /d "C:\Users\ASUS\OneDrive\Documents\Default Project"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($c) { Write-Host 'Server sudah berjalan di http://localhost:3000'; exit } Start-Process -FilePath 'node' -ArgumentList 'server.js' -WindowStyle Hidden; Start-Sleep -Seconds 2; Write-Host 'Server berjalan di http://localhost:3000'"
