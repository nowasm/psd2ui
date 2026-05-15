

//ag-psd 使用 参考 https://github.com/Agamnentzar/ag-psd/blob/HEAD/README_PSD.md

import 'ag-psd/initialize-canvas'; // only needed for reading image data and thumbnails
import * as psd from 'ag-psd';
import fs from 'fs-extra';
import path from 'path';
import { parser } from './Parser';
import { PsdDocument } from './psd/PsdDocument';
import { PsdLayer } from './psd/PsdLayer';
import { LayerType } from './psd/LayerType';
import { PsdGroup } from './psd/PsdGroup';
import { CCNode } from './engine/cc/CCNode';
import { PsdImage } from './psd/PsdImage';
import { PsdText } from './psd/PsdText';
import { CCSprite } from './engine/cc/CCSprite';
import { CCPrefabInfo } from './engine/cc/CCPrefabInfo';
import { CCPrefab } from './engine/cc/CCPrefab';
import { CCSize } from './engine/cc/values/CCSize';
import { CCVec2 } from './engine/cc/values/CCVec2';
import { CCComponent } from './engine/cc/CCComponent';
import { CCLabel } from './engine/cc/CCLabel';
import { CCLabelOutline } from './engine/cc/CCLabelOutline';
import { imageCacheMgr } from './assets-manager/ImageCacheMgr';
import { EditorVersion } from './EditorVersion';
import { Config, config } from './config';
import { fileUtils } from './utils/FileUtils';
import { imageMgr } from './assets-manager/ImageMgr';
import { exportImageMgr } from './ExportImageMgr';
import { CCUIOpacity } from './engine/cc/CCUIOpacity';
import { CCUITransform } from './engine/cc/CCUITransform';
import { CCVec3 } from './engine/cc/values/CCVec3';
import { Vec3 } from './values/Vec3';


/***
 * 执行流程
 * - 首次运行，先读取项目文件夹下所有图片资源，进行 md5 缓存
 * 
 * - 加载缓存文件
 * - 处理 psd
 * - 通过 md5 判断是否已经存在资源，如果存在， 则不再导出，预制体中使用已存在的资源的 uuid
 * 
 */


console.log(`当前目录： `, __dirname);


export class Main {

    spriteFrameMetaContent: string = "";
    prefabMetaContent: string = "";
    psdConfig: Config = null;

    // 强制导出图片
    isForceImg = false;

    async test() {
        console.log(`Main-> test`);
    }

    // 首先加载 meta 模板
    async loadMetaTemplete() {
        this.spriteFrameMetaContent = fs.readFileSync(path.join(__dirname, `../assets/cc/meta/CCSpriteFrame.meta.${EditorVersion[config.editorVersion]}`), "utf-8");
        this.prefabMetaContent = fs.readFileSync(path.join(__dirname, `../assets/cc/meta/CCPrefab.meta.${EditorVersion[config.editorVersion]}`), "utf-8");
    }

    // 加载配置
    async loadPsdConfig(filepath) {
        if (!fs.existsSync(filepath)) {
            console.log(`Main-> 配置 ${filepath} 不存在`);
            return;
        }

        let psdConfig = fs.readFileSync(filepath, "utf-8");
        this.psdConfig = JSON.parse(psdConfig);

        // 合并配置
        for (const key in this.psdConfig) {
            if (key in config) {
                if (typeof this.psdConfig[key] === 'object') {
                    config[key] = Object.assign({}, config[key], this.psdConfig[key]);
                } else {
                    config[key] = this.psdConfig[key] || config[key];
                }
            }
        }

    }

