import fs from "fs-extra";
import path from "path";
import { config } from "../config";
import { EditorVersion } from "../EditorVersion";
import { fileUtils } from "../utils/FileUtils";

export interface ImageWarp {
    path?: string;
    uuid: string;
    textureUuid: string;
    isOutput?: boolean
}

export class ImageCacheMgr {
    private _imageMap: Map<string, ImageWarp> = new Map();
    private _cachePath: string = null;

    initWithPath(_path: string) {
        if (!fs.existsSync(_path)) {
            console.log(`ImageCacheMgr-> 文件不存在: ${_path}`);
            return;
        }
        this._cachePath = _path;
        let content = fs.readFileSync(_path, "utf-8");
        this.initWithFile(content);
    }
    initWithFile(file: string) {
        let json = JSON.parse(file);
        this.initWithJson(json);
    }
    initWithJson(json: any) {
        for (const key in json) {
            if (Object.prototype.hasOwnProperty.call(json, key)) {
                this._imageMap.set(key, json[key]);
            }
        }
    }

    set(md5: string, warp: ImageWarp) {
        this._imageMap.set(md5, warp);
    }

    has(md5: string): boolean {
        return this._imageMap.has(md5);
    }

    get(md5: string): ImageWarp {
        return this._imageMap.get(md5);
    }

    async saveImageMap(_path?: string) {
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
        await fileUtils.writeFile(_path, content);
    }


    // 获取已存在的图片，生成 md5: uuid 映射,
    loadImages(dir: string) {
        if (this._imageMap.size > 0) {
            console.error(`ImageCacheMgr-> 暂时只能在 启动时加载`);
            return;
        }

        let pngs = fileUtils.filterFile(dir, (fileName) => {
            let extname = path.extname(fileName);
            if (extname == ".png") {
                return true;
            }
            return false;
        });

        if (!pngs) {
            return;
        }

        for (let i = 0; i < pngs.length; i++) {
            const png = pngs[i];
            let md5 = fileUtils.getMD5(png);
            let baseName = path.basename(png);
            let fileName = baseName.split(".")[0];
            console.log(`ImageCacheMgr->缓存 `, png);
            let imageWarp = this._loadImageMetaWarp(`${png}.meta`);
            if (imageWarp) {
                this.set(fileName, imageWarp);
            }
        }
    }

    private _loadImageMetaWarp(_path: string) {
        let content = fs.readFileSync(_path, { encoding: "utf-8" });
        let imageWarp: ImageWarp = null;
        switch (config.editorVersion) {
            case EditorVersion.v249:
                imageWarp = this._loadImageMeta249(content, _path);
                break;
            case EditorVersion.v342:
                imageWarp = this._loadImageMeta34x(content, _path);
                break;

            default:
                console.log(`ImageCacheMgr-> 暂未实现 ${EditorVersion[config.editorVersion]} 版本`);

                break;
        }
        return imageWarp;
    }

    private _loadImageMeta249(metaContent: any, _path: string) {
        let filename = path.basename(_path, ".png.meta");
        let fullpath = path.join(path.dirname(_path), `${filename}.png`);
        let metaJson = JSON.parse(metaContent);

        if (!metaJson?.subMetas?.[filename]) {
            return null;
        }
        let imageWarp: ImageWarp = {
            path: fullpath,
            textureUuid: metaJson.subMetas[filename].uuid,
            uuid: metaJson.uuid,
            isOutput: true,
        }

        return imageWarp;
    }
    private _loadImageMeta34x(metaContent: any, _path: string) {
        let filename = path.basename(_path, ".png.meta");
        let fullpath = path.join(path.dirname(_path), `${filename}.png`);
        let metaJson = JSON.parse(metaContent);

        if (!metaJson?.subMetas?.["6c48a"]) {
            return null;
        }
        let uuid = metaJson.subMetas["6c48a"].uuid.replace("@6c48a", "");
        let imageWarp: ImageWarp = {
            path: fullpath,
            textureUuid: uuid,
            uuid: uuid,
            isOutput: true,
        }

        return imageWarp;
    }




    private static _instance: ImageCacheMgr = null
    public static getInstance(): ImageCacheMgr {
        if (!this._instance) {
            this._instance = new ImageCacheMgr();
        }
        return this._instance;
    }
}

export const imageCacheMgr = ImageCacheMgr.getInstance();