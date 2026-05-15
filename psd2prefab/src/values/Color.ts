export class Color{
    declare r: number; 
    declare g: number; 
    declare b: number; 
    declare a: number; 
    constructor(r: number,g: number,b: number,a: number){
        this.r = Math.ceil(r || 0);
        this.g = Math.ceil(g || 0);
        this.b = Math.ceil(b || 0);
        this.a = Math.ceil(a || 0);
    }

    set(color: Color){
        this.r = Math.ceil(color.r || 0);
        this.g = Math.ceil(color.g || 0);
        this.b = Math.ceil(color.b || 0);
        this.a = Math.ceil(color.a || 0);
    }

    
    public toHEX (fmt: '#rgb' | '#rrggbb' | '#rrggbbaa' = '#rrggbb') {
        const prefix = '0';
        // #rrggbb
        const hex = [
            (this.r < 16 ? prefix : '') + (this.r).toString(16),
            (this.g < 16 ? prefix : '') + (this.g).toString(16),
            (this.b < 16 ? prefix : '') + (this.b).toString(16),
        ];
        const i = -1;
        if (fmt === '#rgb') {
            hex[0] = hex[0][0];
            hex[1] = hex[1][0];
            hex[2] = hex[2][0];
        } else if (fmt === '#rrggbbaa') {
            hex.push((this.a < 16 ? prefix : '') + (this.a).toString(16));
        }
        return hex.join('');
    }

}