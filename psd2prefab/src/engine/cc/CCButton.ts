import { EditorVersion } from "../../EditorVersion";
import { PsdLayer } from "../../psd/PsdLayer";
import { cctype, ccversion } from "../../_decorator";
import { CCComponent } from "./CCComponent";
import { CCIDObject } from "./CCObject";

@cctype("cc.Button")
export class CCButton extends CCComponent{
    
    // 2.4.x
    @ccversion(EditorVersion.v249)
    duration: number = 0.1;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    zoomScale: number = 1.2;

    @ccversion(EditorVersion.all)
    clickEvents = [];
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$interactable: boolean = true;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$enableAutoGrayEffect: boolean = false;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$transition: number = 3;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    transition: number = 3;
    // 2.4.x
    @ccversion(EditorVersion.v249)
    _N$target: CCIDObject = null;

    // 3.4.x
    @ccversion(EditorVersion.v342)
    _interactable = true;
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _transition = 3;
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _duration = 0.1;
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _zoomScale = 1.2;
    // 3.4.x
    @ccversion(EditorVersion.v342)
    _target: CCIDObject = null;

    updateWithLayer(psdLayer: PsdLayer) {
        
    }
}