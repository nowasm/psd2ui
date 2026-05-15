import { EditorVersion } from "../../EditorVersion";
import { cctype, ccversion } from "../../_decorator";
import { CCIDObject, CCObject } from "./CCObject";

@cctype("cc.Prefab")
export class CCPrefab extends CCObject{
    
    @ccversion(EditorVersion.all)
    _native: string = "";
    @ccversion(EditorVersion.all)
    data: CCIDObject = null;
    
    @ccversion(EditorVersion.all)
    optimizationPolicy: number = 0;
    @ccversion(EditorVersion.all)
    asyncLoadAssets: boolean = false;

    // 2.4.x
    @ccversion(EditorVersion.v249)
    readonly: boolean = false;
    
    // // 3.4.x
    @ccversion(EditorVersion.v342)
    persistent: boolean = false;

}