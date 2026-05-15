import { PsdLayerSource } from "../_declare";
import { LayerType } from "./LayerType";
import { Size } from "../values/Size";
import { Vec2 } from "../values/Vec2";
import { utils } from "../utils/Utils";
import { UIObject } from "../engine/UIObject";
import { Rect } from "../values/Rect";
import { Color } from "../values/Color";
import { Vec3 } from "../values/Vec3";
import { pinyin } from "pinyin-pro";

/**
 * 命名规则
 * "name@Type{prop: 1,prop2: 2}"
 * Type = btn | bar | (toggle @check) | .9 | 
 * 
 */

export interface PsdAttr {
    name: string,
    comps: {
        Btn?: {};
        btn?: {};
        ProgressBar?: {};
        progressBar?: {};
        bar?: {};
        Toggle?: {};
        toggle?: {};
        check?: {};
        ".9"?: { l?: number, r?: number, b?: number, t?: number };
        ar?: { x?: number, y?: number };
        // 忽略导出节点和图片
        ignore?: {};
        ig?: {};
        // 忽略导出节点
        ignorenode?: {};
        ignode?: {};
        // 忽略导出图片
        ignoreimg?: {};
        igimg?: {};

        full?: {};
        // size?: { w?: number, h?: number };
        // scale?: { x?: number, y?: number };
        img?: { id?: number, name?: string, bind?: number }
        flip?: { bind: number, x?: number, y?: number }
        flipX?: { bind: number }
        flipY?: { bind: number }
        // position?:{x?: number,y?: number};
        // pos?:{x?: number,y?: number};
    }
}

export abstract class PsdLayer {

    static isPinyin = false;

    declare uuid: string;
    declare rootDoc: PsdLayer;
    declare name: string;
    declare source: PsdLayerSource;
    declare parent: PsdLayer;
    declare position: Vec2;
    declare size: Size;
    declare rect: Rect;
    declare anchorPoint: Vec2;
    declare hidden: boolean;
    declare opacity: number;
    declare layerType: LayerType;
    declare uiObject: UIObject;
    declare attr: PsdAttr; // 解析名字获得各项属性
    declare color: Color;
    declare scale: Vec3;

    constructor(source: any, parent: PsdLayer, rootDoc: PsdLayer) {
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
        this.name = this.chineseToPinyin(this.attr?.name || this.name);

        // 使用配置的缩放系数
        // let _scale = this.attr?.comps.scale;
        // this.scale = new Vec3(_scale?.x ?? 1, _scale?.y ?? 1, 1);
        this.scale = new Vec3(1, 1, 1);
    }

    abstract onCtor();


    parseNameRule(name: string) {
        if (!name) {
            return;
        }
        name = name.trim();
        let fragments = name.split("@");
        if (fragments.length === 0) {
            console.error(`PsdLayer-> 名字解析错误`);
            return;
        }
        let obj: PsdAttr = {
            name: fragments[0]?.trim()?.replace(/\.|>|\/|\ /g, "_") ?? "unknow",
            comps: {},
        }
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
    removeChineseFromEnd(inputString: string): string {
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
            this.anchorPoint.x = ar.x ?? this.anchorPoint.x;
            this.anchorPoint.y = ar.y ?? this.anchorPoint.y;
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
    chineseToPinyin(text: string) {
        if (!text || !PsdLayer.isPinyin) {
            return text;
        }

        let reg = new RegExp("[\\u4E00-\\u9FFF]+", "g");
        if (!reg.test(text)) {
            return text;
        }

        let names = pinyin(text, {
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
