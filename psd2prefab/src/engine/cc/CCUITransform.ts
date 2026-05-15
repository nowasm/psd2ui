import { EditorVersion } from "../../EditorVersion";
import { PsdLayer } from "../../psd/PsdLayer";
import { cctype, ccversion } from "../../_decorator";
import { CCComponent } from "./CCComponent";
import { CCIDObject, CCObject } from "./CCObject";
import { CCSize } from "./values/CCSize";
import { CCVec2 } from "./values/CCVec2";

// 3.4.x

@cctype("cc.UITransform")
export class CCUITransform extends CCComponent{
    
    @ccversion(EditorVersion.v342)
    _contentSize: CCSize = new CCSize();
    
    @ccversion(EditorVersion.v342)
    _anchorPoint: CCVec2 = new CCVec2(0,0);
    
    updateWithLayer(psdLayer: PsdLayer) {
    }
}