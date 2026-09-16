// "doctor": one pass over everything that can go wrong, with a verdict. Replaces the manual
// troubleshooting steps (open two logs, check files) from the README.
import fs from 'node:fs';
import path from 'node:path';
import { modPaths, modState } from './mod.js';
import { readConfig, KEYS } from './config.js';
import { readAttrSnapshot } from './values.js';
import { itemById } from './data.js';
import { gameRunning, gameExeStamp, installedVersion, payloadVersion, hasPayload, PAYLOAD_DIR, WIN64 } from './install.js';
import { readSettings } from './settings.js';

const OTHER_PROXIES = ['dinput8.dll', 'dsound.dll', 'winmm.dll', 'xinput1_3.dll', 'dxgi.dll', 'd3d12.dll', 'd3d11.dll'];

const ago = (ms) => {
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s} s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 172800) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};

const mtime = (file) => { try { return fs.statSync(file).mtimeMs; } catch { return null; } };
const grep = (file, re) => { try { return re.test(fs.readFileSync(file, 'utf8')); } catch { return false; } };
const lastMatch = (file, re) => { try { const m = fs.readFileSync(file, 'utf8').match(re); return m ? m[m.length - 1] : null; } catch { return null; } };

/**
 * @returns {{ checks: {level: 'ok'|'warn'|'fail', text: string}[], verdict: string }}
 */
