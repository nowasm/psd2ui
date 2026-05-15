#!/usr/bin/env node
// tscn2psd: Godot 4 .tscn 反向导出为 PSD。
// - 节点树 → PSD 图层；按 psd2tscn 的 @xxx 约定反向编码（@Btn / @.9{...} / @flipX 等）。
// - 把 Texture2D ExtResource 引用的原始 PNG 像素嵌入到 PSD raster 图层。
// - 同名 sidecar JSON 完整记录节点类型、所有属性、ext_resource 引用、sub_resource 定义。

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
    if (!args.input || !args['godot-project']) {
        printHelp();
        process.exit(1);
    }
    let inputs = await collectTscns(args.input);
    if (!inputs.length) {
        console.error(`[tscn2psd] 找不到 tscn 文件: ${args.input}`);
        process.exit(1);
    }
    console.log(`[tscn2psd] 待处理 ${inputs.length} 个 tscn`);

    let projectRoot = path.resolve(args['godot-project']);
    let projectIndex = await scanProjectImports(projectRoot);
    console.log(`[tscn2psd] 项目资源索引: ${projectIndex.byUid.size} 个 .import`);

    for (const tscnPath of inputs) {
        try {
            await convertTscn(tscnPath, args, projectRoot, projectIndex);
        } catch (e) {
            console.error(`[tscn2psd] 转换失败: ${tscnPath}`);
            console.error(e && e.stack ? e.stack : e);
        }
    }
    console.log(`[tscn2psd] 全部完成`);
}

function parseArgs() {
    let raw = minimist(process.argv.slice(2));
    if (raw.json) {
        try { raw = JSON.parse(Buffer.from(raw.json, 'base64').toString()); }
        catch (e) { console.error('[tscn2psd] --json 解析失败'); process.exit(1); }
    }
    // 别名
    raw['godot-project'] = raw['godot-project'] || raw.gp;
    raw.input = raw.input || raw.in;
    raw.output = raw.output || raw.out;
    return raw;
}

function printHelp() {
    console.log(`tscn2psd v${VERSION}
将 Godot 4 .tscn 反向导出为 PSD（同时记录挂载信息到 sidecar）。

用法:
  node tscn2psd.js --input <tscn路径或目录> --godot-project <godot项目根> [选项]

参数:
  --input            必选  .tscn 文件，或包含 .tscn 文件的目录（递归）
  --godot-project    必选  Godot 项目根目录（含 project.godot），用于解析 res:// 路径
  --output           可选  PSD 输出目录，缺省时与 tscn 同级
  --canvas-size      可选  根画布尺寸 WxH（如 1920x1080）。缺省按根 Control 的 offset_right/bottom 推算

示例:
  node tscn2psd.js --input ./ui/MyUI.tscn --godot-project .
  node tscn2psd.js --input ./ui --godot-project ./ --output ./out --canvas-size 1280x720
`);
}

async function collectTscns(input) {
    let stat = await fs.stat(input).catch(() => null);
    if (!stat) return [];
    if (stat.isFile()) {
        return path.extname(input) === '.tscn' ? [input] : [];
    }
    let out = [];
    let walk = async (dir) => {
        let entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
            let p = path.join(dir, e.name);
            if (e.isDirectory()) await walk(p);
            else if (e.isFile() && path.extname(e.name) === '.tscn') out.push(p);
        }
    };
    await walk(input);
    return out;
}

// ============================================================================
// 2. Godot 项目资源索引（uid → 文件路径）
// ============================================================================

async function scanProjectImports(projectRoot) {
    let byUid = new Map(); // 'uid://abc' -> { sourcePath: 'res://...', absPath: '/abs/path' }

    let walk = async (dir) => {
        let entries;
        try { entries = await fs.readdir(dir, { withFileTypes: true }); }
        catch (_) { return; }
        for (const e of entries) {
            if (e.name === '.godot' || e.name === 'node_modules') continue;
            let p = path.join(dir, e.name);
            if (e.isDirectory()) { await walk(p); continue; }
            if (!e.isFile() || !e.name.endsWith('.import')) continue;
            try {
                let content = await fs.readFile(p, 'utf-8');
                let uid = matchKV(content, 'uid');
                let src = matchKV(content, 'source_file');
                if (uid && src) {
                    let absPath = resolveResPath(src, projectRoot);
                    byUid.set(uid, { sourcePath: src, absPath, importPath: p });
                }
            } catch (_) {}
        }
    };
    await walk(projectRoot);
    return { byUid };
}

