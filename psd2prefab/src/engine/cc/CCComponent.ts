import { EditorVersion } from "../../EditorVersion";
import { PsdLayer } from "../../psd/PsdLayer";
import { ccversion, nonserialization } from "../../_decorator";
import { CCIDObject, CCObject } from "./CCObject";

export abstract class CCComponent extends CCObject{
    
    @ccversion(EditorVersion.all)
    _enabled: boolean = true;
    
    @ccversion(EditorVersion.all)
    node: CCIDObject = null;
    
    @ccversion(EditorVersion.all)
    _id: string = "";
 
    // 3.4.x
    @ccversion(EditorVersion.v342)
    __prefab: CCIDObject = null;

    abstract updateWithLayer(psdLayer: PsdLayer);
}