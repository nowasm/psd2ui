export class Vec3{
    declare x: number;
    declare y: number;
    declare z: number;
    constructor(x: number = 0,y: number = 0,z: number = 0) {
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
    }
}