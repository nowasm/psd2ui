
import canvas from 'canvas';

export interface Border {
    l?: number;
    r?: number;
    t?: number;
    b?: number;
}

export class Texture9Utils {

    static safeBorder(_canvas: canvas.Canvas, border: Border) {

        border.l = (border.l ?? border.r) || 0;
        border.r = (border.r ?? border.l) || 0;
        border.t = (border.t ?? border.b) || 0;
        border.b = (border.b ?? border.t) || 0;
        return border;
    }
    static split(_canvas: canvas.Canvas, border: Border): canvas.Canvas {
        this.safeBorder(_canvas, border);
        let cw = _canvas.width;
        let ch = _canvas.height;
        let space = 4;
        let left = border.l || cw;
        let right = border.r || cw;
        let top = border.t || ch;
        let bottom = border.b || ch;
        if (border.b == 0 && border.t == 0 && border.l == 0 && border.r == 0) {
            return _canvas;
        }

        if (border.l + border.r > cw + space) {
            console.log(`Texture9Utils-> 设置的九宫格 left， right 数据不合理，请重新设置`);
            return _canvas;
        }
        if (border.b + border.t > ch + space) {
            console.log(`Texture9Utils-> 设置的九宫格 bottom， top 数据不合理，请重新设置`);
            return _canvas;
        }

        let imgW = border.l + border.r == 0 ? cw : Math.min(cw, border.l + border.r + space);
        let imgH = border.b + border.t == 0 ? ch : Math.min(ch, border.b + border.t + space);
        let newCanvas = canvas.createCanvas(imgW, imgH);
        let ctx = newCanvas.getContext("2d");

        // 左上
        ctx.drawImage(_canvas, 0, 0, left + space, top + space, 0, 0, left + space, top + space);

        // 左下
        ctx.drawImage(_canvas, 0, ch - bottom, left + space, bottom, 0, top + space, left + space, bottom);

        // 右上
        ctx.drawImage(_canvas, cw - left, 0, right, top + space, left + space, 0, right, top + space);

        // 右下
        ctx.drawImage(_canvas, cw - left, ch - bottom, right, bottom, left + space, top + space, right, bottom);

        return newCanvas;
    }
}