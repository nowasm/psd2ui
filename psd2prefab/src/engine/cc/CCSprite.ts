import { config } from "../../config";
import { EditorVersion } from "../../EditorVersion";
import { PsdImage } from "../../psd/PsdImage";
import { cctype, ccversion } from "../../_decorator";
import { CCComponent } from "./CCComponent";
import { CCIDObject, CCUUIDObject } from "./CCObject";
import { CCColor } from "./values/CCColor";
import { CCVec2 } from "./values/CCVec2";

@cctype("cc.Sprite")
export class CCSprite extends CCComponent {
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _materials: CCUUIDObject[] = [];

    @ccversion(EditorVersion.all)
    _srcBlendFactor: number = 770; // 3.4.x = 2

    @ccversion(EditorVersion.all)
    _dstBlendFactor: number = 771; // 3.4.x = 4
    
    @ccversion(EditorVersion.all)
    _spriteFrame: CCUUIDObject = null;
    
    @ccversion(EditorVersion.all)
    _type: number = 0;
    
    @ccversion(EditorVersion.all)
    _sizeMode: number = 1;
    
    @ccversion(EditorVersion.all)
    _fillType: number = 0;
    
    @ccversion(EditorVersion.all)
    _fillCenter: CCVec2 = new CCVec2();
    
    @ccversion(EditorVersion.all)
    _fillStart: number = 0;
    
    @ccversion(EditorVersion.all)
    _fillRange: number = 0;
    
    @ccversion(EditorVersion.all)
    _isTrimmedMode: boolean = true;
    
    @ccversion(EditorVersion.all)
    _atlas = null;


    // 3.4.x
    @ccversion(EditorVersion.v342)
    _visFlags: number = 0;


    // 3.4.x
    @ccversion(EditorVersion.v342)
    _customMaterial: any = null;

    // 3.4.x
    @ccversion(EditorVersion.v342)
    _color: CCColor = new CCColor(255,255,255,255);

    // 3.4.x
    @ccversion(EditorVersion.v342)
    _useGrayscale: boolean = false;

    use9() {
        this._type = 1;
        this._sizeMode = 0;
    }

    updateWithLayer(psdLayer: PsdImage) {
        if (psdLayer.s9) {
            this.use9();
        }
        if (Math.abs(psdLayer.scale.x) != 1 || Math.abs(psdLayer.scale.y) != 1) {
            this._sizeMode = 0;
        }

        if(config.editorVersion >= EditorVersion.v342){
            this._srcBlendFactor = 2;
            this._dstBlendFactor = 4;
        }
    }

    setSpriteFrame(uuid: string){
        if(config.editorVersion >= EditorVersion.v342){
            this._spriteFrame = {__uuid__: `${uuid}@f9941`,__expectedType__ : "cc.SpriteFrame"};
        }else{
            this._spriteFrame = {__uuid__: uuid};
        }
    }
}