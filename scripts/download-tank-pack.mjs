#!/usr/bin/env node
/**
 * Optional CC0 tank GLBs for Desert Tank Siege.
 *
 * 1. Download Quaternius "Animated Tanks Pack" (CC0) from:
 *    https://quaternius.com/packs/animatedtanks.html
 * 2. Save the zip as: public/assets/.cache/AnimatedTanksPack.zip
 * 3. Run: node scripts/download-tank-pack.mjs
 *
 * Copies up to 5 GLB files into public/assets/packs/tanks/ with game-friendly names.
 * The game falls back to procedural camo tanks if files are missing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, 'public', 'assets', '.cache');
const OUT = path.join(ROOT, 'public', 'assets', 'packs', 'tanks');
const ZIP = path.join(CACHE, 'AnimatedTanksPack.zip');

const NAME_MAP = [
  ['scout', /scout|light|small/i],
  ['crusader', /medium|crusader|green/i],
  ['behemoth', /heavy|large|big/i],
  ['panzer', /red|enemy|panzer/i],
  ['command', /blue|command|boss/i],
];

function findGlbs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) findGlbs(p, out);
    else if (name.toLowerCase().endsWith('.glb')) out.push(p);
  }
  return out;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(CACHE, { recursive: true });

  if (!fs.existsSync(ZIP)) {
    console.log('Place AnimatedTanksPack.zip at:\n ', ZIP);
    console.log('Download (CC0): https://quaternius.com/packs/animatedtanks.html\n');
    console.log('Game uses procedural tanks until GLBs are installed.');
    process.exit(0);
  }

  const extractDir = path.join(CACHE, 'animated-tanks-extract');
  fs.mkdirSync(extractDir, { recursive: true });
  execSync(`unzip -qo "${ZIP}" -d "${extractDir}"`, { stdio: 'inherit' });
  const glbs = findGlbs(extractDir);
  if (!glbs.length) {
    console.error('No .glb files found in zip.');
    process.exit(1);
  }

  const used = new Set();
  for (const [dest, pattern] of NAME_MAP) {
    const match = glbs.find((g) => pattern.test(path.basename(g)) && !used.has(g));
    const src = match || glbs.find((g) => !used.has(g));
    if (!src) break;
    used.add(src);
    const destPath = path.join(OUT, `${dest}.glb`);
    fs.copyFileSync(src, destPath);
    console.log('✓', path.relative(ROOT, destPath), '←', path.basename(src));
  }

  console.log(`\nDone. ${used.size} tank GLBs in public/assets/packs/tanks/`);
  console.log('Run: node scripts/rebuild-manifest.mjs');
}

main();
