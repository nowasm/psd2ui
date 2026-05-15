import { utils } from "../../utils/Utils";
import { cctype, nonserialization } from "../../_decorator";
import { UIObject } from "../UIObject";
import { CCIDObject } from "./CCObject";

// @cctype("cc.CompPrefabInfo")
export class CCCompPrefabInfo extends UIObject{
    
    __type__: string = "cc.CompPrefabInfo";
    fileId: string = "";

    constructor(){
        super();
        this.fileId = utils.compressUuid(this.uuid);
    }
}