function matchKV(content, key) {
    let re = new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm');
    let m = content.match(re);
    return m ? m[1] : null;
}

function resolveResPath(resPath, projectRoot) {
    if (!resPath) return null;
    if (resPath.startsWith('res://')) {
        return path.resolve(projectRoot, resPath.substring('res://'.length));
    }
    if (path.isAbsolute(resPath)) return resPath;
    return path.resolve(projectRoot, resPath);
}

// ============================================================================
// 3. TSCN 解析（INI-like）
// ============================================================================

function parseTscn(content) {
    let lines = content.split(/\r?\n/);
    let sections = [];
    let current = null;
    let i = 0;
    while (i < lines.length) {
        let line = lines[i];
        let trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(';')) { i++; continue; }

        // 段落 header 可能是 [xxx ... ]，注意值里也可能含 "[" — 通过 unbalanced [...] 判断
        if (trimmed.startsWith('[') && !current?._pendingValue) {
            let header = trimmed;
            // 处理 header 跨行（极少见，保险起见）
            while (!header.endsWith(']') && i + 1 < lines.length) {
                i++;
                header += ' ' + lines[i].trim();
            }
            let inside = header.substring(1, header.length - 1);
            let { type, attrs } = parseSectionHeader(inside);
            current = { type, attrs, props: {}, propOrder: [] };
            sections.push(current);
            i++;
            continue;
        }

        // 属性行：key = value
        if (current) {
            let eqIdx = line.indexOf('=');
            if (eqIdx === -1) { i++; continue; }
            let key = line.substring(0, eqIdx).trim();
            if (!key) { i++; continue; }
            let value = line.substring(eqIdx + 1).trim();
            // 多行值：括号 / 中括号 / 大括号未平衡时继续读
            let opens = countOf(value, '([{');
            let closes = countOf(value, ')]}');
            while (opens > closes && i + 1 < lines.length) {
                i++;
                value += '\n' + lines[i];
                opens += countOf(lines[i], '([{');
                closes += countOf(lines[i], ')]}');
            }
            current.props[key] = value;
            current.propOrder.push(key);
        }
        i++;
    }
    return { sections };
}

function countOf(s, chars) {
    let n = 0;
    for (const c of s) if (chars.includes(c)) n++;
    return n;
}

function parseSectionHeader(inside) {
    // 形如：node name="X" type="Y" parent="Z"
    inside = inside.trim();
    let firstSpace = inside.indexOf(' ');
    let type = firstSpace === -1 ? inside : inside.substring(0, firstSpace);
    let rest = firstSpace === -1 ? '' : inside.substring(firstSpace + 1);
    let attrs = parseAttrs(rest);
    return { type, attrs };
}

function parseAttrs(rest) {
    let out = {};
    let s = rest.trim();
    let i = 0;
    while (i < s.length) {
        while (i < s.length && /\s/.test(s[i])) i++;
        if (i >= s.length) break;
        let keyStart = i;
        while (i < s.length && s[i] !== '=' && !/\s/.test(s[i])) i++;
        let key = s.substring(keyStart, i);
        if (i >= s.length || s[i] !== '=') break;
        i++;
        let value;
        if (s[i] === '"') {
            i++;
            let valStart = i;
            while (i < s.length) {
                if (s[i] === '\\' && i + 1 < s.length) { i += 2; continue; }
                if (s[i] === '"') break;
                i++;
            }
            value = unescapeStr(s.substring(valStart, i));
            i++;
        } else {
            let valStart = i;
            while (i < s.length && !/\s/.test(s[i])) i++;
            value = s.substring(valStart, i);
        }
        out[key] = value;
    }
    return out;
}

function unescapeStr(s) {
    return String(s)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
}

// ============================================================================
// 4. 属性值解析
// ============================================================================

function readNum(s, dflt) {
    if (s == null) return dflt;
    let n = parseFloat(s);
    return Number.isFinite(n) ? n : dflt;
}
function readBool(s, dflt) {
    if (s == null) return dflt;
    let t = String(s).trim();
    if (t === 'true') return true;
    if (t === 'false') return false;
    return dflt;
}
function readString(s) {
    if (s == null) return null;
    let t = String(s).trim();
    let m = t.match(/^"((?:\\.|[^"\\])*)"$/);
    return m ? unescapeStr(m[1]) : t;
}
function readVector2(s) {
    if (s == null) return null;
    let m = String(s).match(/Vector2\(\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*\)/);
    if (!m) return null;
    return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}