export function runDoctor(cfgFile, gameDir) {
  const p = modPaths(cfgFile);
  const st = modState(p);
  const checks = [];
  const ok = (text) => checks.push({ level: 'ok', text });
  const warn = (text) => checks.push({ level: 'warn', text });
  const fail = (text) => checks.push({ level: 'fail', text });
  const running = gameRunning();

  // --- files ---
  ok(`game folder: ${gameDir}`);
  if (st.loaderOn) ok('mod loader (version.dll) is in place');
  else if (st.loaderOff) fail('mod loader is disabled (version.dll.off): Options > Trainer compatibility or "mod full" turns it back on');
  else fail('mod loader missing: version.dll is not next to the game exe. Reinstall via Options > Game folder (antivirus may have quarantined it)');
  if (hasPayload() && st.loaderOn) {
    const bundled = path.join(PAYLOAD_DIR, WIN64, 'version.dll');
    try {
      if (fs.statSync(bundled).size !== fs.statSync(p.loader).size) warn('version.dll differs from the bundled loader: another mod\'s loader or a different CSharpLoader version. Two loaders crash the game on start; keep one');
    } catch { /* ignore */ }
  }
  const found = OTHER_PROXIES.filter((f) => fs.existsSync(path.join(p.win64, f)));
  if (found.length) warn(`other DLL hooks next to the game exe: ${found.join(', ')} (ReShade, trainers or other loaders). Usually fine; if the game crashes on start, remove them one at a time`);
  if (st.jit === null) fail('CSharpLoader\\b1cs.ini missing or without EnableJit');
  else ok(`mode: ${st.mode}${st.mode === 'lite' ? ' (trainer compatibility on: looks, buffs and regen via the keeper; attack/defense multipliers off)' : st.mode === 'full' ? ' (hooks on; trainers may fail to attach)' : ''}`);
  if (!fs.existsSync(p.modDll)) fail('TrueWukong.dll missing in CSharpLoader\\Mods\\TrueWukong');
  else if (st.patched) ok('TrueWukong.dll is the prepared version');
  else warn('TrueWukong.dll is not the prepared version: Ctrl+Enter needs Tab twice to apply and trainer compatibility mode cannot load the mod. Reinstall via Options > Game folder');
  if (!fs.existsSync(p.talentList)) warn('TrueWukong-TalentList.txt missing: buffs can only be picked by raw ID');
  if (st.keeper) ok('TransmogKeeper is installed (looks re-apply on their own)');
  else warn('TransmogKeeper not installed: looks need Ctrl+Enter in game, buffs and locks do nothing in trainer compatibility mode');
  const inst = installedVersion(gameDir), bundled = payloadVersion();
  if (bundled && inst && bundled !== inst) warn(`installed in-game part (${inst.split(' ')[0]}) differs from the bundled one (${bundled.split(' ')[0]}): start the menu once with the game closed to update it`);

  // --- config ---
  let cfg;
  try { cfg = readConfig(cfgFile); ok('config readable'); } catch (e) { fail(`config unreadable: ${e.message}`); }
  if (cfg) {
    if (cfg.outfits.staff.join() !== cfg.outfits.spear.join()) warn(`staffTransmog and spearTransmog differ; the keeper follows staffTransmog, Tab would change the look. Any save from the menu makes them equal`);
    const unknown = cfg.outfits.staff.filter((id) => itemById(id).name.startsWith('Unknown'));
    if (unknown.length) warn(`unknown transmog IDs in the config: ${unknown.join(', ')} (edited by hand?)`);
    const gourds = cfg.outfits.staff.filter((id) => /unconfirmed/.test(itemById(id).name));
    if (gourds.length) warn(`gourd look ${gourds.join(', ')} is unconfirmed and may show nothing`);
    if (!cfg.outfits.staff.length && !cfg.talents.length) ok('no transmog and no buffs configured (nothing to apply yet)');
  }

  // --- the game itself ---
  const settings = readSettings();
  const exeNow = gameExeStamp(gameDir);
  if (settings.gameExe && exeNow && settings.gameExe !== exeNow) warn('the game executable changed since the in-game part was installed (game update). If looks stop applying, check the mod page for a tool update');
  ok(running ? 'game is running' : 'game is not running');

  // --- logs ---
  const modLogAt = mtime(p.modLog);
  if (!modLogAt) {
    if (st.loaderOn) warn('TrueWukongLog.txt does not exist: the game has not been started with the loader yet, or the loader is not loading (antivirus?)');
  } else if (grep(p.modLog, /Main mod loaded/i)) ok(`True Wukong loaded (log written ${ago(Date.now() - modLogAt)})`);
  else warn(`TrueWukongLog.txt has no "Main mod loaded" line (written ${ago(Date.now() - modLogAt)}); last lines are shown below`);
  const kLogAt = mtime(p.keeperLog);
  if (st.keeper) {
    if (!kLogAt) warn('TransmogKeeperLog.txt does not exist: the keeper never started (game not started since install, or loader not loading)');
    else {
      const applied = lastMatch(p.keeperLog, /\[(\d\d:\d\d:\d\d)[^\]]*\]\[TransmogKeeper\]: Applied [\d,]+/g);
      if (applied) ok(`keeper applied a look (${applied.match(/Applied [\d,]+/)[0]}, log written ${ago(Date.now() - kLogAt)})`);
      else if (cfg?.outfits.staff.length) warn(`keeper log has no "Applied" line yet (written ${ago(Date.now() - kLogAt)}): load a save and wait a few seconds, or see the last lines below`);
      else ok(`keeper running (log written ${ago(Date.now() - kLogAt)})`);
      const err = lastMatch(p.keeperLog, /\]: (?:\w+ error|tick error|config error)[^\n]*/g);
      if (err) warn(`keeper reported: ${err.slice(3, 160)}`);
      const gaveUp = lastMatch(p.keeperLog, /Talent (\d+) was not accepted[^\n]*/g);
      if (gaveUp) warn(`buff ${gaveUp.match(/\d+/)[0]} is refused by the game on the current character (it is skipped)`);
    }
  }
  const snap = readAttrSnapshot(cfgFile);
  if (running && st.keeper && (!snap || snap.stale)) warn('game runs but the keeper has not written live values in the last 3 min: no save loaded, or the keeper is not running');

  const fails = checks.filter((c) => c.level === 'fail').length;
  const warns = checks.filter((c) => c.level === 'warn').length;
  const verdict = fails ? `${fails} problem${fails > 1 ? 's' : ''} found; fix the lines marked "!!" first.`
    : warns ? `No blocker. ${warns} thing${warns > 1 ? 's' : ''} worth a look (marked "!").`
      : 'Everything looks right. If a look still does not show, pick a base-tier item (some tiers have no mesh).';
  return { checks, verdict, paths: p };
}
