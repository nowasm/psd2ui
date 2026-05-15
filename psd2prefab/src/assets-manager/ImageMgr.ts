import { PsdDocument } from "../psd/PsdDocument";
import { PsdGroup } from "../psd/PsdGroup";
import { PsdImage } from "../psd/PsdImage";
interface Layer {
    name: string;
    md5: string;
}
class ImageMgr {
    // 镜像图像管理
    private _imageIdKeyMap: Map<number, PsdImage> = new Map();

    // 当前 psd 所有的图片
    private _imageMapMd5Key: Map<string, PsdImage> = new Map();

    private _imageMapImgNameKey: Map<string, PsdImage> = new Map();

    // /** 相同名称不同  md5 图片的后缀id */
    // private _sameImgNameId: Record<string, number> = {};

    add(psdImage: PsdImage) {
        // 不忽略导出图片
        if (!psdImage.isIgnore() && !psdImage.isBind()) {
            if (!this._imageMapMd5Key.has(psdImage.name)) {
                this._imageMapMd5Key.set(psdImage.name, psdImage);
            }
        }

        if (typeof psdImage.attr.comps.img?.id != "undefined") {
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
    handleSameImgName(psdImage: PsdImage, imgName: string, idx: number) {
        if (this._imageMapImgNameKey.has(imgName)) {
            let _psdImage = this._imageMapImgNameKey.get(imgName);
            if (_psdImage.name != psdImage.name) {
                this.handleSameImgName(psdImage, `${psdImage.imgName}_R${idx}`, idx + 1);
            } else {
                psdImage.imgName = imgName;
            }
        } else {
            psdImage.imgName = imgName;
            this._imageMapImgNameKey.set(imgName, psdImage);
        }
    }


    getAllImage() {
        return this._imageMapMd5Key;
    }

    /** 尝试获取有编号的图像图层 */
    getSerialNumberImage(psdImage: PsdImage) {
        let bind = psdImage.attr.comps.flip?.bind ?? psdImage.attr.comps.img?.bind;
        if (typeof bind != 'undefined') {
            if (this._imageIdKeyMap.has(bind)) {
                return this._imageIdKeyMap.get(bind)
            } else {
                console.warn(`ImageMgr-> ${psdImage.source.name} 未找到绑定的图像 {${bind}}，请检查 psd 图层`);

            }
        }
        return psdImage;
    }

    clear() {
        this._imageIdKeyMap.clear();
        this._imageMapMd5Key.clear()
    }

    private static _instance: ImageMgr = null
    public static getInstance(): ImageMgr {
        if (!this._instance) {
            this._instance = new ImageMgr();
        }
        return this._instance;
    }
}

export const imageMgr = ImageMgr.getInstance();