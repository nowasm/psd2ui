#!/usr/bin/env node
// prefab2psd: Cocos Creator 3.4+ prefab 反向导出为 PSD。
// - 节点树 → PSD 图层；按 ccc-tnt-psd2ui 的 @xxx 约定编码可识别的组件。
// - 完整挂载信息（引擎组件 / 自定义组件 / 资源引用）写到同名 sidecar JSON。
// - 嵌入原始 PNG 像素到 PSD raster 图层；同步更新 psd-to-prefab-cache.json，
//   让回导（PSD → prefab）通过现有 importer 的 md5 缓存命中并跳过重复导出。

'use strict';

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const minimist = require('minimist');
require('ag-psd/initialize-canvas');
const agPsd = require('ag-psd');
const { createCanvas, loadImage, registerFont } = require('canvas');

const VERSION = '0.1.0';

// ============================================================================
// 1. CLI 入口
// ============================================================================

async function main() {
    let args = parseArgs();
    if (!args.input || !args['project-assets']) {
        printHelp();
        process.exit(1);
    }
    let inputs = await collectPrefabs(args.input);
    if (!inputs.length) {
        console.error(`[prefab2psd] 找不到 prefab 文件: ${args.input}`);
        process.exit(1);
    }
    console.log(`[prefab2psd] 待处理 ${inputs.length} 个 prefab`);
    let assetIndex = await scanAssetIndex(args['project-assets']);
    console.log(`[prefab2psd] 资源索引建立完成: ${assetIndex.byUuid.size} 个资源, ${assetIndex.bySubUuid.size} 个子资源`);

    for (const prefabPath of inputs) {
        try {
            await convertPrefab(prefabPath, args, assetIndex);
        } catch (e) {
            console.error(`[prefab2psd] 转换失败: ${prefabPath}`);
            console.error(e && e.stack ? e.stack : e);
        }
    }
    console.log(`[prefab2psd] 全部完成`);
}

function parseArgs() {
    let raw = minimist(process.argv.slice(2));
    if (raw.json) {
        try { raw = JSON.parse(Buffer.from(raw.json, 'base64').toString()); }
        catch (e) { console.error('[prefab2psd] --json 解析失败'); process.exit(1); }
    }
    return raw;
}

function printHelp() {
    console.log(`prefab2psd v${VERSION}
将 Cocos Creator 3.4+ prefab 反向导出为 PSD（同时记录挂载信息到 sidecar）。

用法:
  node prefab2psd.js --input <prefab路径或目录> --project-assets <项目assets目录> [选项]

参数:
  --input            必选  .prefab 文件，或包含 .prefab 文件的目录（递归）
  --project-assets   必选  Cocos 项目的 assets 目录（用于 uuid → 资源路径）
  --output           可选  PSD 输出目录，缺省时与 prefab 同级
  --cache            可选  psd-to-prefab-cache.json 路径；
                          会写入 md5 → spriteFrameUuid 映射，使回导跳过重复导出

示例:
  node prefab2psd.js --input ./assets/MyUI.prefab --project-assets ./assets
  node prefab2psd.js --input ./assets/ui --project-assets ./assets --output ./out --cache ./local/psd-to-prefab-cache.json
`);
}

async function collectPrefabs(input) {
    let stat = await fs.stat(input).catch(() => null);
    if (!stat) return [];
    if (stat.isFile()) {
        return path.extname(input) === '.prefab' ? [input] : [];
    }
    let out = [];
    let walk = async (dir) => {
        let entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
            let p = path.join(dir, e.name);
            if (e.isDirectory()) await walk(p);
            else if (e.isFile() && path.extname(e.name) === '.prefab') out.push(p);
        }
    };
    await walk(input);
    return out;
}

// ============================================================================
// 2. 项目资源索引（uuid → 资源路径）
// ============================================================================

async function scanAssetIndex(assetsRoot) {
    let byUuid = new Map();
    let bySubUuid = new Map();

    let walk = async (dir) => {
        let entries;
        try { entries = await fs.readdir(dir, { withFileTypes: true }); }
        catch (_) { return; }
        for (const e of entries) {
            let p = path.join(dir, e.name);
            if (e.isDirectory()) {
                await walk(p);
                continue;
            }
            if (!e.isFile() || !e.name.endsWith('.meta')) continue;
            let json;
            try { json = JSON.parse(await fs.readFile(p, 'utf-8')); }
            catch (_) { continue; }

            let assetPath = p.slice(0, -'.meta'.length);
            if (json.uuid) {
                byUuid.set(json.uuid, {
                    metaPath: p,
                    assetPath,
                    type: json.importer || 'unknown',
                    meta: json,
                });
            }
            if (json.subMetas) {
                for (const subKey in json.subMetas) {
                    let sub = json.subMetas[subKey];
                    if (sub && sub.uuid) {
                        bySubUuid.set(sub.uuid, {
                            parentUuid: json.uuid,
                            parentMetaPath: p,
                            parentAssetPath: assetPath,
                            parentMeta: json,
                            subKey,
                            subMeta: sub,
                        });
                    }
                }
            }
        }
    };
    await walk(assetsRoot);
    return { byUuid, bySubUuid };
}

