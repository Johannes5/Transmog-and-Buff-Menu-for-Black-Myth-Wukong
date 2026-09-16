// First-run installer: copies the bundled in-game part (mod loader, mod, keeper) into the game
// folder. The payload lives in <tool>/game/b1/... and is only present in release builds
// (npm run dist assembles it from a working install). Also: update detection, uninstall.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url)); // survives spaces and & in the folder name
export const PAYLOAD_DIR = path.resolve(here, '..', 'game');
export const WIN64 = path.join('b1', 'Binaries', 'Win64');
export const EXE = 'b1-Win64-Shipping.exe';
export const CONFIG_REL = path.join(WIN64, 'CSharpLoader', 'Mods', 'TrueWukong', 'TrueWukongConfig.txt');
/** Stamp written by `npm run dist`; installed together with the keeper, so it tells which payload a game folder has. */
export const STAMP_REL = path.join(WIN64, 'CSharpLoader', 'Mods', 'TransmogKeeper', 'payload.version');

export function hasPayload() {
  return fs.existsSync(path.join(PAYLOAD_DIR, WIN64, 'version.dll'));
}

const readStamp = (file) => { try { return fs.readFileSync(file, 'utf8').trim(); } catch { return null; } };
export const payloadVersion = () => readStamp(path.join(PAYLOAD_DIR, STAMP_REL));
export const installedVersion = (gameDir) => readStamp(path.join(gameDir, STAMP_REL));

/** The bundled in-game part is newer (or different) from what the game folder has. */
export function needsUpdate(gameDir) {
  if (!hasPayload() || !isInstalled(gameDir)) return false;
  const bundled = payloadVersion();
  return !!bundled && bundled !== installedVersion(gameDir);
}

/** Steam's own install folder from the registry (works when Steam is not under Program Files). */
function steamFromRegistry() {
  const out = [];
  for (const [hive, key] of [
    ['HKCU', 'HKCU\\Software\\Valve\\Steam'],
    ['HKLM', 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam'],
    ['HKLM', 'HKLM\\SOFTWARE\\Valve\\Steam'],
  ]) {
    try {
      const text = execFileSync('reg', ['query', key, '/v', hive === 'HKCU' ? 'SteamPath' : 'InstallPath'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const m = text.match(/REG_SZ\s+(.+)$/m);
      if (m) out.push(m[1].trim().replace(/\//g, '\\'));
    } catch { /* key missing */ }
  }
  return out;
}

/** Steam library roots from libraryfolders.vdf plus the usual defaults. */
export function steamLibraries() {
  const roots = [];
  const steamDirs = [
    ...steamFromRegistry(),
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Steam') : null,
  ].filter(Boolean);
  for (const dir of steamDirs) {
    const vdf = path.join(dir, 'steamapps', 'libraryfolders.vdf');
    if (!fs.existsSync(vdf)) continue;
    roots.push(dir);
    const text = fs.readFileSync(vdf, 'utf8');
    for (const m of text.matchAll(/"path"\s+"([^"]+)"/g)) roots.push(m[1].replace(/\\\\/g, '\\'));
  }
  return [...new Set(roots)];
}

/** Game folders that contain the game executable. */
export function findGameDirs() {
  const dirs = [];
  for (const root of steamLibraries()) {
    const g = path.join(root, 'steamapps', 'common', 'BlackMythWukong');
    if (fs.existsSync(path.join(g, WIN64, EXE))) dirs.push(g);
  }
  return dirs;
}

export function isGameDir(dir) {
  return !!dir && fs.existsSync(path.join(dir, WIN64, EXE));
}

export function isInstalled(gameDir) {
  return fs.existsSync(path.join(gameDir, CONFIG_REL)) && fs.existsSync(path.join(gameDir, WIN64, 'version.dll'));
}

/** Is the game running? (The loader files are locked while it is.) */
export function gameRunning() {
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq ' + EXE, '/NH'], { encoding: 'utf8', windowsHide: true });
    return out.toLowerCase().includes(EXE.toLowerCase());
  } catch {
    return false;
  }
}

/** Size and date of the game executable: changes when Steam updates the game. */
export function gameExeStamp(gameDir) {
  try {
    const st = fs.statSync(path.join(gameDir, WIN64, EXE));
    return `${st.size}:${Math.round(st.mtimeMs)}`;
  } catch { return null; }
}

/**
 * Copy the payload into the game folder. Existing files are backed up as <name>.bak once;
 * an existing TrueWukongConfig.txt is kept (the user's choices), everything else is replaced.
 * Returns a list of what was done.
 */
export function installInto(gameDir) {
  if (!hasPayload()) throw new Error('This copy of the tool has no bundled game files. Use the release zip from the mod page.');
  if (!isGameDir(gameDir)) throw new Error(`Not the game folder (no ${path.join(WIN64, EXE)} inside): ${gameDir}`);
  const done = [];
  const walk = (src, dst) => {
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, e.name), d = path.join(dst, e.name);
      if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); walk(s, d); continue; }
      if (e.name === 'TrueWukongConfig.txt' && fs.existsSync(d)) { done.push(`kept your existing config`); continue; }
      if (fs.existsSync(d) && !fs.existsSync(d + '.bak') && !sameFile(s, d)) { fs.copyFileSync(d, d + '.bak'); done.push(`backed up ${path.relative(gameDir, d)}`); }
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
    }
  };
  try {
    walk(PAYLOAD_DIR, gameDir);
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'EBUSY') {
      throw new Error(`Windows refused to write into ${gameDir}.\nMake sure the game is closed. If it is, right-click "Transmog & Buff Tool.bat" and choose "Run as administrator", then try again.`);
    }
    throw e;
  }
  done.push(`installed into ${gameDir}${payloadVersion() ? ` (in-game part ${payloadVersion().split(' ')[0]})` : ''}`);
  return done;
}

