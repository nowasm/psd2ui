
# psd ↔ UI 工具集

> **Node.js 版本要求**: >= 18.12.0 或 >= 20.9.0 (推荐 22.x LTS)

本仓库提供 4 个**纯命令行**工具，两两组成 Cocos / Godot 各自的双向转换：

| 引擎 | 正向 (PSD → 资源) | 反向 (资源 → PSD) |
| --- | --- | --- |
| Cocos Creator 3.4+（兼容 2.4.x） | [`psd2prefab/`](./psd2prefab)：`.prefab` + `.png` + `.meta` | [`prefab2psd/`](./prefab2psd)：图片嵌入 + sidecar JSON 记录挂载信息 |
| Godot 4 | [`psd2tscn/`](./psd2tscn)：`.tscn` + `.png` + `.png.import` | [`tscn2psd/`](./tscn2psd)：图片嵌入 + sidecar JSON 记录节点属性 |

四个工具共用同一套 `@xxx` 图层名约定（见下文），让一份 PSD 可以同时面向 Cocos 与 Godot。

> 历史上本仓库提供过 Cocos Creator 编辑器插件（`ccc-tnt-psd2ui-v3.4.+` / `ccc-tnt-psd2ui-v2.4.x`），现已移除，统一改为命令行调用 `psd2prefab/` 这条路径。Cocos 2.4.x 的 prefab 输出仍可用 `psd2prefab --engine-version v249` 生成。

### 一次性安装（npm workspaces）

仓库根目录是一个 npm workspace，4 个工具共用同一份 `node_modules/`，**只需安装一次**：

```bash
cd <repo-root>
npm install        # 一次装好 4 个工具的依赖
npm run build      # 编译 psd2prefab 的 TypeScript（其余 3 个无需 build）
```

之后想跑哪个工具，直接 `node <工具>/<工具>.js ...` 或在工具目录里跑 `command.bat` / `command.sh` 都可以 —— Node 会自动从根 `node_modules/` 解析依赖。

`canvas` 是 native 模块，依赖系统 C++ 工具链：
- Mac：Xcode CLT（如出现 `Bad CPU type in executable canvas` 报错，重装 canvas：`npm uninstall canvas && npm i canvas@^3.2.1`）
- Windows：Visual Studio Build Tools（C++ workload）
- Linux：`build-essential` + cairo / pango / libjpeg / giflib / librsvg dev headers

具体用法 / 参数 / 输出结构请进各自子目录的 README。

下面的图层名约定（`@xxx`）四个工具共用 —— 这是从 PSD 端约定一套节点元数据，让 PSD 与 Cocos / Godot 都能解释。Cocos 路径覆盖全部约定；Godot 路径目前覆盖 `@Btn` / `@Toggle` / `@ProgressBar` / `@.9` / `@ar` / `@full` / `@flip` / `@flipX` / `@flipY` / `@ignore*`，少数标签（如 `@img{bind:N}` 的高级绑定）仅在 Cocos 路径完全实现，详见各子工具 README。

### 属性

<a href="#Btn"> @Btn | @btn 按钮</a>

<a href="#ProgressBar"> @ProgressBar | @progressBar 进度条</a>

<a href="#Toggle"> @Toggle | @toggle 选项按钮</a>

<a href="#png9"> @.9 九宫格</a>

<a href="#ar"> @ar 锚点</a>

<a href="#full"> @full 全屏</a>

<a href="#ignore"> @ignore | @ig 忽略导出图片和节点</a>

<a href="#ignorenode"> @ignorenode | @ignode 忽略导出节点</a>

<a href="#ignoreimg"> @ignoreimg | @igimg 忽略图片</a>

<a href="#img"> @img 图片选项</a>

<a href="#flip"> @flip 翻转图像</a>

<a href="#flipX"> @flipX 翻转图像 (flip 变种)</a>

<a href="#flipY"> @flipY 翻转图像 (flip 变种)</a>

### 移除
~~<a href="#size"> @size 尺寸</a>~~

~~<a href="#scale"> @scale 缩放</a>~~



### 组件

<a id="Btn"></a>
```
@Btn || @btn

作用图层: 所有图层
```

<a id="ProgressBar"></a>
```
@ProgressBar || @progressBar
作用图层: 组图层

@bar 

bar 为 ProgressBar 的属性，类型为 Sprite
作用图层: 图像图层
```

<a id="Toggle"></a>
```
@Toggle || @toggle
作用图层: 组图层

@check

check 为 Toggle 的属性，类型为 Sprite
作用图层: 图像图层


```

### Field


<a id="png9"></a>
```
@.9{l:0,r:0,b:0,t:0}  

九宫格
作用图层: 图像图层

参数：
    l = left
    r = right
    b = bottom
    t = top
    ps: 
        l r 只填写其中一项，则为对称
        b t 同上
        不填写则默认为 0
```

<a id="ar"></a>
```
@ar{x:0,y:0}

锚点
作用图层: 所有图层

参数：
    参数都为可选
    不填写则默认为 0.5

```



