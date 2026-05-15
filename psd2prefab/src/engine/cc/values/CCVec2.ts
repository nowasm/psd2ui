import { Vec2 } from "../../../values/Vec2";
import { cctype } from "../../../_decorator";

@cctype("cc.Vec2")
export class CCVec2 extends Vec2{

    __type__: string = "cc.Vec2";
}