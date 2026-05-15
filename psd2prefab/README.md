# psd2prefab

Photoshop `.psd` → Cocos Creator **3.4+**（向下兼容 2.4.x）`.prefab` + `.png` + `.png.meta` 的独立 Node CLI。

> 本工具是 [`ccc-tnt-psd2ui`](https://gitee.com/onvia/ccc-tnt-psd2ui) Cocos 编辑器插件的命令行版本——剥离了所有编辑器壳，只留下 PSD 解析与 prefab 生成的核心引擎。和 `prefab2psd / psd2tscn / tscn2psd` 同一目录组下，统一通过命令行使用。

---

## 安装

**前提**：Node.js 18+（推荐 22 LTS）。

仓库根目录已经把 4 个工具配成 npm workspace，**只在根跑一次** `npm install`：

```bash
cd <repo-root>
npm install
npm run build   # 编译本工具的 TypeScript → psd2prefab/dist/（其它 3 个工具无需 build）
```

`canvas` 是 native 模块，需要本机 C++ 工具链：
- macOS：Xcode CLT
- Windows：Visual Studio Build Tools（C++ workload）
- Linux：`build-essential` + `libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`

---

## 用法

```bash
# 单个 psd
node dist/index.js \
  --input ./MyUI.psd \
  --project-assets <cocos-project>/assets \
  --cache <cocos-project>/local/psd-to-prefab-cache.json \
  --engine-version v342 \
  --pinyin

# 整个目录（递归）
node dist/index.js \
  --input ./psd-src \
  --output <cocos-project>/assets/ui \
  --project-assets <cocos-project>/assets \
  --cache <cocos-project>/local/psd-to-prefab-cache.json \
  --engine-version v342 \
  --pinyin
```

Windows 双击 `command.bat`、Mac/Linux 执行 `command.sh` 也能调起（仍要传以上参数）。

### 参数

| 参数 | 必选 | 说明 |
| --- | --- | --- |
| `--input` | ✓ | `.psd` 文件，或包含 `.psd` 的目录（递归） |
| `--project-assets` | ✓ | Cocos 项目的 `assets` 目录；缺省输出位置也用它 |
| `--cache` |  | `local/psd-to-prefab-cache.json`：md5 → spriteFrameUuid 缓存，复用已有图片 |
| `--engine-version` |  | `v342`（Cocos 3.4+，默认）或 `v249`（Cocos 2.4.x） |
| `--output` |  | PSD 输出目录，缺省时与 PSD 同级 |
| `--pinyin` |  | **强烈推荐**。把图层名里的中文转拼音，避免节点名 / 资源路径里出现中文 |
| `--force-img` |  | 即使缓存命中也强制导出图片 |
| `--img-only` |  | 只切图，不生成 `.prefab` |
| `--config` |  | `psd.config.json` 路径（默认字体、文本 Y 偏移等微调） |
| `--init` |  | 仅扫描 `--project-assets` 把现有 PNG 写进缓存，不实际转 PSD |
| `--cache-remake` |  | 强制重建缓存 |
| `--json` |  | 把所有参数编成 base64 JSON 一次传入（脚本调用方便） |

---

## 输出结构

对于一个 `MyUI.psd`，输出（`--output` 缺省时落在 PSD 同级）：

```
MyUI/
  MyUI.prefab          ← Cocos prefab JSON
  MyUI.prefab.meta     ← Cocos meta（带稳定 uuid）
  textures/
    <md5>.png          ← 图片文件名 = 像素 md5
    <md5>.png.meta
    ...
```

`<md5>.png` 这种命名让相同像素的图层在不同 PSD 之间天然去重；md5 也是 `--cache` 的 key。

---

## 图层名约定

工具按图层名里的 `@xxx` 标签识别 Cocos 组件。常用：

| 标签 | 作用 | 适用图层 |
| --- | --- | --- |
| `@Btn` / `@btn` | `cc.Button` | 任意 |
| `@Toggle` / `@toggle`（组）+ 子 `@check`（图像） | `cc.Toggle` + 选中标记 | 组 + 图像 |
| `@ProgressBar`（组）+ 子 `@bar`（图像） | `cc.ProgressBar` + bar | 组 + 图像 |
| `@.9{l:N,r:N,t:N,b:N}` | 9 宫格 sprite | 图像 |
| `@ar{x:N,y:N}` | 锚点（默认 0.5/0.5） | 任意 |
| `@full` | Widget 全屏 | 组 |
| `@img{name,id,bind}` | 图片选项与跨图层绑定 | 图像 |
| `@flip` / `@flipX` / `@flipY` | 镜像 | 图像 |
| `@ignore` / `@ignorenode` / `@ignoreimg` | 跳过节点/图片 | 任意 |

多个标签可以叠在同一图层名上：`OkBtn@Btn@.9{l:8,r:8,t:8,b:8}`。

---

## 缓存机制

`local/psd-to-prefab-cache.json` 以 PNG md5 为 key：

```json
{
  "<md5>": { "path": "...", "textureUuid": "...", "uuid": "...", "isOutput": true }
}
```

每次跑工具会重新计算每张图层的 md5；命中已有 key 就跳过该 PNG 的写入，沿用旧 spriteFrameUuid。这也是 `prefab2psd` 反向工具能做到 "PSD → prefab → PSD → prefab 不重新切图" 的根基（`prefab2psd` 会在生成 PSD 时把预测 md5 写进同一个 cache）。

第一次在新项目上用时建议先 `--init` 扫一遍现有资源把 cache 填好。

---

## 推荐工作流

```bash
# 第一次：把项目里已有 PNG 的 md5 缓存起来
node dist/index.js --init \
  --project-assets <cocos-project>/assets \
  --cache <cocos-project>/local/psd-to-prefab-cache.json

# 之后每次：实际转换
node dist/index.js \
  --input ./your.psd \
  --project-assets <cocos-project>/assets \
  --cache <cocos-project>/local/psd-to-prefab-cache.json \
  --engine-version v342 \
  --pinyin
```

---

## 配置文件示例（可选）

`psd.config.json`：

```jsonc
{
    // 不同字号的 Y 方向像素补偿（Cocos Label 与 PS 渲染差异）
    "textOffsetY": { "default": 0, "36": -1 },
    "textLineHeightOffset": 0
}
```

---

## 调试 / 开发

```bash
npm run watch        # tsc 监听编译
npm run help         # 查看 CLI 帮助
ts-node src/index.ts ...   # 直接跑 TS 源码（需要 ts-node）
```

源码在 `src/`；产物在 `dist/`（已纳入仓库，普通用户不需要手动 build）。`assets/cc/meta/` 下是 Cocos `.meta` 文件模板（spriteFrame / prefab，分 v249 与 v342 两套），请勿删。
