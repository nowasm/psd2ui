# psd2tscn — PSD → Godot 4 .tscn (CLI)

把 Photoshop `.psd` 转成 Godot 4 的 `.tscn` 场景（Control 节点树）+ `.png` + `.png.import`。**纯命令行工具**，不依赖 CocosCreator，也不在 Godot 编辑器内运行。图层名约定与同仓库的 `psd2prefab` 一致（`@Btn`、`@.9`、`@ar` 等）。

```
psd2tscn/
├── README.md
├── package.json              ← npm 依赖清单
├── psd2tscn.js               ← Node CLI 主程序
├── command.bat / .sh         ← 终端便利启动器
├── assets/
│   └── Texture2D.import.tmpl
└── test/
    └── demo.psd              ← 示例 PSD
```

## 一次性安装

**前提**：Node.js 16+（推荐 22 LTS，与同仓库其他工具一致）。

仓库根目录已经把 4 个工具配成 npm workspace，**只在根跑一次** `npm install`：

```
cd <repo-root>
npm install
```

会把 `ag-psd / canvas / fs-extra / minimist / pinyin-pro` 等装到根 `node_modules/`。`canvas` 是 native 模块，编译要本机有 C++ 工具链：
- macOS：一般 Xcode CLT 自带
- Windows：装 Visual Studio Build Tools（C++ workload）
- Linux：`build-essential` + `libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`

## 用法

### 基本

```
node psd2tscn.js \
  --input path/to/your.psd \
  --output path/to/godot-project/ui \
  --godot-project path/to/godot-project \
  --pinyin
```

转换完成后 Godot 启动时会自动 reimport 新生成的 `.png`（首次运行会补 `.import` 里的 `path` 与 `.ctex` 缓存）。

### 完整参数

```
--help              帮助信息
--input             [必选] PSD 文件 或 含多个 PSD 的目录
--output            输出目录。建议指到 Godot 项目内。留空则在 PSD 同目录建 psd2tscn/
--godot-project     [推荐] Godot 项目根（含 project.godot 的目录）。
                    决定 res:// 路径基准；缺它 source_file 会回退成只用文件名
--godot-font-path   [可选] res:// 字体路径，例如 res://fonts/MyFont.ttf
                    所有 Label 的 theme_override_fonts/font 都会指向它
                    需要 Godot 已经给该 ttf 生成过 .import（含 uid）
--cache             缓存文件全路径（建议放 <godot 项目>/.psd2tscn-cache.json）。
                    跨多次运行复用 uid，避免给同一张图重复生成 uid
--cache-remake      强制重新扫描 --godot-project 下所有 .png.import 重建缓存
--init              只缓存项目里已有的 .png.import，不实际转换 PSD。
                    必须配合 --godot-project 与 --cache 一起用
--force-img         强制导出图片，即使缓存里已有
--pinyin            把图层名里的中文转拼音（推荐打开，避免 res:// 路径里有中文）
--img-only          只切图，不生成 .tscn（兼容 psd2prefab 行为）
--config            psd.config.json 路径，用于配置默认字体等（见下文）

短别名:
--help -h | --input -in | --output -out | --godot-project -gp |
--godot-font-path -gf | --pinyin -py | --cache -c | --init -i |
--force-img -fimg | --cache-remake -crm
```

### 便利启动器

Windows 双击 `command.bat`（在 `cmd.exe` 里直接运行能看到日志），或：
```
command.bat --input D:\path\to\file.psd --output D:\godot-project\ui --godot-project D:\godot-project --pinyin
```

macOS / Linux：
```
./command.sh --input ./your.psd --output /godot-project/ui --godot-project /godot-project --pinyin
```

启动器会自动检查 `node_modules` 是否存在，缺了就提示先 `npm install`。

### 推荐工作流

第一次：
```
# 1. 扫一遍 Godot 项目里已有的图，把 uid 写进缓存（可选但推荐）
node psd2tscn.js --init \
  --godot-project /path/to/godot-project \
  --cache /path/to/godot-project/.psd2tscn-cache.json

# 2. 实际转换
node psd2tscn.js \
  --input ./screen-login.psd \
  --output /path/to/godot-project/ui \
  --godot-project /path/to/godot-project \
  --cache /path/to/godot-project/.psd2tscn-cache.json \
  --pinyin
```

后续每次只跑步骤 2 就行（缓存会一直滚动维护）。

## 属性 / 标签映射

