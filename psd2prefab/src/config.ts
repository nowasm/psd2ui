import { EditorVersion } from "./EditorVersion";
import { CCButton } from "./engine/cc/CCButton";
import { CCComponent } from "./engine/cc/CCComponent";
import { CCProgressBar } from "./engine/cc/CCProgressBar";
import { CCToggle } from "./engine/cc/CCToggle";

export class Config {


    readonly help = `
--help           |   帮助信息                   
--init           |   初始化缓存文件              必须设置 --project-assets --cache 两项
--force-img      |   强制导出图片                即使在有缓存的情况下也要导出
--input          |   输入目录或者 psd 文件       非 init 时 必选 [dir or psd] 
--output         |   输出目录                   可选 缺省时为 --input [dir] 
--engine-version |   引擎版本                   可选           [v249 | v342] 
--project-assets |   指定项目文件夹              可选            [dir] 
--cache-remake   |   重新创建缓存文件            可选
--cache          |   缓存文件全路径              可选            [file-full-path] 
--config         |   预制体配置                  可选            [file-full-path] 
--pinyin         |   中文转拼音                  可选
--img-only       |   只导出图片                  可选           
--json           |   json 对象参数               插件工具使用 将所有参数用对象的形式编码成 base64 字符串     
`

    editorVersion: EditorVersion = EditorVersion.v249;

    DEFAULT_SPRITE_FRAME_MATERIAL = {
        [EditorVersion.v249]: "eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432",
        [EditorVersion.v342]: "",
    }

    DEFAULT_LABEL_MATERIAL = {
        [EditorVersion.v249]: "eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432",
        [EditorVersion.v342]: "",
    }
    get SpriteFrame_Material() {
        return this.DEFAULT_SPRITE_FRAME_MATERIAL[config.editorVersion];
    }
    get Label_Material() {
        return this.DEFAULT_LABEL_MATERIAL[config.editorVersion];
    }

    CompMappings: Record<string, typeof CCComponent> = {
        "Btn": CCButton,
        "ProgressBar": CCProgressBar,
        "Toggle": CCToggle,
    }

    // text 文本 Y 偏移
    textOffsetY = {
        default: 0,
        "36": 0,
    }

    // text 文本 行高偏移，默认为 0 ，行高默认为 字体大小
    textLineHeightOffset = 0;
}

export const config = new Config();