function readGodotColor(s) {
    if (s == null) return null;
    let m = String(s).match(/Color\(\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*\)/);
    if (!m) return null;
    // Godot 颜色是 0..1 浮点
    return {
        r: Math.round(parseFloat(m[1]) * 255),
        g: Math.round(parseFloat(m[2]) * 255),
        b: Math.round(parseFloat(m[3]) * 255),
        a: Math.round(parseFloat(m[4]) * 255),
    };
}
function readExtResRef(s) {
    if (s == null) return null;
    let m = String(s).match(/ExtResource\(\s*"([^"]+)"\s*\)/);
    return m ? m[1] : null;
}
function readSubResRef(s) {
    if (s == null) return null;
    let m = String(s).match(/SubResource\(\s*"([^"]+)"\s*\)/);
    return m ? m[1] : null;
}

// ============================================================================
// 5. 节点树 / 布局
// ============================================================================

function buildScene(parsed) {
    let header = parsed.sections.find(s => s.type === 'gd_scene');
    let extResources = parsed.sections.filter(s => s.type === 'ext_resource');
    let subResources = parsed.sections.filter(s => s.type === 'sub_resource');
    let nodes = parsed.sections.filter(s => s.type === 'node');

    let extById = new Map();
    for (const ext of extResources) {
        if (ext.attrs.id) extById.set(ext.attrs.id, ext);
    }
    let subById = new Map();
    for (const sub of subResources) {
        if (sub.attrs.id) subById.set(sub.attrs.id, sub);
    }

    return {
        header,
        extResources,
        subResources,
        nodes,
        extById,
        subById,
        sceneUid: header && header.attrs ? header.attrs.uid : null,
    };
}

// 检测内容是否越出根 Control 的 size；越出就扩展画布并把所有 rect 平移 (padX, padY)。
// Godot UI 与 Cocos 一样常出现贴边/全屏挂件，offset_left 可能为负或 offset_right
// 大于父尺寸；PSD 画布固定在根尺寸时 PS 会硬切。
function fitCanvasToContent(layout) {
    let rootW = Math.round(layout.rootSize.x);
    let rootH = Math.round(layout.rootSize.y);
    let bboxL = 0, bboxT = 0, bboxR = rootW, bboxB = rootH;
    for (const entry of layout.entries) {
        if (!entry.parentEntry) continue; // 根本身就是画布
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
        for (const entry of layout.entries) {
            entry.rect.left += padX;
            entry.rect.right += padX;
            entry.rect.top += padY;
            entry.rect.bottom += padY;
        }
    }
    return { width, height, padX, padY };
}

function buildLayout(scene, canvasSizeOverride) {
    if (!scene.nodes.length) throw new Error('tscn 中没有 [node] 段');
    // 根节点：parent 属性缺失
    let rootNode = scene.nodes.find(n => !n.attrs.parent);
    if (!rootNode) throw new Error('找不到根节点（缺 parent 的 [node] 段）');

    // 根尺寸
    let rootSize = canvasSizeOverride || readRootSize(rootNode) || { x: 1920, y: 1080 };

    let entries = [];
    let pathToEntry = new Map();

    let rootEntry = makeEntry(rootNode, null, rootSize, { x: 1, y: 1 });
    rootEntry.depth = 0;
    rootEntry.psdPath = '.';
    entries.push(rootEntry);
    pathToEntry.set('.', rootEntry);

    // 依次处理其他 node（tscn 通常是先父后子的顺序）
    for (const n of scene.nodes) {
        if (n === rootNode) continue;
        let parentPath = n.attrs.parent || '.';
        let parentEntry = pathToEntry.get(parentPath);
        if (!parentEntry) {
            // 父级未出现，回退到根
            console.warn(`[tscn2psd] 节点 ${n.attrs.name} 的父级 "${parentPath}" 未找到，挂在根下`);
            parentEntry = rootEntry;
        }
        let myWorldScale = combineScale(parentEntry.worldScale, readVector2(n.props.scale));
        let entry = makeEntry(n, parentEntry, rootSize, myWorldScale);
        entry.depth = parentEntry.depth + 1;
        let nodeName = n.attrs.name || 'Node';
        entry.psdPath = parentPath === '.' ? nodeName : `${parentPath}/${nodeName}`;
        pathToEntry.set(entry.psdPath, entry);
        entries.push(entry);
    }
    return { rootSize, entries, pathToEntry };
}