function resolveAssetByUuid(uuid, assetIndex) {
    if (!uuid) return null;
    let direct = assetIndex.byUuid.get(uuid);
    if (direct) return { ...direct, isSub: false };
    let sub = assetIndex.bySubUuid.get(uuid);
    if (sub) {
        return {
            metaPath: sub.parentMetaPath,
            assetPath: sub.parentAssetPath,
            meta: sub.parentMeta,
            type: sub.parentMeta.importer || 'unknown',
            subKey: sub.subKey,
            subMeta: sub.subMeta,
            parentUuid: sub.parentUuid,
            isSub: true,
        };
    }
    return null;
}

// ============================================================================
// 3. Prefab JSON 解析
// ============================================================================

function parsePrefab(prefabJsonStr) {
    let arr = JSON.parse(prefabJsonStr);
    if (!Array.isArray(arr) || !arr.length) {
        throw new Error('prefab 文件不是合法的 JSON 数组');
    }
    let prefabObj = arr[0];
    let rootIdx = -1;
    let prefabUuid = null;
    if (prefabObj && prefabObj.__type__ === 'cc.Prefab') {
        if (prefabObj.data && typeof prefabObj.data.__id__ === 'number') {
            rootIdx = prefabObj.data.__id__;
        }
    }
    if (rootIdx < 0) {
        // 退化：找第一个 cc.Node
        rootIdx = arr.findIndex(o => o && o.__type__ === 'cc.Node');
    }
    if (rootIdx < 0) {
        throw new Error('在 prefab 中找不到根节点 (cc.Node)');
    }
    return { array: arr, prefabObj, rootIdx, prefabUuid };
}

function getNodeChildren(arr, nodeObj) {
    let kids = [];
    if (!nodeObj || !Array.isArray(nodeObj._children)) return kids;
    for (const ref of nodeObj._children) {
        if (ref && typeof ref.__id__ === 'number') {
            let child = arr[ref.__id__];
            if (child && child.__type__ === 'cc.Node') kids.push({ idx: ref.__id__, obj: child });
        }
    }
    return kids;
}

function getNodeComponents(arr, nodeObj) {
    let comps = [];
    if (!nodeObj || !Array.isArray(nodeObj._components)) return comps;
    for (const ref of nodeObj._components) {
        if (ref && typeof ref.__id__ === 'number') {
            let c = arr[ref.__id__];
            if (c && typeof c === 'object') comps.push({ idx: ref.__id__, obj: c });
        }
    }
    return comps;
}

function findComponent(comps, type) {
    return comps.find(c => c.obj && c.obj.__type__ === type) || null;
}

// ============================================================================
// 4. 世界坐标计算 (Cocos Y-up + 中心 → PSD Y-down + 左上角)
// ============================================================================

function buildLayout(prefab) {
    let { array: arr, rootIdx } = prefab;
    let rootNode = arr[rootIdx];
    let rootComps = getNodeComponents(arr, rootNode);
    let rootUI = findComponent(rootComps, 'cc.UITransform');
    let rootSize = readContentSize(rootUI) || { width: 750, height: 1334 };

    let nodes = [];

    // worldScale = 父节点累计 scale * 自身 scale；rect 用该值放缩，子节点位置也乘父 scale。
    let walk = (idx, parentOriginPsd, parentWorldScale, parentDepth, parentIdxArg) => {
        let obj = arr[idx];
        let comps = getNodeComponents(arr, obj);
        let ui = findComponent(comps, 'cc.UITransform');
        let size = readContentSize(ui) || { width: 0, height: 0 };
        let anchor = readAnchorPoint(ui) || { x: 0.5, y: 0.5 };
        // Cocos 3.x 用 _lpos / _lrot / _lscale；老格式用 _position / _rotation / _scale。
        let position = readVec3(obj._lpos) || readVec3(obj._position) || { x: 0, y: 0, z: 0 };
        let localScale = readVec3(obj._lscale) || readVec3(obj._scale) || { x: 1, y: 1, z: 1 };
        let worldScale = {
            x: parentWorldScale.x * (typeof localScale.x === 'number' ? localScale.x : 1),
            y: parentWorldScale.y * (typeof localScale.y === 'number' ? localScale.y : 1),
        };

        let originPsd;
        if (parentIdxArg < 0) {
            // root: PSD 画布以 root 的 contentSize 为准（不受自身 scale 影响）
            originPsd = { x: anchor.x * size.width, y: (1 - anchor.y) * size.height };
        } else {
            // 子节点的 local position 在父空间里，要按父的世界 scale 放缩
            originPsd = {
                x: parentOriginPsd.x + position.x * parentWorldScale.x,
                y: parentOriginPsd.y - position.y * parentWorldScale.y,
            };
        }
        // rect 大小按当前节点的 worldScale 放缩
        let scaledW = size.width * Math.abs(worldScale.x);
        let scaledH = size.height * Math.abs(worldScale.y);
        let left = originPsd.x - anchor.x * scaledW;
        let top = originPsd.y - (1 - anchor.y) * scaledH;
        let rect = {
            left,
            top,
            right: left + scaledW,
            bottom: top + scaledH,
        };

        let entry = {
            idx,
            obj,
            comps,
            ui,
            parentIdx: parentIdxArg,
            depth: parentDepth + 1,
            originPsd,
            anchor,
            size,
            scaledSize: { width: scaledW, height: scaledH },
            position,
            localScale,
            worldScale,
            rect,
        };
        nodes.push(entry);

        for (const ch of getNodeChildren(arr, obj)) {
            walk(ch.idx, originPsd, worldScale, parentDepth + 1, idx);
        }
    };
    walk(rootIdx, null, { x: 1, y: 1 }, -1, -1);
    return { rootSize, nodes };
}

