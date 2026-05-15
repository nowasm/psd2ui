export class Size{
    declare width: number;
    declare height: number;
    constructor(width: number = 0,height: number = 0) {
        this.width = width || 0;
        this.height = height || 0;
    }
}