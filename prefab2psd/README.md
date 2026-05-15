# prefab2psd

Cocos Creator **3.4+** prefab 反向导出 PSD 工具。

把已有的 `.prefab` 转回美术可编辑的 `.psd`，并在同级生成一份 sidecar JSON，
完整记录节点上的引擎组件、自定义脚本、资源 uuid 等挂载信息，
方便后续把 PSD 再导回 prefab 时尽量恢复原貌。

> 与 [`psd2prefab`](../psd2prefab) 是反向兄弟工具，独立 Node CLI，纯命令行使用。

---

## 安装

仓库根目录是 npm workspace，**只在根跑一次** `npm install` 即可（4 个工具共用根 `node_modules/`）。详情见根 `README.md` 的"一次性安装"章节。

---

## 输出物

对每个 `MyUI.prefab`，在 `--output`（缺省与 prefab 同级）下生成：

| 文件 | 说明 |
| --- | --- |
| `MyUI.psd` | 反向导出的 PSD，节点结构 = 图层结构 |
| `MyUI.psd.psd2ui.json` | sidecar，记录全部节点 / 组件 / 资源引用 |

如果传了 `--cache <psd-to-prefab-cache.json>`，
工具会把 `md5(嵌入图片) → spriteFrameUuid` 写进该缓存，
下次再用 `psd2prefab` 把这张 PSD 导回 prefab 时
就会命中缓存、跳过同图重复导出。

---

## 用法

```bash
# 单个 prefab
node prefab2psd.js \
  --input ./assets/ui/MyUI.prefab \
  --project-assets ./assets

# 整个目录（递归处理所有 .prefab）
node prefab2psd.js \
  --input ./assets/ui \
  --project-assets ./assets \
  --output ./out \
  --cache ./local/psd-to-prefab-cache.json
```

参数：

| 参数 | 必选 | 说明 |
| --- | --- | --- |
| `--input` | ✓ | `.prefab` 文件，或包含 `.prefab` 的目录（递归） |
| `--project-assets` | ✓ | Cocos 项目的 `assets` 目录，用于把 uuid 反查回资源路径 |
| `--output` |  | PSD 输出目录，缺省时与 prefab 同级 |
| `--cache` |  | `local/psd-to-prefab-cache.json` 路径，写入 md5 → uuid 让回导跳过同图 |

Windows 双击 `command.bat`、Mac/Linux 执行 `command.sh` 也能调起。

---

## 图层名编码

复用 `psd2prefab` 已有的 `@xxx` 约定，让生成的 PSD 用 `psd2prefab` 原本的 PSD→prefab
路径就能基本还原：

| Cocos 节点 / 组件 | PSD 图层 |
| --- | --- |
| `cc.Node`（带子节点） | 组图层 |
| `cc.Sprite` 叶子 | raster 图层（嵌入原 PNG 像素） |
| `cc.Sprite` (sliced, 9宫格) | `@.9{l:N,r:N,t:N,b:N}` |
| 锚点 ≠ (0.5, 0.5) | `@ar{x:N,y:N}` |
| `cc.Button` | `@Btn` |
| `cc.Toggle` | `@Toggle`，子节点中 `checkMark` 指向的图层会带 `@check` |
| `cc.ProgressBar` | `@ProgressBar`，子节点中 `barSprite` 指向的图层会带 `@bar` |

`cc.Label`、`cc.Layout`、`cc.Widget`、`cc.Mask`、`cc.ScrollView`、自定义 `cc.Component`、
事件回调、Prefab 嵌套等 importer 字典里没有的内容 **都不会丢失**，
全部完整记录在 sidecar 里。后续如果在 importer 中接入 sidecar 消费，就能一次性还原。

---

## Sidecar 格式

```jsonc
{
  "_meta": {
    "formatVersion": 1,
    "tool": "prefab2psd",
    "toolVersion": "0.1.0",
    "engineVersion": "v342",
    "prefabName": "MyUI",
    "prefabUuid": "xxxx-xxxx-...",
    "exportedAt": "2026-05-03T..."
  },
  "rootSize": { "width": 750, "height": 1334 },
  "nodes": {
    "MyUI/MainPanel/OkBtn": {
      "name": "OkBtn",
      "active": true,
      "position": { "x": 0, "y": 0, "z": 0 },
      "rotation": null,
      "scale": { "x": 1, "y": 1, "z": 1 },
      "anchorPoint": { "x": 0.5, "y": 0.5 },
      "contentSize": { "width": 200, "height": 80 },
      "psdRect": { "left": 275, "top": 627, "right": 475, "bottom": 707 },
      "components": [
        {
          "__type__": "cc.Sprite",
          "raw": { /* 原始组件 JSON */ },
          "assetRefs": [{ "keyPath": ["_spriteFrame"], "uuid": "...@f9941", "expectedType": "cc.SpriteFrame", "assetPath": "assets/.../btn.png" }],
          "nodeRefs": [],
          "embeddedImage": {
            "sourcePath": "assets/.../btn.png",
            "sourceUuid": "...",
            "spriteFrameUuid": "...@f9941",
            "renderedMd5": "..."
          }
        },
        {
          "__type__": "MyCustomScript",
          "raw": { /* 全部字段 */ },
          "assetRefs": [/* 引用的资源 */],
          "nodeRefs": [/* 引用的兄弟 / 子节点 */]
        }
      ]
    }
  }
}
```

---

## v0.1 已知限制

- 旋转 / 父链上的非 1 缩放在 PSD 图层位置上 **没有反应**，仅记录到 sidecar。
- `cc.Label` 在 PSD 中只放一个透明占位层，文本内容、字体、颜色等在 sidecar 里。
- 嵌套 prefab 实例（PrefabInstance）按当前已展开的状态导出，恢复时需要 sidecar 配合。
- sidecar 还没有被 importer 消费 —— 自定义组件 / 事件回调 / 资源引用的恢复需要后续在
  `psd2prefab` 中接入读取逻辑。