function sameFile(a, b) {
  try {
    const sa = fs.statSync(a), sb = fs.statSync(b);
    return sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch { return false; }
}

/** Files the installer put into the game folder, for the uninstall text. */
export function installedPaths(gameDir) {
  return [
    path.join(gameDir, WIN64, 'version.dll'),
    path.join(gameDir, WIN64, 'CSharpLoader'),
  ];
}

/**
 * Remove what the installer put into the game folder and put back what it replaced.
 *  - files replaced at install time exist as <name>.bak and are restored (another mod's loader or
 *    True Wukong stays usable);
 *  - our two mods are removed; the loader is removed only when no other loader mod remains and it
 *    was not there before.
 * Save games are never touched. Returns a list of what was done.
 */
export function uninstallFrom(gameDir) {
  if (!isGameDir(gameDir)) throw new Error(`Not the game folder: ${gameDir}`);
  const win64 = path.join(gameDir, WIN64);
  const loader = path.join(win64, 'CSharpLoader');
  const mods = path.join(loader, 'Mods');
  const done = [];
  const rm = (p) => { if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); done.push(`removed ${path.relative(gameDir, p)}`); } };
  const restoreBaks = (dir) => {
    if (!fs.existsSync(dir)) return 0;
    let n = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith('.bak')) continue;
      const bak = path.join(dir, e.name);
      fs.copyFileSync(bak, bak.slice(0, -4));
      fs.unlinkSync(bak);
      done.push(`restored ${path.relative(gameDir, bak.slice(0, -4))} from before the install`);
      n++;
    }
    return n;
  };

  // 1. the keeper (ours only)
  rm(path.join(mods, 'TransmogKeeper'));

  // 2. True Wukong: ours unless the user had it before (then .bak files exist inside)
  const tw = path.join(mods, 'TrueWukong');
  if (fs.existsSync(tw)) {
    const hadBefore = fs.readdirSync(tw).some((f) => f.endsWith('.bak'));
    for (const f of fs.readdirSync(tw)) {
      if (/^TrueWukongConfig\.txt\.bak-/.test(f)) fs.unlinkSync(path.join(tw, f)); // our dated backups
    }
    if (hadBefore) { restoreBaks(tw); done.push('kept your earlier True Wukong install'); }
    else rm(tw);
  }

  // 3. the loader: restore a foreign one, else remove ours when nothing else uses it
  const versionDll = path.join(win64, 'version.dll');
  if (fs.existsSync(versionDll + '.bak')) {
    restoreBaks(win64);
    restoreBaks(loader);
    done.push('kept the mod loader that was there before');
  } else {
    const others = fs.existsSync(mods) ? fs.readdirSync(mods).filter((m) => fs.readdirSync(path.join(mods, m)).length) : [];
    if (others.length) done.push(`kept the mod loader and CSharpLoader: other mods use it (${others.join(', ')})`);
    else {
      rm(versionDll);
      rm(path.join(win64, 'version.dll.off'));
      rm(loader);
    }
  }

  // 4. our logs and the live-values file
  for (const f of ['TrueWukongLog.txt', 'TransmogKeeperLog.txt', 'TransmogKeeperAttrs.txt', 'TransmogKeeperDebug.txt']) {
    const p = path.join(win64, f);
    if (fs.existsSync(p)) { fs.unlinkSync(p); done.push(`removed ${f}`); }
  }
  return done;
}
