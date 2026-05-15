import { EditorVersion } from "../../EditorVersion";
import { PsdText } from "../../psd/PsdText";
import { cctype, ccversion } from "../../_decorator";
import { CCComponent } from "./CCComponent";
import { CCUUIDObject } from "./CCObject";
import { CCColor } from "./values/CCColor";

@cctype("cc.LabelOutline")
export class CCLabelOutline extends CCComponent{
    
    @ccversion(EditorVersion.all)
    _color: CCColor = new CCColor(255,255,255,255);
    @ccversion(EditorVersion.all)
    _width: number = 1;

    
    updateWithLayer(psdLayer: PsdText) {
        
        this._width = psdLayer.outline.width;
        this._color.set(psdLayer.outline.color);
    }
}