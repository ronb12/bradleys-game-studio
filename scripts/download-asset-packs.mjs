#!/usr/bin/env node
/**
 * Downloads CC0 asset packs into public/assets/ (same-origin for generated games).
 * Sources: Kenney (CC0), Khronos glTF Sample Models (permissive).
 * Run: node scripts/download-asset-packs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
const PACKS = path.join(ASSETS, 'packs');
const AUDIO = path.join(ASSETS, 'audio');

const KHRONOS_BASE = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0';
const KHRONOS_GLBS = [
  { file: 'CesiumMan.glb', url: `${KHRONOS_BASE}/CesiumMan/glTF-Binary/CesiumMan.glb`, tags: ['platformer', 'rpg', 'arena', 'fps', 'enemy', 'player'] },
  { file: 'Fox.glb', url: `${KHRONOS_BASE}/Fox/glTF-Binary/Fox.glb`, tags: ['platformer', 'runner', 'enemy', 'player'] },
  { file: 'CesiumMilkTruck.glb', url: `${KHRONOS_BASE}/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb`, tags: ['tank', 'racing', 'vehicle', 'enemy'] },
  { file: 'Avocado.glb', url: `${KHRONOS_BASE}/Avocado/glTF-Binary/Avocado.glb`, tags: ['collectible', 'prop'] },
  { file: 'BoxTextured.glb', url: `${KHRONOS_BASE}/BoxTextured/glTF-Binary/BoxTextured.glb`, tags: ['prop', 'crate', 'collectible'] },
  { file: 'Duck.glb', url: `${KHRONOS_BASE}/Duck/glTF-Binary/Duck.glb`, tags: ['prop', 'collectible'] },
  { file: 'BrainStem.glb', url: `${KHRONOS_BASE}/BrainStem/glTF-Binary/BrainStem.glb`, tags: ['horror', 'enemy', 'boss'] },
  { file: 'AnimatedMorphCube.glb', url: `${KHRONOS_BASE}/AnimatedMorphCube/glTF-Binary/AnimatedMorphCube.glb`, tags: ['enemy', 'prop', 'puzzle'] },
];

const ZIP_SOURCES = [
  {
    id: 'kenney-platformer-3d',
    url: 'https://codeload.github.com/KenneyNL/Starter-Kit-3D-Platformer/zip/refs/heads/main',
    genres: ['platformer', 'mobile', 'puzzle'],
    glbGlob: ['**/*.glb', '**/*.gltf'],
  },
  {
    id: 'kenney-basic-scene',
    url: 'https://codeload.github.com/KenneyNL/Starter-Kit-Basic-Scene/zip/refs/heads/main',
    genres: ['open world', 'arena', 'top-down'],
    glbGlob: ['**/*.glb', '**/*.gltf'],
  },
];

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  await pipeline(res.body, createWriteStream(dest));
  console.log('  ✓', path.relative(ROOT, dest));
}

function findFiles(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) findFiles(p, ext, out);
    else if (name.toLowerCase().endsWith(ext)) out.push(p);
  }
  return out;
}

function copyKenneyTextures(extractDir, destRoot) {
  const textures = findFiles(extractDir, '.png').filter((p) =>
    /textures?\/colormap\.png$/i.test(p.replace(/\\/g, '/'))
  );
  if (!textures.length) return;
  const destTex = path.join(destRoot, 'Textures', 'colormap.png');
  if (!fs.existsSync(destTex)) {
    fs.mkdirSync(path.dirname(destTex), { recursive: true });
    fs.copyFileSync(textures[0], destTex);
    console.log('  ✓ texture', path.relative(ROOT, destTex));
  }
}

function copyKenneyModels(zipId, extractDir, genres) {
  const entries = [];
  const glbs = findFiles(extractDir, '.glb').concat(findFiles(extractDir, '.gltf'));
  const destRoot = path.join(PACKS, zipId);
  copyKenneyTextures(extractDir, destRoot);
  let n = 0;
  for (const src of glbs.slice(0, 40)) {
    const base = path.basename(src);
    const dest = path.join(destRoot, base);
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    entries.push({
      id: `${zipId}-${n++}`,
      path: `/assets/packs/${zipId}/${base}`,
      type: base.endsWith('.gltf') ? 'gltf' : 'glb',
      pack: zipId,
      license: 'CC0 (Kenney)',
      genres,
      role: n === 1 ? 'player' : n < 4 ? 'enemy' : 'prop',
    });
  }
  return entries;
}

async function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execSync(`unzip -qo "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
  const subs = fs.readdirSync(destDir).filter((n) => fs.statSync(path.join(destDir, n)).isDirectory());
  return subs.length === 1 ? path.join(destDir, subs[0]) : destDir;
}

async function main() {
  console.log('Bradley\'s Game Studio — asset pack downloader\n');
  fs.mkdirSync(PACKS, { recursive: true });
  fs.mkdirSync(AUDIO, { recursive: true });

  const manifest = {
    version: 1,
    license: 'Bundled CC0 / permissive sample assets — same-origin only (/assets/...). No runtime Sketchfab or random URLs.',
    sources: [
      { name: 'Kenney.nl', license: 'CC0 1.0', url: 'https://kenney.nl/assets' },
      { name: 'Khronos glTF Sample Models', license: 'Various (see Khronos repo)', url: 'https://github.com/KhronosGroup/glTF-Sample-Models' },
    ],
    models: [],
    audio: [],
  };

  const khronosDir = path.join(PACKS, 'khronos');
  fs.mkdirSync(khronosDir, { recursive: true });
  console.log('Downloading Khronos GLB samples…');
  for (const item of KHRONOS_GLBS) {
    const dest = path.join(khronosDir, item.file);
    if (!fs.existsSync(dest)) {
      try {
        await download(item.url, dest);
      } catch (e) {
        console.warn('  ⚠ skip', item.file, e.message);
        continue;
      }
    }
    manifest.models.push({
      id: `khronos-${item.file.replace(/\W/g, '-')}`,
      path: `/assets/packs/khronos/${item.file}`,
      type: 'glb',
      pack: 'khronos',
      license: 'Khronos glTF Sample Models',
      genres: item.tags,
      role: item.tags.includes('player') ? 'player' : item.tags.includes('tank') ? 'vehicle' : item.tags.includes('collectible') ? 'collectible' : 'prop',
    });
  }

  const cacheZip = path.join(ASSETS, '.cache');
  fs.mkdirSync(cacheZip, { recursive: true });

  for (const zip of ZIP_SOURCES) {
    console.log(`\nDownloading ${zip.id}…`);
    const zipFile = path.join(cacheZip, `${zip.id}.zip`);
    const extractBase = path.join(cacheZip, zip.id);
    try {
      if (!fs.existsSync(zipFile)) await download(zip.url, zipFile);
      const extracted = await extractZip(zipFile, extractBase);
      const added = copyKenneyModels(zip.id, extracted, zip.genres);
      manifest.models.push(...added);
      console.log(`  → ${added.length} models from ${zip.id}`);
    } catch (e) {
      console.warn(`  ⚠ ${zip.id} failed:`, e.message);
    }
  }

  // Kenney interface sounds (small CC0 pack via GitHub mirror)
  const audioZip = 'https://codeload.github.com/KenneyNL/Starter-Kit-3D-Platformer/zip/refs/heads/main';
  const audioExtract = path.join(cacheZip, 'audio-scan');
  try {
    const zf = path.join(cacheZip, 'platformer-audio.zip');
    if (!fs.existsSync(zf)) await download(audioZip, zf);
    await extractZip(zf, audioExtract);
    const oggs = findFiles(audioExtract, '.ogg').concat(findFiles(audioExtract, '.wav'));
    let ai = 0;
    for (const src of oggs.slice(0, 24)) {
      const base = path.basename(src);
      const dest = path.join(AUDIO, base);
      if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
      manifest.audio.push({
        id: `sfx-${ai++}`,
        path: `/assets/audio/${base}`,
        pack: 'kenney',
        license: 'CC0 (Kenney)',
        role: base.includes('coin') ? 'collect' : base.includes('jump') ? 'jump' : base.includes('hurt') ? 'hurt' : 'sfx',
      });
    }
    console.log(`\nAudio: ${manifest.audio.length} files in public/assets/audio/`);
  } catch (e) {
    console.warn('Audio extract:', e.message);
  }

  const manifestPath = path.join(ASSETS, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${manifest.models.length} models, ${manifest.audio.length} sounds`);
  console.log('Manifest:', path.relative(ROOT, manifestPath));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