    async exec(args) {
        args = mergeAlias(args);
        if (args.help) {
            console.log(`help:\n`, config.help);
            return false;
        }

        // 只导出图片
        if (args["img-only"]) {
            exportImageMgr.exec(args);
            return true;
        }

        let writeCache = async () => {
            // 写入缓存
            if (args.cache) {
                fs.mkdirsSync(path.dirname(args.cache));
                await imageCacheMgr.saveImageMap(args.cache);
            }
        }
        // 设置引擎版本
        if (args["engine-version"]) {
            config.editorVersion = EditorVersion[args["engine-version"] as string];
        }

        console.log(`Main-> 数据版本 ${EditorVersion[config.editorVersion]}`);


        if (args.init && (!args["project-assets"] || !args.cache)) {
            console.log(`psd2ui --init 无法处理，请设置 --project-assets`);
            return;
        }

        // 创建缓存文件
        if (args.cache && !fs.existsSync(args.cache)) {
            await writeCache();
        }

        // 在没有缓存文件或者 指定重新缓存的时候，读取项目资源
        if (args["project-assets"] && (args["cache-remake"] || args.init)) {
            await imageCacheMgr.loadImages(args["project-assets"]);
            // 先写入一次
            writeCache();
            if (args.init) {
                console.log(`psd2ui 缓存完成`);
                return;
            }
        }

        // 检查参数
        if (!this.checkArgs(args)) {
            return;
        }

        if (args.cache) {
            await imageCacheMgr.initWithPath(args.cache);
        }

        // 加载 meta 文件模板
        await this.loadMetaTemplete();

        if (args.config) {
            await this.loadPsdConfig(args.config);
        }

        this.isForceImg = !!args["force-img"];

        PsdLayer.isPinyin = args.pinyin;

        // 判断输入是文件夹还是文件
        let stat = fs.lstatSync(args.input);
        let isDirectory = stat.isDirectory();
        if (isDirectory) {
            if (!args.output) {
                args.output = path.join(args.input, "psd2ui")
            }
            this.parsePsdDir(args.input, args.output);
        } else {
            if (!args.output) {
                let input_dir = path.dirname(args.input);
                args.output = path.join(input_dir, "psd2ui")
            }
            this.parsePsd(args.input, args.output);
        }

        // 写入缓存
        await writeCache();

        console.log(`psd2ui 导出完成`);
    }
    // 检查参数
    checkArgs(args) {

        if (!args.input) {
            console.error(`请设置 --input`);
            return false;
        }

        if (!fs.existsSync(args.input)) {
            console.error(`输入路径不存在: ${args.input}`);
            return false;
        }

        if (args["engine-version"]) {
            let editorVersion = EditorVersion[args["engine-version"] as string];
            switch (editorVersion) {
                case EditorVersion.v249:
                case EditorVersion.v342:
                    break;
                default:
                    console.log(`暂未实现该引擎版本 ${args["engine-version"]}`);
                    return false;
            }
        }


        return true;
    }

    async parsePsdDir(dir: string, outDir: string) {
        // 清空目录
        // fs.emptyDirSync(outDir);

        let psds = fileUtils.filterFile(dir, (fileName) => {
            let extname = path.extname(fileName);
            if (extname == ".psd") {
                return true;
            }
            return false;
        });

        for (let i = 0; i < psds.length; i++) {
            const element = psds[i];
            await this.parsePsd(element, outDir);
        }
    }
    async parsePsd(psdPath: string, outDir: string) {
        // 每开始一个新的 psd 清理掉上一个 psd 的图
        imageMgr.clear();
        console.log(`=========================================`);

        console.log(`处理 ${psdPath} 文件`);

        let psdName = path.basename(psdPath, ".psd");
        let buffer = fs.readFileSync(psdPath);
        const psdFile = psd.readPsd(buffer as unknown as ArrayBuffer)
        let psdRoot = parser.parseLayer(psdFile) as PsdDocument;
        psdRoot.name = psdName;
        let prefabDir = path.join(outDir, psdName);
        let textureDir = path.join(prefabDir, "textures");
        fs.mkdirsSync(prefabDir); // 创建预制体根目录
        // fs.emptyDirSync(prefabDir);
        fs.mkdirsSync(textureDir); //创建 图片目录
        await this.saveImage(textureDir);
        await this.buildPrefab(psdRoot);
        await this.savePrefab(psdRoot, prefabDir);
        console.log(`psd2ui ${psdPath} 处理完成`);

    }