function readRootSize(rootNode) {
    // 优先用 size，其次用 offset_right/bottom（即 psd2tscn 的输出形式）
    let sizeV = readVector2(rootNode.props.size);
    if (sizeV && sizeV.x > 0 && sizeV.y > 0) return sizeV;
    let w = readNum(rootNode.props.offset_right, 0);
    let h = readNum(rootNode.props.offset_bottom, 0);
    if (w > 0 && h > 0) return { x: w, y: h };
    return null;
}

function combineScale(parentWorldScale, ownLocal) {
    let lx = ownLocal && typeof ownLocal.x === 'number' ? ownLocal.x : 1;
    let ly = ownLocal && typeof ownLocal.y === 'number' ? ownLocal.y : 1;
    return {
        x: (parentWorldScale.x || 1) * lx,
        y: (parentWorldScale.y || 1) * ly,
    };
}

function makeEntry(node, parentEntry, rootSize, worldScale) {
    let attrs = node.attrs || {};
    let props = node.props || {};
    let nodeType = attrs.type || 'Node';

    // 解析锚点 + offset；若有 size + position，优先用之
    let posV = readVector2(props.position);
    let sizeV = readVector2(props.size);

    let parentSize = parentEntry ? parentEntry.size : rootSize;
    let parentPsdLeft = parentEntry ? parentEntry.rect.left : 0;
    let parentPsdTop = parentEntry ? parentEntry.rect.top : 0;
    let parentWorldScale = parentEntry ? parentEntry.worldScale : { x: 1, y: 1 };

    let aL = readNum(props.anchor_left, 0);
    let aT = readNum(props.anchor_top, 0);
    let aR = readNum(props.anchor_right, 0);
    let aB = readNum(props.anchor_bottom, 0);
    // anchors_preset 仅做最常见两种（0=不变, 15=full-rect）
    let preset = readNum(props.anchors_preset, null);
    if (preset === 15) { aL = 0; aT = 0; aR = 1; aB = 1; }

    let oL = readNum(props.offset_left, 0);
    let oT = readNum(props.offset_top, 0);
    let oR = readNum(props.offset_right, 0);
    let oB = readNum(props.offset_bottom, 0);

    // 父空间内（Godot 原坐标，未 scale）的左上 + 大小
    let localLeft, localTop, w, h;
    if (posV && sizeV) {
        localLeft = posV.x;
        localTop = posV.y;
        w = sizeV.x;
        h = sizeV.y;
    } else if (!parentEntry) {
        // 根节点：直接占满 rootSize
        localLeft = 0;
        localTop = 0;
        w = rootSize.x;
        h = rootSize.y;
    } else {
        localLeft = parentSize.x * aL + oL;
        localTop = parentSize.y * aT + oT;
        let localRight = parentSize.x * aR + oR;
        let localBottom = parentSize.y * aB + oB;
        w = localRight - localLeft;
        h = localBottom - localTop;
    }

    // PSD 绝对位置：父 PSD rect 的左上 + 自己在父空间的偏移（按父 worldScale 放缩）
    let psdLeft = parentPsdLeft + localLeft * parentWorldScale.x;
    let psdTop = parentPsdTop + localTop * parentWorldScale.y;
    let scaledW = w * Math.abs(worldScale.x);
    let scaledH = h * Math.abs(worldScale.y);

    return {
        node,
        nodeType,
        attrs,
        props,
        parentEntry,
        size: { x: w, y: h },
        scaledSize: { x: scaledW, y: scaledH },
        worldScale,
        rect: {
            left: psdLeft,
            top: psdTop,
            right: psdLeft + scaledW,
            bottom: psdTop + scaledH,
        },
    };
}

// ============================================================================
// 6. Godot 节点类型 → PSD 图层名编码
// ============================================================================

const FLIP_TAG_X = '@flipX';
const FLIP_TAG_Y = '@flipY';