// 检测内容是否越出 root 的 contentSize；如果越出就扩展画布并把所有 rect/originPsd
// 平移 (padX, padY)。返回最终的 PSD 画布尺寸 + 平移量。
function fitCanvasToContent(layout) {
    let rootW = Math.round(layout.rootSize.width);
    let rootH = Math.round(layout.rootSize.height);
    let bboxL = 0, bboxT = 0, bboxR = rootW, bboxB = rootH;
    for (const entry of layout.nodes) {
        if (entry.parentIdx < 0) continue; // 根节点本身就是画布，不算
        bboxL = Math.min(bboxL, entry.rect.left);
        bboxT = Math.min(bboxT, entry.rect.top);
        bboxR = Math.max(bboxR, entry.rect.right);
        bboxB = Math.max(bboxB, entry.rect.bottom);
    }
    let padX = Math.ceil(Math.max(0, -bboxL));
    let padY = Math.ceil(Math.max(0, -bboxT));
    let width = Math.max(1, Math.ceil(bboxR) + padX);
    let height = Math.max(1, Math.ceil(bboxB) + padY);
    if (padX || padY) {
        for (const entry of layout.nodes) {
            entry.rect.left += padX;
            entry.rect.right += padX;
            entry.rect.top += padY;
            entry.rect.bottom += padY;
            if (entry.originPsd) {
                entry.originPsd.x += padX;
                entry.originPsd.y += padY;
            }
        }
    }
    return { width, height, padX, padY };
}

function readContentSize(uiCompEntry) {
    if (!uiCompEntry || !uiCompEntry.obj) return null;
    let s = uiCompEntry.obj._contentSize;
    if (!s) return null;
    return { width: s.width || 0, height: s.height || 0 };
}
function readAnchorPoint(uiCompEntry) {
    if (!uiCompEntry || !uiCompEntry.obj) return null;
    let a = uiCompEntry.obj._anchorPoint;
    if (!a) return null;
    return {
        x: typeof a.x === 'number' ? a.x : 0.5,
        y: typeof a.y === 'number' ? a.y : 0.5,
    };
}
function readVec3(v) {
    if (!v) return null;
    return { x: v.x || 0, y: v.y || 0, z: v.z || 0 };
}

// ============================================================================
// 5. 图层名编码 / Sidecar 数据生成
// ============================================================================

function sanitizeName(name) {
    // importer 用 '@' 切分图层名；同时为与 importer 的 name 清理保持一致也替换 . / > \ 空格
    return String(name == null ? 'unnamed' : name).replace(/[@.\/>\\ ]/g, '_');
}

function trimNum(n) {
    return Number.isInteger(n) ? n : Number(Number(n).toFixed(3));
}

function buildLayerNameForNode(entry) {
    let nodeName = sanitizeName(entry.obj._name);
    let tags = [];

    if (Math.abs(entry.anchor.x - 0.5) > 1e-6 || Math.abs(entry.anchor.y - 0.5) > 1e-6) {
        tags.push(`@ar{x:${trimNum(entry.anchor.x)},y:${trimNum(entry.anchor.y)}}`);
    }
    if (findComponent(entry.comps, 'cc.Button')) tags.push('@Btn');
    if (findComponent(entry.comps, 'cc.Toggle')) tags.push('@Toggle');
    if (findComponent(entry.comps, 'cc.ProgressBar')) tags.push('@ProgressBar');

    return nodeName + tags.join('');
}

// 标记“父节点的 ProgressBar.barSprite 指向当前子节点”这种关联，
// 让对应的子图层补 @bar 标签。
function isProgressBarChild(parentEntry, childEntry, prefab) {
    let bar = parentEntry && findComponent(parentEntry.comps, 'cc.ProgressBar');
    if (!bar) return false;
    let ref = bar.obj.barSprite || bar.obj._barSprite;
    if (!ref || typeof ref.__id__ !== 'number') return false;
    let target = prefab.array[ref.__id__];
    if (!target || !target.node || typeof target.node.__id__ !== 'number') return false;
    return target.node.__id__ === childEntry.idx;
}
function isToggleCheckChild(parentEntry, childEntry, prefab) {
    let toggle = parentEntry && findComponent(parentEntry.comps, 'cc.Toggle');
    if (!toggle) return false;
    let ref = toggle.obj.checkMark || toggle.obj._checkMark || toggle.obj.checkmark;
    if (!ref || typeof ref.__id__ !== 'number') return false;
    let target = prefab.array[ref.__id__];
    if (!target || !target.node || typeof target.node.__id__ !== 'number') return false;
    return target.node.__id__ === childEntry.idx;
}

