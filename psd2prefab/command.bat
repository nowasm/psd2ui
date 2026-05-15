@echo off
setlocal

cd /d %~dp0

if not exist node_modules if not exist ..\node_modules (
    echo.
    echo [psd2prefab] node_modules 不存在，请先在仓库根目录执行: npm install
    echo.
    pause
    exit /b 1
)

if not exist dist\index.js (
    echo.
    echo [psd2prefab] dist/index.js 不存在，需要先构建。
    echo [psd2prefab] 在本目录执行: npm run build
    echo.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo [psd2prefab] 找不到 node，请先安装 Node.js 18+
    echo.
    pause
    exit /b 1
)

node dist/index.js %*

pause
exit /b %ERRORLEVEL%
