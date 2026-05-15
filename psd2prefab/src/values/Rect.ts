export class Rect{
    declare left: number;
    declare right: number;
    declare top: number;
    declare bottom: number;
    constructor(left: number | Rect = 0,right = 0,top = 0,bottom = 0) {
        if(typeof left == 'object'){
            this.set(left);
            return;
        }
        this.left = left || 0;
        this.right = right || 0;
        this.top = top || 0;
        this.bottom = bottom || 0;
    }

    set(rect: Rect){
        this.left = rect.left;
        this.right = rect.right;
        this.top = rect.top;
        this.bottom = rect.bottom;
    }
}