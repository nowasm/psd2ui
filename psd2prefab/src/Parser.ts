import { imageCacheMgr } from "./assets-manager/ImageCacheMgr";
import { imageMgr } from "./assets-manager/ImageMgr";
import { LayerType } from "./psd/LayerType";
import { PsdDocument } from "./psd/PsdDocument";
import { PsdGroup } from "./psd/PsdGroup";
import { PsdImage } from "./psd/PsdImage";
import { PsdAttr, PsdLayer } from "./psd/PsdLayer";
import { PsdText } from "./psd/PsdText";
import { PsdLayerSource } from "./_declare";

export class Parser {

    /** 解析图层类型 */
    parseLayerType(source: PsdLayerSource) {
        if ("children" in source) {
            if ("width" in source && "height" in source) {
                // Document
                return LayerType.Doc;
            } else {
                // Group
                return LayerType.Group;
            }
        } else if ("text" in source) {
            //  Text
            return LayerType.Text;
        }
        // else if ('placedLayer' in layer) {
        //     // 智能对象
        // }
        return LayerType.Image;
    }
    parseLayer(source: any, parent?: PsdGroup, rootDoc?: PsdDocument) {
        let layer: PsdLayer = null;
        let layerType = this.parseLayerType(source);
        switch (layerType) {
            case LayerType.Doc:
            case LayerType.Group: {

                let group: PsdGroup = null
                // Group
                if (layerType == LayerType.Group) {
                    group = new PsdGroup(source, parent, rootDoc);
                    if (group.attr.comps.ignorenode || group.attr.comps.ignore) {
                        return null;
                    }
                } else {
                    // Document
                    group = new PsdDocument(source);
                }

                for (let i = 0; i < source.children.length; i++) {
                    const childSource = source.children[i];
                    let child = this.parseLayer(childSource, group, rootDoc || group as PsdDocument);
                    if (child) {
                        if (!child.attr.comps.ignorenode && !child.attr.comps.ignore) {
                            // 没有进行忽略节点的时候才放入列表
                            group.children.push(child);
                        }
                    } else {
                        console.error(`图层解析错误`);
                    }
                }
                layer = group;
            }
                break;

            case LayerType.Image: {
                // 
                if (!source.canvas) {
                    console.error(`Parser-> 空图层 ${source?.name}`);
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

            case LayerType.Text: {
                //  Text
                layer = new PsdText(source, parent, rootDoc);
            }
                break;

            default:
                break;
        }
        layer.layerType = layerType;
        layer.parseSource();
        layer.onCtor();
        return layer;
    }


}

export const parser = new Parser();