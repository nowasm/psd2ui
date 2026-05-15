---
name: psd-to-cocos-prefab
description: Convert Photoshop .psd files to Cocos Creator 3.4+ (or 2.4.x) prefab + .png + .meta using the standalone psd2prefab Node CLI. Trigger when the user asks to turn a PSD into a Cocos prefab/UI, mentions psd2prefab / psd2ui / ccc-tnt-psd2ui (legacy plugin name), or has a .psd they want to import into a Cocos project.
---

# psd → Cocos Creator prefab

The `psd2prefab/` directory in this repo is a standalone Node CLI that walks a PSD's layers, splits images by md5, and emits a `.prefab` + per-image `.png` + `.png.meta` set ready for Cocos Creator to import.

It used to be packaged as a Cocos editor plugin (`ccc-tnt-psd2ui-v3.4.+` and `-v2.4.x`). Both plugin shells are gone — this is now a pure CLI, mirroring the structure of `prefab2psd / tscn2psd / psd2tscn`.

## When NOT to use this

- The user wants a Godot scene → use `psd-to-godot-tscn`.
- The reverse direction (`.prefab` → PSD) → use `cocos-prefab-to-psd`.
- The PSD has no `@xxx` layer-name tags AND no clean group structure → output may be garbage. Tell the user to follow the README's layer-name conventions first.

## Setup (one-time)

The repo is an npm workspace. Run **one** install at the repo root, then `npm run build` once to compile this tool's TypeScript:

```bash
cd <repo-root>
npm install                 # installs deps for all 4 tools into root node_modules/
npm run build               # compiles psd2prefab TypeScript → psd2prefab/dist/
```

Sub-tool dirs do NOT get their own `node_modules/` — Node walks up to the root one when running `node psd2prefab/dist/index.js`. `canvas` is a native module — needs platform C++ toolchain. See `psd2prefab/README.md` for platform-specific notes.

## Invocation

```bash
node psd2prefab/dist/index.js \
  --input <psd file or dir> \
  --project-assets <cocos-project>/assets \
  --cache <cocos-project>/local/psd-to-prefab-cache.json \
  --engine-version v342 \
  --pinyin
```

Wrapper: `psd2prefab/command.bat` (Windows) / `command.sh` (mac/linux). They check `node_modules` and `dist/` exist, then `node dist/index.js "$@"`.

### Flags

| Flag | Required | Notes |
| --- | --- | --- |
| `--input` | yes | `.psd` file OR directory containing PSDs (recursive) |
| `--project-assets` | yes | Cocos project's `assets/` dir; outputs land here unless `--output` given |
| `--cache` |  | `local/psd-to-prefab-cache.json` — md5→spriteFrameUuid cache, makes re-imports skip same-image re-export |
| `--engine-version` |  | `v342` for Cocos 3.4+ (default), `v249` for Cocos 2.4.x |
| `--output` |  | Override output dir; defaults to `<psd-dir>` |
| `--pinyin` |  | Strongly recommended — converts Chinese layer names to pinyin so node names / file paths are ASCII |
| `--force-img` |  | Re-export images even if md5 already cached |
| `--img-only` |  | Slice images only, do not generate `.prefab` (export-only mode) |
| `--config` |  | Path to `psd.config.json` (text Y offset tuning, default font, etc.) |
| `--init` |  | Just scan `--project-assets` to seed the cache; no PSD conversion |

CLI also accepts `--json <base64>` where the base64-decoded JSON is the args object — convenience for upstream tooling.

## Layer-name conventions

(Fully documented in the root `README.md`.)

| Tag | Purpose |
| --- | --- |
| `@Btn` / `@btn` | Wrap node in `cc.Button` |
| `@Toggle` / `@toggle` (group) + `@check` (child sprite) | `cc.Toggle` + checkmark |
| `@ProgressBar` / `@progressBar` (group) + `@bar` (child sprite) | `cc.ProgressBar` |
| `@.9{l:N,r:N,t:N,b:N}` | 9-slice border for `cc.Sprite` |
| `@ar{x:N,y:N}` | Anchor point (default 0.5/0.5) |
| `@full` | Full-rect node (Widget anchored to all edges) |
| `@img{name,id,bind}` | Image options + cross-layer bind |
| `@flip` / `@flipX` / `@flipY` | Flip a referenced image (no extra image export) |
| `@ignore` / `@ignorenode` / `@ignoreimg` | Skip node and/or image |

Multiple tags can stack on one layer: `<name>@Btn@ar{x:1,y:1}@.9{l:8,r:8,t:8,b:8}`.

## Outputs

For a PSD `MyUI.psd`, output relative to `--output` (or `<psd-dir>`):

```
MyUI/
  MyUI.prefab          # the Cocos prefab JSON
  MyUI.prefab.meta
  textures/
    <md5>.png          # one per unique image (filename = md5 of pixel bytes)
    <md5>.png.meta
```

The `.meta` files contain stable Cocos uuids derived per-PSD; idempotent across runs.

## md5 cache

`local/psd-to-prefab-cache.json` is keyed by md5 of the exported PNG bytes:

```json
{
  "<md5>": { "path": "...", "textureUuid": "...", "uuid": "...", "isOutput": true }
}
```

On every run the importer recomputes md5 of each layer's pixels; if the md5 is already in the cache, it reuses the existing texture uuid and skips writing the PNG. This is also how `cocos-prefab-to-psd` makes the round-trip work — it pre-populates the cache with predicted md5s so re-imports of the generated PSD short-circuit.

## Common gotchas

- **CocosCreator must be closed (or the assets reloaded)** when overwriting prefabs/PNGs in `assets/` — the editor caches them.
- **`--engine-version v342`** is the default; pass `v249` only for legacy Cocos 2.4.x projects.
- **Output dir must NOT be inside `<cocos-project>/assets`** if you're writing while the editor is open — Cocos may grab the file mid-write.
- **First run on a project should be `--init` only** to seed the md5 cache from existing project PNGs; then run real conversions.
- **Build step required**: `npm run build` produces `dist/index.js`. If you cloned fresh and skipped this, the CLI complains.
- **TypeScript source lives in `psd2prefab/src/`**, build output in `psd2prefab/dist/`. Both tracked in git so users can run `node dist/index.js` immediately after `npm install`. If you edit `src/`, run `npm run build` (or `npm run watch`) before re-testing.