    buildPrefab(psdRoot: PsdDocument) {
        let prefab = new CCPrefab();
        psdRoot.pushObject(prefab);
        let data = this.createCCNode(psdRoot, psdRoot);
        prefab.data = { __id__: data.idx };
        // 后期处理
        this.postUIObject(psdRoot, psdRoot);

    }
    createCCNode(layer: PsdLayer, psdRoot: PsdDocument) {
        let node = new CCNode(psdRoot);
        layer.uiObject = node;
        node._name = layer.name; //layer.attr?.name || layer.name;
        node._active = !layer.hidden;
        node._opacity = layer.opacity;

        if (config.editorVersion >= EditorVersion.v342) {
            // 3.4.x
            if (layer.opacity !== 255) {
                let uiOpacity = new CCUIOpacity();
                uiOpacity._opacity = layer.opacity;
                uiOpacity.updateWithLayer(layer);
                node.addComponent(uiOpacity);
            }
        }

        // 劫持尺寸设置，使用 psd 中配置的尺寸，这里不对原数据进行修改
        let size = new CCSize(layer.size.width, layer.size.height);
        // if (layer.attr?.comps.size) {
        //     let _attrSize = layer.attr.comps.size;
        //     size.width = _attrSize.w ?? size.width;
        //     size.height = _attrSize.h ?? size.height;
        // }

        // // 对缩放进行处理
        // size.width = Math.round(Math.abs(size.width / layer.scale.x));
        // size.height = Math.round(Math.abs(size.height / layer.scale.y));

        // 配置的位置 Y 偏移
        let offsetY = 0;
        if (layer instanceof PsdText) {
            offsetY = layer.offsetY;
        }

        node._contentSize = size;
        // 更新一下位置 // 根据图层名字设置 锚点，位置， 因为没有对原始数据进行修改，所以这里不考虑 缩放
        layer.updatePositionWithAR();

        // 2.4.9
        node._trs.setPosition(layer.position.x, layer.position.y + offsetY, 0);
        node._trs.setRotation(0, 0, 0, 1);
        node._trs.setScale(layer.scale.x, layer.scale.y, layer.scale.z);
        node._anchorPoint = new CCVec2(layer.anchorPoint.x, layer.anchorPoint.y);


        if (config.editorVersion >= EditorVersion.v342) {
            // 3.4.x
            node._lpos = new CCVec3(layer.position.x, layer.position.y + offsetY, 0);
            node._lrot = new CCVec3(0, 0, 0);
            node._lscale = new CCVec3(layer.scale.x, layer.scale.y, layer.scale.z);
            node._euler = new CCVec3();

            // 3.4.x
            let uiTransform = new CCUITransform();
            uiTransform._contentSize = size;
            uiTransform._anchorPoint = node._anchorPoint;
            uiTransform.updateWithLayer(layer);
            node.addComponent(uiTransform);
        }

        // 
        if (layer instanceof PsdGroup) {
            for (let i = 0; i < layer.children.length; i++) {
                const childLayer = layer.children[i];
                let childNode = this.createCCNode(childLayer, psdRoot);
                childNode && node.addChild(childNode);
            }
        } else if (layer instanceof PsdImage) {
            let sprite = new CCSprite();

            node.addComponent(sprite);
            sprite._materials.push({
                __uuid__: config.SpriteFrame_Material
            });
            sprite.updateWithLayer(layer);

            if (layer.isIgnore()) {
                // 忽略图像
            } else {
                // 查找绑定的图像
                let _layer = imageMgr.getSerialNumberImage(layer);


                // 根据原始图片自动计算缩放
                let scaleX = layer.textureSize.width / _layer.textureSize.width;
                let scaleY = layer.textureSize.height / _layer.textureSize.height;
                if (scaleX != 1 || scaleY != 1) {
                    layer.scale = new Vec3((layer.isFlipX() ? -1 : 1) * scaleX, (layer.isFlipY() ? -1 : 1) * scaleY, 1);
                    node._trs.setScale(layer.scale.x, layer.scale.y, layer.scale.z);
                    node._lscale = new CCVec3(layer.scale.x, layer.scale.y, layer.scale.z);
                }


                // 使用已缓存的 图片 的 uuid
                let imageWarp = imageCacheMgr.get(_layer.name);
                sprite.setSpriteFrame(imageWarp ? imageWarp.textureUuid : _layer.textureUuid);
            }

            this.applyConfig(sprite);
        } else if (layer instanceof PsdText) {
            let label = new CCLabel();
            node.addComponent(label);
            node._color.set(layer.color);
            label._color.set(layer.color);
            label._materials.push({
                __uuid__: config.Label_Material
            });
            label.updateWithLayer(layer);
            this.applyConfig(label);
            // 有描边
            if (layer.outline) {
                let labelOutline = new CCLabelOutline();
                node.addComponent(labelOutline);
                labelOutline.updateWithLayer(layer);
                this.applyConfig(labelOutline);
            }
        }

        // Button / Toggle / ProgressBar
        if (layer.attr) {
            for (const key in layer.attr.comps) {
                if (Object.prototype.hasOwnProperty.call(layer.attr.comps, key) && layer.attr.comps[key]) {
                    let ctor = config.CompMappings[key] as any;
                    if (ctor) {
                        let comp: CCComponent = new ctor();
                        node.addComponent(comp);
                        comp.updateWithLayer(layer);
                        this.applyConfig(comp);
                    }
                }
            }
        }

        this.createPrefabInfo(layer, psdRoot);
        return node;
    }

