// 生成最小化测试 fixture：assets/ui/btn.png + .meta + MyUI.prefab + .meta
// 用法: node test/build-fixture.js

'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const root = path.join(__dirname, 'project');
const uiDir = path.join(root, 'assets', 'ui');
fs.mkdirSync(uiDir, { recursive: true });
fs.mkdirSync(path.join(root, 'local'), { recursive: true });

// ---- 1. 生成 32x32 红色圆 PNG ----
const c = createCanvas(32, 32);
const ctx = c.getContext('2d');
ctx.fillStyle = '#cc3333';
ctx.beginPath();
ctx.arc(16, 16, 14, 0, Math.PI * 2);
ctx.fill();
fs.writeFileSync(path.join(uiDir, 'btn.png'), c.toBuffer('image/png'));

// ---- 2. btn.png.meta ----
const btnTextureUuid = '11111111-2222-4333-8444-555555555555';
const btnMeta = {
    ver: '1.0.22',
    importer: 'image',
    imported: true,
    uuid: btnTextureUuid,
    files: ['.png', '.json'],
    subMetas: {
        '6c48a': {
            importer: 'texture',
            uuid: `${btnTextureUuid}@6c48a`,
            displayName: 'btn',
            id: '6c48a',
            name: 'texture',
            userData: {
                wrapModeS: 'clamp-to-edge',
                wrapModeT: 'clamp-to-edge',
                imageUuidOrDatabaseUri: btnTextureUuid,
                minfilter: 'linear',
                magfilter: 'linear',
                mipfilter: 'none',
                anisotropy: 0,
                isUuid: true,
            },
        },
        'f9941': {
            importer: 'sprite-frame',
            uuid: `${btnTextureUuid}@f9941`,
            displayName: 'btn',
            id: 'f9941',
            name: 'spriteFrame',
            userData: {
                trimType: 'auto',
                trimThreshold: 1,
                rotated: false,
                offsetX: 0, offsetY: 0,
                trimX: 0, trimY: 0,
                width: 32, height: 32,
                rawWidth: 32, rawHeight: 32,
                borderTop: 4, borderBottom: 4, borderLeft: 4, borderRight: 4,
                packable: true,
                isUuid: true,
                imageUuidOrDatabaseUri: `${btnTextureUuid}@6c48a`,
                atlasUuid: '',
            },
        },
    },
    userData: {
        type: 'sprite-frame',
        hasAlpha: true,
        redirect: `${btnTextureUuid}@f9941`,
    },
};
fs.writeFileSync(path.join(uiDir, 'btn.png.meta'), JSON.stringify(btnMeta, null, 2));

// ---- 3. MyUI.prefab (Cocos 3.4+ 格式) ----
// 节点结构:
//   MyUI (750x1334, anchor=0.5,0.5)
//     ├─ Bg (cc.Sprite, 600x800)
//     └─ OkBtn (cc.Button, 200x80, anchor=0.5,0.5)
//          └─ Label (cc.Label "OK")

const SF = { __uuid__: `${btnTextureUuid}@f9941`, __expectedType__: 'cc.SpriteFrame' };

const arr = [];

// 0: cc.Prefab
arr.push({
    __type__: 'cc.Prefab',
    _name: '',
    _objFlags: 0,
    _native: '',
    data: { __id__: 1 },
    optimizationPolicy: 0,
    asyncLoadAssets: false,
    persistent: false,
});

// 1: root cc.Node MyUI
arr.push({
    __type__: 'cc.Node',
    _name: 'MyUI',
    _objFlags: 0,
    _parent: null,
    _children: [{ __id__: 5 }, { __id__: 9 }],
    _active: true,
    _components: [{ __id__: 2 }],
    _prefab: { __id__: 18 },
    _lpos: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _layer: 33554432,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '',
});
// 2: root UITransform
arr.push({
    __type__: 'cc.UITransform',
    _name: '',
    _objFlags: 0,
    node: { __id__: 1 },
    _enabled: true,
    _contentSize: { __type__: 'cc.Size', width: 750, height: 1334 },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _id: '',
});

// helper to put _position on _lpos (Cocos uses _lpos in 3.x but legacy _position is also present)
function withPos(node, x, y) {
    node._lpos = { __type__: 'cc.Vec3', x, y, z: 0 };
    node._position = { __type__: 'cc.Vec3', x, y, z: 0 }; // for our reader
    return node;
}
// fix root: make _position present so our buildLayout uses it (it's 0,0 anyway)
arr[1]._position = { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 };

// 3,4 unused (we keep contiguous indices). We'll just have:
// idx 5: Bg node
// idx 6: Bg UITransform
// idx 7: Bg Sprite
// idx 8: Bg PrefabInfo
// idx 9: OkBtn node
// idx 10: OkBtn UITransform
// idx 11: OkBtn Sprite
// idx 12: OkBtn Button
// idx 13: OkBtn PrefabInfo
// idx 14: Label node
// idx 15: Label UITransform
// idx 16: Label cc.Label
// idx 17: Label PrefabInfo
// idx 18: root PrefabInfo