// ============================================================================
// 6. 单 prefab 转换
// ============================================================================

async function convertPrefab(prefabPath, args, assetIndex) {
    console.log(`[prefab2psd] ----- 处理 ${prefabPath} -----`);

    let outputDir = args.output ? path.resolve(args.output) : path.dirname(prefabPath);
    await fs.ensureDir(outputDir);

    let prefabJsonStr = await fs.readFile(prefabPath, 'utf-8');
    let prefab = parsePrefab(prefabJsonStr);

    // 读取 prefab 的 .meta 拿到 prefabUuid（仅用于 sidecar 元信息）
    let prefabMetaPath = prefabPath + '.meta';
    if (await fs.pathExists(prefabMetaPath)) {
        try {
            let m = JSON.parse(await fs.readFile(prefabMetaPath, 'utf-8'));
            if (m && m.uuid) prefab.prefabUuid = m.uuid;
        } catch (_) {}
    }

    let layout = buildLayout(prefab);

    // Cocos UI 节点常会越出根的 contentSize（用于贴边 / 全屏挂件等）。
    // PSD 画布如果只用根尺寸，越出部分就会被 PS 裁掉。这里算一遍全局 bbox：
    //  - 左 / 上越界 → 给画布加同等量的 padding，所有图层 rect 同步右 / 下平移
    //  - 右 / 下越界 → 直接把画布扩到能装下
    let canvasFit = fitCanvasToContent(layout);
    if (canvasFit.padX || canvasFit.padY ||
        canvasFit.width !== Math.round(layout.rootSize.width) ||
        canvasFit.height !== Math.round(layout.rootSize.height)) {
        console.log(`[prefab2psd] 内容溢出根尺寸：扩展画布 ${Math.round(layout.rootSize.width)}x${Math.round(layout.rootSize.height)} → ${canvasFit.width}x${canvasFit.height} (左/上 pad=${canvasFit.padX}/${canvasFit.padY})`);
    }

    // 在创建任何要用到自定义字体的 canvas 之前预注册字体
    let fontRegistry = preregisterFonts(prefab, assetIndex);

    // 加载 / 准备缓存
    let cacheJson = {};
    if (args.cache) {
        if (await fs.pathExists(args.cache)) {
            try { cacheJson = JSON.parse(await fs.readFile(args.cache, 'utf-8')) || {}; }
            catch (_) { cacheJson = {}; }
        }
    }

    let sidecar = {
        _meta: {
            formatVersion: 1,
            tool: 'prefab2psd',
            toolVersion: VERSION,
            engineVersion: 'v342',
            prefabName: path.basename(prefabPath, '.prefab'),
            prefabUuid: prefab.prefabUuid || null,
            sourcePrefab: path.basename(prefabPath),
            exportedAt: new Date().toISOString(),
        },
        rootSize: layout.rootSize,
        // PSD 画布的实际尺寸 + 因内容溢出额外加的左/上 padding（rect 已平移过）。
        // 回导时如需恢复 cocos 原始坐标，把每个 layer 的 left/top 减去 canvasPadding 即可。
        canvasSize: { width: canvasFit.width, height: canvasFit.height },
        canvasPadding: { x: canvasFit.padX, y: canvasFit.padY },
        nodes: {},
    };

    // stable id：节点 path（消歧后），方便回导时定位
    let pathCounter = new Map();
    let stableIdByIdx = new Map();
    for (const entry of layout.nodes) {
        let parentEntry = entry.parentIdx >= 0
            ? layout.nodes.find(n => n.idx === entry.parentIdx)
            : null;
        let parentPath = parentEntry ? stableIdByIdx.get(parentEntry.idx) : '';
        let baseName = sanitizeName(entry.obj._name || 'node');
        let basePath = parentPath ? `${parentPath}/${baseName}` : baseName;
        let count = pathCounter.get(basePath) || 0;
        pathCounter.set(basePath, count + 1);
        let stableId = count === 0 ? basePath : `${basePath}#${count}`;
        stableIdByIdx.set(entry.idx, stableId);
        sidecar.nodes[stableId] = buildSidecarEntry(entry, prefab, assetIndex);
    }

    // 构造 PSD 图层树（先按 Cocos 顺序，最后整体反转 → PSD top-down 顺序）
    let layerByEntryIdx = new Map();
    let rootChildren = [];
    // layerName -> { textureUuid, assetPath } 用于在 PSD 写完后预测 md5 并写缓存
    let pendingCacheByLayerName = new Map();

    for (const entry of layout.nodes) {
        if (entry.parentIdx < 0) continue; // 根节点本身就是 PSD 画布
        let parentEntry = layout.nodes.find(n => n.idx === entry.parentIdx) || null;

        let extraTags = [];
        if (parentEntry && isProgressBarChild(parentEntry, entry, prefab)) extraTags.push('@bar');
        if (parentEntry && isToggleCheckChild(parentEntry, entry, prefab)) extraTags.push('@check');

        let layer = await buildPsdLayer(
            entry,
            prefab,
            assetIndex,
            sidecar.nodes[stableIdByIdx.get(entry.idx)],
            pendingCacheByLayerName,
            extraTags,
            fontRegistry,
        );
        layerByEntryIdx.set(entry.idx, layer);

        let parentLayer = layerByEntryIdx.get(entry.parentIdx);
        if (parentLayer) {
            parentLayer.children = parentLayer.children || [];
            // 注意：bg layer 已经在 buildPsdLayer 中放在 children[0] 了；
            // 这里追加的子节点位于 bg 之后（绘制时在 bg 之上），
            // 整体反转后 bg 会落在数组末尾（PSD 中位于最底）。
            parentLayer.children.push(layer);
        } else {
            rootChildren.push(layer);
        }
    }

    if (!rootChildren.length) {
        // 空 prefab：放一个透明占位避免 ag-psd 报错
        rootChildren.push({
            name: 'placeholder',
            left: 0, top: 0, right: 1, bottom: 1,
            canvas: createCanvas(1, 1),
        });
    }

    // ag-psd / PSD 都是 bottom-first 顺序：children[0] 为面板最底层（先绘制），
    // 与 Cocos children[0] 也是先绘制一致 —— 不需要反转。
    // 节点带 Sprite + 子节点时，bg 已经放在 children[0]（最底），其余 cocos 子节点
    // 按 cocos 顺序追加，正好叠在 bg 之上。

    let psd = {
        width: canvasFit.width,
        height: canvasFit.height,
        children: rootChildren,
    };

    let psdPath = path.join(outputDir, path.basename(prefabPath, '.prefab') + '.psd');
    let buffer = agPsd.writePsdBuffer(psd);
    await fs.writeFile(psdPath, buffer);
    console.log(`[prefab2psd] 生成 ${psdPath}`);

    // 把 PSD 读回来，按 importer 同样的方式预测 md5 → 用预测值写缓存。
    // 这样回导时 importer 计算出的 md5 就能命中缓存、跳过重复导出。
    if (pendingCacheByLayerName.size) {
        try {
            let psdBack = agPsd.readPsd(buffer);
            updateCacheFromPsd(psdBack.children || [], pendingCacheByLayerName, cacheJson, sidecar);
        } catch (e) {
            console.warn(`[prefab2psd] 读回 PSD 预测 md5 失败: ${e.message}`);
        }
    }

    let sidecarPath = psdPath + '.psd2ui.json';
    await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf-8');
    console.log(`[prefab2psd] 生成 ${sidecarPath}`);

    if (args.cache) {
        await fs.ensureDir(path.dirname(args.cache));
        await fs.writeFile(args.cache, JSON.stringify(cacheJson, null, 2), 'utf-8');
        console.log(`[prefab2psd] 更新缓存 ${args.cache}`);
    }
}

