@echo off
setlocal

cd /d %~dp0

if not exist node_modules if not exist ..\node_modules (
    echo.
    echo [prefab2psd] node_modules 不存在，请先在仓库根目录执行: npm install
    echo.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo [prefab2psd] 找不到 node，请先安装 Node.js 16+
    echo.
    pause
    exit /b 1
)

node prefab2psd.js %*

pause
exit /b %ERRORLEVEL%
