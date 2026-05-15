// 读回生成的 PSD，打印图层树，并把整体手工合成出来便于肉眼校验
'use strict';
const fs = require('fs');
const path = require('path');
require('ag-psd/initialize-canvas');
const agPsd = require('ag-psd');
const { createCanvas } = require('canvas');

const psdPath = process.argv[2] || path.join(__dirname, 'project/ui/MyUI.psd');
const buf = fs.readFileSync(psdPath);
const psd = agPsd.readPsd(buf);

console.log('PSD canvas:', psd.width, 'x', psd.height);

function walk(layers, depth) {
    for (const l of layers) {
        const r = `[${l.left},${l.top}-${l.right},${l.bottom}]`;
        const tag = l.children ? 'GROUP' : (l.canvas ? 'IMG' : '----');
        console.log('  '.repeat(depth) + `${tag} ${l.name} ${r}`);
        if (l.children) walk(l.children, depth + 1);
    }
}
walk(psd.children || [], 0);

const c = createCanvas(psd.width, psd.height);
const ctx = c.getContext('2d');
function draw(arr) {
    for (const l of arr) {
        if (l.canvas) ctx.drawImage(l.canvas, l.left, l.top);
        if (l.children) draw(l.children);
    }
}
draw(psd.children || []);
const outPng = psdPath.replace(/\.psd$/, '.handcomposite.png');
fs.writeFileSync(outPng, c.toBuffer('image/png'));
console.log('wrote', outPng);
