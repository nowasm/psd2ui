import { EditorVersion } from "../../EditorVersion";
import { utils } from "../../utils/Utils";
import { cctype, ccversion, nonserialization } from "../../_decorator";
import { UIObject } from "../UIObject";
import { CCIDObject } from "./CCObject";

// @cctype("cc.PrefabInfo")
export class CCPrefabInfo extends UIObject{
    
    @ccversion(EditorVersion.all)
    __type__: string = "cc.PrefabInfo";

    
    @ccversion(EditorVersion.all)
    root: CCIDObject = { __id__: 1 };

    @ccversion(EditorVersion.all)
    asset: CCIDObject = { __id__: 0};

    @ccversion(EditorVersion.all)
    fileId: string = "";

    @ccversion(EditorVersion.all)
    sync: boolean = false;

    constructor(){
        super();
        this.fileId = utils.compressUuid(this.uuid);
    }
}