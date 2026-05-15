---
name: psd-to-godot-tscn
description: Convert Photoshop .psd files into Godot 4 .tscn scenes (Control node tree) + .png + .png.import using the psd2tscn standalone CLI. Trigger when the user asks to turn a PSD into a Godot scene/UI, mentions psd2tscn, has a .psd they want to import into a Godot 4 project, or works in a Godot project (project.godot present) and is creating UI from art.
---

# psd → Godot 4 .tscn

The `psd2tscn/` directory is a self-contained Node CLI (no Cocos / no Godot editor dependency) that walks a PSD's layers and emits a `.tscn` Control-node tree, plus per-layer `.png` and `.png.import` (with stable Godot `uid://`).

Same `@xxx` layer-name vocabulary as the Cocos importer — designed so a single PSD can target both Cocos and Godot.

## When NOT to use this

- Cocos prefab → use `psd-to-cocos-prefab`.
- Reverse direction (`.tscn` → PSD) → use `godot-tscn-to-psd`.

## Setup (one-time)

The repo is an npm workspace. Run **one** install at the repo root, all 4 sibling tools share the same `node_modules/`:

```bash
cd <repo-root>
npm install
```

Sub-tool dirs do NOT get their own `node_modules/` after this — Node walks up to root. `canvas` needs a C++ toolchain. See its README troubleshooting if `npm install` fails.

## Invocation

```bash
node psd2tscn/psd2tscn.js \
  --input <path-to-psd-or-dir> \
  --output <godot-project>/ui \
  --godot-project <godot-project> \
  --cache <godot-project>/.psd2tscn-cache.json \
  --pinyin
```

Or use the wrapper: `psd2tscn/command.bat` / `command.sh`.

### Flags

| Flag (long / short) | Required | Notes |
| --- | --- | --- |
| `--input` `-in` | yes | `.psd` file OR directory containing PSDs |
| `--output` `-out` |  | Output directory; if omitted, creates `psd2tscn/` next to the PSD |
| `--godot-project` `-gp` | strongly recommended | Godot project root (folder containing `project.godot`). Determines `res://` base. Without it, generated `path` fields fall back to bare filenames |
| `--cache` `-c` |  | Cache file path; recommended to point at `<godot-project>/.psd2tscn-cache.json`. Reuses uids across runs so re-imports don't generate duplicate texture assets |
| `--cache-remake` `-crm` |  | Force a full rescan of `<godot-project>` `.png.import` files to rebuild the cache |
| `--init` `-i` |  | Only seed the cache from existing `.png.import`, no PSD conversion. Must be combined with `--godot-project` and `--cache` |
| `--force-img` `-fimg` |  | Re-export images even if cached |
| `--pinyin` `-py` |  | **Recommended.** Convert Chinese layer names to pinyin so `res://` paths stay ASCII |
| `--img-only` |  | Slice images only, no `.tscn` |
| `--godot-font-path` `-gf` |  | `res://fonts/MyFont.ttf` — sets the default Label font (`theme_override_fonts/font`). Requires Godot has already imported that ttf |
| `--config` |  | `psd.config.json` for default font / text Y offset / etc. (see psd2tscn/README.md) |

## Recommended workflow

First time on a project:

```bash
# 1. Seed cache from existing project assets (optional but avoids duplicate uids)
node psd2tscn/psd2tscn.js --init \
  --godot-project /path/to/godot-project \
  --cache /path/to/godot-project/.psd2tscn-cache.json

# 2. Real conversion
node psd2tscn/psd2tscn.js \
  --input ./screen-login.psd \
  --output /path/to/godot-project/ui \
  --godot-project /path/to/godot-project \
  --cache /path/to/godot-project/.psd2tscn-cache.json \
  --pinyin
```

After the first run only step 2 is needed; the cache rolls.

## PSD layer-name tag → Godot 4 mapping

| Tag | Godot output |
| --- | --- |
| (group layer) | `Control` |
| (image layer) | `TextureRect` (`expand_mode = 1`, `stretch_mode = 0`) |
| text layer | `Label` (`theme_override_font_sizes/font_size`, `theme_override_colors/font_color`) |
| `@.9{l,r,t,b}` | `NinePatchRect` + `patch_margin_*` (keeps full original image, no slicing) |
| `@ar{x,y}` | `pivot_offset = Vector2(size.x*x, size.y*y)` |
| `@full` | `anchors_preset = 15` + `anchor_right/bottom = 1` + `grow_*=2` |
| `@flipX{bind}` / `@flipY{bind}` | `TextureRect.flip_h` / `flip_v = true` |
| `@img{bind:N}` | Reuses the bound layer's `ExtResource` id + `uid://` |
| opacity < 255 | `modulate = Color(1, 1, 1, opacity/255)` |
| `@Btn` on image | `TextureButton` (`texture_normal`, `ignore_texture_size = true`, `stretch_mode = 0`) |
| `@Btn` on group/text | warn — not auto-mapped, leave to user |
| `@ProgressBar` + child `@bar` | `TextureProgressBar` — `@bar`'s texture → `texture_progress`, BG sprite → `texture_under`, child nodes get removed |
| `@Toggle` + child `@check` | `CheckBox` placeholder (does NOT preserve textures, just the type) |
| `@ignore` / `@ig` | Skip node + image |
| `@ignorenode` / `@ignode` | Skip node, keep image |
| `@ignoreimg` / `@igimg` | Skip image, keep node |

## Outputs

For PSD `MyUI.psd` with `--output /godot-project/ui`:

```
/godot-project/ui/MyUI/
  MyUI.tscn
  textures/
    sky.png
    sky.png.import
    button1.png
    button1.png.import
    ...
```

Godot will auto-reimport on next open (the `.import` files reference paths/uids it expects).

## Default font handling

PSD doesn't embed fonts. Set the default Godot font two ways:

**Option A — CLI:**
```
--godot-font-path res://fonts/MyFont.ttf
```
Reads `<godot-project>/fonts/MyFont.ttf.import` to extract `uid` + `type`, applies to every Label.

**Option B — `psd.config.json`:**
```json
{
  "godot": {
    "defaultFont": {
      "uid": "uid://abc...",
      "path": "res://fonts/MyFont.ttf",
      "type": "FontFile"
    }
  },
  "textOffsetY": { "default": 0, "36": -2 },
  "textLineHeightOffset": 0
}
```

Either way, the `.ttf` must already have a `.import` (open Godot once after adding it).

## Common gotchas

- **`canvas` native build failures** → install the platform's C++ toolchain. See psd2tscn/README.md "一次性安装" section.
- **`Cannot find module 'ag-psd'`** → didn't run `npm install` at the repo root. The repo is an npm workspace; sub-tools rely on root `node_modules/`.
- **Bilingual layer names with Chinese** → pass `--pinyin`, otherwise `res://` paths break.
- **`@.9 + @flip` together** → NinePatchRect doesn't support flip. Warn-and-ignore the flip; user has to choose.
- **`@Btn` on a group** → not auto-mapped; user needs to put `@Btn` on the BG image layer instead.
- **Cache key is layer name, NOT md5** (despite what the README's "工具特性" section suggests). Same name = same uid. Different name = new uid even if pixel-identical.
- **First run on a project should be `--init`** to seed cache from existing project pngs/imports.
