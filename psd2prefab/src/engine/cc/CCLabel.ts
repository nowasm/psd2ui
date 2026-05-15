import { config } from "../../config";
import { EditorVersion } from "../../EditorVersion";
import { PsdLayer } from "../../psd/PsdLayer";
import { PsdText } from "../../psd/PsdText";
import { cctype, ccversion } from "../../_decorator";
import { CCComponent } from "./CCComponent";
import { CCUUIDObject } from "./CCObject";
import { CCColor } from "./values/CCColor";

@cctype("cc.Label")
export class CCLabel extends CCComponent{
    
    @ccversion(EditorVersion.all)
    _srcBlendFactor: number = 770; // 3.4.x = 2
    @ccversion(EditorVersion.all)
    _dstBlendFactor: number = 771; // 3.4.x = 4
    @ccversion(EditorVersion.all)
    _string: string = "";
    @ccversion(EditorVersion.all)
    _fontSize: number = 0;
    @ccversion(EditorVersion.all)
    _lineHeight: number = 0;
    @ccversion(EditorVersion.all)
    _enableWrapText: boolean = true;
    @ccversion(EditorVersion.all)
    _isSystemFontUsed: boolean = true;
    @ccversion(EditorVersion.all)
    _spacingX: number = 0;
    @ccversion(EditorVersion.all)
    _underlineHeight: number = 0;
    
    @ccversion(EditorVersion.v249)
    _materials: CCUUIDObject[] = [];
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$string: string = "";
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$file: any = null;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _batchAsBitmap: boolean = false;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _styleFlags: number = 0;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$horizontalAlign: number = 1;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$verticalAlign: number = 1;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$fontFamily: string = "Arial";
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$overflow: number = 0;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$cacheMode: number = 0;

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
    _overflow: number = 0;
    
    // // 3.4.x
    @ccversion(EditorVersion.v342)
    _cacheMode = 0;

    @ccversion(EditorVersion.v342)
    _horizontalAlign = 1;

    @ccversion(EditorVersion.v342)
    _verticalAlign = 1;
    
    @ccversion(EditorVersion.v342)
    _actualFontSize = 0;
    
    @ccversion(EditorVersion.v342)
    _isItalic = false;
    
    @ccversion(EditorVersion.v342)
    _isBold = false;
    
    @ccversion(EditorVersion.v342)
    _isUnderline = false;
    
    updateWithLayer(psdLayer: PsdText) {
        this._fontSize = psdLayer.fontSize;
        // this._actualFontSize = this._fontSize;
        this._string = this._N$string = psdLayer.text;
        
        this._lineHeight = this._fontSize + config.textLineHeightOffset;
        
        if(config.editorVersion >= EditorVersion.v342){
            this._srcBlendFactor = 2;
            this._dstBlendFactor = 4;
        }
    }
}