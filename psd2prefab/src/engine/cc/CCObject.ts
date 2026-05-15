import { EditorVersion } from "../../EditorVersion";
import { utils } from "../../utils/Utils";
import { ccversion, nonserialization } from "../../_decorator";
import { UIObject } from "../UIObject";

export type CCIDObject = { __id__: number };
export type CCUUIDObject = { __uuid__: string, __expectedType__?: string};



export class CCObject extends UIObject{

    @ccversion(EditorVersion.all)
    __type__: string;
    
    @ccversion(EditorVersion.all)
    _name: string = "";
    
    @ccversion(EditorVersion.all)
    _objFlags: number = 0;
    
    constructor(){
        super();
        
        // @ts-ignore
        this.__type__ = this.$__type__
        
    }
}