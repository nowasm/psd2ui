import { cctype } from "../../../_decorator";
import { CCVec3 } from "./CCVec3";

@cctype("TypedArray")
export class CCTypedArray{

    __type__: string = "TypedArray";
    ctor: string = "Float64Array";
    array: number [] = [];

    setPosition(x: number,y: number,z: number){
        this.array[0] = x;
        this.array[1] = y;
        this.array[2] = z;
    }

    setRotation(x: number,y: number,z: number,w: number){
        this.array[3] = x;
        this.array[4] = y;
        this.array[5] = z;
        this.array[6] = w;
    }
    setScale(x: number,y: number,z: number){
        this.array[7] = x;
        this.array[8] = y;
        this.array[9] = z;
    }
}