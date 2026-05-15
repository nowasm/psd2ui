---
name: godot-tscn-to-psd
description: Reverse-export a Godot 4 .tscn scene to a Photoshop .psd using the tscn2psd standalone CLI. Embeds the scene's ExtResource Texture2D PNGs into PSD raster layers, encodes Godot node types as @xxx layer-name tags, and writes a sidecar JSON with the full node-property dump. Trigger when the user asks to turn a .tscn back into a PSD, edit a Godot scene's UI in Photoshop, or do "tscn → psd / Godot 反向导出 / scene to PSD".
---

# Godot 4 .tscn → PSD

The `tscn2psd/` directory is a self-contained Node CLI that parses `.tscn` (the INI-like Godot scene format), walks the node tree, embeds the textures referenced by `ExtResource("Texture2D")` into PSD layers, and writes:

1. `<name>.psd` — the PSD
2. `<name>.psd.tscn2psd.json` — sidecar with every node's full type/attrs/props + ext+sub resource refs + embedded texture metadata

It's the reverse of `psd-to-godot-tscn`. PSD → tscn → PSD round-trips visually-identically on tested scenes.

## When NOT to use this

- Cocos prefab → use `cocos-prefab-to-psd`.
- The user wants to keep editing in Godot, not Photoshop → don't bother.

## Setup (one-time)

The repo is an npm workspace. Run **one** install at the repo root, all 4 sibling tools share the same `node_modules/`:

```bash
cd <repo-root>
npm install
```

Sub-tool dirs do NOT get their own `node_modules/` after this — Node walks up to the root one. `canvas` needs a C++ toolchain (see psd-to-cocos-prefab skill for platform-specific notes).

## Invocation

```bash
node tscn2psd/tscn2psd.js \
  --input <tscn path or directory> \
  --godot-project <godot-project root> \
  [--output <psd output dir>] \
  [--canvas-size WxH]
```

Or use the wrapper: `tscn2psd/command.bat` / `command.sh`.

### Flags

| Flag (long / short) | Required | Notes |
| --- | --- | --- |
| `--input` `-in` | yes | `.tscn` file OR directory containing tscns (recursive) |
| `--godot-project` `-gp` | yes | Godot project root (folder containing `project.godot`); needed to resolve `res://` paths and scan `.png.import` for uid → file mapping |
| `--output` `-out` |  | PSD output dir; defaults to the tscn's own directory |
| `--canvas-size` |  | Override root canvas size as `WxH` (e.g. `1920x1080`). Default: read from root Control's `offset_right/bottom` |

The CLI also accepts `--json <base64>` for editor-style invocation.

## Godot node type → PSD layer-name tag mapping

