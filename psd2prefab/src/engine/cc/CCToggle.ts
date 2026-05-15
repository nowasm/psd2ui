import { EditorVersion } from "../../EditorVersion";
import { PsdGroup } from "../../psd/PsdGroup";
import { PsdLayer } from "../../psd/PsdLayer";
import { cctype, ccversion } from "../../_decorator";
import { CCButton } from "./CCButton";
import { CCComponent } from "./CCComponent";
import { CCNode } from "./CCNode";
import { CCIDObject } from "./CCObject";
import { CCSprite } from "./CCSprite";

@cctype("cc.Toggle")
export class CCToggle extends CCButton{
   
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$isChecked = true;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    toggleGroup = null;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    checkMark: CCIDObject = null;
    @ccversion(EditorVersion.all)
    checkEvents = [];

    // 3.4.x
    @ccversion(EditorVersion.v342)
    _isChecked = true;
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _checkMark: CCIDObject = null;

    setCheckMark(sprite: CCSprite){
       this._checkMark = this.checkMark = {
            __id__: sprite.idx
        }
    }

    
    updateWithLayer(psdLayer: PsdGroup) {
        if(!psdLayer.children){
            console.error(`CCToggle-> 只能作用在 组图层 上`);
            return;
        }

        outer: for (let i = 0; i < psdLayer.children.length; i++) {
            const child = psdLayer.children[i];
            if(child.attr.comps.check){
                let node = child.uiObject as CCNode;
                for (let j = 0; j < node.components.length; j++) {
                    const comp = node.components[j];
                    if(comp instanceof CCSprite){

                        this.setCheckMark(comp);
                        break outer;
                    }
                }
            }
        }

    }
}