function buildLayerNameForGodotNode(entry) {
    let baseName = sanitizeName(entry.attrs.name || 'Node');
    let tags = [];
    let t = entry.nodeType;
    let p = entry.props;

    if (t === 'TextureButton') {
        tags.push('@Btn');
    }
    if (t === 'NinePatchRect') {
        let m = readPatchMargins(p);
        if (m) tags.push(`@.9{l:${m.l},r:${m.r},t:${m.t},b:${m.b}}`);
    }
    if (t === 'TextureProgressBar') tags.push('@ProgressBar');
    if (t === 'CheckBox' || t === 'CheckButton') tags.push('@Toggle');

    if (t === 'TextureRect') {
        if (readBool(p.flip_h, false)) tags.push(FLIP_TAG_X);
        if (readBool(p.flip_v, false)) tags.push(FLIP_TAG_Y);
    }
    return baseName + tags.join('');
}

function readPatchMargins(p) {
    let l = readNum(p.patch_margin_left, 0) | 0;
    let r = readNum(p.patch_margin_right, 0) | 0;
    let t = readNum(p.patch_margin_top, 0) | 0;
    let b = readNum(p.patch_margin_bottom, 0) | 0;
    if (!(l || r || t || b)) return null;
    return { l, r, t, b };
}

function sanitizeName(name) {
    return String(name == null ? 'Node' : name).replace(/[@.\/>\\ :]/g, '_');
}

// ============================================================================
// 7. 单 tscn → PSD
// ============================================================================

async function convertTscn(tscnPath, args, projectRoot, projectIndex) {
    console.log(`[tscn2psd] ----- 处理 ${tscnPath} -----`);

    let outputDir = args.output ? path.resolve(args.output) : path.dirname(tscnPath);
    await fs.ensureDir(outputDir);

    let content = await fs.readFile(tscnPath, 'utf-8');
    let parsed = parseTscn(content);
    let scene = buildScene(parsed);

    let canvasSizeOverride = parseCanvasSize(args['canvas-size']);
    let layout = buildLayout(scene, canvasSizeOverride);

    // 内容越出根尺寸时扩展画布（左/上越界 → 加 padding 并平移；右/下越界 → 直接扩）
    let canvasFit = fitCanvasToContent(layout);
    if (canvasFit.padX || canvasFit.padY ||
        canvasFit.width !== Math.round(layout.rootSize.x) ||
        canvasFit.height !== Math.round(layout.rootSize.y)) {
        console.log(`[tscn2psd] 内容溢出根尺寸：扩展画布 ${Math.round(layout.rootSize.x)}x${Math.round(layout.rootSize.y)} → ${canvasFit.width}x${canvasFit.height} (左/上 pad=${canvasFit.padX}/${canvasFit.padY})`);
    }

    // 在创建任何 canvas 之前预注册字体（Label 用）
    let fontRegistry = preregisterFonts(scene, projectRoot);

    let sidecar = {
        _meta: {
            formatVersion: 1,
            tool: 'tscn2psd',
            toolVersion: VERSION,
            engine: 'godot4',
            tscnName: path.basename(tscnPath, '.tscn'),
            sceneUid: scene.sceneUid || null,
            sourceTscn: path.basename(tscnPath),
            exportedAt: new Date().toISOString(),
        },
        rootSize: layout.rootSize,
        // PSD 实际画布尺寸 + 因内容溢出额外加的左/上 padding（rect 已平移过）。
        // 回导时 layer.left/top 减去 canvasPadding 就是 Godot 原始坐标。
        canvasSize: { width: canvasFit.width, height: canvasFit.height },
        canvasPadding: { x: canvasFit.padX, y: canvasFit.padY },
        extResources: scene.extResources.map(e => ({
            id: e.attrs.id,
            type: e.attrs.type,
            uid: e.attrs.uid || null,
            path: e.attrs.path || null,
        })),
        subResources: scene.subResources.map(s => ({
            id: s.attrs.id,
            type: s.attrs.type,
            props: s.props,
        })),
        nodes: {},
    };

    for (const entry of layout.entries) {
        sidecar.nodes[entry.psdPath] = buildSidecarEntry(entry, scene);
    }

    // 构造 PSD 图层树
    let layerByEntry = new Map();
    let rootChildren = [];

    for (const entry of layout.entries) {
        if (!entry.parentEntry) continue; // 根节点本身就是 PSD 画布
        let layer = await buildPsdLayer(entry, scene, projectRoot, projectIndex, sidecar.nodes[entry.psdPath], fontRegistry);
        layerByEntry.set(entry, layer);
        let parentLayer = layerByEntry.get(entry.parentEntry);
        if (parentLayer) {
            parentLayer.children = parentLayer.children || [];
            parentLayer.children.push(layer);
        } else {
            rootChildren.push(layer);
        }
    }

    if (!rootChildren.length) {
        rootChildren.push({
            name: 'placeholder', left: 0, top: 0, right: 1, bottom: 1,
            canvas: createCanvas(1, 1),
        });
    }

    let psd = {
        width: canvasFit.width,
        height: canvasFit.height,
        children: rootChildren,
    };

    let psdPath = path.join(outputDir, path.basename(tscnPath, '.tscn') + '.psd');
    let buffer = agPsd.writePsdBuffer(psd);
    await fs.writeFile(psdPath, buffer);
    console.log(`[tscn2psd] 生成 ${psdPath}`);

    let sidecarPath = psdPath + '.tscn2psd.json';
    await fs.writeFile(sidecarPath, JSON.stringify(sidecar, null, 2), 'utf-8');
    console.log(`[tscn2psd] 生成 ${sidecarPath}`);
}

