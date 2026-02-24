@echo off
echo --- Starting Ngrok Tunnel ---
echo Cleaning up existing ngrok sessions...
taskkill /f /im ngrok.exe 2>nul
echo.
echo Starting new tunnel on port 8080...
npx ngrok http 8080
pause
