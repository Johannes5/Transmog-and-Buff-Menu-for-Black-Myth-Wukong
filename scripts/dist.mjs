// Builds the release folder: dist/Transmog & Buff Tool/
//   node/node.exe              official Node.js runtime (downloaded from nodejs.org, checksum verified)
//   src/, node_modules/        the tool and its one dependency
//   game/b1/Binaries/Win64/    the in-game part, taken from a working install (--game <folder>):
//       version.dll, CSharpLoader/ (loader files), CSharpLoader/Mods/TrueWukong/ (patched mod,
//       lists, a clean config), CSharpLoader/Mods/TransmogKeeper/TransmogKeeper.dll
//   Transmog & Buff Tool.bat, README.md, docs/
// Users unpack the folder anywhere and double-click the .bat; the tool copies game/ into the game.
//
// usage: node scripts/dist.mjs [--node v24.19.0] [--game "X:\...\BlackMythWukong"]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const nodeVersion = arg('--node', process.version);
const gameDir = arg('--game', 'X:\\SteamLibrary\\steamapps\\common\\BlackMythWukong');
const distRoot = path.join(root, 'dist');
const out = path.join(distRoot, 'Transmog & Buff Tool');
const cache = path.join(distRoot, 'cache');
fs.mkdirSync(cache, { recursive: true });
// Clear the release folder. If the folder itself is held open (Explorer, a console window inside it),
// clear its contents instead so the build still succeeds.
const nodeDir = path.join(out, 'node');
const versionFile = path.join(nodeDir, 'VERSION.txt');
const keepNode = fs.existsSync(path.join(nodeDir, 'node.exe')) && fs.existsSync(versionFile) && fs.readFileSync(versionFile, 'utf8').startsWith(`Node.js ${nodeVersion} `);
try {
  if (keepNode) {
    for (const entry of fs.readdirSync(out)) if (entry !== 'node') fs.rmSync(path.join(out, entry), { recursive: true, force: true });
  } else fs.rmSync(out, { recursive: true, force: true });
} catch (e) {
  if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e;
  console.log('release folder is in use; replacing what can be replaced');
  for (const entry of fs.readdirSync(out)) {
    if (entry === 'node') continue;
    fs.rmSync(path.join(out, entry), { recursive: true, force: true });
  }
}
fs.mkdirSync(out, { recursive: true });

// ---- 1. Node runtime ----
if (keepNode) {
  console.log(`node ${nodeVersion} already in place, kept`);
} else {
  const zipName = `node-${nodeVersion}-win-x64.zip`;
  const zipPath = path.join(cache, zipName);
  const base = `https://nodejs.org/dist/${nodeVersion}/`;
  if (!fs.existsSync(zipPath)) {
    console.log(`downloading ${base}${zipName} ...`);
    const res = await fetch(base + zipName);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  }
  const sums = await (await fetch(base + 'SHASUMS256.txt')).text();
  const expected = sums.split('\n').find((l) => l.endsWith(zipName))?.split(/\s+/)[0];
  const actual = createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
  if (!expected || expected !== actual) throw new Error(`checksum mismatch for ${zipName}`);
  const extractDir = path.join(cache, 'extract');
  if (!fs.existsSync(path.join(extractDir, `node-${nodeVersion}-win-x64`, 'node.exe'))) {
    fs.rmSync(extractDir, { recursive: true, force: true });
    execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extractDir}' -Force`], { stdio: 'inherit' });
  }
  fs.mkdirSync(nodeDir, { recursive: true });
  fs.copyFileSync(path.join(extractDir, `node-${nodeVersion}-win-x64`, 'node.exe'), path.join(nodeDir, 'node.exe'));
  fs.copyFileSync(path.join(extractDir, `node-${nodeVersion}-win-x64`, 'LICENSE'), path.join(nodeDir, 'LICENSE'));
  fs.writeFileSync(versionFile, `Node.js ${nodeVersion} win-x64 from ${base}${zipName}\nsha256 ${actual}\n`);
  console.log(`node ${nodeVersion} ok`);
}

// ---- 2. the tool ----
const copy = (rel) => fs.cpSync(path.join(root, rel), path.join(out, rel), { recursive: true });
for (const rel of ['src', 'docs', 'README.md', 'LICENSE', 'package.json', 'Transmog & Buff Tool.bat']) copy(rel);
// The only dependency is @inquirer/prompts; the repo has no dev dependencies, so node_modules is copied as is.
fs.cpSync(path.join(root, 'node_modules'), path.join(out, 'node_modules'), { recursive: true, filter: (s) => !/\.(md|markdown|ts|map)$/i.test(s) });
console.log('tool files ok');

