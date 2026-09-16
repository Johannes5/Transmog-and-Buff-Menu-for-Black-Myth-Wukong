// State of the in-game part: loader on/off, JIT (full/lite mode), patched mod DLL, keeper.
//   full : EnableJit=1, loader active  -> whole mod (hooks + transmog); breaks trainers (FLiNG, WeMod...)
//   lite : EnableJit=0, loader active  -> no hooks; looks, buffs and regen via the keeper; trainer-friendly
//   off  : version.dll renamed         -> loader not loaded at all; pure vanilla
import fs from 'node:fs';
import path from 'node:path';

/** The patcher embeds this text in TrueWukong.dll (as a string constant, UTF-16); the release ships no .orig. */
export const PATCH_MARKER = 'TransmogTool-patched';

export function modPaths(cfgFile) {
  const modDir = path.dirname(cfgFile);
  const win64 = path.resolve(modDir, '..', '..', '..');
  return {
    win64,
    modDir,
    ini: path.join(win64, 'CSharpLoader', 'b1cs.ini'),
    loader: path.join(win64, 'version.dll'),
    loaderOff: path.join(win64, 'version.dll.off'),
    modDll: path.join(modDir, 'TrueWukong.dll'),
    modOrig: path.join(modDir, 'TrueWukong.dll.orig'),
    talentList: path.join(modDir, 'TrueWukong-TalentList.txt'),
    keeperDll: path.join(modDir, '..', 'TransmogKeeper', 'TransmogKeeper.dll'),
    modLog: path.join(win64, 'TrueWukongLog.txt'),
    keeperLog: path.join(win64, 'TransmogKeeperLog.txt'),
    snapshot: path.join(win64, 'TransmogKeeperAttrs.txt'),
  };
}

/** Patched = carries the marker, or (developer install) differs from the kept original. */
export function isPatched(p) {
  if (!fs.existsSync(p.modDll)) return false;
  try {
    if (fs.readFileSync(p.modDll).includes(Buffer.from(PATCH_MARKER, 'utf16le'))) return true;
  } catch { /* unreadable */ }
  return fs.existsSync(p.modOrig) && fs.statSync(p.modOrig).size !== fs.statSync(p.modDll).size;
}

export function readJit(ini) {
  if (!fs.existsSync(ini)) return null;
  const m = fs.readFileSync(ini, 'utf8').match(/^EnableJit\s*=\s*(\d)/m);
  return m ? m[1] === '1' : null;
}

export function modState(p) {
  const loaderOn = fs.existsSync(p.loader);
  const loaderOff = fs.existsSync(p.loaderOff);
  const jit = readJit(p.ini);
  const patched = isPatched(p);
  const keeper = fs.existsSync(p.keeperDll);
  const mode = !loaderOn ? 'off' : jit ? 'full' : 'lite';
  return { loaderOn, loaderOff, jit, patched, keeper, mode };
}

export const keeperInstalled = (cfgFile) => fs.existsSync(modPaths(cfgFile).keeperDll);
export const trainerMode = (cfgFile) => modState(modPaths(cfgFile)).mode === 'lite';

/** Switch mode; the caller checks that the game is closed. Returns a warning text or null. */
export function setMode(p, want) {
  const st = modState(p);
  if (want === 'off') {
    if (st.loaderOn) fs.renameSync(p.loader, p.loaderOff);
    return null;
  }
  if (!st.loaderOn && st.loaderOff) fs.renameSync(p.loaderOff, p.loader);
  if (!fs.existsSync(p.loader)) throw new Error('version.dll not found; reinstall the in-game part (Options > Game folder).');
  const ini = fs.existsSync(p.ini) ? fs.readFileSync(p.ini, 'utf8') : '[Settings]\r\n';
  const val = want === 'full' ? '1' : '0';
  const next = /^EnableJit\s*=/m.test(ini) ? ini.replace(/^EnableJit\s*=.*$/m, `EnableJit=${val}`) : ini.trimEnd() + `\r\nEnableJit=${val}\r\n`;
  fs.writeFileSync(p.ini, next, 'utf8');
  if (want === 'lite' && !st.patched) return 'TrueWukong.dll is not the prepared (patched) version; in lite mode the unpatched mod fails to load.';
  return null;
}

/** Last lines of a text file, for the status screen. */
export function tailLines(file, n = 8) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-n);
  } catch { return []; }
}
