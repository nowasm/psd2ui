import { EditorVersion } from "../../EditorVersion";
import { PsdLayer } from "../../psd/PsdLayer";
import { cctype, ccversion } from "../../_decorator";
import { CCComponent } from "./CCComponent";

// 3.4.x
@cctype("cc.UIOpacity")
export class CCUIOpacity extends CCComponent{
    
    @ccversion(EditorVersion.v342)
    _opacity = 255;
    
    updateWithLayer(psdLayer: PsdLayer) {
    }
}