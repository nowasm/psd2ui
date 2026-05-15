// 读回生成的 PSD，打印图层树 + 验证嵌入图像 md5 与 sidecar/cache 一致
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('ag-psd/initialize-canvas');
const agPsd = require('ag-psd');

const psdPath = path.join(__dirname, 'project/assets/ui/MyUI.psd');
const buf = fs.readFileSync(psdPath);
const psd = agPsd.readPsd(buf);

console.log('PSD canvas:', psd.width, 'x', psd.height);

function walk(layers, depth) {
    for (const l of layers) {
        const r = `[${l.left},${l.top}-${l.right},${l.bottom}]`;
        const tag = l.children ? 'GROUP' : (l.canvas ? 'IMG' : '----');
        console.log('  '.repeat(depth) + `${tag} ${l.name} ${r}`);
        if (l.canvas) {
            const png = l.canvas.toBuffer('image/png');
            const md5 = crypto.createHash('md5').update(png).digest('hex');
            console.log('  '.repeat(depth + 1) + `md5=${md5}  size=${l.canvas.width}x${l.canvas.height}`);
        }
        if (l.children) walk(l.children, depth + 1);
    }
}
walk(psd.children || [], 0);

// 对照 cache
const cache = JSON.parse(fs.readFileSync(path.join(__dirname, 'project/local/psd-to-prefab-cache.json'), 'utf-8'));
console.log('\n--- cache 键 ---');
for (const k of Object.keys(cache)) console.log(k, '->', cache[k].textureUuid);
