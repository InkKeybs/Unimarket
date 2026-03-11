@echo off
REM run-local.bat — Start MongoDB, backend and frontend in separate PowerShell windows bound to localhost
REM Place this file in the project root (next to the `client` and `server` folders).

REM Start MongoDB (ensure data directory exists)
start "BuyNSell - MongoDB" powershell -NoProfile -NoExit -Command "if (!(Test-Path 'C:\data\db')) { New-Item -ItemType Directory -Path 'C:\data\db' -Force }; & 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe' --dbpath 'C:\data\db'"

REM Wait a few seconds for MongoDB to start
timeout /t 5 /nobreak

REM Start Server (uses server's npm start)
start "BuyNSell - Server" powershell -NoProfile -NoExit -Command "Set-Location -LiteralPath '%~dp0server'; npm start"

REM Start Client (force HOST to localhost and ensure .env exists)
start "BuyNSell - Client" powershell -NoProfile -NoExit -Command "$env:HOST='127.0.0.1'; Set-Location -LiteralPath '%~dp0client'; if (!(Test-Path .env)) { Copy-Item -Path .env.example -Destination .env -ErrorAction SilentlyContinue }; npm start"

echo Launched MongoDB, Server and Client in separate windows.
exit /B 0
