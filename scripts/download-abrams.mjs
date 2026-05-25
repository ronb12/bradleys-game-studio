#!/usr/bin/env node
/**
 * Install CC-BY M1A1 Abrams GLB for Desert Tank Siege.
 *
 * Source: Sketchfab "Abrams M1A1 [Free]" by Quasar (@mansoorsajidp)
 * https://sketchfab.com/3d-models/abrams-m1a1-free-1b4a0b196df14e67bce38ed6fef7d944
 * License: CC Attribution 4.0
 *
 * Option A — API (recommended):
 *   1. Create a token: https://sketchfab.com/settings/password → API token
 *   2. SKETCHFAB_API_TOKEN=your_token node scripts/download-abrams.mjs
 *
 * Option B — Manual:
 *   1. Log in on Sketchfab, open the model URL above, click "Download 3D Model"
 *   2. Save the zip as: public/assets/.cache/abrams-m1a1-sketchfab.zip
 *   3. node scripts/download-abrams.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, 'public', 'assets', '.cache');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'packs', 'tanks');
const ZIP_MANUAL = path.join(CACHE, 'abrams-m1a1-sketchfab.zip');
const MODEL_UID = process.env.SKETCHFAB_MODEL_UID || '1b4a0b196df14e67bce38ed6fef7d944';

function findFiles(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) findFiles(p, ext, out);
    else if (name.toLowerCase().endsWith(ext)) out.push(p);
  }
  return out;
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function downloadSketchfabZip() {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) return null;
  const data = await fetchJson(`https://api.sketchfab.com/v3/models/${MODEL_UID}/download`, {
    Authorization: `Token ${token}`,
  });
  const glbUrl = data?.glb?.url;
  const gltfUrl = data?.gltf?.url;
  if (!glbUrl && !gltfUrl) throw new Error('No download URL in Sketchfab response');
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (glbUrl) {
    const res = await fetch(glbUrl);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const abramsGlb = path.join(OUT_DIR, 'abrams.glb');
    fs.writeFileSync(abramsGlb, buf);
    console.log('✓', path.relative(ROOT, abramsGlb), `(${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
    for (const alias of ['crusader.glb', 'scout.glb', 'behemoth.glb']) {
      fs.copyFileSync(abramsGlb, path.join(OUT_DIR, alias));
      console.log('✓', path.relative(ROOT, path.join(OUT_DIR, alias)), '(alias)');
    }
    return { type: 'glb' };
  }

  const zipPath = path.join(CACHE, 'abrams-m1a1-sketchfab.zip');
  const res = await fetch(gltfUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  console.log('✓ Downloaded glTF zip →', path.relative(ROOT, zipPath));
  return { type: 'zip', path: zipPath };
}

function extractZip(zipPath) {
  const extractDir = path.join(CACHE, 'abrams-m1a1-extract');
  fs.mkdirSync(extractDir, { recursive: true });
  execSync(`unzip -qo "${zipPath}" -d "${extractDir}"`, { stdio: 'inherit' });
  return extractDir;
}

function installFromExtract(extractDir) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const glbs = findFiles(extractDir, '.glb');
  const gltfs = findFiles(extractDir, '.gltf');
  const abramsGlb = path.join(OUT_DIR, 'abrams.glb');
  const abramsDir = path.join(OUT_DIR, 'abrams');

  if (glbs.length) {
    const src = glbs.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
    fs.copyFileSync(src, abramsGlb);
    console.log('✓', path.relative(ROOT, abramsGlb));
    for (const alias of ['crusader.glb', 'scout.glb', 'behemoth.glb']) {
      const dest = path.join(OUT_DIR, alias);
      fs.copyFileSync(src, dest);
      console.log('✓', path.relative(ROOT, dest), '(alias)');
    }
    return true;
  }

  if (gltfs.length) {
    const scene = gltfs.find((f) => /scene\.gltf$/i.test(f)) || gltfs[0];
    const srcDir = path.dirname(scene);
    if (fs.existsSync(abramsDir)) {
      for (const f of fs.readdirSync(abramsDir)) fs.rmSync(path.join(abramsDir, f), { recursive: true, force: true });
    } else fs.mkdirSync(abramsDir, { recursive: true });
    for (const f of fs.readdirSync(srcDir)) {
      fs.copyFileSync(path.join(srcDir, f), path.join(abramsDir, f));
    }
    console.log('✓', path.relative(ROOT, path.join(abramsDir, 'scene.gltf')), '(glTF pack — game loads this if .glb missing)');
    return true;
  }

  return false;
}

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const argZip = process.argv[2] && fs.existsSync(process.argv[2]) ? path.resolve(process.argv[2]) : null;
  let zipPath = argZip || (fs.existsSync(ZIP_MANUAL) ? ZIP_MANUAL : null);
  let apiResult = null;
  if (!zipPath) apiResult = await downloadSketchfabZip();

  if (apiResult?.type === 'glb') {
    console.log('\nDone. Hard-refresh Desert Tank Siege to see the Abrams GLB.');
    console.log('Attribution: see public/games/assets/CREDITS-TANKS.md');
    return;
  }
  if (apiResult?.type === 'zip') zipPath = apiResult.path;

  if (!zipPath) {
    console.log(`
No Abrams model installed yet.

Sketchfab model (CC-BY): https://sketchfab.com/3d-models/abrams-m1a1-free-${MODEL_UID}

Either:
  SKETCHFAB_API_TOKEN=xxx node scripts/download-abrams.mjs
Or save the Sketchfab download zip to:
  ${ZIP_MANUAL}
Then run this script again.

The game uses procedural M1A2 until abrams.glb exists.
`);
    process.exit(0);
  }

  const extractDir = extractZip(zipPath);
  if (!installFromExtract(extractDir)) {
    console.error('No .glb or .gltf found inside the archive.');
    process.exit(1);
  }

  console.log('\nDone. Hard-refresh Desert Tank Siege to see the Abrams GLB.');
  console.log('Attribution: see public/games/assets/CREDITS-TANKS.md');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
