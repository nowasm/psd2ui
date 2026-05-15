import { config } from "../../config";
import { EditorVersion } from "../../EditorVersion";
import { PsdLayer } from "../../psd/PsdLayer";
import { PsdText } from "../../psd/PsdText";
import { cctype, ccversion } from "../../_decorator";
import { CCComponent } from "./CCComponent";
import { CCUUIDObject } from "./CCObject";
import { CCColor } from "./values/CCColor";
import { CCLabel } from "./CCLabel";
import { Vec2 } from "../../values/Vec2";

@cctype("LabelPlus")
export class LabelPlus extends CCLabel {
    @ccversion(EditorVersion.all)
    _outline: boolean = false;

    @ccversion(EditorVersion.all)
    _outlineThickness: number = 0.3;

    @ccversion(EditorVersion.all)
    _shadow: boolean = false;

    @ccversion(EditorVersion.all)
    _shadowOffset: Vec2 = new Vec2(0, 0);
}