// pad 3, 4 with placeholders
arr.push({ __type__: 'placeholder' });
arr.push({ __type__: 'placeholder' });

// 5: Bg node
arr.push(withPos({
    __type__: 'cc.Node',
    _name: 'Bg',
    _objFlags: 0,
    _parent: { __id__: 1 },
    _children: [],
    _active: true,
    _components: [{ __id__: 6 }, { __id__: 7 }],
    _prefab: { __id__: 8 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _layer: 33554432,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '',
}, 0, 200));
// 6: Bg UITransform
arr.push({
    __type__: 'cc.UITransform',
    node: { __id__: 5 },
    _enabled: true,
    _contentSize: { __type__: 'cc.Size', width: 600, height: 800 },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _id: '',
});
// 7: Bg Sprite (sliced -> @.9 will be derived)
arr.push({
    __type__: 'cc.Sprite',
    node: { __id__: 5 },
    _enabled: true,
    _customMaterial: null,
    _srcBlendFactor: 2,
    _dstBlendFactor: 4,
    _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 },
    _spriteFrame: SF,
    _type: 1, // SLICED
    _fillType: 0,
    _sizeMode: 0,
    _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 },
    _fillStart: 0, _fillRange: 0,
    _isTrimmedMode: true,
    _useGrayscale: false,
    _atlas: null,
    _id: '',
});
// 8: Bg PrefabInfo
arr.push({
    __type__: 'cc.CompPrefabInfo',
    fileId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
});

// 9: OkBtn node
arr.push(withPos({
    __type__: 'cc.Node',
    _name: 'OkBtn',
    _objFlags: 0,
    _parent: { __id__: 1 },
    _children: [{ __id__: 14 }],
    _active: true,
    _components: [{ __id__: 10 }, { __id__: 11 }, { __id__: 12 }],
    _prefab: { __id__: 13 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _layer: 33554432,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '',
}, 0, -300));
// 10: OkBtn UITransform
arr.push({
    __type__: 'cc.UITransform',
    node: { __id__: 9 },
    _enabled: true,
    _contentSize: { __type__: 'cc.Size', width: 200, height: 80 },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _id: '',
});
// 11: OkBtn Sprite
arr.push({
    __type__: 'cc.Sprite',
    node: { __id__: 9 },
    _enabled: true,
    _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 },
    _spriteFrame: SF,
    _type: 0,
    _sizeMode: 1,
    _id: '',
});
// 12: OkBtn Button
arr.push({
    __type__: 'cc.Button',
    node: { __id__: 9 },
    _enabled: true,
    _interactable: true,
    _transition: 0,
    duration: 0.1,
    zoomScale: 1.2,
    clickEvents: [],
    _id: '',
});
// 13: OkBtn PrefabInfo
arr.push({
    __type__: 'cc.CompPrefabInfo',
    fileId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
});

// 14: Label node
arr.push(withPos({
    __type__: 'cc.Node',
    _name: 'Label',
    _objFlags: 0,
    _parent: { __id__: 9 },
    _children: [],
    _active: true,
    _components: [{ __id__: 15 }, { __id__: 16 }],
    _prefab: { __id__: 17 },
    _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
    _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _layer: 33554432,
    _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
    _id: '',
}, 0, 0));
// 15: Label UITransform
arr.push({
    __type__: 'cc.UITransform',
    node: { __id__: 14 },
    _enabled: true,
    _contentSize: { __type__: 'cc.Size', width: 100, height: 40 },
    _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    _id: '',
});
// 16: Label cc.Label
arr.push({
    __type__: 'cc.Label',
    node: { __id__: 14 },
    _enabled: true,
    _string: 'OK',
    _horizontalAlign: 1,
    _verticalAlign: 1,
    _fontSize: 32,
    _color: { __type__: 'cc.Color', r: 0, g: 0, b: 0, a: 255 },
    _id: '',
});
// 17: Label PrefabInfo
arr.push({
    __type__: 'cc.CompPrefabInfo',
    fileId: 'cccccccccccccccccccccccc',
});
// 18: root PrefabInfo
arr.push({
    __type__: 'cc.PrefabInfo',
    root: { __id__: 1 },
    asset: { __id__: 0 },
    fileId: 'dddddddddddddddddddddddd',
    instance: null,
    targetOverrides: null,
    nestedPrefabInstanceRoots: null,
});

const prefabPath = path.join(uiDir, 'MyUI.prefab');
fs.writeFileSync(prefabPath, JSON.stringify(arr, null, 2));

// 4. prefab .meta
const prefabUuid = '99999999-aaaa-4bbb-8ccc-dddddddddddd';
fs.writeFileSync(prefabPath + '.meta', JSON.stringify({
    ver: '1.1.50',
    importer: 'prefab',
    imported: true,
    uuid: prefabUuid,
    files: ['.json'],
    subMetas: {},
    userData: { syncNodeName: 'MyUI' },
}, null, 2));

console.log('Fixture generated under', root);