// ---- 3. in-game part from a working install ----
const win64 = path.join(gameDir, 'b1', 'Binaries', 'Win64');
const dstWin64 = path.join(out, 'game', 'b1', 'Binaries', 'Win64');
const must = (p) => { if (!fs.existsSync(p)) throw new Error(`missing in source install: ${p}`); return p; };
fs.mkdirSync(dstWin64, { recursive: true });
fs.copyFileSync(must(path.join(win64, 'version.dll')), path.join(dstWin64, 'version.dll'));
// loader files (everything in CSharpLoader except Mods)
fs.cpSync(must(path.join(win64, 'CSharpLoader')), path.join(dstWin64, 'CSharpLoader'), {
  recursive: true,
  filter: (s) => !/[\\/]CSharpLoader[\\/]Mods([\\/]|$)/.test(s) && !/\.(log|bak)$/i.test(s),
});
// loader ini: full mode by default
const ini = path.join(dstWin64, 'CSharpLoader', 'b1cs.ini');
if (fs.existsSync(ini)) fs.writeFileSync(ini, fs.readFileSync(ini, 'utf8').replace(/^EnableJit\s*=.*$/m, 'EnableJit=1'));
// the mod: patched dll + lists + a clean config
const modSrc = must(path.join(win64, 'CSharpLoader', 'Mods', 'TrueWukong'));
const modDst = path.join(dstWin64, 'CSharpLoader', 'Mods', 'TrueWukong');
fs.mkdirSync(modDst, { recursive: true });
for (const f of fs.readdirSync(modSrc)) {
  if (f === 'TrueWukong.dll' || /^TrueWukong-.*\.txt$/.test(f)) fs.copyFileSync(path.join(modSrc, f), path.join(modDst, f));
}
must(path.join(modDst, 'TrueWukong.dll'));
let cfgText = fs.readFileSync(must(path.join(modSrc, 'TrueWukongConfig.txt')), 'utf8');
for (const key of ['staffTransmog', 'spearTransmog', 'addTalents', 'keeperAttr', 'keeperSoaks', 'keeperBuffs', 'recentBuffs', 'recentValues']) cfgText = cfgText.replace(new RegExp(`^${key} = .*$`, 'm'), `${key} = 0`);
for (const [key, val] of Object.entries({ healthRegen: 0, manaRegen: 0, spiritRegen: 0, vesselRegen: 0, focusRegen: 0, wukongSpeed: 1, attackMultiplier: 1, defenseMultiplier: 1, attackMultiplierAlt: 1, defenseMultiplierAlt: 1 })) {
  cfgText = cfgText.replace(new RegExp(`^${key} = .*$`, 'm'), `${key} = ${val}`);
}
// saved looks the release starts with (chosen by the author for the public release)
const PUBLIC_LOOKS = 'Gold Serpent=15003,10501,10342,10823,10824,18008;red=15003,11541,11542,11543,11544,18008;Training Gear=15003,10101,10202,10603,10604,18008;Centipede Serpent=15021,11901,10342,10603,11804,18001;Chapter 4 Venom=15013,11001,10802,17009,11404,18007';
// the tool's own keys, visible in the shipped config (F7 cycles saved looks by default; the default named buffs)
const { DEFAULT_PRESETS, formatPresets } = await import('../src/presets.js');
const { GRIP_KEY, GRIP_COMMENT, STANCE_KEY, STANCE_COMMENT } = await import('../src/config.js');
for (const [key, val, comment] of [
  ['keeperOutfits', PUBLIC_LOOKS, 'TransmogKeeper only: saved looks "Name=ids;Name=ids" (see wukong-transmog outfits)'],
  ['keeperOutfitKey', 'F7', 'TransmogKeeper only: key that puts on the next saved look in game, e.g. F7 or Ctrl+F7 (None = off); Shift + it shows the real gear'],
  [STANCE_KEY, 'None', STANCE_COMMENT],
  [GRIP_KEY, 'None', GRIP_COMMENT],
  ['keeperPresets', formatPresets(DEFAULT_PRESETS), 'named buffs: Name{talents=ids;soaks=ids;values=key:on:off;key=F8} (see wukong-transmog presets)'],
]) {
  const line = new RegExp(`^${key} = .*$`, 'm');
  const commented = new RegExp(`^# .* #\\r?\\n${key} = .*$`, 'm'); // refresh the comment too: its wording changes between versions
  if (commented.test(cfgText)) cfgText = cfgText.replace(commented, () => `# ${comment} #\r\n${key} = ${val}`);
  else if (line.test(cfgText)) cfgText = cfgText.replace(line, () => `${key} = ${val}`);
  else cfgText = cfgText.replace(/\s*$/, '') + `\r\n\r\n# ${comment} #\r\n${key} = ${val}\r\n`;
}
fs.writeFileSync(path.join(modDst, 'TrueWukongConfig.txt'), cfgText);
// the patched DLL must carry the marker the tool looks for (src/mod.js); the release ships no .orig
if (!fs.readFileSync(path.join(modDst, 'TrueWukong.dll')).includes(Buffer.from('TransmogTool-patched', 'utf16le'))) {
  throw new Error('TrueWukong.dll in the source install is not patched with the current patcher (no marker). Run: npm run patch-mod');
}
// the keeper
const keeper = must(path.join(root, 'keeper', 'bin', 'TransmogKeeper.dll'));
const keeperDst = path.join(dstWin64, 'CSharpLoader', 'Mods', 'TransmogKeeper');
fs.mkdirSync(keeperDst, { recursive: true });
fs.copyFileSync(keeper, path.join(keeperDst, 'TransmogKeeper.dll'));
// version stamp: installed with the keeper, so the tool can tell an outdated in-game part (src/install.js)
const toolVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
fs.writeFileSync(path.join(keeperDst, 'payload.version'), `${toolVersion} ${new Date().toISOString().slice(0, 10)}\n`);
console.log(`in-game part ok (payload ${toolVersion})`);

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`\nrelease folder: ${out}\nsize: ${(size(out) / 1024 / 1024).toFixed(1)} MB (zip it for upload)`);
