#!/usr/bin/env node
/** Rescan public/assets/packs for GLBs and rewrite manifest.json */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = path.join(ROOT, 'public', 'assets', 'packs');
const AUDIO = path.join(ROOT, 'public', 'assets', 'audio');

function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, ext, out);
    else if (name.toLowerCase().endsWith(ext)) out.push(p);
  }
  return out;
}

function addAll(set, ...vals) {
  vals.forEach((v) => set.add(v));
  return set;
}

function roleFor(name, pack) {
  const n = name.toLowerCase();
  if (pack === 'tanks') {
    if (/abrams|crusader|scout/i.test(n)) return 'player';
    if (/command|behemoth/i.test(n)) return 'boss';
    if (/panzer|t90|opfor|t-90/i.test(n)) return 'enemy';
    return 'vehicle';
  }
  if (pack === 'sketchfab') {
    if (/btr|tank/i.test(n)) return 'vehicle';
    return 'prop';
  }
  if (/character|soldier|fox|cesiumman/i.test(n)) return 'player';
  if (/truck|tank|vehicle|btr|abrams|panzer|crusader|scout/i.test(n)) return 'vehicle';
  if (/brain|behemoth|command|boss/i.test(n)) return 'boss';
  if (/coin|avocado|duck|collect|trophy|block-coin/i.test(n)) return 'collectible';
  if (/enemy|morph|panzer|t90|opfor/i.test(n)) return 'enemy';
  if (/weapon|rack|spear|sword/i.test(n)) return 'powerup';
  if (/platform|flag|checkpoint/i.test(n)) return 'prop';
  return 'prop';
}

function genresFor(name, pack) {
  const n = name.toLowerCase();
  const g = new Set(['prop']);

  if (pack === 'tanks') {
    addAll(g, 'tank', '3d tank battle', 'vehicle', 'military', 'top-down', 'fps');
    return [...g];
  }
  if (pack === 'sketchfab') {
    addAll(g, 'tank', '3d tank battle', 'military', 'fps', 'top-down', 'open world');
    return [...g];
  }
  if (pack === 'khronos') {
    if (/truck/i.test(n)) addAll(g, 'tank', 'racing', 'vehicle', 'enemy', '3d racing game');
    else if (/brain/i.test(n)) addAll(g, 'tank', 'horror', 'survival horror', 'enemy', 'boss', 'rpg');
    else if (/morph|box/i.test(n)) addAll(g, 'tank', 'enemy', 'puzzle', '3d puzzle platformer');
    else addAll(g, 'platformer', '3d platformer', 'enemy', 'player', 'rpg');
    return [...g];
  }
  if (pack.startsWith('kenney-platformer')) {
    addAll(g, 'platformer', '3d platformer', 'runner', '3d endless runner', 'mobile');
    return [...g];
  }
  if (pack.startsWith('kenney')) {
    addAll(g, 'arena', 'open world', 'top-down', 'fps', 'rpg', '3d top-down action');
    if (/wall|brick|column|block|floor|border|gate|banner|stairs|statue|tree|weapon/i.test(n))
      addAll(g, 'tank', 'military', '3d tank battle');
    if (/character|soldier|weapon|spear|sword/i.test(n))
      addAll(g, 'fps', '3d first-person shooter', 'stealth', '3d stealth action', 'rpg');
    return [...g];
  }
  return [...g];
}

