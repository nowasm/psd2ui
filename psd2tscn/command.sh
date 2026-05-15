#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -d node_modules ] && [ ! -d ../node_modules ]; then
    echo
    echo "[psd2tscn] node_modules 不存在，请先在仓库根目录执行: npm install"
    echo
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo
    echo "[psd2tscn] 找不到 node，请先安装 Node.js 16+"
    echo
    exit 1
fi

node psd2tscn.js "$@"
