#!/usr/bin/env node
/**
 * Download CC-BY / CC0 / Sketchfab Standard models for Desert Tank Siege.
 * Only installs models that are free and commercially usable (no NC/ND).
 *
 * Usage:
 *   SKETCHFAB_API_TOKEN=xxx node scripts/download-sketchfab-pack.mjs
 *   node scripts/download-sketchfab-pack.mjs --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, 'public', 'assets', '.cache', 'sketchfab');
const TANK_OUT = path.join(ROOT, 'public', 'assets', 'packs', 'tanks');
const PROP_OUT = path.join(ROOT, 'public', 'assets', 'packs', 'sketchfab');

/** uid → outfile (relative to packs/) */
const MANIFEST = [
  // Friendly — CC-BY
  { uid: '1b4a0b196df14e67bce38ed6fef7d944', out: 'tanks/abrams.glb', name: 'Abrams M1A1 [Free]' },
  { uid: 'cb822cb1b13043a4b953a87df05b235e', out: 'tanks/scout.glb', name: 'Low poly M1 Abrams' },
  { uid: '14df36cf1c3d4ac48ef09a0e502852e5', out: 'tanks/crusader.glb', name: 'M1 Abrams' },
  { uid: '283791f26b034b92816f850757fbf403', out: 'tanks/behemoth.glb', name: 'Low poly M1 Abrams (detail)' },
  // OPFOR — CC-BY
  { uid: '3f521cf2d2204bd095c4fce86c384846', out: 'tanks/panzer.glb', name: 'T90 Low-poly tank' },
  { uid: 'ba8b84d78c0a42038cf2eaa4210ef296', out: 'tanks/command.glb', name: 'KV-2 heavy tank 1940' },
  { uid: '60eaa0e780e742e3bdd46fe405487178', out: 'tanks/t90a.glb', name: 'Battlefield 4 - T-90A' },
  { uid: '308346f4741a48018c93ebe6f8e53905', out: 'tanks/opfor-light.glb', name: 'Low Poly Tank' },
  // Props — CC-BY / Sketchfab Standard (commercial OK on platform)
  { uid: '953e5ea65a7148c79fac9e7912930d43', out: 'sketchfab/desert-building.glb', name: 'Desert Building' },
  { uid: '3f4d0ec9510244bab16bbd0916a3495b', out: 'sketchfab/sandbags.glb', name: 'Military Sandbag Barrier' },
  { uid: 'c5370ce0ab5a47ac838e391c03afbd99', out: 'sketchfab/military-crate.glb', name: 'Military Crate' },
  { uid: '32145d6303e5487e9d92097b9845ef02', out: 'sketchfab/btr80.glb', name: 'Abandoned Soviet BTR-80' },
];

const DRY_RUN = process.argv.includes('--dry-run');

function isCommercialLicense(lic) {
  if (!lic) return false;
  const slug = (lic.slug || '').toLowerCase();
  const label = (lic.label || '').toLowerCase();
  const full = (lic.fullName || '').toLowerCase();
  const text = `${slug} ${label} ${full}`;
  if (/non[- ]?commercial|\bnc\b|-nc/.test(text)) return false;
  if (/no derivatives/.test(text) && !/share.?alike|by-sa/.test(text)) return false;
  if (slug === 'by' || slug === 'cc0' || slug === 'by-sa') return true;
  if (slug === 'free-st' || label.includes('free standard')) return true;
  if (label.includes('attribution') && !label.includes('non')) return true;
  return false;
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function findFiles(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) findFiles(p, ext, out);
    else if (name.toLowerCase().endsWith(ext)) out.push(p);
  }
  return out;
}

async function verifyModel(uid) {
  const m = await fetchJson(`https://api.sketchfab.com/v3/models/${uid}`);
  const ok = m.isDownloadable && isCommercialLicense(m.license);
  return { ok, name: m.name, license: m.license, author: m.user?.displayName, authorUrl: m.user?.profileUrl };
}

async function downloadModel(uid, destPath) {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) throw new Error('Set SKETCHFAB_API_TOKEN (https://sketchfab.com/settings/password)');
  const data = await fetchJson(`https://api.sketchfab.com/v3/models/${uid}/download`, {
    Authorization: `Token ${token}`,
  });
  const glbUrl = data?.glb?.url;
  const gltfUrl = data?.gltf?.url;
  if (!glbUrl && !gltfUrl) throw new Error('No download URL');

  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  if (glbUrl) {
    const res = await fetch(glbUrl);
    if (!res.ok) throw new Error(`GLB download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    return { bytes: buf.length, type: 'glb' };
  }

  const zipPath = path.join(CACHE, `${uid}.zip`);
  fs.mkdirSync(CACHE, { recursive: true });
  const res = await fetch(gltfUrl);
  if (!res.ok) throw new Error(`glTF zip download ${res.status}`);
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  const extractDir = path.join(CACHE, `${uid}-extract`);
  fs.mkdirSync(extractDir, { recursive: true });
  execSync(`unzip -qo "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
  const glbs = findFiles(extractDir, '.glb');
  if (!glbs.length) throw new Error('No .glb in glTF archive');
  const src = glbs.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  fs.copyFileSync(src, destPath);
  return { bytes: fs.statSync(destPath).size, type: 'gltf-zip' };
}

async function main() {
  fs.mkdirSync(TANK_OUT, { recursive: true });
  fs.mkdirSync(PROP_OUT, { recursive: true });
  fs.mkdirSync(CACHE, { recursive: true });

  const results = [];
  for (const item of MANIFEST) {
    const dest = path.join(ROOT, 'public', 'assets', 'packs', item.out);
    process.stdout.write(`\n→ ${item.name} (${item.uid.slice(0, 8)}…)\n`);
    try {
      const meta = await verifyModel(item.uid);
      if (!meta.ok) {
        console.log('  SKIP — not downloadable or license not commercial');
        results.push({ ...item, status: 'skip-license' });
        continue;
      }
      console.log(`  License: ${meta.license?.label || meta.license?.slug}`);
      if (DRY_RUN) {
        console.log(`  DRY-RUN would write ${path.relative(ROOT, dest)}`);
        results.push({ ...item, status: 'dry-run', meta });
        continue;
      }
      const { bytes, type } = await downloadModel(item.uid, dest);
      console.log(`  ✓ ${path.relative(ROOT, dest)} (${(bytes / 1024 / 1024).toFixed(2)} MB, ${type})`);
      results.push({ ...item, status: 'ok', bytes, meta });
    } catch (e) {
      console.log(`  ✗ ${e.message}`);
      results.push({ ...item, status: 'error', error: e.message });
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const skip = results.filter((r) => r.status === 'skip-license').length;
  const err = results.filter((r) => r.status === 'error').length;
  console.log(`\nDone: ${ok} installed, ${skip} skipped, ${err} failed.`);
  console.log('Credits: public/games/assets/CREDITS-TANKS.md');
  if (err && !process.env.SKETCHFAB_API_TOKEN) {
    console.log('\nTip: export SKETCHFAB_API_TOKEN from https://sketchfab.com/settings/password');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
