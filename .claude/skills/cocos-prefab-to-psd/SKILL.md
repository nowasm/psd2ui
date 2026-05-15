---
name: cocos-prefab-to-psd
description: Reverse-export a Cocos Creator 3.4+ .prefab back to a Photoshop .psd using the prefab2psd standalone CLI. Embeds the original PNG pixels into PSD raster layers, encodes built-in components as @xxx layer-name tags, and writes a sidecar JSON with the full mount info. Trigger when the user asks to turn a .prefab back into a PSD, edit a Cocos UI in Photoshop, or do "prefab → psd / 反向导出 / reverse export" of UI.
---

# Cocos Creator 3.4+ prefab → PSD

The `prefab2psd/` directory in this repo is a self-contained Node CLI that walks a `.prefab`'s node tree, embeds source PNG pixel data into PSD layers, and emits:

1. `<name>.psd` — the PSD file
2. `<name>.psd.psd2ui.json` — sidecar with full mount info (every component's serialized props, asset uuids, custom-script data)
3. Updates `<cocos-project>/local/psd-to-prefab-cache.json` with **predicted md5 → spriteFrameUuid** entries so a subsequent psd→prefab import via `psd2prefab` skips re-exporting unchanged images.

It's the reverse companion of `psd-to-cocos-prefab`. Designed to round-trip via the existing importer's md5-keyed cache — no importer changes needed.

## When NOT to use this

- `.tscn` / Godot scene → use `godot-tscn-to-psd`.
- The user wants to edit the prefab in Cocos itself, not in Photoshop → don't bother converting.

## Setup (one-time)

The repo is an npm workspace. Run **one** install at the repo root, all 4 sibling tools share the same `node_modules/`:

```bash
cd <repo-root>
npm install   # installs ag-psd, canvas, fs-extra, minimist, pinyin-pro for all 4 tools
```

Sub-tool dirs do NOT get their own `node_modules/` after this — Node walks up to the root one when running e.g. `node prefab2psd/prefab2psd.js`.

`canvas` is a native module. Windows needs Visual Studio Build Tools (C++ workload), Mac needs Xcode CLT, Linux needs `build-essential` + cairo/pango/libjpeg/giflib/librsvg dev headers. If `npm install` fails on `canvas`, the build env is the issue.

## Invocation

```bash
node prefab2psd/prefab2psd.js \
  --input <prefab path or directory> \
  --project-assets <cocos-project>/assets \
  [--output <psd output dir>] \
  [--cache <cocos-project>/local/psd-to-prefab-cache.json]
```

Or use the wrapper: `prefab2psd/command.bat` (Windows) / `command.sh` (mac/linux).

### Flags

| Flag | Required | Notes |
| --- | --- | --- |
| `--input` | yes | `.prefab` file OR directory containing prefabs (recursive) |
| `--project-assets` | yes | Cocos project's `assets/` dir; needed to resolve `__uuid__` references back to PNG paths |
| `--output` |  | PSD output dir; defaults to the prefab's own directory |
| `--cache` |  | `local/psd-to-prefab-cache.json` path. **Pass this when the user wants the round-trip-skip behavior.** Without it, the PSDs will still re-import correctly but every image will be re-exported. |

The CLI also accepts `--json <base64>` (base64-encoded JSON of all args, convenience for upstream tooling).

## How the round-trip cache works

The Cocos importer keys its skip-export cache by md5 of the PNG bytes it extracts from each PSD layer. After `prefab2psd` writes the PSD, it reads the PSD back via ag-psd, runs the same `canvas.toBuffer('image/png')` the importer will run, computes md5, and writes:

```json
{ "<predicted-md5>": { "path": "...", "textureUuid": "<original SpriteFrame uuid>", "uuid": "...", "isOutput": true } }
```

Into `--cache`. So when the user re-imports the PSD via `psd-to-cocos-prefab`, the md5 lookup hits and the original SpriteFrame uuid is reused — no duplicate texture asset, no broken refs in any prefab/scene that already references that uuid.

## Built-in component → layer-name tag mapping

| Cocos component | PSD layer encoding |
| --- | --- |
| `cc.Sprite` (leaf) | raster layer with PNG embedded |
| `cc.Sprite._type === 1` (SLICED) | `@.9{l:N,r:N,t:N,b:N}` from the spriteframe meta's `border*` |
| `cc.Button` | `@Btn` |
| `cc.Toggle` | `@Toggle` (the node referenced by `checkMark` gets `@check`) |
| `cc.ProgressBar` | `@ProgressBar` (the node referenced by `barSprite` gets `@bar`) |
| anchor != (0.5, 0.5) | `@ar{x:N,y:N}` |
| node has Sprite + children | PSD group; the sprite becomes a `<name>_bg` child layer at the bottom |

Anything **not** in the table — `cc.Layout`, `cc.Widget`, `cc.Mask`, `cc.ScrollView`, custom user scripts, asset references beyond Sprite, animation refs, prefab-instance metadata — is **fully recorded in the sidecar JSON** but doesn't affect the PSD layer structure. Round-trip restoration of those would need future importer-side changes (sidecar consumer is not yet wired up).

## Coordinate / scale handling

- Cocos UI is Y-up + center origin (anchor-dependent); PSD is Y-down + top-left.
- The CLI walks the tree accumulating a `worldScale` (parent's worldScale × node's `_lscale`) and uses it to (a) scale the rect size and (b) scale child position offsets.
- Reads `_lpos`/`_lrot`/`_lscale` first, falling back to `_position`/`_rotation`/`_scale`. **Do NOT assume `_position` exists** on real Cocos 3.x prefabs — they use `_lpos`. (This was the "all images at origin" bug fixed early on.)
- Rotation is recorded in the sidecar but not applied to PSD geometry.

## Label rendering

`cc.Label` and `cc.RichText` get rasterized into the PSD layer's canvas with:
- `_string`, `_fontSize` (× worldScale), `_color`, bold/italic
- horizontal/vertical alignment + multi-line via `\n`
- `_enableOutline` + `_outlineColor` + `_outlineWidth`
- `_enableShadow` + `_shadowColor` + `_shadowOffset` + `_shadowBlur`
- Custom TTF (`_font` uuid) auto-registered via node-canvas's `registerFont`; falls back to `_fontFamily` / Arial if the TTF can't be parsed
- The label canvas is **padded** by `outlineWidth + shadowMag + max(4, fontSize × 0.15)` on each side and the PSD layer's `left/top/right/bottom` is shifted accordingly — this prevents bold/outline/shadow visual extents from being clipped at the node's contentSize boundary. (This was the "text edges clipped" bug.)

## Sidecar (`*.psd.psd2ui.json`)

```jsonc
{
  "_meta": { "tool": "prefab2psd", "engineVersion": "v342", "prefabName": "...", ... },
  "rootSize": { "width": 750, "height": 1334 },
  "nodes": {
    "MyUI/MainPanel/OkBtn": {
      "name": "OkBtn",
      "psdRect": { "left": ..., "top": ..., "right": ..., "bottom": ... },
      "components": [
        { "__type__": "cc.Sprite", "raw": { /* full serialized comp */ },
          "assetRefs": [...], "nodeRefs": [...],
          "embeddedImage": { "sourcePath": "...", "renderedMd5": "..." } },
        { "__type__": "MyCustomScript", "raw": { /* fields verbatim */ }, ... }
      ],
      ...
    }
  }
}
```

Stable IDs are the node's path from root (with `#N` suffix to disambiguate sibling collisions).

## Known limits (v0.1)

- Rotation / non-uniform parent scale don't change PSD geometry, only sidecar.
- Sidecar isn't read back by the importer yet — built-in components round-trip via `@xxx` + md5 cache; custom-component restoration needs follow-up importer work.
- Group-layer rect in PSD is degenerate (`[L,T,L,T]`) — cosmetic, Photoshop computes the bounding box from children.
