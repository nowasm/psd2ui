
import { config } from "../config";
import { Color } from "../values/Color";
import { Vec2 } from "../values/Vec2";
import { PsdGroup } from "./PsdGroup";
import { PsdLayer } from "./PsdLayer";

export class PsdText extends PsdLayer {
    declare parent: PsdGroup;
    declare text: string;
    declare fontSize: number;
    declare font: string;
    declare outline: { width: number, color: Color }; // 描边
    declare offsetY: number;


    parseSource(): boolean {
        super.parseSource();
        let textSource = this.source.text;
        let style = textSource.style;
        if (style) {
            let fillColor = style.fillColor;
            if (fillColor) {
                this.color = new Color(fillColor.r, fillColor.g, fillColor.b, fillColor.a * 255);
            }
        }
        this.text = textSource.text;

        // 可能会对文本图层进行缩放，这里计算缩放之后的时机字体大小
        if (Math.abs(1 - textSource.transform[0]) > 0.001) {
            this.fontSize = Math.round(style.fontSize * textSource.transform[0] * 100) / 100;
        } else {
            this.fontSize = style.fontSize;
        }


        this.offsetY = config.textOffsetY[this.fontSize] || config.textOffsetY["default"] || 0;

        this.parseSolidFill();
        this.parseStroke();
        return true;
    }
    onCtor() {

    }

    /** 描边 */
    parseStroke() {
        if (this.source.effects?.stroke) {
            let stroke = this.source.effects?.stroke[0];
            // 外描边
            if (stroke?.enabled && stroke?.position === "outside") {
                let color = stroke.color;
                this.outline = {
                    width: stroke.size.value,
                    color: new Color(color.r, color.g, color.b, stroke.opacity * 255)
                }
            }
        }
    }
    /** 解析 颜色叠加 */
    parseSolidFill() {
        if (this.source.effects?.solidFill) {
            let solidFills = this.source.effects?.solidFill;
            for (let i = 0; i < solidFills.length; i++) {
                const solidFill = solidFills[i];
                if (solidFill.enabled) {
                    let color = solidFill.color;
                    this.color = new Color(color.r, color.g, color.b, solidFill.opacity * 255);
                }
            }
        }
    }
}