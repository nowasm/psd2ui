// 生成最小化的 Godot 4 项目 fixture：project.godot + ui/btn.png + .png.import + MyUI.tscn
// 用法：node test/build-fixture.js

'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const projectRoot = path.join(__dirname, 'project');
const uiDir = path.join(projectRoot, 'ui');
fs.mkdirSync(uiDir, { recursive: true });

// project.godot 占位
fs.writeFileSync(path.join(projectRoot, 'project.godot'),
    '[application]\nconfig/name="tscn2psd test"\nconfig/features=PackedStringArray("4.0")\n');

// 32x32 红色圆 PNG
const c = createCanvas(32, 32);
const ctx = c.getContext('2d');
ctx.fillStyle = '#cc3333';
ctx.beginPath();
ctx.arc(16, 16, 14, 0, Math.PI * 2);
ctx.fill();
fs.writeFileSync(path.join(uiDir, 'btn.png'), c.toBuffer('image/png'));

// btn.png.import
const btnUid = 'uid://b1234abcdefgh';
fs.writeFileSync(path.join(uiDir, 'btn.png.import'),
`[remap]

importer="texture"
type="CompressedTexture2D"
uid="${btnUid}"

[deps]

source_file="res://ui/btn.png"

[params]

compress/mode=0
`);

// MyUI.tscn
// 节点结构：
//   MyUI (Control, 750x1334, anchors_preset=0)
//     Bg (NinePatchRect, 600x800 居中, patch_margin_*=4)
//     OkBtn (TextureButton, 200x80 居中靠下)
//       Label (Label, 100x40, "OK")

const tscn = `[gd_scene load_steps=2 format=3 uid="uid://scene12345abc"]

[ext_resource type="Texture2D" uid="${btnUid}" path="res://ui/btn.png" id="1_btn"]

[node name="MyUI" type="Control"]
layout_mode = 3
anchors_preset = 0
offset_right = 750
offset_bottom = 1334

[node name="Bg" type="NinePatchRect" parent="."]
layout_mode = 1
anchors_preset = 0
offset_left = 75
offset_top = 67
offset_right = 675
offset_bottom = 867
texture = ExtResource("1_btn")
patch_margin_left = 4
patch_margin_top = 4
patch_margin_right = 4
patch_margin_bottom = 4

[node name="OkBtn" type="TextureButton" parent="."]
layout_mode = 1
anchors_preset = 0
offset_left = 275
offset_top = 927
offset_right = 475
offset_bottom = 1007
texture_normal = ExtResource("1_btn")
ignore_texture_size = true
stretch_mode = 0

[node name="Label" type="Label" parent="OkBtn"]
layout_mode = 1
anchors_preset = 0
offset_left = 50
offset_top = 20
offset_right = 150
offset_bottom = 60
text = "OK"
horizontal_alignment = 1
vertical_alignment = 1
theme_override_font_sizes/font_size = 32
theme_override_colors/font_color = Color(0, 0, 0, 1)
`;

fs.writeFileSync(path.join(uiDir, 'MyUI.tscn'), tscn);
console.log('Fixture generated under', projectRoot);
