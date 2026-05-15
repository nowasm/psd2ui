import { Rect } from "../values/Rect";
import { PsdLayer } from "./PsdLayer";

export class PsdGroup extends PsdLayer {
    declare children: PsdLayer[];
    declare parent: PsdGroup;


    constructor(source: any, parent: PsdLayer, rootDoc: PsdLayer) {
        super(source, parent, rootDoc);
        this.children = [];
        if (rootDoc) {
            this.rect = new Rect(0, rootDoc.size.width, 0, rootDoc.size.height);
        }
    }
    parseSource(): boolean {
        super.parseSource();

        if(!this.attr?.comps.full){
            this.resize();
            this.computeBasePosition();
        }
        return true;
    }

    resize() {
        if(!this.children.length){
            return;
        }
        let left = Number.MAX_SAFE_INTEGER;
        let right = Number.MIN_SAFE_INTEGER;
        let top = Number.MAX_SAFE_INTEGER;
        let bottom = Number.MIN_SAFE_INTEGER;

        for (let i = 0; i < this.children.length; i++) {
            const element = this.children[i];
            let _rect = element.rect;
            left = Math.min(_rect.left, left);
            right = Math.max(_rect.right, right);
            top = Math.min(_rect.top, top);
            bottom = Math.max(_rect.bottom, bottom);
        }
        this.rect.left = left;
        this.rect.right = right;
        this.rect.top = top;
        this.rect.bottom = bottom;
    }

    onCtor() {

    }
}