function parseCanvasSize(spec) {
    if (!spec) return null;
    let m = String(spec).match(/^(\d+)x(\d+)$/i);
    if (!m) return null;
    return { x: +m[1], y: +m[2] };
}

function buildSidecarEntry(entry, scene) {
    return {
        name: entry.attrs.name,
        type: entry.nodeType,
        parentPath: entry.attrs.parent || null,
        size: entry.size,
        scaledSize: entry.scaledSize,
        worldScale: entry.worldScale,
        psdRect: entry.rect,
        attrs: entry.attrs,
        props: entry.props,
        extResRefs: extractExtResRefs(entry.props),
        subResRefs: extractSubResRefs(entry.props),
    };
}

function extractExtResRefs(props) {
    let out = [];
    for (const k in props) {
        let id = readExtResRef(props[k]);
        if (id) out.push({ key: k, extId: id });
    }
    return out;
}

function extractSubResRefs(props) {
    let out = [];
    for (const k in props) {
        let id = readSubResRef(props[k]);
        if (id) out.push({ key: k, subId: id });
    }
    return out;
}

// ============================================================================
// 8. PSD 图层构造（含纹理嵌入）
// ============================================================================

async function buildPsdLayer(entry, scene, projectRoot, projectIndex, sidecarEntry, fontRegistry) {
    let layerName = buildLayerNameForGodotNode(entry);
    let r = entry.rect;
    let left = Math.round(r.left);
    let top = Math.round(r.top);
    let right = Math.round(r.right);
    let bottom = Math.round(r.bottom);
    if (right <= left) right = left + 1;
    if (bottom <= top) bottom = top + 1;

    let layer = {
        name: layerName,
        left, top, right, bottom,
        hidden: readBool(entry.props.visible, true) === false,
        opacity: readModulateAlpha(entry.props),
    };

    // 是否有子节点（在 layout.entries 里查）
    // —— 通过 sidecar/scene 反推太麻烦；用 scene.nodes 直接判断
    let hasChildren = sceneHasChildren(scene, entry);

    let t = entry.nodeType;
    let textureCanvas = null;

    if (t === 'TextureRect' || t === 'NinePatchRect' || t === 'TextureButton') {
        // 选取主纹理属性
        let textureKey = t === 'TextureButton' ? 'texture_normal' : 'texture';
        textureCanvas = await loadTextureCanvasForNode(entry.props[textureKey], scene, projectRoot, projectIndex, right - left, bottom - top);
        if (sidecarEntry && textureCanvas) {
            sidecarEntry.embeddedTexture = textureCanvas._meta;
        }
    } else if (t === 'TextureProgressBar') {
        // ProgressBar 折叠了 bar / under 两张图。在 PSD 里展开成两个子图层（bar / bg），
        // 主节点本身做组图层。
        let underRef = entry.props.texture_under;
        let progressRef = entry.props.texture_progress;
        layer.children = layer.children || [];
        if (underRef) {
            let bgCanvas = await loadTextureCanvasForNode(underRef, scene, projectRoot, projectIndex, right - left, bottom - top);
            if (bgCanvas) {
                layer.children.push({
                    name: sanitizeName(entry.attrs.name || 'bg') + '_bg',
                    left, top, right, bottom,
                    canvas: bgCanvas,
                });
            }
        }
        if (progressRef) {
            let barCanvas = await loadTextureCanvasForNode(progressRef, scene, projectRoot, projectIndex, right - left, bottom - top);
            if (barCanvas) {
                layer.children.push({
                    name: sanitizeName(entry.attrs.name || 'bar') + '_bar@bar',
                    left, top, right, bottom,
                    canvas: barCanvas,
                });
            }
        }
        layer.opened = true;
    } else if (t === 'Label') {
        let labelResult = renderLabelCanvas(entry, right - left, bottom - top, entry.worldScale, fontRegistry, scene, projectRoot, projectIndex);
        layer.canvas = labelResult.canvas;
        layer.left = left - labelResult.pad;
        layer.top = top - labelResult.pad;
        layer.right = layer.left + labelResult.canvas.width;
        layer.bottom = layer.top + labelResult.canvas.height;
        return layer; // Label 没有子节点
    }

    if (hasChildren) {
        layer.children = layer.children || [];
        layer.opened = true;
        if (textureCanvas) {
            // 既有自身贴图又有子节点 → 把贴图作为底层 bg 子图层
            let bgName = sanitizeName(entry.attrs.name || 'bg') + '_bg';
            layer.children.unshift({
                name: bgName,
                left, top, right, bottom,
                canvas: textureCanvas,
            });
            if (sidecarEntry) sidecarEntry.bgLayerName = bgName;
        }
    } else if (textureCanvas) {
        layer.canvas = textureCanvas;
    } else if (!layer.children || !layer.children.length) {
        // 空叶子节点（Control / 容器但无子）
        layer.canvas = createCanvas(1, 1);
    }

    return layer;
}

