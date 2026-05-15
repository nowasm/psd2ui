(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('minimist'), require('ag-psd/initialize-canvas'), require('ag-psd'), require('fs-extra'), require('path'), require('crypto'), require('pinyin-pro'), require('canvas')) :
    typeof define === 'function' && define.amd ? define(['minimist', 'ag-psd/initialize-canvas', 'ag-psd', 'fs-extra', 'path', 'crypto', 'pinyin-pro', 'canvas'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.minimist, null, global.psd, global.fs, global.path, global.crypto, global.pinyinPro, global.canvas));
})(this, (function (minimist, initializeCanvas, psd, fs, path, crypto, pinyinPro, canvas) { 'use strict';

    function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n["default"] = e;
        return Object.freeze(n);
    }

    var minimist__default = /*#__PURE__*/_interopDefaultLegacy(minimist);
    var psd__namespace = /*#__PURE__*/_interopNamespace(psd);
    var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
    var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
    var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);
    var canvas__default = /*#__PURE__*/_interopDefaultLegacy(canvas);

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    // 注：保留 EditorVersion 仅是为了让 Main / GodotExporter 不需要重写过多。godot4 是唯一目标。
    var EditorVersion;
    (function (EditorVersion) {
        EditorVersion[EditorVersion["godot4"] = 100] = "godot4";
    })(EditorVersion || (EditorVersion = {}));
    class Utils {
        /** PSD 图层 / 节点用的随机 id（仅本进程内唯一即可）*/
        uuid() {
            var d = new Date().getTime();
            if (globalThis.performance && typeof globalThis.performance.now === "function") {
                d += performance.now();
            }
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
                return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
            return uuid;
        }
        isNumber(val) {
            return (!isNaN(parseFloat(val)) && isFinite(val));
        }
        /**
         * 生成 Godot 4 的资源 UID（uid://xxxxxxxxxxxxx，13 个 base32 字符）。
         * 实际形态来自 ResourceUID::id_to_text 的 64-bit base32 编码；
         * 这里直接用 13 字节随机数取低 5 位映射到字母表，统计上等价（65 bit 熵 → 取 64）。
         */
        godotUid() {
            const ALPHABET = "abcdefghijklmnopqrstuvwxyz012345";
            const bytes = crypto__default["default"].randomBytes(13);
            let chars = "";
            for (let i = 0; i < 13; i++) {
                chars += ALPHABET[bytes[i] & 31];
            }
            return "uid://" + chars;
        }
    }
    const utils = new Utils();

    class Color {
        constructor(r, g, b, a) {
            this.r = Math.ceil(r || 0);
            this.g = Math.ceil(g || 0);
            this.b = Math.ceil(b || 0);
            this.a = Math.ceil(a || 0);
        }
        set(color) {
            this.r = Math.ceil(color.r || 0);
            this.g = Math.ceil(color.g || 0);
            this.b = Math.ceil(color.b || 0);
            this.a = Math.ceil(color.a || 0);
        }
        toHEX(fmt = '#rrggbb') {
            const prefix = '0';
            // #rrggbb
            const hex = [
                (this.r < 16 ? prefix : '') + (this.r).toString(16),
                (this.g < 16 ? prefix : '') + (this.g).toString(16),
                (this.b < 16 ? prefix : '') + (this.b).toString(16),
            ];
            if (fmt === '#rgb') {
                hex[0] = hex[0][0];
                hex[1] = hex[1][0];
                hex[2] = hex[2][0];
            }
            else if (fmt === '#rrggbbaa') {
                hex.push((this.a < 16 ? prefix : '') + (this.a).toString(16));
            }
            return hex.join('');
        }
    }

    class Vec2 {
        constructor(x = 0, y = 0) {
            this.x = x || 0;
            this.y = y || 0;
        }
    }

    class Config {
        constructor() {
            this.help = `
--help            |   帮助信息
--init            |   初始化缓存文件              必须设置 --godot-project --cache
--force-img       |   强制导出图片                即使在有缓存的情况下也要导出
--input           |   输入目录或 psd 文件         非 init 时必选 [dir or psd]
--output          |   输出目录                   可选 缺省时为 --input [dir]
--godot-project   |   Godot 项目根                可选 用于将输出 .png 路径转换成 res://
--godot-font-path |   Godot 默认字体              可选 res:// 路径，用于 Label.theme_override_fonts/font
--cache           |   缓存文件全路径              可选 [file-full-path]
--cache-remake    |   重新生成缓存                可选
--config          |   预制体配置                  可选 [file-full-path]，可写 godot.defaultFont 等
--pinyin          |   中文图层名转拼音            可选
--img-only        |   只导出图片                  可选 不生成 .tscn
--json            |   json 对象参数               把所有参数 base64 编码后用 --json 透传
`;
            // 仅保留 godot4，统一让 PsdImage / GodotExporter 内部判断
            this.editorVersion = EditorVersion.godot4;
            // text 文本 Y 偏移（兼容 psd.config.json 的 textOffsetY）
            this.textOffsetY = {
                default: 0,
            };
            // 行高偏移（默认 0 = 行高跟字号一致）
            this.textLineHeightOffset = 0;
        }
    }
    const config = new Config();

    class FileUtils {
        // 深度遍历
        DFS(root, callback, depth = 0) {
            let exists = fs__default["default"].existsSync(root);
            if (!exists) {
                console.log(`FileUtils-> ${root} is not exists`);
                return;
            }
            let files = fs__default["default"].readdirSync(root);
            let _cacheDepth = depth;
            depth++;
            files.forEach((file) => {
                let fullPath = path__default["default"].join(root, file);
                let stat = fs__default["default"].lstatSync(fullPath);
                let isDirectory = stat.isDirectory();
                callback === null || callback === void 0 ? void 0 : callback({ isDirectory, fullPath, fileName: file, depth: _cacheDepth });
                if (!isDirectory) ;
                else {
                    this.DFS(fullPath, callback, depth);
                }
            });
        }
        filterFile(root, filter) {
            let exists = fs__default["default"].existsSync(root);
            if (!exists) {
                console.log(`FileUtils-> ${root} is not exists`);
                return;
            }
            var res = [];
            let files = fs__default["default"].readdirSync(root);
            files.forEach((file) => {
                let pathName = path__default["default"].join(root, file);
                let stat = fs__default["default"].lstatSync(pathName);
                let isDirectory = stat.isDirectory();
                // 只对文件进行判断
                if (!isDirectory) {
                    let isPass = filter(file);
                    if (!isPass) {
                        return;
                    }
                }
                if (!isDirectory) {
                    res.push(pathName);
                }
                else {
                    res = res.concat(this.filterFile(pathName, filter));
                }
            });
            return res;
        }
        getFolderFiles(dir, type) {
            let exists = fs__default["default"].existsSync(dir);
            if (!exists) {
                console.log(`FileUtils-> ${dir} is not exists`);
                return;
            }
            let res = [];
            let files = fs__default["default"].readdirSync(dir);
            files.forEach((file) => {
                let fullPath = path__default["default"].join(dir, file);
                let stat = fs__default["default"].lstatSync(fullPath);
                let isDirectory = stat.isDirectory();
                if (isDirectory) {
                    if (type === 'folder') {
                        res.push({ fullPath, basename: file });
                    }
                }
                else {
                    if (type === 'file') {
                        res.push({ fullPath, basename: file });
                    }
                }
            });
            return res;
        }
        writeFile(fullPath, data) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof data !== 'string') {
                    try {
                        data = JSON.stringify(data, null, 2);
                    }
                    catch (error) {
                        console.log(`FileUtils->writeFile `, error);
                        return;
                    }
                }
                console.log(`写入文件 ${fullPath}`);
                let dir = path__default["default"].dirname(fullPath);
                yield fs__default["default"].mkdirp(dir);
                yield fs__default["default"].writeFile(fullPath, data);
                console.log(`写入完成 ${fullPath} `);
            });
        }
        /** 获取文件的 md5 */
        getMD5(buffer) {
            if (typeof buffer === 'string') {
                buffer = fs__default["default"].readFileSync(buffer);
            }
            let md5 = crypto__default["default"].createHash("md5").update(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)).digest("hex");
            return md5;
        }
    }
    let fileUtils = new FileUtils();

    class ImageCacheMgr {
        constructor() {
            this._imageMap = new Map();
            this._cachePath = null;
        }
        initWithPath(_path) {
            if (!fs__default["default"].existsSync(_path)) {
                console.log(`ImageCacheMgr-> 文件不存在: ${_path}`);
                return;
            }
            this._cachePath = _path;
            let content = fs__default["default"].readFileSync(_path, "utf-8");
            this.initWithFile(content);
        }
        initWithFile(file) {
            let json = JSON.parse(file);
            this.initWithJson(json);
        }
        initWithJson(json) {
            for (const key in json) {
                if (Object.prototype.hasOwnProperty.call(json, key)) {
                    this._imageMap.set(key, json[key]);
                }
            }
        }
        set(md5, warp) {
            this._imageMap.set(md5, warp);
        }
        has(md5) {
            return this._imageMap.has(md5);
        }
        get(md5) {
            return this._imageMap.get(md5);
        }
        saveImageMap(_path) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!_path) {
                    _path = this._cachePath;
                }
                if (!_path) {
                    console.log(`ImageCacheMgr-> 缓存路径 [${_path}] 不存在，无法保存  `);
                    return;
                }
                let obj = Object.create(null);
                this._imageMap.forEach((v, k) => {
                    obj[k] = v;
                });
                let content = JSON.stringify(obj, null, 2);
                yield fileUtils.writeFile(_path, content);
            });
        }
        // 标准化扫描入口由 GodotExporter.loadProjectImageCache 提供（读取 .png.import）
        static getInstance() {
            if (!this._instance) {
                this._instance = new ImageCacheMgr();
            }
            return this._instance;
        }
    }
    ImageCacheMgr._instance = null;
    const imageCacheMgr = ImageCacheMgr.getInstance();

    class ImageMgr {
        constructor() {
            // 镜像图像管理
            this._imageIdKeyMap = new Map();
            // 当前 psd 所有的图片
            this._imageMapMd5Key = new Map();
            this._imageMapImgNameKey = new Map();
        }
        // /** 相同名称不同  md5 图片的后缀id */
        // private _sameImgNameId: Record<string, number> = {};
        add(psdImage) {
            var _a;
            // 不忽略导出图片
            if (!psdImage.isIgnore() && !psdImage.isBind()) {
                if (!this._imageMapMd5Key.has(psdImage.name)) {
                    this._imageMapMd5Key.set(psdImage.name, psdImage);
                }
            }
            if (typeof ((_a = psdImage.attr.comps.img) === null || _a === void 0 ? void 0 : _a.id) != "undefined") {
                let id = psdImage.attr.comps.img.id;
                if (this._imageIdKeyMap.has(id)) {
                    console.warn(`ImageMgr-> ${psdImage.source.name} 已有相同 @img{id:${id}}，请检查 psd 图层`);
                }
                this._imageIdKeyMap.set(id, psdImage);
            }
            this.handleSameImgName(psdImage, psdImage.imgName, 0);
        }
        /**
         * 处理相同名称的图片
         *
         * @param {PsdImage} psdImage
         * @param {string} imgName
         * @param {number} idx
         * @memberof ImageMgr
         */
        handleSameImgName(psdImage, imgName, idx) {
            if (this._imageMapImgNameKey.has(imgName)) {
                let _psdImage = this._imageMapImgNameKey.get(imgName);
                if (_psdImage.name != psdImage.name) {
                    this.handleSameImgName(psdImage, `${psdImage.imgName}_R${idx}`, idx + 1);
                }
                else {
                    psdImage.imgName = imgName;
                }
            }
            else {
                psdImage.imgName = imgName;
                this._imageMapImgNameKey.set(imgName, psdImage);
            }
        }
        getAllImage() {
            return this._imageMapMd5Key;
        }
        /** 尝试获取有编号的图像图层 */
        getSerialNumberImage(psdImage) {
            var _a, _b, _c;
            let bind = (_b = (_a = psdImage.attr.comps.flip) === null || _a === void 0 ? void 0 : _a.bind) !== null && _b !== void 0 ? _b : (_c = psdImage.attr.comps.img) === null || _c === void 0 ? void 0 : _c.bind;
            if (typeof bind != 'undefined') {
                if (this._imageIdKeyMap.has(bind)) {
                    return this._imageIdKeyMap.get(bind);
                }
                else {
                    console.warn(`ImageMgr-> ${psdImage.source.name} 未找到绑定的图像 {${bind}}，请检查 psd 图层`);
                }
            }
            return psdImage;
        }
        clear() {
            this._imageIdKeyMap.clear();
            this._imageMapMd5Key.clear();
        }
        static getInstance() {
            if (!this._instance) {
                this._instance = new ImageMgr();
            }
            return this._instance;
        }
    }
    ImageMgr._instance = null;
    const imageMgr = ImageMgr.getInstance();

    var LayerType;
    (function (LayerType) {
        LayerType[LayerType["Doc"] = 0] = "Doc";
        LayerType[LayerType["Group"] = 1] = "Group";
        LayerType[LayerType["Text"] = 2] = "Text";
        LayerType[LayerType["Image"] = 3] = "Image";
    })(LayerType || (LayerType = {}));

    class Rect {
        constructor(left = 0, right = 0, top = 0, bottom = 0) {
            if (typeof left == 'object') {
                this.set(left);
                return;
            }
            this.left = left || 0;
            this.right = right || 0;
            this.top = top || 0;
            this.bottom = bottom || 0;
        }
        set(rect) {
            this.left = rect.left;
            this.right = rect.right;
            this.top = rect.top;
            this.bottom = rect.bottom;
        }
    }

    class Size {
        constructor(width = 0, height = 0) {
            this.width = width || 0;
            this.height = height || 0;
        }
    }

    class Vec3 {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x || 0;
            this.y = y || 0;
            this.z = z || 0;
        }
    }

    class PsdLayer {
        constructor(source, parent, rootDoc) {
            var _a;
            this.uuid = utils.uuid();
            this.source = source;
            this.parent = parent;
            this.rootDoc = rootDoc;
            this.name = source.name;
            this.position = new Vec2();
            this.size = new Size();
            this.rect = new Rect(source);
            // this.anchorPoint = new Vec2();
            this.anchorPoint = new Vec2(0.5, 0.5);
            this.hidden = false;
            this.opacity = 255;
            this.color = new Color(255, 255, 255, 255);
            console.log(`PsdLayer->解析到图层 `, this.name);
            this.attr = this.parseNameRule(this.name);
            // // 更新名字
            this.name = this.chineseToPinyin(((_a = this.attr) === null || _a === void 0 ? void 0 : _a.name) || this.name);
            // 使用配置的缩放系数
            // let _scale = this.attr?.comps.scale;
            // this.scale = new Vec3(_scale?.x ?? 1, _scale?.y ?? 1, 1);
            this.scale = new Vec3(1, 1, 1);
        }
        parseNameRule(name) {
            var _a, _b, _c;
            if (!name) {
                return;
            }
            name = name.trim();
            let fragments = name.split("@");
            if (fragments.length === 0) {
                console.error(`PsdLayer-> 名字解析错误`);
                return;
            }
            let obj = {
                name: (_c = (_b = (_a = fragments[0]) === null || _a === void 0 ? void 0 : _a.trim()) === null || _b === void 0 ? void 0 : _b.replace(/\.|>|\/|\ /g, "_")) !== null && _c !== void 0 ? _c : "unknow",
                comps: {},
            };
            for (let i = 1; i < fragments.length; i++) {
                const fragment = this.removeChineseFromEnd(fragments[i].trim()).trim(); // 删除规则尾部的中文
                let attr = {};
                let startIdx = fragment.indexOf("{");
                let comp = fragment;
                if (startIdx != -1) {
                    let endIdx = fragment.indexOf("}");
                    if (endIdx == -1) {
                        console.log(`PsdLayer->${name} 属性 解析错误`);
                        continue;
                    }
                    let attrStr = fragment.substring(startIdx + 1, endIdx);
                    comp = fragment.substr(0, startIdx);
                    attrStr = attrStr.trim();
                    let attrs = attrStr.split(",");
                    attrs.forEach((str) => {
                        str = str.trim();
                        let strs = str.split(":");
                        if (!strs.length) {
                            console.log(`PsdLayer->${name} 属性 解析错误`);
                            return;
                        }
                        strs.map((v) => {
                            return v.trim();
                        });
                        attr[strs[0]] = utils.isNumber(strs[1]) ? parseFloat(strs[1]) : strs[1];
                    });
                }
                comp = comp.trim();
                comp = comp.replace(":", ""); // 防呆，删除 key 中的冒号，
                obj.comps[comp] = attr;
            }
            // 获取别名的值
            obj.comps.ignore = obj.comps.ignore || obj.comps.ig;
            obj.comps.ignorenode = obj.comps.ignorenode || obj.comps.ignode;
            obj.comps.ignoreimg = obj.comps.ignoreimg || obj.comps.igimg;
            obj.comps.Btn = obj.comps.Btn || obj.comps.btn;
            obj.comps.ProgressBar = obj.comps.ProgressBar || obj.comps.progressBar;
            obj.comps.Toggle = obj.comps.Toggle || obj.comps.toggle;
            // 图片名中文转拼音
            if (obj.comps.img) {
                if (obj.comps.img.name) {
                    obj.comps.img.name = this.chineseToPinyin(obj.comps.img.name);
                }
            }
            // 将mirror filpX filpY  进行合并
            if (obj.comps.flip || obj.comps.flipX || obj.comps.flipY) {
                obj.comps.flip = Object.assign({}, obj.comps.flip, obj.comps.flipX, obj.comps.flipY);
                if (obj.comps.flipX) {
                    obj.comps.flip.x = 1;
                }
                if (obj.comps.flipY) {
                    obj.comps.flip.y = 1;
                }
                //   x,y 都缺省时，默认 x 方向镜像
                if (typeof obj.comps.flip.bind !== 'undefined') {
                    if (!obj.comps.flip.y) {
                        obj.comps.flip.x = 1;
                    }
                    // 只有作为镜像图片使用的时候才反向赋值
                    // 反向赋值，防止使用的时候值错误
                    if (obj.comps.flip.x) {
                        obj.comps.flipX = Object.assign({}, obj.comps.flipX, obj.comps.flip);
                    }
                    if (obj.comps.flip.y) {
                        obj.comps.flipY = Object.assign({}, obj.comps.flipY, obj.comps.flip);
                    }
                }
            }
            // // 检查冲突
            // if (obj.comps.full && obj.comps.size) {
            //     console.warn(`PsdLayer->${obj.name} 同时存在 @full 和 @size`);
            // }
            return obj;
        }
        removeChineseFromEnd(inputString) {
            if (!inputString) {
                return inputString;
            }
            const chineseRegex = /[\u4e00-\u9fa5]+$/;
            const match = inputString.trim().match(chineseRegex);
            if (match && match[0]) {
                const chineseLength = match[0].length;
                return this.removeChineseFromEnd(inputString.slice(0, -chineseLength));
            }
            return inputString;
        }
        /** 解析数据 */
        parseSource() {
            var _a, _b;
            let _source = this.source;
            // psd文档
            if (!this.parent) {
                return false;
            }
            this.hidden = _source.hidden;
            this.opacity = Math.round(_source.opacity * 255);
            // 获取锚点
            let ar = this.attr.comps.ar;
            if (ar) {
                this.anchorPoint.x = (_a = ar.x) !== null && _a !== void 0 ? _a : this.anchorPoint.x;
                this.anchorPoint.y = (_b = ar.y) !== null && _b !== void 0 ? _b : this.anchorPoint.y;
            }
            this.computeBasePosition();
            return true;
        }
        /** 解析 effect */
        parseEffects() {
            // 颜色叠加 暂时搞不定
            // if(this.source.effects?.solidFill){
            //     let solidFills = this.source.effects?.solidFill;
            //     for (let i = 0; i < solidFills.length; i++) {
            //         const solidFill = solidFills[i];
            //         if(solidFill.enabled){
            //             let color = solidFill.color;
            //             this.color = new Color(color.r,color.g,color.b,solidFill.opacity * 255);
            //         }
            //     }
            // }
        }
        /** 中文转拼音 */
        chineseToPinyin(text) {
            if (!text || !PsdLayer.isPinyin) {
                return text;
            }
            let reg = new RegExp("[\\u4E00-\\u9FFF]+", "g");
            if (!reg.test(text)) {
                return text;
            }
            let names = pinyinPro.pinyin(text, {
                toneType: "none",
                type: "array"
            });
            names = names.map((text) => {
                return text.slice(0, 1).toUpperCase() + text.slice(1).toLowerCase();
            });
            return names.join("");
        }
        // 计算初始坐标 左下角 0,0 为锚点
        computeBasePosition() {
            if (!this.rootDoc) {
                return;
            }
            let _rect = this.rect;
            let width = (_rect.right - _rect.left);
            let height = (_rect.bottom - _rect.top);
            this.size.width = width;
            this.size.height = height;
            // 位置 左下角为锚点
            let x = _rect.left;
            let y = (this.rootDoc.size.height - _rect.bottom);
            this.position.x = x;
            this.position.y = y;
        }
        // 根据锚点计算坐标
        updatePositionWithAR() {
            if (!this.parent) {
                return;
            }
            let parent = this.parent;
            while (parent) {
                this.position.x -= parent.position.x;
                this.position.y -= parent.position.y;
                parent = parent.parent;
            }
            // this.position.x  = this.position.x - this.parent.size.width * this.parent.anchorPoint.x + this.size.width * this.anchorPoint.x;
            // this.position.y  = this.position.y - this.parent.size.height * this.parent.anchorPoint.y + this.size.height * this.anchorPoint.y;
            this.position.x = this.position.x - this.rootDoc.size.width * this.rootDoc.anchorPoint.x + this.size.width * this.anchorPoint.x;
            this.position.y = this.position.y - this.rootDoc.size.height * this.rootDoc.anchorPoint.y + this.size.height * this.anchorPoint.y;
        }
    }
    PsdLayer.isPinyin = false;

    class PsdGroup extends PsdLayer {
        constructor(source, parent, rootDoc) {
            super(source, parent, rootDoc);
            this.children = [];
            if (rootDoc) {
                this.rect = new Rect(0, rootDoc.size.width, 0, rootDoc.size.height);
            }
        }
        parseSource() {
            var _a;
            super.parseSource();
            if (!((_a = this.attr) === null || _a === void 0 ? void 0 : _a.comps.full)) {
                this.resize();
                this.computeBasePosition();
            }
            return true;
        }
        resize() {
            if (!this.children.length) {
                return;
            }
            let left = Number.MAX_SAFE_INTEGER;
            let right = Number.MIN_SAFE_INTEGER;
            let top = Number.MAX_SAFE_INTEGER;
            let bottom = Number.MIN_SAFE_INTEGER;
            for (let i = 0; i < this.children.length; i++) {
                const element = this.children[i];
                let _rect = element.rect;
                left = Math.min(_rect.left, left);
                right = Math.max(_rect.right, right);
                top = Math.min(_rect.top, top);
                bottom = Math.max(_rect.bottom, bottom);
            }
            this.rect.left = left;
            this.rect.right = right;
            this.rect.top = top;
            this.rect.bottom = bottom;
        }
        onCtor() {
        }
    }

    class PsdDocument extends PsdGroup {
        constructor(source) {
            super(source, null, null);
            /** 当前文档所有的图片 */
            this.images = new Map();
            this.objectMap = new Map();
            this.objectArray = [];
            this.size = new Size(source.width, source.height);
            this.rect = new Rect(0, this.size.width, 0, this.size.height);
        }
        pushObject(uiObject) {
            let idx = this.objectArray.length;
            uiObject.idx = idx;
            this.objectMap.set(uiObject.uuid, idx);
            this.objectArray.push(uiObject);
            return idx;
        }
        getObjectIdx(uuid) {
            let idx = this.objectMap.get(uuid);
            return idx;
        }
        getObject(uuid) {
            let idx = this.objectMap.get(uuid);
            if (idx < this.objectArray.length) {
                return this.objectArray[idx];
            }
            return null;
        }
        onCtor() {
            super.onCtor();
        }
    }

    class Texture9Utils {
        static safeBorder(_canvas, border) {
            var _a, _b, _c, _d;
            border.l = ((_a = border.l) !== null && _a !== void 0 ? _a : border.r) || 0;
            border.r = ((_b = border.r) !== null && _b !== void 0 ? _b : border.l) || 0;
            border.t = ((_c = border.t) !== null && _c !== void 0 ? _c : border.b) || 0;
            border.b = ((_d = border.b) !== null && _d !== void 0 ? _d : border.t) || 0;
            return border;
        }
        static split(_canvas, border) {
            this.safeBorder(_canvas, border);
            let cw = _canvas.width;
            let ch = _canvas.height;
            let space = 4;
            let left = border.l || cw;
            let right = border.r || cw;
            let top = border.t || ch;
            let bottom = border.b || ch;
            if (border.b == 0 && border.t == 0 && border.l == 0 && border.r == 0) {
                return _canvas;
            }
            if (border.l + border.r > cw + space) {
                console.log(`Texture9Utils-> 设置的九宫格 left， right 数据不合理，请重新设置`);
                return _canvas;
            }
            if (border.b + border.t > ch + space) {
                console.log(`Texture9Utils-> 设置的九宫格 bottom， top 数据不合理，请重新设置`);
                return _canvas;
            }
            let imgW = border.l + border.r == 0 ? cw : Math.min(cw, border.l + border.r + space);
            let imgH = border.b + border.t == 0 ? ch : Math.min(ch, border.b + border.t + space);
            let newCanvas = canvas__default["default"].createCanvas(imgW, imgH);
            let ctx = newCanvas.getContext("2d");
            // 左上
            ctx.drawImage(_canvas, 0, 0, left + space, top + space, 0, 0, left + space, top + space);
            // 左下
            ctx.drawImage(_canvas, 0, ch - bottom, left + space, bottom, 0, top + space, left + space, bottom);
            // 右上
            ctx.drawImage(_canvas, cw - left, 0, right, top + space, left + space, 0, right, top + space);
            // 右下
            ctx.drawImage(_canvas, cw - left, ch - bottom, right, bottom, left + space, top + space, right, bottom);
            return newCanvas;
        }
    }

    class PsdImage extends PsdLayer {
        constructor(source, parent, rootDoc) {
            var _a;
            super(source, parent, rootDoc);
            this.textureUuid = utils.uuid();
            // img name
            this.imgName = ((_a = this.attr.comps.img) === null || _a === void 0 ? void 0 : _a.name) || this.name;
            // .9：Godot 用 NinePatchRect + patch_margin_*，保留整张原图，只记 s9 边界
            if (this.attr.comps['.9']) {
                let s9 = this.attr.comps['.9'];
                this.s9 = Texture9Utils.safeBorder(this.source.canvas, s9);
            }
            let canvas = this.source.canvas;
            this.imgBuffer = canvas.toBuffer('image/png');
            this.md5 = fileUtils.getMD5(this.imgBuffer);
            this.textureSize = new Size(canvas.width, canvas.height);
            this.scale = new Vec3((this.isFlipX() ? -1 : 1) * this.scale.x, (this.isFlipY() ? -1 : 1) * this.scale.y, 1);
        }
        onCtor() {
        }
        isIgnore() {
            // 
            if (this.attr.comps.ignore || this.attr.comps.ignoreimg) {
                return true;
            }
            return false;
        }
        /** 是否是镜像图片 */
        isBind() {
            var _a, _b;
            return typeof ((_a = this.attr.comps.flip) === null || _a === void 0 ? void 0 : _a.bind) !== 'undefined'
                || typeof ((_b = this.attr.comps.img) === null || _b === void 0 ? void 0 : _b.bind) !== 'undefined';
        }
        /** 是否是 x 方向镜像图片 */
        isFlipX() {
            var _a;
            return typeof ((_a = this.attr.comps.flipX) === null || _a === void 0 ? void 0 : _a.bind) !== 'undefined';
        }
        /** 是否是 y 方向镜像图片 */
        isFlipY() {
            var _a;
            return typeof ((_a = this.attr.comps.flipY) === null || _a === void 0 ? void 0 : _a.bind) !== 'undefined';
        }
        // 根据锚点计算坐标
        updatePositionWithAR() {
            if (!this.parent) {
                return;
            }
            let parent = this.parent;
            while (parent) {
                this.position.x -= parent.position.x;
                this.position.y -= parent.position.y;
                parent = parent.parent;
            }
            // this.position.x  = this.position.x - this.parent.size.width * this.parent.anchorPoint.x + this.size.width * this.anchorPoint.x;
            // this.position.y  = this.position.y - this.parent.size.height * this.parent.anchorPoint.y + this.size.height * this.anchorPoint.y;
            // 如果是镜像图片，则特殊处理
            let arX = (this.isFlipX() ? (1 - this.anchorPoint.x) : this.anchorPoint.x);
            let arY = (this.isFlipY() ? (1 - this.anchorPoint.y) : this.anchorPoint.y);
            this.position.x = this.position.x - this.rootDoc.size.width * this.rootDoc.anchorPoint.x + this.size.width * arX;
            this.position.y = this.position.y - this.rootDoc.size.height * this.rootDoc.anchorPoint.y + this.size.height * arY;
        }
    }

    class PsdText extends PsdLayer {
        parseSource() {
            super.parseSource();
            let textSource = this.source.text;
            let style = textSource.style;
            if (style) {
                let fillColor = style.fillColor;
                if (fillColor) {
                    this.color = new Color(fillColor.r, fillColor.g, fillColor.b, fillColor.a * 255);
                }
            }
            this.text = textSource.text;
            // 可能会对文本图层进行缩放，这里计算缩放之后的时机字体大小
            if (Math.abs(1 - textSource.transform[0]) > 0.001) {
                this.fontSize = Math.round(style.fontSize * textSource.transform[0] * 100) / 100;
            }
            else {
                this.fontSize = style.fontSize;
            }
            this.offsetY = config.textOffsetY[this.fontSize] || config.textOffsetY["default"] || 0;
            this.parseSolidFill();
            this.parseStroke();
            return true;
        }
        onCtor() {
        }
        /** 描边 */
        parseStroke() {
            var _a, _b;
            if ((_a = this.source.effects) === null || _a === void 0 ? void 0 : _a.stroke) {
                let stroke = (_b = this.source.effects) === null || _b === void 0 ? void 0 : _b.stroke[0];
                // 外描边
                if ((stroke === null || stroke === void 0 ? void 0 : stroke.enabled) && (stroke === null || stroke === void 0 ? void 0 : stroke.position) === "outside") {
                    let color = stroke.color;
                    this.outline = {
                        width: stroke.size.value,
                        color: new Color(color.r, color.g, color.b, stroke.opacity * 255)
                    };
                }
            }
        }
        /** 解析 颜色叠加 */
        parseSolidFill() {
            var _a, _b;
            if ((_a = this.source.effects) === null || _a === void 0 ? void 0 : _a.solidFill) {
                let solidFills = (_b = this.source.effects) === null || _b === void 0 ? void 0 : _b.solidFill;
                for (let i = 0; i < solidFills.length; i++) {
                    const solidFill = solidFills[i];
                    if (solidFill.enabled) {
                        let color = solidFill.color;
                        this.color = new Color(color.r, color.g, color.b, solidFill.opacity * 255);
                    }
                }
            }
        }
    }

    class Parser {
        /** 解析图层类型 */
        parseLayerType(source) {
            if ("children" in source) {
                if ("width" in source && "height" in source) {
                    // Document
                    return LayerType.Doc;
                }
                else {
                    // Group
                    return LayerType.Group;
                }
            }
            else if ("text" in source) {
                //  Text
                return LayerType.Text;
            }
            // else if ('placedLayer' in layer) {
            //     // 智能对象
            // }
            return LayerType.Image;
        }
        parseLayer(source, parent, rootDoc) {
            let layer = null;
            let layerType = this.parseLayerType(source);
            switch (layerType) {
                case LayerType.Doc:
                case LayerType.Group:
                    {
                        let group = null;
                        // Group
                        if (layerType == LayerType.Group) {
                            group = new PsdGroup(source, parent, rootDoc);
                            if (group.attr.comps.ignorenode || group.attr.comps.ignore) {
                                return null;
                            }
                        }
                        else {
                            // Document
                            group = new PsdDocument(source);
                        }
                        for (let i = 0; i < source.children.length; i++) {
                            const childSource = source.children[i];
                            let child = this.parseLayer(childSource, group, rootDoc || group);
                            if (child) {
                                if (!child.attr.comps.ignorenode && !child.attr.comps.ignore) {
                                    // 没有进行忽略节点的时候才放入列表
                                    group.children.push(child);
                                }
                            }
                            else {
                                console.error(`图层解析错误`);
                            }
                        }
                        layer = group;
                    }
                    break;
                case LayerType.Image:
                    {
                        // 
                        if (!source.canvas) {
                            console.error(`Parser-> 空图层 ${source === null || source === void 0 ? void 0 : source.name}`);
                            return null;
                        }
                        // Image
                        let image = layer = new PsdImage(source, parent, rootDoc);
                        imageMgr.add(image);
                        // 没有设置忽略且不说镜像的情况下才进行缓存
                        if (!image.isIgnore() && !image.isBind()) {
                            if (!imageCacheMgr.has(image.name)) {
                                imageCacheMgr.set(image.name, {
                                    uuid: image.uuid,
                                    textureUuid: image.textureUuid,
                                });
                            }
                        }
                    }
                    break;
                case LayerType.Text:
                    {
                        //  Text
                        layer = new PsdText(source, parent, rootDoc);
                    }
                    break;
            }
            layer.layerType = layerType;
            layer.parseSource();
            layer.onCtor();
            return layer;
        }
    }
    const parser = new Parser();


    class ExportImageMgr {
        constructor() {
            this.textObjects = [];
        }
        test() {
            const outDir = path__default["default"].join(__dirname, "..", "out");
            let psdPath = "./test-img-only/境界奖励-优化.psd";
            this.parsePsd(psdPath, outDir);
        }
        exec(args) {
            return __awaiter(this, void 0, void 0, function* () {
                // 检查参数
                if (!this.checkArgs(args)) {
                    return;
                }
                // 判断输入是文件夹还是文件
                let stat = fs__default["default"].lstatSync(args.input);
                let isDirectory = stat.isDirectory();
                if (isDirectory) {
                    if (!args.output) {
                        args.output = path__default["default"].join(args.input, "psd2ui");
                    }
                    this.parsePsdDir(args.input, args.output);
                }
                else {
                    if (!args.output) {
                        let input_dir = path__default["default"].dirname(args.input);
                        args.output = path__default["default"].join(input_dir, "psd2ui");
                    }
                    this.parsePsd(args.input, args.output);
                }
            });
        }
        // 检查参数
        checkArgs(args) {
            if (!args.input) {
                console.error(`请设置 --input`);
                return false;
            }
            if (!fs__default["default"].existsSync(args.input)) {
                console.error(`输入路径不存在: ${args.input}`);
                return false;
            }
            return true;
        }
        parsePsdDir(dir, outDir) {
            return __awaiter(this, void 0, void 0, function* () {
                // 清空目录
                fs__default["default"].emptyDirSync(outDir);
                let psds = fileUtils.filterFile(dir, (fileName) => {
                    let extname = path__default["default"].extname(fileName);
                    if (extname == ".psd") {
                        return true;
                    }
                    return false;
                });
                for (let i = 0; i < psds.length; i++) {
                    const element = psds[i];
                    yield this.parsePsd(element, outDir);
                }
            });
        }
        parsePsd(psdPath, outDir) {
            return __awaiter(this, void 0, void 0, function* () {
                // 每开始一个新的 psd 清理掉上一个 psd 的图
                imageMgr.clear();
                this.textObjects.length = 0;
                console.log(`=========================================`);
                console.log(`处理 ${psdPath} 文件`);
                let psdName = path__default["default"].basename(psdPath, ".psd");
                let buffer = fs__default["default"].readFileSync(psdPath);
                const psdFile = psd__namespace.readPsd(buffer);
                let psdRoot = parser.parseLayer(psdFile);
                psdRoot.name = psdName;
                let prefabDir = path__default["default"].join(outDir, psdName);
                let textureDir = path__default["default"].join(prefabDir, "textures");
                fs__default["default"].mkdirsSync(prefabDir); // 创建预制体根目录
                fs__default["default"].emptyDirSync(prefabDir);
                fs__default["default"].mkdirsSync(textureDir); //创建 图片目录
                yield this.saveImage(textureDir);
                yield this.saveTextFile(psdRoot, prefabDir);
                console.log(`psd2ui ${psdPath} 处理完成`);
            });
        }
        saveImage(out) {
            let images = imageMgr.getAllImage();
            let idx = 0;
            images.forEach((psdImage, k) => {
                // 查找镜像
                let _layer = imageMgr.getSerialNumberImage(psdImage);
                let name = `${_layer.imgName}_${idx}`;
                console.log(`保存图片 [${_layer.imgName}] 重命名为 [${name}] md5: ${_layer.md5}`);
                let fullpath = path__default["default"].join(out, `${name}.png`);
                fs__default["default"].writeFileSync(fullpath, new Uint8Array(_layer.imgBuffer.buffer, _layer.imgBuffer.byteOffset, _layer.imgBuffer.byteLength));
                idx++;
            });
        }
        saveTextFile(psdRoot, out) {
            this.scanText(psdRoot, psdRoot);
            let textContent = JSON.stringify(this.textObjects, null, 2);
            let fullpath = path__default["default"].join(out, `text.txt`);
            fs__default["default"].writeFileSync(fullpath, textContent, { encoding: "utf-8" });
        }
        scanText(layer, psdRoot) {
            if (layer instanceof PsdGroup) {
                for (let i = 0; i < layer.children.length; i++) {
                    const childLayer = layer.children[i];
                    this.scanText(childLayer, psdRoot);
                }
            }
            else if (layer instanceof PsdText) {
                let textObj = {
                    text: layer.text,
                    fontSize: layer.fontSize,
                    color: `#${layer.color.toHEX()}`
                };
                // 有描边
                if (layer.outline) {
                    textObj.outlineWidth = layer.outline.width;
                    textObj.outlineColor = `#${layer.outline.color.toHEX()}`;
                }
                this.textObjects.push(textObj);
            }
        }
        static getInstance() {
            if (!this._instance) {
                this._instance = new ExportImageMgr();
            }
            return this._instance;
        }
    }
    ExportImageMgr._instance = null;
    let exportImageMgr = ExportImageMgr.getInstance();

    // ag-psd 使用 参考 https://github.com/Agamnentzar/ag-psd/blob/HEAD/README_PSD.md
    /***
     * 执行流程：
     *  - 加载缓存文件 godot-psd-to-prefab-cache.json（如有）
     *  - 解析 psd → PsdLayer 树
     *  - 已有资源（按 layer name 命中缓存）直接复用 uid，否则导出新 .png + .png.import 并入缓存
     *  - 把树构造成 GodotScene → 序列化为 .tscn
     */
    console.log(`当前目录： `, __dirname);

    /** 渲染端抽象基类。本工具只有一个实现 GodotExporter，但留 IExporter 方便后续扩展或测试 */
    class IExporter {
        constructor() {
            this.psdConfig = null;
            this.isForceImg = false;
        }
        /** exec 阶段调用。子类按需加载模板等 */
        init(args) {
            return __awaiter(this, void 0, void 0, function* () {
                this.isForceImg = !!args["force-img"];
                if (args.config) {
                    yield this.loadPsdConfig(args.config);
                }
            });
        }
        /** 加载 psd.config.json。psdConfig 仅由本 exporter 使用，但全局 textOffsetY 等会同步到 config */
        loadPsdConfig(filepath) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!fs__default["default"].existsSync(filepath)) {
                    console.log(`Exporter-> 配置 ${filepath} 不存在`);
                    return;
                }
                let raw = fs__default["default"].readFileSync(filepath, "utf-8");
                this.psdConfig = JSON.parse(raw);
                for (const key in this.psdConfig) {
                    if (key in config) {
                        if (typeof this.psdConfig[key] === 'object') {
                            config[key] = Object.assign({}, config[key], this.psdConfig[key]);
                        } else {
                            config[key] = this.psdConfig[key] || config[key];
                        }
                    }
                }
            });
        }
        /** 扫描项目内已有图片，注入到 imageCacheMgr。子类按引擎 meta 格式解析 */
        loadProjectImageCache(projectAssetsDir) {
            return __awaiter(this, void 0, void 0, function* () {
                // 默认实现：不做事。Cocos 子类在内部走 imageCacheMgr.loadImages
            });
        }
        /** 把 imageMgr 中所有 PsdImage 落盘并写引擎 meta */
        saveImages(textureDir) {
            return __awaiter(this, void 0, void 0, function* () {
                throw new Error("saveImages not implemented");
            });
        }
        /** 由 PsdLayer 树构造引擎中间结构 */
        buildPrefab(psdRoot) {
            throw new Error("buildPrefab not implemented");
        }
        /** 把中间结构序列化到磁盘 */
        savePrefab(psdRoot, prefabDir) {
            return __awaiter(this, void 0, void 0, function* () {
                throw new Error("savePrefab not implemented");
            });
        }
    }

    // ============== Godot 中间结构 ==============
    /** tscn 字面量包装：Vector2(x, y) */
    class GVec2 {
        constructor(x, y) { this.x = x; this.y = y; }
    }
    /** tscn 字面量包装：Color(r, g, b, a) — 各分量为 0..1 浮点 */
    class GColor {
        constructor(r, g, b, a = 1) { this.r = r; this.g = g; this.b = b; this.a = a; }
        /** 由 0..255 的 Color 构造 */
        static fromBytes(c) {
            return new GColor((c.r || 0) / 255, (c.g || 0) / 255, (c.b || 0) / 255, (c.a || 0) / 255);
        }
    }
    /** tscn 字面量包装：ExtResource("id") 引用 */
    class GExtResRef {
        constructor(id) { this.id = id; }
    }
    /** tscn 字面量包装：NodePath("path") */
    class GNodePath {
        constructor(path) { this.path = path; }
    }

    /** 一个 Godot 节点（最终对应 tscn 中的一个 [node ...] 段） */
    class GodotNode {
        constructor(name, type) {
            this.name = name;
            this.type = type;
            /** @type {Map<string, any>} key 是属性名，value 可以是 GVec2/GColor/string/number/boolean/GExtResRef */
            this.props = new Map();
            /** @type {GodotNode|null} */
            this.parent = null;
            /** @type {GodotNode[]} */
            this.children = [];
        }
        setProp(key, value) { this.props.set(key, value); }
        addChild(child) {
            child.parent = this;
            this.children.push(child);
        }
        /** 该节点用作 tscn `parent="..."` 的字符串：根返回 null；根的直接子返回 "."；嵌套返回 "Group1/Group2" */
        parentTscnPath() {
            if (!this.parent) return null;
            if (!this.parent.parent) return ".";
            let segs = [];
            let cur = this.parent;
            while (cur && cur.parent) {
                segs.unshift(cur.name);
                cur = cur.parent;
            }
            return segs.join("/");
        }
    }

    /** 一个 Godot 场景。一个 PSD 对应一个 GodotScene */
    class GodotScene {
        constructor() {
            this.uid = utils.godotUid();
            /** @type {GodotNode|null} */
            this.root = null;
            /** @type {{type:string, uid:string, path:string, id:string}[]} */
            this.extResources = [];
            this._byUid = new Map();
        }
        /** 同一资源（uid 相同）只注册一次，返回同一个条目（含 id） */
        addOrGetExtResource(type, uid, resPath) {
            if (this._byUid.has(uid)) return this._byUid.get(uid);
            const seq = this.extResources.length + 1;
            const suffix = (uid.replace("uid://", "") || "x").substr(0, 5);
            const id = `${seq}_${suffix}`;
            const entry = { type, uid, path: resPath, id };
            this.extResources.push(entry);
            this._byUid.set(uid, entry);
            return entry;
        }
    }

    /** GodotScene → tscn 文本序列化器 */
    class TscnEmitter {
        constructor() { this.lines = []; }
        line(s) { this.lines.push(s); }
        blank() { this.lines.push(""); }
        emit(scene) {
            const loadSteps = scene.extResources.length + 1; // ext_resources + 场景自身
            this.line(`[gd_scene load_steps=${loadSteps} format=3 uid="${scene.uid}"]`);
            this.blank();
            for (const ext of scene.extResources) {
                this.line(`[ext_resource type="${ext.type}" uid="${ext.uid}" path="${this._escapeStr(ext.path)}" id="${ext.id}"]`);
            }
            if (scene.extResources.length > 0) this.blank();
            this._emitNode(scene.root);
            return this.lines.join("\n");
        }
        _emitNode(node) {
            const parentPath = node.parentTscnPath();
            let header = `[node name="${this._escapeName(node.name)}" type="${node.type}"`;
            if (parentPath !== null) {
                header += ` parent="${this._escapeStr(parentPath)}"`;
            }
            header += "]";
            this.line(header);
            for (const [k, v] of node.props) {
                this.line(`${k} = ${this._formatValue(v)}`);
            }
            this.blank();
            for (const child of node.children) {
                this._emitNode(child);
            }
        }
        _formatValue(v) {
            if (v === null || v === undefined) return "null";
            if (v instanceof GVec2) return `Vector2(${this._fmtNum(v.x)}, ${this._fmtNum(v.y)})`;
            if (v instanceof GColor) return `Color(${this._fmtNum(v.r)}, ${this._fmtNum(v.g)}, ${this._fmtNum(v.b)}, ${this._fmtNum(v.a)})`;
            if (v instanceof GExtResRef) return `ExtResource("${v.id}")`;
            if (v instanceof GNodePath) return `NodePath("${this._escapeStr(v.path)}")`;
            if (typeof v === "boolean") return v ? "true" : "false";
            if (typeof v === "number") return this._fmtNum(v);
            if (typeof v === "string") return `"${this._escapeStr(v)}"`;
            return String(v);
        }
        _fmtNum(n) {
            if (typeof n !== "number" || !isFinite(n)) return "0";
            if (Number.isInteger(n)) return `${n}`;
            // 限制小数位避免浮点噪音；trailing 0 由 parseFloat 自然去掉
            return parseFloat(n.toFixed(6)).toString();
        }
        _escapeStr(s) {
            return String(s)
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/\t/g, "\\t");
        }
        /** Godot 节点名禁止 : / @ %，且必须非空 */
        _escapeName(n) {
            let s = String(n || "Node").replace(/[:/@%]/g, "_");
            if (!s) s = "Node";
            return s;
        }
    }

    /**
     * Godot 4 的 exporter。
     *  - 资源 meta 是 .png.import（INI 风格，仅写最小字段，Godot 自补 path/hash）
     *  - 资源 ID 是 Godot 的 uid:// 形式（13-char base32）
     *  - 节点结构序列化为 .tscn
     */
    class GodotExporter extends IExporter {
        constructor() {
            super();
            /** @type {string} Texture2D.import.tmpl 模板内容 */
            this.importTemplate = "";
            /** @type {string} Godot 项目根（绝对路径），用于把输出 .png 路径转换成 res:// 形式 */
            this.projectRoot = "";
            /** @type {string|null} 默认字体的 uid:// 字符串。null 表示沿用 Godot 主题默认 */
            this.defaultFontUid = null;
            /** @type {string|null} 默认字体的 res:// 路径 */
            this.defaultFontPath = null;
            /** @type {string} 默认字体类型，FontFile / FontVariation。来自 .import 文件的 type 字段 */
            this.defaultFontType = "FontFile";
        }
        init(args) {
            const _super = Object.create(null, {
                init: { get: () => super.init }
            });
            return __awaiter(this, void 0, void 0, function* () {
                yield _super.init.call(this, args);
                this.importTemplate = fs__default["default"].readFileSync(path__default["default"].join(__dirname, "assets/Texture2D.import.tmpl"), "utf-8");
                // 优先用 --godot-project，没有就回退 --project-assets（面板尚未提供独立输入时的兼容路径）
                let root = args["godot-project"] || args["project-assets"] || "";
                if (root) {
                    this.projectRoot = path__default["default"].resolve(root);
                }
                // 默认字体：优先命令行 --godot-font-path，其次 psd.config.json 的 godot.defaultFont
                let fontResPath = args["godot-font-path"] || "";
                if (!fontResPath && this.psdConfig && this.psdConfig.godot && this.psdConfig.godot.defaultFont) {
                    const cfg = this.psdConfig.godot.defaultFont;
                    if (cfg.uid && cfg.path) {
                        // psd.config.json 直接给了 uid + path，不需要再去解析 .import
                        this.defaultFontUid = cfg.uid;
                        this.defaultFontPath = cfg.path;
                        this.defaultFontType = cfg.type || "FontFile";
                        console.log(`GodotExporter-> 默认字体（来自 psd.config.json）${cfg.path} ${cfg.uid}`);
                    } else if (cfg.path) {
                        fontResPath = cfg.path;
                    }
                }
                if (fontResPath && !this.defaultFontUid) {
                    this._setupDefaultFont(fontResPath);
                }
            });
        }
        /** 从 res:// 路径反查 .import 文件，提取 uid 与 type 作为默认字体 */
        _setupDefaultFont(resPath) {
            if (!resPath.startsWith("res://")) {
                console.warn(`GodotExporter-> 默认字体路径需以 res:// 开头：${resPath}`);
                return;
            }
            if (!this.projectRoot) {
                console.warn(`GodotExporter-> 设置默认字体需要先填写 Godot 项目根`);
                return;
            }
            const rel = resPath.substring(6);
            const absPath = path__default["default"].join(this.projectRoot, rel);
            const importPath = absPath + ".import";
            if (!fs__default["default"].existsSync(importPath)) {
                console.warn(`GodotExporter-> 字体导入文件不存在：${importPath}（先在 Godot 里打开项目让它自动生成 .import）`);
                return;
            }
            const content = fs__default["default"].readFileSync(importPath, "utf-8");
            const uidMatch = content.match(/^uid="([^"]+)"/m);
            if (!uidMatch) {
                console.warn(`GodotExporter-> ${importPath} 没有 uid 字段，跳过默认字体`);
                return;
            }
            const typeMatch = content.match(/^type="([^"]+)"/m);
            this.defaultFontUid = uidMatch[1];
            this.defaultFontPath = resPath;
            this.defaultFontType = typeMatch ? typeMatch[1] : "FontFile";
            console.log(`GodotExporter-> 默认字体 ${resPath} → ${this.defaultFontUid} (${this.defaultFontType})`);
        }
        loadProjectImageCache(projectRoot) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!projectRoot) return;
                this.projectRoot = path__default["default"].resolve(projectRoot);
                let pngs = fileUtils.filterFile(projectRoot, (fileName) => {
                    return path__default["default"].extname(fileName) === ".png";
                });
                if (!pngs) return;
                for (let i = 0; i < pngs.length; i++) {
                    const png = pngs[i];
                    const importPath = png + ".import";
                    if (!fs__default["default"].existsSync(importPath)) continue;
                    const content = fs__default["default"].readFileSync(importPath, "utf-8");
                    const uidMatch = content.match(/^uid="([^"]+)"/m);
                    if (!uidMatch) continue;
                    const uid = uidMatch[1];
                    let baseName = path__default["default"].basename(png);
                    let fileName = baseName.split(".")[0];
                    console.log(`GodotExporter-> 缓存 ${png} → ${uid}`);
                    imageCacheMgr.set(fileName, {
                        path: this.toResPath(png),
                        uuid: uid,
                        textureUuid: uid,
                        isOutput: true,
                    });
                }
            });
        }
        saveImages(textureDir) {
            return __awaiter(this, void 0, void 0, function* () {
                let images = imageMgr.getAllImage();
                images.forEach((psdImage, k) => {
                    let _layer = imageMgr.getSerialNumberImage(psdImage);
                    let imageWarp = imageCacheMgr.get(_layer.name);
                    if (!this.isForceImg) {
                        if (imageWarp && imageWarp.isOutput && this._isGodotUid(imageWarp.uuid)) {
                            console.log(`已有相同资源，不再导出 [${psdImage.imgName}] name: ${psdImage.name}`);
                            return;
                        }
                    }
                    console.log(`保存图片 [${_layer.imgName}] name: ${_layer.name}`);
                    let pngPath = path__default["default"].join(textureDir, `${_layer.imgName}.png`);
                    fs__default["default"].writeFileSync(pngPath, new Uint8Array(_layer.imgBuffer.buffer, _layer.imgBuffer.byteOffset, _layer.imgBuffer.byteLength));
                    this.saveImageImport(_layer, pngPath);
                });
            });
        }
        /** 写 .png.import 文件，并把 godotUid 回写到 imageCacheMgr */
        saveImageImport(layer, pngPath) {
            let _layer = imageMgr.getSerialNumberImage(layer);
            let imageWarp = imageCacheMgr.get(_layer.name);
            // 若没有缓存或缓存里是 Cocos uuid（parser 阶段的占位），重新生成 Godot uid
            if (!imageWarp || !this._isGodotUid(imageWarp.uuid)) {
                const newUid = utils.godotUid();
                imageWarp = {
                    path: this.toResPath(pngPath),
                    uuid: newUid,
                    textureUuid: newUid,
                    isOutput: true,
                };
                imageCacheMgr.set(_layer.name, imageWarp);
            } else {
                imageWarp.path = this.toResPath(pngPath);
                imageWarp.isOutput = true;
            }
            let importContent = this.importTemplate
                .replace(/\$TEXTURE_UID/g, imageWarp.uuid)
                .replace(/\$SOURCE_PATH/g, imageWarp.path);
            fs__default["default"].writeFileSync(pngPath + ".import", importContent);
        }
        /** 把绝对路径转成 res://xxx；项目根未知时退化为 res://basename 并 warn */
        toResPath(absPath) {
            let normalized = path__default["default"].resolve(absPath).replace(/\\/g, "/");
            if (this.projectRoot) {
                let rootNormalized = this.projectRoot.replace(/\\/g, "/");
                if (!rootNormalized.endsWith("/")) rootNormalized += "/";
                if (normalized.startsWith(rootNormalized)) {
                    return "res://" + normalized.substring(rootNormalized.length);
                }
            }
            console.warn(`GodotExporter-> 路径 ${absPath} 不在 Godot 项目根 [${this.projectRoot}] 内，res:// 路径退化为只用 basename`);
            return "res://" + path__default["default"].basename(absPath);
        }
        _isGodotUid(uid) {
            return typeof uid === "string" && uid.indexOf("uid://") === 0;
        }
        buildPrefab(psdRoot) {
            const scene = new GodotScene();
            scene.root = this._createGodotNode(psdRoot, null, scene);
            // _createGodotNode 内部会把每个 layer.uiObject 指向其 GodotNode（含 psdRoot 本身）；
            // 把 scene 单独挂在 godotScene 字段上，savePrefab 时取出来。
            psdRoot.godotScene = scene;
        }
        /** 递归构造 Godot 节点树。parentNode 为 null 表示当前是根 */
        _createGodotNode(layer, parentNode, scene) {
            const isRoot = !parentNode;
            const baseName = layer.name || "Node";
            const name = isRoot ? baseName : this._uniqueChildName(parentNode, baseName);
            let node;
            if (layer instanceof PsdImage) {
                // 仅源图层（自带 s9）转 NinePatchRect；镜像图层即使绑了 9 切原图也用普通 TextureRect 走 flip。
                const isNinePatch = !!layer.s9 && !layer.isBind();
                node = new GodotNode(name, isNinePatch ? "NinePatchRect" : "TextureRect");
                this._fillImageProps(node, layer, scene);
            } else if (layer instanceof PsdText) {
                node = new GodotNode(name, "Label");
                this._fillLabelProps(node, layer, scene);
            } else {
                // PsdDocument / PsdGroup → Control
                node = new GodotNode(name, "Control");
            }
            // 不透明度 < 255 → modulate.a 衰减
            if (layer.opacity != null && layer.opacity !== 255) {
                node.setProp("modulate", new GColor(1, 1, 1, layer.opacity / 255));
            }
            // 隐藏图层
            if (layer.hidden) {
                node.setProp("visible", false);
            }
            // 位置/尺寸（同时处理 @full）
            this._fillRectProps(node, layer, isRoot);
            // @ar{x,y} → pivot_offset。layer.anchorPoint 已由 PsdLayer.parseSource 填好
            if (layer.attr && layer.attr.comps && layer.attr.comps.ar) {
                const ax = layer.anchorPoint ? layer.anchorPoint.x : 0.5;
                const ay = layer.anchorPoint ? layer.anchorPoint.y : 0.5;
                node.setProp("pivot_offset", new GVec2(layer.size.width * ax, layer.size.height * ay));
            }
            // 递归子节点
            if (layer instanceof PsdGroup || layer instanceof PsdDocument) {
                for (let i = 0; i < layer.children.length; i++) {
                    const child = this._createGodotNode(layer.children[i], node, scene);
                    if (child) node.addChild(child);
                }
            }
            // 把 GodotNode 反向挂回 PsdLayer，方便后续阶段（@ProgressBar 等）跨层引用
            layer.uiObject = node;
            // 控件标签映射（@Btn / @Toggle / @ProgressBar）。必须放在子节点递归之后：
            //  - @ProgressBar 需要把 @bar 子节点的 texture 提升到父节点
            //  - 子节点已经设置好了 uiObject，可以直接引用
            this._applyControls(node, layer);
            return node;
        }
        /** 根据 @Btn / @Toggle / @ProgressBar 重新塑造节点 */
        _applyControls(node, layer) {
            if (!layer.attr || !layer.attr.comps) return;
            const comps = layer.attr.comps;
            if (comps.Btn) {
                this._applyBtn(node, layer);
            }
            if (comps.Toggle) {
                this._applyToggle(node, layer);
            }
            if (comps.ProgressBar) {
                this._applyProgressBar(node, layer);
            }
        }
        _applyBtn(node, layer) {
            // @Btn 仅在图像图层上自动转 TextureButton；放在组/文本上要求用户手动调整
            if (!(layer instanceof PsdImage)) {
                console.warn(`GodotExporter-> @Btn 在非图像图层 [${layer.name}] 上未自动映射；建议把 @Btn 放在按钮 BG 的图像图层上`);
                return;
            }
            if (node.type === "NinePatchRect") {
                console.warn(`GodotExporter-> [${layer.name}] 同时带 @Btn 与 @.9：Godot TextureButton 不支持 9-patch，已退化为普通拉伸（patch_margin 已移除）`);
                node.props.delete("patch_margin_left");
                node.props.delete("patch_margin_right");
                node.props.delete("patch_margin_top");
                node.props.delete("patch_margin_bottom");
            }
            node.type = "TextureButton";
            // texture → texture_normal
            if (node.props.has("texture")) {
                node.props.set("texture_normal", node.props.get("texture"));
                node.props.delete("texture");
            }
            // 移除 TextureRect 专属属性
            node.props.delete("expand_mode");
            // TextureButton 自带 stretch_mode 与 ignore_texture_size：用 PSD 给的 size 拉伸贴图
            node.setProp("ignore_texture_size", true);
            node.setProp("stretch_mode", 0); // STRETCH_SCALE
            // flip_h / flip_v 在 TextureButton 上仍然有效（Godot 4），保留
        }
        _applyToggle(node, layer) {
            if (!(layer instanceof PsdGroup)) {
                console.warn(`GodotExporter-> @Toggle 仅作用于组图层，[${layer.name}] 未自动映射`);
                return;
            }
            // Godot 没有完全等价的 Toggle。CheckBox 是带 text 的复选框，外观依赖 theme，不直接吃自定义贴图。
            // 这里把节点类型置为 CheckBox 作为占位；@check 子图层的自定义图保留为 TextureRect 子节点，
            // 用户可在 Godot 里把它换成 BaseButton + TextureRect 自绘组合，或者改 theme。
            node.type = "CheckBox";
            console.info(`GodotExporter-> [${layer.name}]：@Toggle 已映射为 CheckBox 占位。Godot CheckBox 行为与 Cocos Toggle 不完全一致（@check 自定义图未自动接入），如需还原请在 Godot 里改 theme 或换 BaseButton + TextureRect`);
        }
        _applyProgressBar(node, layer) {
            if (!(layer instanceof PsdGroup)) {
                console.warn(`GodotExporter-> @ProgressBar 仅作用于组图层，[${layer.name}] 未自动映射`);
                return;
            }
            // 找 @bar 子（前景填充）
            let barChildLayer = null;
            let bgChildLayer = null;
            for (const child of layer.children) {
                if (!child.attr || !child.attr.comps) continue;
                if (child.attr.comps.bar && !barChildLayer) {
                    barChildLayer = child;
                } else if (child instanceof PsdImage && !child.attr.comps.bar && !bgChildLayer) {
                    bgChildLayer = child;
                }
            }
            if (!barChildLayer) {
                console.warn(`GodotExporter-> @ProgressBar [${layer.name}] 没有 @bar 子图层，未自动映射`);
                return;
            }
            const barNode = barChildLayer.uiObject;
            const bgNode = bgChildLayer ? bgChildLayer.uiObject : null;
            // 把父节点重塑成 TextureProgressBar
            node.type = "TextureProgressBar";
            if (barNode && barNode.props.has("texture")) {
                node.setProp("texture_progress", barNode.props.get("texture"));
            }
            if (bgNode && bgNode.props.has("texture")) {
                node.setProp("texture_under", bgNode.props.get("texture"));
            }
            node.setProp("max_value", 100);
            node.setProp("value", 100);
            node.setProp("fill_mode", 0); // FILL_BEGIN_TO_END
            // 把 @bar 与 BG 子节点从输出中拿掉，避免重叠绘制
            const remove = new Set();
            if (barNode) remove.add(barNode);
            if (bgNode) remove.add(bgNode);
            node.children = node.children.filter((c) => !remove.has(c));
        }
        /**
         * 给节点设置 anchors_preset/offset_*。坐标体系：PSD 左上角原点 → Godot 父级左上角偏移。
         * 三种情况：
         *  1) 根 Control：占满 PSD 文档尺寸（preset=0 + offset_right/bottom）
         *  2) 子节点带 @full：占满父级（preset=15 + grow_*=2）
         *  3) 子节点：相对父图层 PSD rect 左上角的偏移
         */
        _fillRectProps(node, layer, isRoot) {
            const w = layer.size.width;
            const h = layer.size.height;
            if (isRoot) {
                node.setProp("layout_mode", 3);
                node.setProp("anchors_preset", 0);
                node.setProp("offset_right", w);
                node.setProp("offset_bottom", h);
                return;
            }
            if (layer.attr && layer.attr.comps && layer.attr.comps.full) {
                node.setProp("layout_mode", 1);
                node.setProp("anchors_preset", 15);
                node.setProp("anchor_right", 1);
                node.setProp("anchor_bottom", 1);
                node.setProp("grow_horizontal", 2);
                node.setProp("grow_vertical", 2);
                return;
            }
            const parentLeft = layer.parent ? layer.parent.rect.left : 0;
            const parentTop = layer.parent ? layer.parent.rect.top : 0;
            const x = layer.rect.left - parentLeft;
            const y = layer.rect.top - parentTop;
            node.setProp("layout_mode", 1);
            node.setProp("anchors_preset", 0);
            if (x !== 0) node.setProp("offset_left", x);
            if (y !== 0) node.setProp("offset_top", y);
            node.setProp("offset_right", x + w);
            node.setProp("offset_bottom", y + h);
        }
        /** 处理 PsdImage 类图层的 texture/9-patch/flip。覆盖 NinePatchRect 与 TextureRect 两条路径 */
        _fillImageProps(node, layer, scene) {
            // 忽略图片标记的图层：保留节点位置但不设贴图
            if (layer.isIgnore && layer.isIgnore()) return;
            const _layer = imageMgr.getSerialNumberImage(layer);
            const imageWarp = imageCacheMgr.get(_layer.name);
            if (!imageWarp) {
                console.warn(`GodotExporter-> 图层 ${_layer.name} 没有缓存的 uid，texture 留空`);
                return;
            }
            const ext = scene.addOrGetExtResource("Texture2D", imageWarp.uuid, imageWarp.path);
            node.setProp("texture", new GExtResRef(ext.id));
            if (node.type === "NinePatchRect") {
                const s9 = layer.s9; // safeBorder 标准化过的 {l,r,t,b}
                if (s9) {
                    if (s9.l) node.setProp("patch_margin_left", s9.l);
                    if (s9.t) node.setProp("patch_margin_top", s9.t);
                    if (s9.r) node.setProp("patch_margin_right", s9.r);
                    if (s9.b) node.setProp("patch_margin_bottom", s9.b);
                }
                // 提示：NinePatchRect 不支持 flip_h/v；如有需求需改成 TextureRect 重做。
                if (layer.isFlipX() || layer.isFlipY()) {
                    console.warn(`GodotExporter-> 图层 ${layer.name} 同时带 @.9 与 @flip，Godot NinePatchRect 不支持 flip，已忽略翻转`);
                }
            } else {
                // TextureRect：拉伸到节点尺寸，并应用 flip
                node.setProp("expand_mode", 1); // EXPAND_IGNORE_SIZE
                node.setProp("stretch_mode", 0); // STRETCH_SCALE
                if (layer.isFlipX()) node.setProp("flip_h", true);
                if (layer.isFlipY()) node.setProp("flip_v", true);
            }
        }
        _fillLabelProps(node, layer, scene) {
            node.setProp("text", layer.text || "");
            const fontSize = Math.max(1, Math.round(layer.fontSize || 0));
            node.setProp("theme_override_font_sizes/font_size", fontSize);
            if (layer.color) {
                node.setProp("theme_override_colors/font_color", GColor.fromBytes(layer.color));
            }
            // 默认字体（如果配置了）。Label 上写 theme_override_fonts/font 覆盖主题默认
            if (this.defaultFontUid && scene) {
                const ext = scene.addOrGetExtResource(this.defaultFontType, this.defaultFontUid, this.defaultFontPath);
                node.setProp("theme_override_fonts/font", new GExtResRef(ext.id));
            }
            // 文本描边
            if (layer.outline) {
                const w = Math.max(1, Math.round(layer.outline.width || 0));
                node.setProp("theme_override_constants/outline_size", w);
                if (layer.outline.color) {
                    node.setProp("theme_override_colors/font_outline_color", GColor.fromBytes(layer.outline.color));
                }
            }
            node.setProp("horizontal_alignment", 0);
            node.setProp("vertical_alignment", 0);
            node.setProp("autowrap_mode", 0);
        }
        _uniqueChildName(parentNode, name) {
            const used = new Set();
            for (const c of parentNode.children) used.add(c.name);
            if (!used.has(name)) return name;
            let i = 2;
            while (used.has(`${name}_${i}`)) i++;
            return `${name}_${i}`;
        }
        savePrefab(psdRoot, prefabDir) {
            return __awaiter(this, void 0, void 0, function* () {
                const scene = psdRoot.godotScene;
                if (!scene || !scene.root) {
                    console.error("GodotExporter-> savePrefab: psdRoot.godotScene 缺失，跳过 .tscn 写入（buildPrefab 没跑成功？）");
                    return;
                }
                const emitter = new TscnEmitter();
                const text = emitter.emit(scene);
                const tscnPath = path__default["default"].join(prefabDir, `${psdRoot.name}.tscn`);
                fs__default["default"].writeFileSync(tscnPath, text, { encoding: "utf-8" });
                console.log(`GodotExporter-> 写入 ${tscnPath}`);
            });
        }
    }

    class Main {
        constructor() {
            /** @type {IExporter} */
            this.exporter = new GodotExporter();
        }
        test() {
            return __awaiter(this, void 0, void 0, function* () {
                console.log(`Main-> test`);
            });
        }
        exec(args) {
            return __awaiter(this, void 0, void 0, function* () {
                args = mergeAlias(args);
                if (args.help) {
                    console.log(`help:\n`, config.help);
                    return false;
                }
                if (args["img-only"]) {
                    exportImageMgr.exec(args);
                    return true;
                }
                let writeCache = () => __awaiter(this, void 0, void 0, function* () {
                    if (args.cache) {
                        fs__default["default"].mkdirsSync(path__default["default"].dirname(args.cache));
                        yield imageCacheMgr.saveImageMap(args.cache);
                    }
                });
                // --init 把 Godot 项目根（含 .png.import）扫一遍写入缓存
                if (args.init && (!args["godot-project"] || !args.cache)) {
                    console.log(`psd2tscn --init 无法处理，请同时设置 --godot-project 与 --cache`);
                    return;
                }
                if (args.cache && !fs__default["default"].existsSync(args.cache)) {
                    yield writeCache();
                }
                // 用 godot-project 作为扫描入口（旧的 --project-assets 仍兼容）
                let scanRoot = args["godot-project"] || args["project-assets"];
                if (scanRoot && (args["cache-remake"] || args.init)) {
                    yield this.exporter.loadProjectImageCache(scanRoot);
                    writeCache();
                    if (args.init) {
                        console.log(`psd2tscn 缓存完成`);
                        return;
                    }
                }
                if (!this.checkArgs(args)) {
                    return;
                }
                if (args.cache) {
                    yield imageCacheMgr.initWithPath(args.cache);
                }
                yield this.exporter.init(args);
                PsdLayer.isPinyin = args.pinyin;
                let stat = fs__default["default"].lstatSync(args.input);
                let isDirectory = stat.isDirectory();
                if (isDirectory) {
                    if (!args.output) {
                        args.output = path__default["default"].join(args.input, "psd2tscn");
                    }
                    this.parsePsdDir(args.input, args.output);
                }
                else {
                    if (!args.output) {
                        let input_dir = path__default["default"].dirname(args.input);
                        args.output = path__default["default"].join(input_dir, "psd2tscn");
                    }
                    this.parsePsd(args.input, args.output);
                }
                yield writeCache();
                console.log(`psd2tscn 导出完成`);
            });
        }
        checkArgs(args) {
            if (!args.input) {
                console.error(`请设置 --input`);
                return false;
            }
            if (!fs__default["default"].existsSync(args.input)) {
                console.error(`输入路径不存在: ${args.input}`);
                return false;
            }
            return true;
        }
        parsePsdDir(dir, outDir) {
            return __awaiter(this, void 0, void 0, function* () {
                // 清空目录
                // fs.emptyDirSync(outDir);
                let psds = fileUtils.filterFile(dir, (fileName) => {
                    let extname = path__default["default"].extname(fileName);
                    if (extname == ".psd") {
                        return true;
                    }
                    return false;
                });
                for (let i = 0; i < psds.length; i++) {
                    const element = psds[i];
                    yield this.parsePsd(element, outDir);
                }
            });
        }
        parsePsd(psdPath, outDir) {
            return __awaiter(this, void 0, void 0, function* () {
                // 每开始一个新的 psd 清理掉上一个 psd 的图
                imageMgr.clear();
                console.log(`=========================================`);
                console.log(`处理 ${psdPath} 文件`);
                let psdName = path__default["default"].basename(psdPath, ".psd");
                let buffer = fs__default["default"].readFileSync(psdPath);
                const psdFile = psd__namespace.readPsd(buffer);
                let psdRoot = parser.parseLayer(psdFile);
                psdRoot.name = psdName;
                let prefabDir = path__default["default"].join(outDir, psdName);
                let textureDir = path__default["default"].join(prefabDir, "textures");
                fs__default["default"].mkdirsSync(prefabDir); // 创建预制体根目录
                // fs.emptyDirSync(prefabDir);
                fs__default["default"].mkdirsSync(textureDir); //创建 图片目录
                yield this.exporter.saveImages(textureDir);
                this.exporter.buildPrefab(psdRoot);
                yield this.exporter.savePrefab(psdRoot, prefabDir);
                console.log(`psd2tscn ${psdPath} 处理完成`);
            });
        }
    }
    /** 合并别名 */
    function mergeAlias(args) {
        // 如果是 json 对象参数
        if (args.json) {
            let base64 = args.json;
            // 解码 json 
            args = JSON.parse(Buffer.from(base64, "base64").toString());
            // // 编码
            // let jsonContent = JSON.stringify(args);
            // let base64 = Buffer.from(jsonContent).toString("base64");
        }
        args.help = args.help || args.h;
        args.input = args.input || args.in;
        args.output = args.output || args.out;
        args["engine-version"] = args["engine-version"] || args.ev;
        args["project-assets"] = args["project-assets"] || args.p;
        args["godot-project"] = args["godot-project"] || args.gp;
        args["godot-font-path"] = args["godot-font-path"] || args.gf;
        args["cache-remake"] = args["cache-remake"] || args.crm;
        args["force-img"] = args["force-img"] || args.fimg;
        args.pinyin = args.pinyin || args.py;
        args.cache = args.cache || args.c;
        args.init = args.init || args.i;
        args.config = args.config;
        return args;
    }

    // ##################
    // 输入
    const oldArgs = process.argv.slice(2);
    const args = minimist__default["default"](oldArgs);
    let main = new Main();
    if (oldArgs.length) {
        main.exec(args);
    }
    else {
        // 测试
        main.test();
    }
    // ##################

}));