<a id="full"></a>
```
@full

节点设置为全屏尺寸
作用图层: 组图层

```

<a id="ignore"></a>
```
@ignore
@ig

忽略导出图像和节点
作用图层: 所有图层
```

<a id="ignorenode"></a>
```
@ignorenode
@ignode

忽略导出节点
作用图层: 所有图层
```

<a id="ignoreimg"></a>
```
@ignoreimg
@igimg

忽略导出图像
作用图层: 图像图层
```

<a id="img"></a>
```
@img{name:string,id:number,bind:number}

定制图片
作用图层：图像图层

参数：
    id: number 可选 当前文档中图片唯一 id
    name: string 可选 导出的图片名
    bind: number 可选 绑定 图像 id
```

<a id="flip"></a>
```
@flip{bind: 0, x: 0, y: 0}

镜像图像
作用图层：图像图层

参数：
    bind: number 必选 被绑定的图片 需要用  @img{id:number} 做标记
    x: 0 | 1, 可选， 1 为 进行 x 方向镜像
    y: 0 | 1, 可选， 1 为 进行 y 方向镜像
    x,y 都缺省时，默认 x 方向镜像

注意：
    @flip 的图层不会导出图像
```

<a id="flipX"></a>
```
@flipX{bind: 0}

flip 的变种 x 方向镜像图像
作用图层：图像图层

参数：
    bind: number 必选 被绑定的图片 需要用  @img{id:number} 做标记
 
注意：
    @flipX 的图层不会导出图像
```

<a id="flipY"></a>
```
@flipY{bind: 0}

flip 的变种 y 方向镜像图像vv
作用图层：图像图层

参数：
    bind: number 必选 被绑定的图片 需要用  @img{id:number} 做标记
 
注意：
    @flipY 的图层不会导出图像
```

---
---
---
### 移除
<a id="size"></a>
```
@size{w:100,h:100}

节点尺寸 非图片尺寸
作用图层: 所有图层

参数：
    w?: 宽
    h?: 高
    只对填写的参数生效，未填写的则为计算到的值
    无参数不生效
    
```

<a id="scale"></a>
```
@scale{x:1,y:1}

节点缩放
作用图层: 所有图层

参数：
    x?: x 方向
    y?: y 方向
    只对填写的参数生效，未填写的则为 1 
    
```
---
---
---

### 说明
    多个字段可作用在同一个图层上，按需使用
    为做到所见所得，移除手动设置 @size 和 @scale，修改为自动计算，使用方式为 `@img{bind:目标id}` `@flipX{bind:目标id}` `@flipY{bind:目标id}`



#### 例如
```
节点名@Btn@size{w:100,h:100}

节点名@ar{x:1,y:1}@full@img{name:bg}
```


## 注意事项
### 美术
- 智能图层  支持 
- 蒙版，形状这些图层需要栅格化，或转为智能图层使用  
- 图层样式
  - 颜色叠加： 文本图层支持，图像图层不支持
  - 描边： 文本图层支持
  - 其他图层样式不支持

工具会把 画布外的图像也导出成图片，需要美术将 画布外 不需要导出的图像处理掉



### 程序配置
如果想对指定组件进行统一定制，准备一份 `psd.config.json` 并在调用 `psd2prefab` 时通过 `--config <路径>` 传入。
key 为组件名，val 为 预制体参数，你可以对任意组件的任意属性进行定制

例如当你想在导出时默认使用指定字体：
```
cc2.4.x 可以配置为
{
    "cc.Label": {
        "_N$file":{
            "__uuid__": "7ecfa26a-27ec-4e2c-9815-d7c4c744d53f"
        },
        "_isSystemFontUsed": false
    }
}

cc3.7.x 可以配置为
"cc.Label": {
    "_font": {
        "__uuid__": "7ecfa26a-27ec-4e2c-9815-d7c4c744d53f",
        "__expectedType__": "cc.TTFFont"
        },
    "_isSystemFontUsed": false
}
// 以上这些配置会覆盖正常的属性数据，没有其他属性不受影响。


// 特殊配置
"textOffsetY":{
    "default": 0,
    "36": 0
},
"textLineHeightOffset": 0

// textOffsetY:  Label节点 Y 偏移，当你使用了定制的字体的时候，可能在 PS 中与 CocosCreator 中表现不一致，可以使用这个参数进行处理，字号为 key，偏移量为值

// textLineHeightOffset: Label节点行高增量，默认没有增量，行高默认为字体大小，当你想将行高统一高n个像素的时候可以使用这个配置

以字号为 key ，偏移值 为 val
如果没有配置 某些字号，则 使用 default 默认偏移值，如果没有配置 default， 偏移为 0

```

## 已知bug
传 `--force-img` 时，如果同一次调用里多张 PSD（或目录里多个 PSD）含有相同 md5 的图层，会在各自输出目录下生成相同 uuid 的图片，需要手动取舍。


<font size=5 ><b> 
不要跟我说在 PS 里调整图层！！<br>
批量重命名！！<br>
强制导出！！<br>
一把梭哈！！<br>
我只要位置信息！！！<br>
</br></font>