function themesFor(name, pack) {
  const n = name.toLowerCase();
  const t = new Set();

  if (pack === 'tanks') {
    addAll(t, 'tank', 'military', 'warfare', 'desert', 'battlefield', 'combat');
    if (/abrams|crusader|scout/i.test(n)) addAll(t, 'hero', 'allied');
    if (/panzer|t90|opfor/i.test(n)) addAll(t, 'enemy', 'opfor');
    if (/behemoth|command/i.test(n)) addAll(t, 'boss');
    return [...t];
  }
  if (pack === 'sketchfab') {
    if (/desert|sand/i.test(n)) addAll(t, 'desert', 'military', 'warfare', 'battlefield');
    if (/military|crate|sandbag|btr/i.test(n)) addAll(t, 'military', 'base', 'combat', 'tank');
    if (/building/i.test(n)) addAll(t, 'city', 'ruins', 'urban', 'desert');
    return [...t];
  }
  if (pack === 'khronos') {
    if (/truck/i.test(n)) addAll(t, 'vehicle', 'military', 'racing', 'industrial');
    if (/brain/i.test(n)) addAll(t, 'horror', 'sci-fi', 'boss', 'creature');
    if (/duck|avocado|fox/i.test(n)) addAll(t, 'cute', 'collectible', 'fantasy');
    if (/cesium|fox/i.test(n)) addAll(t, 'hero', 'character');
    if (/morph|box/i.test(n)) addAll(t, 'puzzle', 'abstract', 'sci-fi');
    return [...t];
  }
  if (pack.startsWith('kenney-platformer')) {
    addAll(t, 'platformer', 'fantasy', 'colorful', 'outdoor', 'grass', 'sky');
    if (/coin|block-coin/i.test(n)) addAll(t, 'collectible');
    if (/character/i.test(n)) addAll(t, 'hero');
    if (/cloud|grass|flag/i.test(n)) addAll(t, 'outdoor', 'sky');
    return [...t];
  }
  if (pack.startsWith('kenney-basic')) {
    addAll(t, 'dungeon', 'medieval', 'arena', 'castle', 'ruins');
    if (/soldier|weapon|spear|sword|rack/i.test(n)) addAll(t, 'military', 'medieval', 'combat');
    if (/tree|grass/i.test(n)) addAll(t, 'forest', 'outdoor');
    if (/column|statue|wall|brick|gate|banner/i.test(n)) addAll(t, 'ruins', 'city', 'dungeon');
    if (/trophy/i.test(n)) addAll(t, 'victory', 'collectible');
    return [...t];
  }
  return [...t];
}

function audioThemes(name) {
  const n = name.toLowerCase();
  const t = ['sfx'];
  if (/coin|jump|land|fall|walk/i.test(n)) t.push('platformer', 'action', 'collectible');
  if (/break/i.test(n)) t.push('combat', 'destruction', 'tank');
  return [...new Set(t)];
}

const models = [];
for (const pack of fs.readdirSync(PACKS)) {
  const packDir = path.join(PACKS, pack);
  if (!fs.statSync(packDir).isDirectory()) continue;
  for (const src of walk(packDir, '.glb')) {
    const base = path.basename(src);
    const rel = '/assets/packs/' + pack + '/' + base;
    models.push({
      id: pack + '-' + base.replace(/\W/g, '-').toLowerCase(),
      path: rel,
      type: 'glb',
      pack,
      license: pack === 'khronos' ? 'Khronos glTF Sample Models' : 'CC0 (Kenney)',
      genres: genresFor(base, pack),
      themes: themesFor(base, pack),
      role: roleFor(base, pack),
    });
  }
}

const audio = [];
for (const src of walk(AUDIO, '.ogg').concat(walk(AUDIO, '.wav'))) {
  const base = path.basename(src);
  audio.push({
    id: 'sfx-' + base.replace(/\W/g, '-'),
    path: '/assets/audio/' + base,
    pack: 'kenney',
    license: 'CC0 (Kenney)',
    role: 'sfx',
    themes: audioThemes(base),
  });
}

const manifest = {
  version: 2,
  license:
    'Bundled CC0 / Khronos sample assets — same-origin /assets/ only. No Sketchfab, Unity Asset Store, or random URLs at runtime.',
  sources: [
    { name: 'Kenney.nl', license: 'CC0 1.0', url: 'https://kenney.nl/assets' },
    {
      name: 'Khronos glTF Sample Models',
      license: 'See Khronos repository',
      url: 'https://github.com/KhronosGroup/glTF-Sample-Models',
    },
  ],
  models,
  audio,
};

const outPath = path.join(ROOT, 'public', 'assets', 'manifest.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log('Wrote', models.length, 'models,', audio.length, 'audio →', outPath);
