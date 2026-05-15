import { config } from "../../config";
import { EditorVersion } from "../../EditorVersion";
import { PsdDocument } from "../../psd/PsdDocument";
import { cctype, ccversion, nonserialization } from "../../_decorator";
import { CCComponent } from "./CCComponent";
import { CCCompPrefabInfo } from "./CCCompPrefabInfo";
import { CCIDObject, CCObject } from "./CCObject";
import { CCColor } from "./values/CCColor";
import { CCSize } from "./values/CCSize";
import { CCTypedArray } from "./values/CCTypedArray";
import { CCVec2 } from "./values/CCVec2";
import { CCVec3 } from "./values/CCVec3";

@cctype("cc.Node")
export class CCNode extends CCObject{

    @ccversion(EditorVersion.all)
    _parent: CCIDObject = null;
    
    @ccversion(EditorVersion.all)
    _children: CCIDObject[] = [];
    
    @ccversion(EditorVersion.all)
    _active: boolean = true;
    
    @ccversion(EditorVersion.all)
    _components: CCIDObject[] = [];
    
    @ccversion(EditorVersion.all)
    _prefab: CCIDObject = null;

    @ccversion(EditorVersion.all)
    _id: string = "";

    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _opacity: number = 255;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _color: CCColor = new CCColor(255,255,255,255);
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _contentSize: CCSize = new CCSize();
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _anchorPoint: CCVec2 = new CCVec2(0,0);
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _trs: CCTypedArray = new CCTypedArray();
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _eulerAngles: CCVec3 = new CCVec3();
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _skewX: number = 0;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _skewY: number = 0;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _is3DNode: boolean = false;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _groupIndex: number = 0;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    groupIndex: number = 0;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _renderEnable: boolean = false;
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _bfsRenderFlag: boolean = false;

    // 3.4.x
    @ccversion(EditorVersion.v342)
    _lpos: CCVec3 = new CCVec3();

    // 3.4.x
    @ccversion(EditorVersion.v342)
    _lrot: CCVec3 = new CCVec3();
    
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _lscale: CCVec3 = new CCVec3();
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _euler: CCVec3 = new CCVec3();
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _layer: number = 33554432;


    @nonserialization
    psdDoc: PsdDocument = null;

    @nonserialization
    components: CCComponent[] = [];

    @nonserialization
    children: CCNode[] = [];

    constructor(psdDoc: PsdDocument){
        super();
        if(psdDoc){
            this.psdDoc = psdDoc;
            psdDoc.pushObject(this);
        }
    }

    
    addComponent(comp: CCComponent){
        comp.node = {__id__: this.idx }
        let compIdx = this.psdDoc.pushObject(comp);
        this._components.push({ __id__: compIdx});
        this.components.push(comp);

        if(config.editorVersion >= EditorVersion.v342){
            this.addCompPrefabInfo(comp)    
        }
    }

    addCompPrefabInfo(comp: CCComponent){
        let compInfo = new CCCompPrefabInfo();
        let compIdx = this.psdDoc.pushObject(compInfo);
        comp.__prefab = {__id__: compIdx }
    }
    
    addChild(child: CCNode){
        this._children.push({ __id__: child.idx});
        child._parent =  { __id__: this.idx };
        this.children.push(child);
    }   
}