function updateCacheFromPsd(layers, pending, cacheJson, sidecar) {
    for (const layer of layers) {
        if (layer.canvas && pending.has(layer.name)) {
            let info = pending.get(layer.name);
            let buf = layer.canvas.toBuffer('image/png');
            let md5 = crypto.createHash('md5')
                .update(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength))
                .digest('hex');
            cacheJson[md5] = {
                path: info.assetPath || '',
                textureUuid: info.textureUuid,
                uuid: info.textureUuid,
                isOutput: true,
            };
            // 同步到 sidecar 里对应组件的 embeddedImage.renderedMd5
            if (info.sidecarRef) {
                info.sidecarRef.renderedMd5 = md5;
            }
        }
        if (layer.children) updateCacheFromPsd(layer.children, pending, cacheJson, sidecar);
    }
}

function buildSidecarEntry(entry, prefab, assetIndex) {
    let comps = entry.comps.map(c => serializeComponent(c.obj, prefab, assetIndex));
    let prefabRef = (entry.obj._prefab && typeof entry.obj._prefab.__id__ === 'number')
        ? prefab.array[entry.obj._prefab.__id__]
        : null;
    return {
        name: entry.obj._name,
        active: entry.obj._active !== false,
        layer: entry.obj._layer,
        position: readVec3(entry.obj._lpos || entry.obj._position),
        rotation: entry.obj._lrot || entry.obj._rotation || null,
        eulerAngles: entry.obj._euler || entry.obj._eulerAngles || null,
        scale: readVec3(entry.obj._lscale || entry.obj._scale),
        anchorPoint: entry.anchor,
        contentSize: entry.size,
        psdRect: entry.rect,
        components: comps,
        prefabInfo: prefabRef ? { __type__: prefabRef.__type__, raw: prefabRef } : null,
        parentIdx: entry.parentIdx,
        nodeIdx: entry.idx,
    };
}

function serializeComponent(compObj, prefab, assetIndex) {
    return {
        __type__: compObj.__type__ || 'unknown',
        raw: compObj,
        assetRefs: collectAssetRefs(compObj, assetIndex),
        nodeRefs: collectNodeRefs(compObj, prefab),
    };
}

