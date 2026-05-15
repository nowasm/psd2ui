

import 'ag-psd/initialize-canvas'; // only needed for reading image data and thumbnails
import * as psd from 'ag-psd';
import fs from 'fs-extra';
import path from 'path';
import { imageMgr } from './assets-manager/ImageMgr';
import { fileUtils } from './utils/FileUtils';
import { parser } from './Parser';
import { PsdDocument } from './psd/PsdDocument';
import { PsdLayer } from './psd/PsdLayer';
import { PsdGroup } from './psd/PsdGroup';
import { PsdText } from './psd/PsdText';
import { Color } from './values/Color';

interface TextObject {
    text: string;
    fontSize: number;
    color: string;
    outlineWidth?: number;
    outlineColor?: string;
}

class ExportImageMgr {

    textObjects: TextObject[] = [];

    test() {
        const outDir = path.join(__dirname, "..", "out");
        let psdPath = "./test-img-only/境界奖励-优化.psd";
        this.parsePsd(psdPath, outDir);
    }

    async exec(args) {
        // 检查参数
        if (!this.checkArgs(args)) {
            return;
        }

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

        return true;
    }

    async parsePsdDir(dir: string, outDir: string) {
        // 清空目录
        fs.emptyDirSync(outDir);

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
        this.textObjects.length = 0;
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
        fs.emptyDirSync(prefabDir);
        fs.mkdirsSync(textureDir); //创建 图片目录
        await this.saveImage(textureDir);
        await this.saveTextFile(psdRoot, prefabDir);
        console.log(`psd2ui ${psdPath} 处理完成`);

    }

    saveImage(out: string) {

        let images = imageMgr.getAllImage();
        let idx = 0;
        images.forEach((psdImage, k) => {
            // 查找镜像
            let _layer = imageMgr.getSerialNumberImage(psdImage);
            let name = `${_layer.imgName}_${idx}`
            console.log(`保存图片 [${_layer.imgName}] 重命名为 [${name}] md5: ${_layer.md5}`);
            let fullpath = path.join(out, `${name}.png`);
            fs.writeFileSync(fullpath, new Uint8Array(_layer.imgBuffer.buffer, _layer.imgBuffer.byteOffset, _layer.imgBuffer.byteLength));
            idx++;
        });

    }


    saveTextFile(psdRoot: PsdDocument, out: string) {
        this.scanText(psdRoot, psdRoot);
        let textContent = JSON.stringify(this.textObjects, null, 2);
        let fullpath = path.join(out, `text.txt`);
        fs.writeFileSync(fullpath, textContent, { encoding: "utf-8" });
    }

    scanText(layer: PsdLayer, psdRoot: PsdDocument) {
        if (layer instanceof PsdGroup) {
            for (let i = 0; i < layer.children.length; i++) {
                const childLayer = layer.children[i];
                this.scanText(childLayer, psdRoot);
            }
        } else if (layer instanceof PsdText) {
            let textObj: TextObject = {
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


    private static _instance: ExportImageMgr = null
    public static getInstance(): ExportImageMgr {
        if (!this._instance) {
            this._instance = new ExportImageMgr();
        }
        return this._instance;
    }
}


export let exportImageMgr = ExportImageMgr.getInstance();