(Reverse of `psd-to-godot-tscn`'s table.)

| Godot type | PSD encoding |
| --- | --- |
| `Control` / Container with children | group layer |
| `TextureRect` | raster leaf with `texture` ExtResource embedded |
| `TextureRect.flip_h = true` | `@flipX` |
| `TextureRect.flip_v = true` | `@flipY` |
| `NinePatchRect` | raster + `@.9{l:N,r:N,t:N,b:N}` from `patch_margin_*` |
| `TextureButton` | raster + `@Btn` (embeds `texture_normal`) |
| `TextureProgressBar` | group + `@ProgressBar`; expands `texture_under` → `<name>_bg` child, `texture_progress` → `<name>_bar@bar` child |
| `CheckBox` / `CheckButton` | `@Toggle` (no auto-synthesized `@check` child — relies on sidecar for theme info) |
| `Label` | text-rasterized layer (see below) |

Anything else (signals, themes, custom scripts, `theme_override_styles/*` StyleBoxes, sub_resources beyond textures) is **fully recorded in sidecar** but doesn't affect PSD geometry.

## Coordinate / scale handling

- Godot is already Y-down + top-left origin. **No coordinate flip needed** (this is the main difference from `cocos-prefab-to-psd`).
- Position computed in this priority order:
  1. Explicit `position` + `size` Vector2 properties
  2. Otherwise: `pos = parentSize * anchor + offset` for left/top + right/bottom
- Recognizes `anchors_preset = 0` (no anchor change) and `anchors_preset = 15` (full-rect; sets all anchors to 0/0/1/1). **Other presets are ignored** — read whatever `anchor_*` values are written explicitly.
- `scale = Vector2(x, y)` accumulates down the tree (`worldScale = parentWorldScale * localScale`); used to scale rect size and child position offsets.
- `rotation` is recorded in sidecar but does NOT change PSD geometry.

## Texture resolution

For each node's `texture` (or `texture_normal` for `TextureButton`, `texture_under`/`texture_progress` for `TextureProgressBar`):

1. Read `ExtResource("<id>")`.
2. Look up the matching `[ext_resource id="<id>" path="res://..." uid="uid://..."]` block.
3. Resolve `res://` to `<godot-project>/...`.
4. If the path is missing or the file doesn't exist, scan `<godot-project>/**/*.import` files for a matching `uid` and use the import's `source_file` instead.
5. Load the PNG via node-canvas, draw it onto a canvas of the node's PSD rect size (stretching as needed), embed in the PSD layer.

## Label rendering

Reads Godot 4 theme override props:

| Property | Effect |
| --- | --- |
| `text` | label content (multi-line via `\n`) |
| `theme_override_font_sizes/font_size` | font size (× worldScale) |
| `theme_override_colors/font_color` | text fill color (Godot Color is 0..1 floats, converted to 0..255) |
| `theme_override_constants/outline_size` | outline width (× worldScale) |
| `theme_override_colors/font_outline_color` | outline color |
| `theme_override_constants/shadow_offset_x/y` | shadow offset |
| `theme_override_constants/shadow_outline_size` | shadow blur |
| `theme_override_colors/font_shadow_color` | shadow color |
| `theme_override_fonts/font` (ExtResource → FontFile/Font/DynamicFont) | custom TTF (auto-registered via `canvas.registerFont`); falls back to Arial if the TTF can't be parsed by node-canvas |
| `horizontal_alignment` (0=left, 1=center, 2=right, 3=fill) | h-alignment |
| `vertical_alignment` (0=top, 1=center, 2=bottom, 3=fill) | v-alignment |

Label canvas is **padded** by `outlineWidth + max(|shadowOffset|, shadowBlur) + max(4, fontSize × 0.15)` and the PSD layer rect is shifted accordingly — prevents bold/outline/shadow glyph extents from being clipped at the node's `size` boundary.

## Sidecar (`*.psd.tscn2psd.json`)

```jsonc
{
  "_meta": { "tool": "tscn2psd", "engine": "godot4", "tscnName": "...", "sceneUid": "uid://...", ... },
  "rootSize": { "x": 750, "y": 1334 },
  "extResources": [ { "id": "1_btn", "type": "Texture2D", "uid": "uid://...", "path": "res://ui/btn.png" } ],
  "subResources": [ { "id": "...", "type": "...", "props": { ... } } ],
  "nodes": {
    "MyUI/OkBtn": {
      "name": "OkBtn", "type": "TextureButton", "parentPath": ".",
      "size": { "x": 200, "y": 80 }, "psdRect": { ... },
      "attrs": { ... }, "props": { ... },           // raw key=value strings
      "extResRefs": [ { "key": "texture_normal", "extId": "1_btn" } ],
      "subResRefs": [...],
      "embeddedTexture": { "sourceExtId": "...", "sourcePath": "...", "sourceUid": "..." }
    }
  }
}
```

Path keys mirror Godot's NodePath: `.` for root, `<name>` for direct child, `<parent>/<child>` for nested.

## Verified round-trip

Tested on a real `sample.psd` (`test/project/ui/sample.psd`):
1. `psd2tscn` → `sample.tscn` (9 ext_resources, 9 nodes including 3-level nesting `ui/footer/buttonN`)
2. `tscn2psd` → `sample.psd`
3. Hand-composited PSD pixels matched the original visually.

## Common gotchas

- **No `--godot-project`** → ext_resource paths can't be resolved → no textures embedded. The CLI requires it.
- **Position seems off** → make sure the .tscn was saved by Godot (or by `psd2tscn`). A hand-written .tscn that uses `position`+`size` rather than `offset_*` works too; the CLI handles both.
- **Container types** (HBoxContainer, VBoxContainer, GridContainer, MarginContainer) → the CLI doesn't run Godot's container layout logic; it reads whatever `offset_*` Godot saved. If the .tscn was never opened in Godot, container children may all be at (0, 0). Open the scene in Godot once to let it lay out + save.
- **Custom fonts that node-canvas can't parse** (newer TTF formats with variable axes, etc.) → log a warning, fall back to Arial. Visually approximate, not pixel-perfect — that's a known limit.
- **`anchors_preset` other than 0 or 15** → not handled; explicit `anchor_*` values are read instead. If the .tscn relies on a preset like `8` (center), positions will be wrong unless the scene also wrote out the resolved anchors.
