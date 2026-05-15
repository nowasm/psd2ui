import { EditorVersion } from "../../EditorVersion";
import { PsdGroup } from "../../psd/PsdGroup";
import { PsdLayer } from "../../psd/PsdLayer";
import { cctype, ccversion } from "../../_decorator";
import { CCComponent } from "./CCComponent";
import { CCNode } from "./CCNode";
import { CCIDObject } from "./CCObject";
import { CCSprite } from "./CCSprite";

@cctype("cc.ProgressBar")
export class CCProgressBar extends CCComponent{


    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$totalLength: number = 0;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$barSprite: CCIDObject = null;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$mode: number = 0;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$progress: number = 1;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$reverse: boolean = false;

    // 3.4.x
    @ccversion(EditorVersion.v342)
    _barSprite: CCIDObject = null;
    
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _mode = 0;
    
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _totalLength = 0;
    
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _progress = 1;

    // 3.4.x
    @ccversion(EditorVersion.v342)
    _reverse = false;


    setBar(sprite: CCSprite){
        this._barSprite = this._N$barSprite = {
            __id__: sprite.idx
        }
    }

    updateWithLayer(psdLayer: PsdGroup) {
        if(!psdLayer.children){
            console.error(`CCProgressBar-> 只能作用在 组图层 上`);
            return;
        }

        outer: for (let i = 0; i < psdLayer.children.length; i++) {
            const child = psdLayer.children[i];
            if(child.attr.comps.bar){
                let node = child.uiObject as CCNode;
                
                // 暂时只有横向进度条
                this._totalLength = this._N$totalLength = node._contentSize.width;

                for (let j = 0; j < node.components.length; j++) {
                    const comp = node.components[j];
                    if(comp instanceof CCSprite){
                        this.setBar(comp);
                        break outer;
                    }
                }
            }
        }

    }
}