function collectAssetRefs(value, assetIndex) {
    let out = [];
    let walk = (v, keyPath) => {
        if (!v || typeof v !== 'object') return;
        if (Array.isArray(v)) {
            v.forEach((item, i) => walk(item, keyPath.concat(i)));
            return;
        }
        if (v.__uuid__) {
            let resolved = resolveAssetByUuid(v.__uuid__, assetIndex);
            out.push({
                keyPath,
                uuid: v.__uuid__,
                expectedType: v.__expectedType__ || null,
                assetPath: resolved ? resolved.assetPath : null,
                isSub: resolved ? resolved.isSub : false,
            });
            return;
        }
        for (const k in v) {
            if (k === '__type__') continue;
            walk(v[k], keyPath.concat(k));
        }
    };
    walk(value, []);
    return out;
}

function collectNodeRefs(value, prefab) {
    let out = [];
    let walk = (v, keyPath) => {
        if (!v || typeof v !== 'object') return;
        if (Array.isArray(v)) {
            v.forEach((item, i) => walk(item, keyPath.concat(i)));
            return;
        }
        if (typeof v.__id__ === 'number' && Object.keys(v).length === 1) {
            // 纯内部 id 引用
            let target = prefab.array[v.__id__];
            out.push({ keyPath, refIdx: v.__id__, refType: target ? target.__type__ : null });
            return;
        }
        for (const k in v) {
            if (k === '__type__') continue;
            walk(v[k], keyPath.concat(k));
        }
    };
    walk(value, []);
    return out;
}

// ============================================================================
// 7. PSD 图层构造（含图片嵌入与 9 宫格识别）
// ============================================================================

async function buildPsdLayer(entry, prefab, assetIndex, sidecarEntry, pendingCacheByLayerName, extraTags, fontRegistry) {
    let layerName = buildLayerNameForNode(entry) + (extraTags && extraTags.length ? extraTags.join('') : '');
    let rect = entry.rect;
    let left = Math.round(rect.left);
    let top = Math.round(rect.top);
    let right = Math.round(rect.right);
    let bottom = Math.round(rect.bottom);
    if (right <= left) right = left + 1;
    if (bottom <= top) bottom = top + 1;

    let hasChildren = getNodeChildren(prefab.array, entry.obj).length > 0;
    let sprite = findComponent(entry.comps, 'cc.Sprite');
    let label = findComponent(entry.comps, 'cc.Label') || findComponent(entry.comps, 'cc.RichText');

    let layer = {
        name: layerName,
        left, top, right, bottom,
        hidden: entry.obj._active === false,
        opacity: 255,
    };

    let bgCanvas = null;
    let s9 = null;
    let spriteAssetInfo = null; // { textureUuid, assetPath, sidecarRef }

    if (sprite) {
        let result = await renderSpriteCanvas(sprite, right - left, bottom - top, assetIndex);
        if (result) {
            bgCanvas = result.canvas;
            s9 = readSlicedBorder(sprite, assetIndex);
            spriteAssetInfo = resolveCacheInfoForSprite(sprite, assetIndex, result);
            if (sidecarEntry) {
                let sc = sidecarEntry.components.find(c => c.__type__ === 'cc.Sprite');
                if (sc) {
                    sc.embeddedImage = {
                        sourcePath: result.sourcePath,
                        sourceUuid: result.sourceUuid,
                        spriteFrameUuid: sprite.obj._spriteFrame && sprite.obj._spriteFrame.__uuid__,
                        renderedMd5: null, // 真实 md5 在 PSD 写完读回后填入
                    };
                    if (spriteAssetInfo) spriteAssetInfo.sidecarRef = sc.embeddedImage;
                }
            }
        }
    }

    if (hasChildren) {
        layer.opened = true;
        layer.children = [];
        // group 不要带 canvas
        if (bgCanvas) {
            let bgName = sanitizeName(entry.obj._name || 'bg') + '_bg';
            if (s9) bgName += `@.9{l:${s9.l},r:${s9.r},t:${s9.t},b:${s9.b}}`;
            let bgLayer = {
                name: bgName,
                left, top, right, bottom,
                canvas: bgCanvas,
                hidden: false,
                opacity: 255,
            };
            // 放到 children[0]，反转后位于数组末尾 → PSD 最底层（先绘制）
            layer.children.push(bgLayer);
            if (sidecarEntry) sidecarEntry.bgLayerName = bgName;
            if (spriteAssetInfo) pendingCacheByLayerName.set(bgName, spriteAssetInfo);
        }
    } else if (bgCanvas) {
        // 叶子且有图片
        layer.canvas = bgCanvas;
        if (s9) layer.name += `@.9{l:${s9.l},r:${s9.r},t:${s9.t},b:${s9.b}}`;
        if (spriteAssetInfo) pendingCacheByLayerName.set(layer.name, spriteAssetInfo);
    } else if (label) {
        // 叶子文本：渲染文字到 canvas。粗体 / 描边 / 阴影 会让字形溢出节点框，
        // 所以渲染到比 rect 更大的 canvas 上，再把 PSD 图层按 pad 等量外扩，
        // 视觉位置还是落在原节点位置。
        let labelResult = renderLabelCanvas(
            label.obj,
            right - left,
            bottom - top,
            entry.worldScale || { x: 1, y: 1 },
            fontRegistry,
        );
        layer.canvas = labelResult.canvas;
        layer.left = left - labelResult.pad;
        layer.top = top - labelResult.pad;
        layer.right = layer.left + labelResult.canvas.width;
        layer.bottom = layer.top + labelResult.canvas.height;
    } else {
        // 空叶子节点
        layer.canvas = createCanvas(1, 1);
    }

    return layer;
}

