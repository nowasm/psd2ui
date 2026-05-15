import { config } from "../config";
import { EditorVersion } from "../EditorVersion";
import { utils } from "../utils/Utils";
import { nonserialization } from "../_decorator";

export class UIObject{
    
    @nonserialization
    uuid: string = "";
    
    @nonserialization
    idx: number = 0;

    constructor(){
        this.uuid = utils.uuid();
    }

    toJSON(){
        let data:Record<any,any> = {};
        for (const key in this) {
            if (Object.prototype.hasOwnProperty.call(this, key)) {
                // @ts-ignore
                if(this.__unserialization && this.__unserialization.indexOf(key) !== -1){
                    continue;
                }
                // @ts-ignore
                let ver_tag = this.constructor.__ver_tag_id__;
                
                // 判断编辑器版本
                // @ts-ignore
                if(this._version && this._version[ver_tag]?.[key]){
                    // @ts-ignore
                    if(!this._version[ver_tag][key][EditorVersion[config.editorVersion]]){
                        continue;
                    }
                }
                
                const value = this[key];
                data[key] = value;
            }
        }
        return data;
    }
}