function readModulateAlpha(props) {
    let modulate = readGodotColor(props.modulate);
    if (!modulate) return 255;
    return Math.round(modulate.a);
}

function sceneHasChildren(scene, entry) {
    let myPath = entry.psdPath; // '.' 或 'A/B'
    for (const n of scene.nodes) {
        let p = n.attrs.parent;
        if (p == null) continue;
        if (p === myPath) return true;
    }
    return false;
}

async function loadTextureCanvasForNode(textureProp, scene, projectRoot, projectIndex, w, h) {
    if (!textureProp) return null;
    let extId = readExtResRef(textureProp);
    if (!extId) return null;
    let ext = scene.extById.get(extId);
    if (!ext) return null;
    let absPath = ext.attrs.path ? resolveResPath(ext.attrs.path, projectRoot) : null;
    if (!absPath && ext.attrs.uid) {
        let info = projectIndex.byUid.get(ext.attrs.uid);
        if (info) absPath = info.absPath;
    }
    if (!absPath || !await fs.pathExists(absPath)) {
        console.warn(`[tscn2psd] 找不到纹理文件: ext=${extId} path=${ext.attrs.path}`);
        return null;
    }
    let img;
    try {
        img = await loadImage(absPath);
    } catch (e) {
        console.warn(`[tscn2psd] 加载纹理失败 ${absPath}: ${e.message}`);
        return null;
    }
    let cw = Math.max(1, Math.round(w));
    let ch = Math.max(1, Math.round(h));
    let canvas = createCanvas(cw, ch);
    let ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, cw, ch);
    canvas._meta = {
        sourceExtId: extId,
        sourcePath: absPath,
        sourceResPath: ext.attrs.path,
        sourceUid: ext.attrs.uid || null,
    };
    return canvas;
}

// ============================================================================
// 9. Label 渲染（与 prefab2psd 风格一致）
// ============================================================================

function preregisterFonts(scene, projectRoot) {
    let registry = new Map(); // ext_resource id -> family name
    for (const ext of scene.extResources) {
        let t = ext.attrs.type;
        if (t !== 'FontFile' && t !== 'Font' && t !== 'DynamicFont') continue;
        let absPath = ext.attrs.path ? resolveResPath(ext.attrs.path, projectRoot) : null;
        if (!absPath) continue;
        let extName = path.extname(absPath).toLowerCase();
        if (extName !== '.ttf' && extName !== '.otf') continue;
        let family = `t2p_${ext.attrs.id}`;
        try {
            registerFont(absPath, { family });
            registry.set(ext.attrs.id, family);
        } catch (e) {
            console.warn(`[tscn2psd] 字体注册失败 ${absPath}: ${e.message}`);
        }
    }
    return registry;
}