function resolveCacheInfoForSprite(spriteCompEntry, assetIndex, renderResult) {
    let sf = spriteCompEntry.obj._spriteFrame;
    if (!sf || !sf.__uuid__) return null;
    let asset = resolveAssetByUuid(sf.__uuid__, assetIndex);
    if (!asset) return null;
    let textureUuid = asset.isSub ? asset.parentUuid : (asset.uuid || (asset.meta && asset.meta.uuid));
    if (!textureUuid) return null;
    return {
        textureUuid,
        assetPath: asset.assetPath || (renderResult && renderResult.sourcePath) || '',
        sidecarRef: null,
    };
}

async function renderSpriteCanvas(spriteCompEntry, w, h, assetIndex) {
    let sf = spriteCompEntry.obj._spriteFrame;
    if (!sf || !sf.__uuid__) return null;
    let asset = resolveAssetByUuid(sf.__uuid__, assetIndex);
    if (!asset || !asset.assetPath) return null;
    if (!await fs.pathExists(asset.assetPath)) {
        console.warn(`[prefab2psd] 找不到图片文件: ${asset.assetPath}`);
        return null;
    }
    let img;
    try {
        img = await loadImage(asset.assetPath);
    } catch (e) {
        console.warn(`[prefab2psd] 加载图片失败 ${asset.assetPath}: ${e.message}`);
        return null;
    }
    // 用图片原始像素填充节点 rect 大小的 canvas（拉伸适配）
    let cw = Math.max(1, Math.round(w));
    let ch = Math.max(1, Math.round(h));
    let canvas = createCanvas(cw, ch);
    let ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, cw, ch);
    let buf = canvas.toBuffer('image/png');
    let md5 = crypto.createHash('md5')
        .update(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength))
        .digest('hex');
    return {
        canvas,
        md5,
        sourcePath: asset.assetPath,
        sourceUuid: asset.isSub ? asset.parentUuid : (asset.uuid || (asset.meta && asset.meta.uuid)),
    };
}

function readSlicedBorder(spriteCompEntry, assetIndex) {
    if (spriteCompEntry.obj._type !== 1) return null; // 1 = SLICED
    let sf = spriteCompEntry.obj._spriteFrame;
    if (!sf || !sf.__uuid__) return null;
    let asset = resolveAssetByUuid(sf.__uuid__, assetIndex);
    if (!asset || !asset.meta || !asset.meta.subMetas) return null;
    let f9941 = asset.meta.subMetas['f9941'];
    if (!f9941 || !f9941.userData) return null;
    let u = f9941.userData;
    let l = u.borderLeft | 0;
    let r = u.borderRight | 0;
    let t = u.borderTop | 0;
    let b = u.borderBottom | 0;
    if (!(l || r || t || b)) return null;
    return { l, r, t, b };
}

// ============================================================================
// 8. 文本（cc.Label / cc.RichText）渲染
// ============================================================================

function preregisterFonts(prefab, assetIndex) {
    let registry = new Map(); // uuid -> registered family name
    for (const obj of prefab.array) {
        if (!obj || (obj.__type__ !== 'cc.Label' && obj.__type__ !== 'cc.RichText')) continue;
        if (obj._isSystemFontUsed) continue;
        let fontRef = obj._font;
        if (!fontRef || !fontRef.__uuid__) continue;
        if (registry.has(fontRef.__uuid__)) continue;
        let asset = resolveAssetByUuid(fontRef.__uuid__, assetIndex);
        if (!asset || !asset.assetPath) continue;
        let ext = path.extname(asset.assetPath).toLowerCase();
        if (ext !== '.ttf' && ext !== '.otf') continue;
        let family = `p2p_${fontRef.__uuid__.slice(0, 8)}`;
        try {
            registerFont(asset.assetPath, { family });
            registry.set(fontRef.__uuid__, family);
        } catch (e) {
            console.warn(`[prefab2psd] 字体注册失败 ${asset.assetPath}: ${e.message}`);
        }
    }
    return registry;
}

function readColor(c) {
    if (!c) return null;
    return {
        r: typeof c.r === 'number' ? c.r : 255,
        g: typeof c.g === 'number' ? c.g : 255,
        b: typeof c.b === 'number' ? c.b : 255,
        a: typeof c.a === 'number' ? c.a : 255,
    };
}

function colorToCss(c) {
    return `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${(c.a / 255).toFixed(3)})`;
}

function resolveLabelFamily(labelObj, fontRegistry) {
    if (!labelObj._isSystemFontUsed && labelObj._font && labelObj._font.__uuid__) {
        let fam = fontRegistry.get(labelObj._font.__uuid__);
        if (fam) return fam;
    }
    return labelObj._fontFamily || 'Arial';
}

