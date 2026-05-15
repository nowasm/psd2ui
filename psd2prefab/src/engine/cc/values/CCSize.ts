import { Size } from "../../../values/Size";
import { cctype } from "../../../_decorator";

@cctype("cc.Size")
export class CCSize extends Size{

    __type__: string = "cc.Size";
}