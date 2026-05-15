import { UIObject } from "../engine/UIObject";
import { Rect } from "../values/Rect";
import { Size } from "../values/Size";
import { PsdGroup } from "./PsdGroup";

export class PsdDocument extends PsdGroup{
    
    /** 当前文档所有的图片 */
    images: Map<string,any> = new Map();

    objectMap: Map<string,number> = new Map();

    objectArray: UIObject[] = [];
    
    constructor(source: any){
        super(source,null,null);
        this.size = new Size(source.width,source.height);
        this.rect = new Rect(0, this.size.width, 0, this.size.height);
    }
    
    pushObject(uiObject: UIObject){
        let idx = this.objectArray.length;
        uiObject.idx = idx;
        this.objectMap.set(uiObject.uuid,idx);
        this.objectArray.push(uiObject);
        return idx;
    }

    getObjectIdx(uuid: string){
        let idx = this.objectMap.get(uuid); 
        return idx;
    }
    getObject(uuid: string){
        let idx = this.objectMap.get(uuid);
        if(idx < this.objectArray.length){
            return this.objectArray[idx];
        }
        return null;
    }
    
    onCtor(): void {
        super.onCtor();
        
    }

}