| PSD 标签 | Godot 4 输出 |
|---|---|
| 普通组 | `Control` |
| 普通图像图层 | `TextureRect`（`expand_mode=1`、`stretch_mode=0`）|
| 文本图层 | `Label`（`theme_override_font_sizes/font_size`、`theme_override_colors/font_color`）|
| `@.9{l,r,t,b}` | `NinePatchRect` + `patch_margin_*`（**保留整张原图**，不裁切）|
| `@ar{x,y}` | `pivot_offset = Vector2(size.x*x, size.y*y)`（旋转/缩放中心）|
| `@full` | `anchors_preset=15` + `anchor_right/bottom=1` + `grow_horizontal/vertical=2` |
| `@flipX{bind}` / `@flipY{bind}` | `TextureRect.flip_h / flip_v = true` |
| `@img{bind:N}` | 复用源图的 `ExtResource id` 与 `uid://`（同图共享）|
| 不透明度 < 255 | `modulate = Color(1,1,1, opacity/255)` |
| 文本描边 | `theme_override_constants/outline_size` + `theme_override_colors/font_outline_color` |
| `@Btn` 在图像图层 | `TextureButton`（`texture_normal` + `ignore_texture_size=true` + `stretch_mode=0`）|
| `@Btn` 在组/文本上 | 控制台 warn，不自动映射 |
| `@ProgressBar` + 子 `@bar` | `TextureProgressBar`：`@bar` 子贴图升为 `texture_progress`，BG 升为 `texture_under`，原 `@bar/BG` 子节点从输出中移除 |
| `@Toggle` + 子 `@check` | `CheckBox` 占位（行为与 Cocos Toggle 不完全等价）|
| `@ignore` / `@ig` | 跳过节点和图片 |
| `@ignorenode` / `@ignode` | 跳过节点 |
| `@ignoreimg` / `@igimg` | 跳过图片，节点保留 |

## 默认字体（可选）

PSD 不嵌入字体，所以 Godot 这边必须有真实的 `.ttf/.otf` 资源。设置方式：

**方式 A：命令行参数**
```
--godot-font-path res://fonts/MyFont.ttf
```
插件会从 `<godot-project>/fonts/MyFont.ttf.import` 里读 `uid` 与 `type`，给所有 Label 加 `theme_override_fonts/font`。

**方式 B：psd.config.json**

新建 `psd.config.json`，传给 `--config`：

```json
{
    "godot": {
        "defaultFont": {
            "uid": "uid://abc...",
            "path": "res://fonts/MyFont.ttf",
            "type": "FontFile"
        }
    },
    "textOffsetY": {
        "default": 0,
        "36": -2
    },
    "textLineHeightOffset": 0
}
```

`textOffsetY` 用于补偿 PS 与 Godot 的字号渲染差异（key 是字号，value 是 Y 偏移）。

> **前提**：Godot 已经给该 `.ttf` 生成过 `.import`。第一次添加字体后在 Godot 里打开一次项目即可。

## 已知限制

- **NinePatchRect 不支持 `flip_h/flip_v`**：`@.9 + @flip` 会忽略 flip。
- **`@Btn + @.9`**：`TextureButton` 不支持 9-patch，patch_margin 被剥掉，warn。
- **`@Toggle` 自定义贴图**：不会自动接到 `CheckBox` theme，需手动调整。
- **缓存按 layer name 去重，不按 MD5**：与 `psd2prefab` 实际行为一致（README 描述为 MD5，但实现就是 layer name）。
- **只支持单一默认字体**：所有 Label 用同一字体，PSD 里多种字体会被替换成默认。
- **不支持加粗 / 斜体 PSD 样式 → Godot FontVariation**。

## Troubleshooting

| 现象 | 原因 / 处理 |
|---|---|
| `Cannot find module 'ag-psd'` | 没在仓库根跑过 `npm install`。先 `cd <repo-root> && npm install`，4 个工具共用根 `node_modules/` |
| `canvas` 编译失败 | 缺 C++ 工具链。看上文 "一次性安装" 章节 |
| `输入路径不存在` | `--input` 写错了。Windows 下注意路径分隔符与引号 |
| Godot 提示 "字体导入文件不存在" | `.ttf` 还没被 Godot import；先在 Godot 里打开项目让它扫一遍 |
| 节点位置略有偏差 | 检查 PSD 图层 `@ar`、`@full`，或父级 PsdGroup 的 rect 是否有外溢 |
| 控制台 warn `WenBeAnNiu... 未自动映射` | `@Btn` 放在了组图层上。把 `@Btn` 挪到按钮 BG 的图像图层即可 |

## 来源 / 致谢

本工具是从 `ccc-tnt-psd2ui` (https://gitee.com/onvia/ccc-tnt-psd2ui，本仓库现已重构为 `psd2prefab`) 派生出的 Godot 输出版本。PSD 解析、图层规则、`@xxx` 标签解析全部沿用上游设计；Cocos 部分（CCNode/CCSprite 等）已剥离，不依赖任何 Cocos 代码或运行时。