    createPrefabInfo(layer: PsdLayer, psdRoot: PsdDocument) {
        let node = layer.uiObject as CCNode;
        let prefabInfo = new CCPrefabInfo();
        let idx = psdRoot.pushObject(prefabInfo);
        node._prefab = { __id__: idx };
    }

    // 后处理
    postUIObject(layer: PsdLayer, psdRoot: PsdDocument) {
    }

    saveImage(out: string) {

        let images = imageMgr.getAllImage();
        images.forEach((psdImage, k) => {
            // 查找镜像
            let _layer = imageMgr.getSerialNumberImage(psdImage);

            // 查找已缓存的相同图像
            let imageWarp = imageCacheMgr.get(_layer.name);

            // 不是强制导出的话，判断是否已经导出过
            if (!this.isForceImg) {
                // 判断是否已经导出过相同 md5 的资源，不再重复导出
                if (imageWarp?.isOutput) {
                    console.log(`已有相同资源，不再导出 [${psdImage.imgName}]  md5: ${psdImage.name}`);
                    return;
                }
            }
            console.log(`保存图片 [${_layer.imgName}] md5: ${_layer.name}`);
            imageWarp && (imageWarp.isOutput = true);
            let fullPath = path.join(out, `${_layer.imgName}.png`);
            fs.writeFileSync(fullPath, new Uint8Array(_layer.imgBuffer.buffer, _layer.imgBuffer.byteOffset, _layer.imgBuffer.byteLength));
            this.saveImageMeta(_layer, fullPath);
        });

    }

    saveImageMeta(layer: PsdImage, fullPath: string) {
        let _layer = imageMgr.getSerialNumberImage(layer);
        let imageWarp = imageCacheMgr.get(_layer.name);
        if (!imageWarp) {
            imageWarp = _layer;
        }

        // 2.4.9 =-> SPRITE_FRAME_UUID
        let meta = this.spriteFrameMetaContent.replace(/\$SPRITE_FRAME_UUID/g, imageWarp.uuid)

        meta = meta.replace(/\$TEXTURE_UUID/g, imageWarp.textureUuid);
        meta = meta.replace(/\$FILE_NAME/g, _layer.imgName);
        meta = meta.replace(/\$WIDTH/g, _layer.textureSize.width as any);
        meta = meta.replace(/\$HEIGHT/g, _layer.textureSize.height as any);

        let s9 = _layer.s9 || {
            b: 0, t: 0, l: 0, r: 0,
        };

        meta = meta.replace(/\$BORDER_TOP/g, s9.t as any);
        meta = meta.replace(/\$BORDER_BOTTOM/g, s9.b as any);
        meta = meta.replace(/\$BORDER_LEFT/g, s9.l as any);
        meta = meta.replace(/\$BORDER_RIGHT/g, s9.r as any);

        fs.writeFileSync(fullPath + `.meta`, meta);
    }


    savePrefab(psdDoc: PsdDocument, out) {
        let fullpath = path.join(out, `${psdDoc.name}.prefab`);
        fs.writeFileSync(fullpath, JSON.stringify(psdDoc.objectArray, null, 2));
        this.savePrefabMeta(psdDoc, fullpath);
    }

    savePrefabMeta(psdDoc: PsdDocument, fullpath) {
        let meta = this.prefabMetaContent.replace(/\$PREFB_UUID/g, psdDoc.uuid)
        fs.writeFileSync(fullpath + `.meta`, meta);
    }

    applyConfig(comp: CCComponent) {
        if (!this.psdConfig) {
            return;
        }
        if (comp.__type__ in this.psdConfig) {
            let compConfig = this.psdConfig[comp.__type__];
            for (const key in compConfig) {
                if (Object.prototype.hasOwnProperty.call(compConfig, key)) {
                    const element = compConfig[key];
                    comp[key] = element;
                }
            }
        }
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
    args["cache-remake"] = args["cache-remake"] || args.crm;
    args["force-img"] = args["force-img"] || args.fimg;
    args.pinyin = args.pinyin || args.py;
    args.cache = args.cache || args.c;
    args.init = args.init || args.i;
    args.config = args.config;
    return args;
}

