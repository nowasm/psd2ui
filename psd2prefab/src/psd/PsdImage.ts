import { PsdGroup } from "./PsdGroup";
import { PsdLayer } from "./PsdLayer";
import { utils } from "../utils/Utils";
import canvas from 'canvas';
import { Border, Texture9Utils } from "../utils/Texture9Utils";
import { Size } from "../values/Size";
import { fileUtils } from "../utils/FileUtils";
import { Vec3 } from "../values/Vec3";

export class PsdImage extends PsdLayer {
    declare parent: PsdGroup;

    declare textureUuid: string;

    declare md5: string;
    declare imgBuffer: Buffer;

    declare textureSize: Size;

    declare imgName: string;


    declare s9: Border;

    constructor(source: any, parent: PsdLayer, rootDoc: PsdLayer) {
        super(source, parent, rootDoc);
        this.textureUuid = utils.uuid();

        // img name
        this.imgName = this.attr.comps.img?.name || this.name

        // .9
        if (this.attr.comps['.9']) {
            let s9 = this.attr.comps['.9'];
            this.s9 = Texture9Utils.safeBorder(this.source.canvas, s9 as any);
            let newCanvas = Texture9Utils.split(this.source.canvas, s9 as any);
            this.source.canvas = newCanvas;
        }
        let canvas: canvas.Canvas = this.source.canvas;

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
        return typeof this.attr.comps.flip?.bind !== 'undefined'
            || typeof this.attr.comps.img?.bind !== 'undefined';
    }

    /** 是否是 x 方向镜像图片 */
    isFlipX() {
        return typeof this.attr.comps.flipX?.bind !== 'undefined';
    }

    /** 是否是 y 方向镜像图片 */
    isFlipY() {
        return typeof this.attr.comps.flipY?.bind !== 'undefined';
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