function renderLabelCanvas(labelObj, w, h, worldScale, fontRegistry) {
    let isRichText = labelObj.__type__ === 'cc.RichText';
    let text = isRichText
        ? extractRichTextPlain(labelObj._string)
        : String(labelObj._string == null ? '' : labelObj._string);

    let scaleX = Math.abs(worldScale.x || 1);
    let scaleY = Math.abs(worldScale.y || 1);
    let scaleAvg = (scaleX + scaleY) / 2;

    let fontSize = (labelObj._fontSize || 16) * scaleAvg;
    let lineHeight = (labelObj._lineHeight || labelObj._fontSize || fontSize) * scaleAvg;

    // 计算视觉外扩量：粗体字形会比文字框略宽，描边、阴影还会再扩。
    // 取最大方向再加一点兜底，统一对四边外扩，简化坐标对齐。
    let outlineW = (labelObj._enableOutline && (labelObj._outlineWidth || 0) > 0)
        ? (labelObj._outlineWidth || 0) * scaleAvg
        : 0;
    let shadowMag = 0;
    if (labelObj._enableShadow) {
        let so = labelObj._shadowOffset || { x: 0, y: 0 };
        shadowMag = Math.max(Math.abs(so.x || 0) * scaleX, Math.abs(so.y || 0) * scaleY)
            + (labelObj._shadowBlur || 0) * scaleAvg;
    }
    // 4px 兜底覆盖：bold 字形外溢、italic 倾斜、子像素抗锯齿
    let pad = Math.ceil(outlineW + shadowMag + Math.max(4, fontSize * 0.15));

    let innerW = Math.max(1, Math.round(w));
    let innerH = Math.max(1, Math.round(h));
    let cw = innerW + pad * 2;
    let ch = innerH + pad * 2;
    let canvas = createCanvas(cw, ch);

    if (!text) return { canvas, pad };

    let ctx = canvas.getContext('2d');
    let color = readColor(labelObj._color) || { r: 255, g: 255, b: 255, a: 255 };
    let weight = labelObj._isBold ? 'bold' : 'normal';
    let style = labelObj._isItalic ? 'italic' : 'normal';
    let family = resolveLabelFamily(labelObj, fontRegistry);

    ctx.font = `${style} ${weight} ${fontSize}px "${family}"`;
    ctx.fillStyle = colorToCss(color);

    // 所有 x/y 都基于 inner 区域算，再统一加 pad。
    // h-align: 0=left, 1=center, 2=right
    let hAlign = labelObj._horizontalAlign | 0;
    ctx.textAlign = hAlign === 0 ? 'left' : hAlign === 1 ? 'center' : 'right';
    let xOrigin = (hAlign === 0 ? 0 : hAlign === 1 ? innerW / 2 : innerW) + pad;

    ctx.textBaseline = 'top';

    let lines = text.split(/\r?\n/);
    let totalH = lineHeight * lines.length;
    let vAlign = labelObj._verticalAlign | 0;
    let yStart;
    if (vAlign === 0) yStart = 0;
    else if (vAlign === 1) yStart = (innerH - totalH) / 2;
    else yStart = innerH - totalH;
    yStart += pad;

    let shadowEnabled = !!labelObj._enableShadow;
    let shadowColor = readColor(labelObj._shadowColor);
    let shadowOffset = labelObj._shadowOffset || { x: 0, y: 0 };
    let shadowBlur = (labelObj._shadowBlur || 0) * scaleAvg;
    let applyShadow = () => {
        if (shadowEnabled && shadowColor) {
            ctx.shadowColor = colorToCss(shadowColor);
            ctx.shadowOffsetX = (shadowOffset.x || 0) * scaleX;
            ctx.shadowOffsetY = -(shadowOffset.y || 0) * scaleY; // Cocos Y 向上 → PSD Y 向下
            ctx.shadowBlur = shadowBlur;
        }
    };
    let clearShadow = () => {
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 0;
    };

    let outlineEnabled = !!labelObj._enableOutline && (labelObj._outlineWidth || 0) > 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let y = yStart + i * lineHeight + (lineHeight - fontSize) / 2;
        if (outlineEnabled) {
            applyShadow();
            let oc = readColor(labelObj._outlineColor) || { r: 0, g: 0, b: 0, a: 255 };
            ctx.strokeStyle = colorToCss(oc);
            ctx.lineWidth = (labelObj._outlineWidth || 0) * scaleAvg * 2;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(line, xOrigin, y);
            clearShadow();
        } else {
            applyShadow();
        }
        ctx.fillText(line, xOrigin, y);
        clearShadow();
    }

    if (labelObj._isUnderline && (labelObj._underlineHeight || 0) > 0) {
        ctx.strokeStyle = colorToCss(color);
        ctx.lineWidth = labelObj._underlineHeight * scaleAvg;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let lineW = ctx.measureText(line).width;
            let y = yStart + i * lineHeight + lineHeight - 2 * scaleAvg;
            let lx = (hAlign === 0 ? 0 : hAlign === 1 ? (innerW - lineW) / 2 : innerW - lineW) + pad;
            ctx.beginPath();
            ctx.moveTo(lx, y);
            ctx.lineTo(lx + lineW, y);
            ctx.stroke();
        }
    }

    return { canvas, pad };
}

function extractRichTextPlain(s) {
    if (!s) return '';
    // 极简：把 <foo .../> 标签去掉，保留文本
    return String(s).replace(/<[^>]+>/g, '');
}

// ============================================================================
main().catch(e => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
});
