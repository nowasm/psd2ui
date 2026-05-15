#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -d node_modules ] && [ ! -d ../node_modules ]; then
    echo
    echo "[psd2prefab] node_modules 不存在，请先在仓库根目录执行: npm install"
    echo
    exit 1
fi

if [ ! -f dist/index.js ]; then
    echo
    echo "[psd2prefab] dist/index.js 不存在，需要先构建。"
    echo "[psd2prefab] 在本目录执行: npm run build"
    echo
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo
    echo "[psd2prefab] 找不到 node，请先安装 Node.js 18+"
    echo
    exit 1
fi

node dist/index.js "$@"
