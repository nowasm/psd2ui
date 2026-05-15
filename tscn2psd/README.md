# tscn2psd

Godot **4** `.tscn` 反向导出 PSD 工具。

把 Godot 项目里已有的 UI 场景转回美术可编辑的 `.psd`，并在同级生成
sidecar JSON 完整记录节点类型、属性、ext_resource / sub_resource 引用，
方便后续把 PSD 再次导回 `.tscn` 时尽量恢复。

> 与 [`psd2tscn`](../psd2tscn) 镜像，独立 Node CLI，无 Godot
> 编辑器依赖；图层名约定也沿用同一套（`@Btn` / `@.9` / `@flipX` 等）。

---

## 安装

仓库根目录是 npm workspace，**只在根跑一次** `npm install` 即可（4 个工具共用根 `node_modules/`）。详情见根 `README.md` 的"一次性安装"章节。

---

## 输出物

对每个 `MyUI.tscn`，在 `--output`（缺省与 tscn 同级）下生成：

| 文件 | 说明 |
| --- | --- |
| `MyUI.psd` | 反向导出的 PSD，节点结构 = 图层结构 |
| `MyUI.psd.tscn2psd.json` | sidecar，记录全部节点 / 属性 / 资源引用 |

---

## 用法

```bash
# 单个 tscn
node tscn2psd.js \
  --input ./ui/MyUI.tscn \
  --godot-project .

# 整个目录（递归处理所有 .tscn）
node tscn2psd.js \
  --input ./ui \
  --godot-project . \
  --output ./out \
  --canvas-size 1280x720
```

参数：

| 参数 | 必选 | 说明 |
| --- | --- | --- |
| `--input` `-in` | ✓ | `.tscn` 文件，或包含 `.tscn` 的目录（递归） |
| `--godot-project` `-gp` | ✓ | Godot 项目根目录（含 `project.godot`），用于解析 `res://` 路径与 uid |
| `--output` `-out` |  | PSD 输出目录，缺省时与 tscn 同级 |
| `--canvas-size` |  | 根画布尺寸 `WxH`（如 `1920x1080`）。缺省按根 Control 的 `offset_right/bottom` 推算 |

Windows 双击 `command.bat`、Mac/Linux 执行 `command.sh` 也能调起。

---

## Godot 节点类型 → PSD 图层

`tscn2psd` 是 `psd2tscn` 的反向映射，约定保持一致：

| Godot 节点 | PSD 图层 |
| --- | --- |
| `Control` / 容器（带子节点） | 组图层 |
| `TextureRect` | raster 图层（嵌入 `texture` 引用的原 PNG 像素） |
| `TextureRect.flip_h = true` | `@flipX` |
| `TextureRect.flip_v = true` | `@flipY` |
| `NinePatchRect` | raster 图层 + `@.9{l:N,r:N,t:N,b:N}`（取自 `patch_margin_*`） |
| `TextureButton` | raster 图层 + `@Btn`（嵌入 `texture_normal`） |
| `TextureProgressBar` | 组图层 + `@ProgressBar`，内部展开 `texture_under` 为底层 bg、`texture_progress` 为 `@bar` 子图层 |
| `CheckBox` / `CheckButton` | `@Toggle`（@check 子图层暂不自动合成，依赖 sidecar 还原） |
| `Label` | 文本 raster 图层（按 fontSize / 颜色 / 描边 / 阴影 / 对齐渲染） |

不在表里的字段 / 自定义脚本 / signals / theme overrides 等 **完整记录到 sidecar**。

---

## 坐标 / 缩放

- Godot 已经是 Y 向下 + 左上角原点，不需要翻转。
- 节点用 `anchors_preset` + `offset_*` 描述时，按 Godot 公式
  `pos = parentSize * anchor + offset` 算出 rect。
- 节点也能写显式 `position` + `size` Vector2，优先用之。
- 节点 `scale = Vector2(x,y)` 会沿父链累乘，影响 PSD rect 的尺寸与子节点的位置偏移。

> 当前不做 `rotation` 的几何变换；旋转角度仅落到 sidecar，PSD 图层仍按
> 未旋转矩形写入（与 `prefab2psd` 一致）。

---

## Sidecar 格式

```jsonc
{
  "_meta": {
    "formatVersion": 1,
    "tool": "tscn2psd",
    "toolVersion": "0.1.0",
    "engine": "godot4",
    "tscnName": "MyUI",
    "sceneUid": "uid://...",
    "exportedAt": "..."
  },
  "rootSize": { "x": 750, "y": 1334 },
  "extResources": [
    { "id": "1_btn", "type": "Texture2D", "uid": "uid://...", "path": "res://ui/btn.png" }
  ],
  "subResources": [
    { "id": "StyleBoxFlat_xyz", "type": "StyleBoxFlat", "props": { ... } }
  ],
  "nodes": {
    "MyUI/OkBtn": {
      "name": "OkBtn",
      "type": "TextureButton",
      "parentPath": ".",
      "size": { "x": 200, "y": 80 },
      "scaledSize": { "x": 200, "y": 80 },
      "worldScale": { "x": 1, "y": 1 },
      "psdRect": { "left": 275, "top": 927, "right": 475, "bottom": 1007 },
      "attrs": { "name": "OkBtn", "type": "TextureButton", "parent": "." },
      "props": { /* 原始 key=value 字符串 */ },
      "extResRefs": [{ "key": "texture_normal", "extId": "1_btn" }],
      "subResRefs": [],
      "embeddedTexture": {
        "sourceExtId": "1_btn",
        "sourcePath": "/abs/.../btn.png",
        "sourceResPath": "res://ui/btn.png",
        "sourceUid": "uid://..."
      }
    }
  }
}
```

---

## v0.1 已知限制

- `rotation` / 复杂 anchors_preset（除 `0` 与 `15`）不会改变 PSD 图层位置，仅记录到 sidecar。
- `theme` / `theme_override_styles/*`（StyleBoxTexture / StyleBoxFlat 等）没有渲染到 PSD，需在 sidecar 里查阅。
- `Container` 子类（`HBoxContainer` / `VBoxContainer` / `GridContainer` / `MarginContainer` 等）按 Godot 实际计算的子节点位置不会跑一遍布局算法，
  只读节点上写出来的 `offset_*`；如果场景从来没在 Godot 里打开保存过，
  这些容器子节点的位置会落到默认 `(0, 0)`。
- 多行文本暂不做 `horizontal_alignment = FILL` 的换行；按 `\n` 分行。
- sidecar 还没有被 `psd2tscn` 消费 —— 自定义脚本 / signals / 完整 theme 的还原依赖后续在 `psd2tscn` 中接入读取逻辑。
