@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if (-not $c) { Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory 'C:\Users\ASUS\OneDrive\Documents\Default Project' -WindowStyle Hidden }"