function colorToCss(c) {
    return `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${(c.a / 255).toFixed(3)})`;
}

function renderLabelCanvas(entry, w, h, worldScale, fontRegistry, scene, projectRoot, projectIndex) {
    let p = entry.props;
    let text = readString(p.text);
    if (text == null) text = '';

    let scaleX = Math.abs(worldScale.x || 1);
    let scaleY = Math.abs(worldScale.y || 1);
    let scaleAvg = (scaleX + scaleY) / 2;

    // theme_override_font_sizes/font_size
    let fontSize = (readNum(p['theme_override_font_sizes/font_size'], 16)) * scaleAvg;
    let lineHeight = (readNum(p['theme_override_constants/line_spacing'], 0) + readNum(p['theme_override_font_sizes/font_size'], 16)) * scaleAvg;
    if (lineHeight <= 0) lineHeight = fontSize * 1.2;

    let color = readGodotColor(p['theme_override_colors/font_color']) || { r: 255, g: 255, b: 255, a: 255 };

    // 字体：theme_override_fonts/font 是 ExtResource
    let fontExtId = readExtResRef(p['theme_override_fonts/font']);
    let family = fontExtId && fontRegistry.get(fontExtId) || 'Arial';

    // 描边
    let outlineW = readNum(p['theme_override_constants/outline_size'], 0) * scaleAvg;
    let outlineColor = readGodotColor(p['theme_override_colors/font_outline_color']) || { r: 0, g: 0, b: 0, a: 255 };

    // 阴影
    let shadowEnabled = false;
    let shadowOffsetX = readNum(p['theme_override_constants/shadow_offset_x'], 0) * scaleX;
    let shadowOffsetY = readNum(p['theme_override_constants/shadow_offset_y'], 0) * scaleY;
    let shadowBlur = readNum(p['theme_override_constants/shadow_outline_size'], 0) * scaleAvg;
    let shadowColor = readGodotColor(p['theme_override_colors/font_shadow_color']);
    if (shadowColor && shadowColor.a > 0 && (shadowOffsetX || shadowOffsetY || shadowBlur)) {
        shadowEnabled = true;
    }

    let pad = Math.ceil(outlineW + Math.max(Math.abs(shadowOffsetX), Math.abs(shadowOffsetY)) + shadowBlur + Math.max(4, fontSize * 0.15));
    let innerW = Math.max(1, Math.round(w));
    let innerH = Math.max(1, Math.round(h));
    let cw = innerW + pad * 2;
    let ch = innerH + pad * 2;
    let canvas = createCanvas(cw, ch);

    if (!text) return { canvas, pad };

    let ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px "${family}"`;
    ctx.fillStyle = colorToCss(color);

    // horizontal_alignment: 0=left, 1=center, 2=right, 3=fill
    let hAlign = readNum(p.horizontal_alignment, 0) | 0;
    ctx.textAlign = hAlign === 1 ? 'center' : hAlign === 2 ? 'right' : 'left';
    let xOrigin = (hAlign === 1 ? innerW / 2 : hAlign === 2 ? innerW : 0) + pad;
    ctx.textBaseline = 'top';

    let lines = text.split(/\r?\n/);
    let totalH = lineHeight * lines.length;
    // vertical_alignment: 0=top, 1=center, 2=bottom, 3=fill
    let vAlign = readNum(p.vertical_alignment, 0) | 0;
    let yStart;
    if (vAlign === 1) yStart = (innerH - totalH) / 2;
    else if (vAlign === 2) yStart = innerH - totalH;
    else yStart = 0;
    yStart += pad;

    let applyShadow = () => {
        if (shadowEnabled) {
            ctx.shadowColor = colorToCss(shadowColor);
            ctx.shadowOffsetX = shadowOffsetX;
            ctx.shadowOffsetY = shadowOffsetY;
            ctx.shadowBlur = shadowBlur;
        }
    };
    let clearShadow = () => {
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 0;
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let y = yStart + i * lineHeight + (lineHeight - fontSize) / 2;
        if (outlineW > 0) {
            applyShadow();
            ctx.strokeStyle = colorToCss(outlineColor);
            ctx.lineWidth = outlineW * 2;
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

    return { canvas, pad };
}

// ============================================================================
main().catch(e => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
});
